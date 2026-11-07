<?php
declare(strict_types=1);
// Rate Calculation Engine — configurable per vendor

class RateCalculator {
    private ?PDO $pdo;
    private int $vendorId;
    private int $batchId;
    private array $config;
    private string $vendorName;

    public function __construct(?PDO $pdo, int $vendorId, int $batchId, string $vendorName = '') {
        $this->pdo = $pdo;
        $this->vendorId = $vendorId;
        $this->batchId = $batchId;
        $this->vendorName = $vendorName;
        $this->config = $pdo ? getVendorCalcConfig($pdo, $vendorId) : [];
    }

    public function getCountryAliases(string $country): array {
        $c = trim($country);
        $norm = strtolower($c);
        $aliases = [$c];

        $map = [
            'usa' => ['USA', 'United States', 'United States of America', 'US', 'U.S.A.', 'U.S.', 'U.S.A.(Single Package)'],
            'united states' => ['USA', 'United States', 'United States of America', 'US', 'U.S.A.', 'U.S.', 'U.S.A.(Single Package)'],
            'united states of america' => ['USA', 'United States', 'United States of America', 'US', 'U.S.A.', 'U.S.', 'U.S.A.(Single Package)'],
            'us' => ['USA', 'United States', 'United States of America', 'US', 'U.S.A.', 'U.S.', 'U.S.A.(Single Package)'],
            'uk' => ['UK', 'United Kingdom', 'Great Britain', 'GB', 'U.K.', 'U.K.(EXPRESS)', 'U.K.(Single Package)', 'U.K. (Single Package)'],
            'united kingdom' => ['UK', 'United Kingdom', 'Great Britain', 'GB', 'U.K.', 'U.K.(EXPRESS)', 'U.K.(Single Package)', 'U.K. (Single Package)'],
            'great britain' => ['UK', 'United Kingdom', 'Great Britain', 'GB', 'U.K.', 'U.K.(EXPRESS)', 'U.K.(Single Package)', 'U.K. (Single Package)'],
            'gb' => ['UK', 'United Kingdom', 'Great Britain', 'GB', 'U.K.', 'U.K.(EXPRESS)', 'U.K.(Single Package)', 'U.K. (Single Package)'],
            'uae' => ['UAE', 'United Arab Emirates', 'U.A.E.', 'Dubai'],
            'united arab emirates' => ['UAE', 'United Arab Emirates', 'U.A.E.', 'Dubai'],
            'canada' => ['Canada', 'CA', 'CAN'],
            'ca' => ['Canada', 'CA', 'CAN'],
            'australia' => ['Australia', 'AU', 'AUS'],
            'au' => ['Australia', 'AU', 'AUS'],
            'new zealand' => ['New Zealand', 'NZ', 'NZL'],
            'nz' => ['New Zealand', 'NZ', 'NZL'],
        ];

        if (isset($map[$norm])) {
            foreach ($map[$norm] as $alias) {
                if (!in_array($alias, $aliases, true)) {
                    $aliases[] = $alias;
                }
            }
        }
        return $aliases;
    }

    public function isCountryZonewise(string $country): bool {
        if ($this->pdo === null) return false;
        $country = trim($country);
        if ($country === '') return false;

        $aliases = $this->getCountryAliases($country);
        $placeholders = implode(',', array_fill(0, count($aliases), '?'));

        // 1. Check if vendor_zone_rows contains postcode-to-zone mappings for this country
        $st = $this->pdo->prepare(
            "SELECT COUNT(*) FROM vendor_zone_rows 
             WHERE vendor_id = ? AND batch_id = ? 
               AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))"
        );
        $st->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country]));
        if ((int)$st->fetchColumn() > 0) {
            return true;
        }

        // 2. Check if vendor_rate_rows has zonewise rates specifically assigned to this country
        $st2 = $this->pdo->prepare(
            "SELECT COUNT(*) FROM vendor_rate_rows 
             WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' 
               AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))"
        );
        $st2->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country]));
        return (int)$st2->fetchColumn() > 0;
    }

    public function getZonewiseCountries(): array {
        if ($this->pdo === null) return [];
        $st = $this->pdo->prepare(
            "SELECT DISTINCT country FROM (
                SELECT country FROM vendor_zone_rows 
                WHERE vendor_id = ? AND batch_id = ? AND country IS NOT NULL AND country != ''
                UNION
                SELECT country FROM vendor_rate_rows 
                WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' AND country IS NOT NULL AND country != ''
             ) as zc ORDER BY country"
        );
        $st->execute([$this->vendorId, $this->batchId, $this->vendorId, $this->batchId]);
        return array_column($st->fetchAll(), 'country');
    }

    public function calculate(string $country, string $serviceCode, float $weightKg, ?string $postcode = null, ?string $state = null): array {
        // Step 1: Validate inputs
        if ($weightKg <= 0) {
            return $this->error('Weight must be greater than 0 kg.');
        }
        if (empty($country)) {
            return $this->error('Destination country is required.');
        }
        if (empty($serviceCode)) {
            return $this->error('Service code is required.');
        }

        $country = trim($country);
        $serviceCode = trim($serviceCode);
        $postcode = clean($postcode);
        $state = clean($state);

        // Step 2: Determine if this destination country uses zone-wise pricing
        $isZonewiseCountry = $this->isCountryZonewise($country);

        // Step 3: Determine rate type availability (strictly country-wise)
        $hasRegular = $this->hasRates('regular', $serviceCode, $country);
        $hasZonewise = $this->hasRates('zonewise', $serviceCode, $country);

        // Step 4: Resolve zone ONLY if destination country is zone-wise and postcode OR state was provided
        $zone = null;
        $zoneDetails = null;
        if ($isZonewiseCountry && (!empty($postcode) || !empty($state))) {
            $zoneDetails = $this->resolveZoneDetails($country, $postcode, $state);
            $zone = $zoneDetails['zone'] ?? null;
        }

        // Step 5: Execute calculation based on resolved availability
        // 5A: If zone resolved and zonewise tariff exists, use zone-wise pricing
        if ($zone !== null && $hasZonewise) {
            return $this->calculateZonewise($country, $serviceCode, $weightKg, $postcode, $zone, $zoneDetails);
        }

        // 5B: If regular rates exist for this service and country, use regular rates!
        // (Even if service code is on zonewise for other countries, regular rates NEVER demand a postcode)
        if ($hasRegular) {
            return $this->calculateRegular($country, $serviceCode, $weightKg);
        }

        // 5C: Destination country is zone-wise, service only has zone-wise rates, but neither postcode nor state was provided
        if ($isZonewiseCountry && $hasZonewise && empty($postcode) && empty($state)) {
            return $this->error("Destination '{$country}' uses zone-wise pricing for service '{$serviceCode}'. Please provide a destination postcode or state.");
        }

        // 5D: Destination country is zone-wise, service only has zone-wise rates, but postcode/state could not be mapped
        if ($isZonewiseCountry && $hasZonewise && (!empty($postcode) || !empty($state))) {
            $loc = trim(($postcode ?: '') . ($postcode && $state ? ' / ' : '') . ($state ?: ''));
            return $this->error("No shipping zone found for location '{$loc}' in destination '{$country}'.");
        }

        // 5E: No rate data found
        return $this->error("No rate data found for service '{$serviceCode}' to '{$country}'.");
    }

    private function calculateRegular(string $country, string $serviceCode, float $weightKg): array {
        $baseWeightKg = (float)$this->config['base_weight_kg'];
        $increment = (float)$this->config['weight_increment_kg'];
        $baseLabel = $this->config['base_weight_label'];
        $addlLabel = $this->config['addl_weight_label'];
        $curr = $this->config['currency'] ?? 'INR';

        // 1. Get all weight slabs for this service+country
        $aliases = $this->getCountryAliases($country);
        $placeholders = implode(',', array_fill(0, count($aliases), '?'));

        $st = $this->pdo->prepare(
            "SELECT DISTINCT weight_label, weight_kg, rate, rate_raw, transit_time, sheet_name FROM vendor_rate_rows
             WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular'
             AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))
             AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))
             ORDER BY weight_kg ASC"
        );
        $st->execute(array_merge([$this->vendorId, $this->batchId, $serviceCode, $serviceCode], $aliases, [$country]));
        $slabs = $st->fetchAll();

        // Fallback: check if vendor_country_services links this service to this country and regular rates exist
        if (empty($slabs)) {
            $csCheck = $this->pdo->prepare(
                "SELECT COUNT(*) FROM vendor_country_services 
                 WHERE vendor_id = ? AND batch_id = ? 
                   AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))
                   AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))"
            );
            $csCheck->execute(array_merge([$this->vendorId, $this->batchId, $serviceCode, $serviceCode], $aliases, [$country]));
            if ((int)$csCheck->fetchColumn() > 0) {
                $stAny = $this->pdo->prepare(
                    "SELECT DISTINCT weight_label, weight_kg, rate, rate_raw, transit_time, sheet_name FROM vendor_rate_rows
                     WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular'
                     AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))
                     ORDER BY weight_kg ASC"
                );
                $stAny->execute([$this->vendorId, $this->batchId, $serviceCode, $serviceCode]);
                $slabs = $stAny->fetchAll();
            }
        }

        if (empty($slabs)) {
            return $this->error("No regular rate data found for service '{$serviceCode}' to '{$country}'.");
        }

        $sheetName = $slabs[0]['sheet_name'] ?? 'Regular Rates';
        $transitTime = $slabs[0]['transit_time'] ?? null;

        // 2. Identify Base Rate (prefer exact base_weight_label e.g. '500 Gms', or fall back to '500 Gms SPX', '500 Gms Dox')
        $baseRate = null;
        $actualBaseLabel = $baseLabel;
        foreach ($slabs as $s) {
            if (strcasecmp(trim($s['weight_label'] ?? ''), trim($baseLabel)) === 0 && $s['rate'] !== null) {
                $baseRate = (float)$s['rate'];
                $actualBaseLabel = $s['weight_label'];
                break;
            }
        }
        // Fallback for base rate if main base cell is '-' / null (e.g. Malaysia, Cambodia with 500 Gms SPX / Dox)
        if ($baseRate === null) {
            foreach ($slabs as $s) {
                $lbl = strtolower(trim($s['weight_label'] ?? ''));
                if (!str_contains($lbl, 'addl') && (float)$s['weight_kg'] === $baseWeightKg && $s['rate'] !== null) {
                    $baseRate = (float)$s['rate'];
                    $actualBaseLabel = $s['weight_label'];
                    break;
                }
            }
        }

        // 3. Identify Additional Increment Rate (e.g. 'Addl 500 Gms')
        $addlRate = null;
        $actualAddlLabel = $addlLabel;
        foreach ($slabs as $s) {
            $lbl = strtolower(trim($s['weight_label'] ?? ''));
            if (str_contains($lbl, 'addl') && $s['rate'] !== null) {
                $addlRate = (float)$s['rate'];
                $actualAddlLabel = $s['weight_label'];
                break;
            }
        }

        // 4. Identify all higher slabs (weight_kg > baseWeightKg) that HAVE A VALID NUMERIC RATE
        // Note: Slabs with null / '-' (e.g. unquoted 3 Kg++, 5 Kg, 8 Kg++, 16 Kg++) are ignored so they don't break calculation
        $higherSlabsWithRate = [];
        foreach ($slabs as $s) {
            $lbl = strtolower(trim($s['weight_label'] ?? ''));
            if ($s['weight_kg'] !== null
                && (float)$s['weight_kg'] > $baseWeightKg
                && !str_contains($lbl, 'addl')
                && $lbl !== strtolower(trim($baseLabel))
                && !str_contains($lbl, 'dox')
                && !str_contains($lbl, 'spx')
                && $s['rate'] !== null) {
                $higherSlabsWithRate[] = $s;
            }
        }
        usort($higherSlabsWithRate, fn($a, $b) => (float)$a['weight_kg'] <=> (float)$b['weight_kg']);

        // Determine which valid higher slab applies (highest qualifying slab with threshold <= input weight)
        $applicableSlab = null;
        foreach ($higherSlabsWithRate as $hs) {
            if ($weightKg >= (float)$hs['weight_kg']) {
                $applicableSlab = $hs;
            }
        }

        // Helper to mark active cells in the row array
        $buildSheetRow = function(array $activeLabels) use ($slabs) {
            $sheetRow = [];
            foreach ($slabs as $s) {
                $isActive = false;
                foreach ($activeLabels as $al) {
                    if (strcasecmp(trim($s['weight_label'] ?? ''), trim($al)) === 0) {
                        $isActive = true;
                        break;
                    }
                }
                $sheetRow[] = [
                    'label' => $s['weight_label'],
                    'weight_kg' => $s['weight_kg'],
                    'rate' => $s['rate'],
                    'rate_raw' => $s['rate_raw'],
                    'is_active' => $isActive
                ];
            }
            return $sheetRow;
        };

        // =====================================================================
        // CASE 1: Weight qualifies for an active Higher / ++ Slab
        // (e.g. 6 Kg++, 11 Kg++, 21 Kg++ - or intermediate weights where 6 Kg++ carries over)
        // =====================================================================
        if ($applicableSlab !== null) {
            $slabRate = (float)$applicableSlab['rate'];
            $slabWeightKg = (float)$applicableSlab['weight_kg'];
            $slabLabel = $applicableSlab['weight_label'];
            $isPerKg = str_contains($slabLabel, '+');

            if ($isPerKg) {
                // ++ slab: Standard courier industry per-kg multiplication by total chargeable weight
                $chargeableWeight = ceil($weightKg / $increment) * $increment;
                $finalRate = $chargeableWeight * $slabRate;
                $formula = number_format($chargeableWeight, 2) . " kg [Chargeable] × " . number_format($slabRate, 2) . " [Slab {$slabLabel}] = " . number_format($finalRate, 2);

                return $this->success([
                    'rate_type' => 'regular',
                    'actual_weight' => $weightKg,
                    'chargeable_weight' => $chargeableWeight,
                    'base_rate' => $slabRate,
                    'additional_weight_units' => 0,
                    'additional_charge' => 0.0,
                    'final_rate' => $finalRate,
                    'sheet_name' => $sheetName,
                    'transit_time' => $transitTime,
                    'formula' => $formula,
                    'sheet_row' => $buildSheetRow([$slabLabel]),
                    'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $slabLabel, $sheetName, [$slabLabel]),
                    'active_slab' => $slabLabel,
                    'breakdown' => [
                        [
                            'item' => "Slab {$slabLabel} (Per-kg tariff rate: " . number_format($slabRate, 2) . " {$curr})",
                            'unit_price' => $slabRate,
                            'quantity' => number_format($chargeableWeight, 2) . " kg",
                            'amount' => $finalRate
                        ]
                    ],
                    'calculation' => [
                        'method' => 'per_kg_slab',
                        'selected_slab' => $slabLabel,
                        'slab_weight' => $slabWeightKg,
                        'slab_rate' => $slabRate,
                        'is_per_kg' => true,
                        'sheet_name' => $sheetName,
                        'transit_time' => $transitTime,
                        'formula' => $formula,
                        'steps' => [
                            [
                                'step' => 1,
                                'title' => 'Tariff Row & Slab Identification',
                                'detail' => "Retrieved rates from sheet '{$sheetName}' for service '{$serviceCode}' to '{$country}'. Shipment weight {$weightKg} kg qualifies for slab '{$slabLabel}' ({$slabWeightKg} kg and above)."
                            ],
                            [
                                'step' => 2,
                                'title' => 'Chargeable Weight Evaluation',
                                'detail' => "Actual weight ({$weightKg} kg) rounded to {$increment} kg increment = {$chargeableWeight} kg chargeable weight."
                            ],
                            [
                                'step' => 3,
                                'title' => 'Per-KG Tariff Multiplication (++)',
                                'detail' => "Rate for {$slabLabel} is " . number_format($slabRate, 2) . " {$curr} per kg. Chargeable computation: {$chargeableWeight} kg × " . number_format($slabRate, 2) . " = " . number_format($finalRate, 2) . " {$curr}."
                            ]
                        ],
                        'note' => "Weight {$weightKg} kg qualifies for per-kg slab '{$slabLabel}'."
                    ]
                ], $country, $serviceCode);
            } else {
                // Flat higher slab (e.g. flat '5 Kg', '30 Kg')
                $extraWeight = round($weightKg - $slabWeightKg, 4);
                if ($extraWeight <= 0) {
                    $formula = "Slab Rate ({$slabLabel}) = " . number_format($slabRate, 2);
                    return $this->success([
                        'rate_type' => 'regular',
                        'actual_weight' => $weightKg,
                        'chargeable_weight' => $slabWeightKg,
                        'base_rate' => $slabRate,
                        'additional_weight_units' => 0,
                        'additional_charge' => 0.0,
                        'final_rate' => $slabRate,
                        'sheet_name' => $sheetName,
                        'transit_time' => $transitTime,
                        'formula' => $formula,
                        'sheet_row' => $buildSheetRow([$slabLabel]),
                        'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $slabLabel, $sheetName, [$slabLabel]),
                        'active_slab' => $slabLabel,
                        'breakdown' => [
                            [
                                'item' => "Flat Slab ({$slabLabel} up to {$slabWeightKg} kg)",
                                'unit_price' => $slabRate,
                                'quantity' => "1 package",
                                'amount' => $slabRate
                            ]
                        ],
                        'calculation' => [
                            'method' => 'higher_slab',
                            'selected_slab' => $slabLabel,
                            'slab_weight' => $slabWeightKg,
                            'slab_rate' => $slabRate,
                            'sheet_name' => $sheetName,
                            'transit_time' => $transitTime,
                            'formula' => $formula,
                            'steps' => [
                                [
                                    'step' => 1,
                                    'title' => 'Flat Slab Matching',
                                    'detail' => "Shipment weight ({$weightKg} kg) matches flat slab '{$slabLabel}' ({$slabWeightKg} kg) at " . number_format($slabRate, 2) . " {$curr}."
                                ],
                                [
                                    'step' => 2,
                                    'title' => 'Flat Charge Application',
                                    'detail' => "Flat slab rate of " . number_format($slabRate, 2) . " {$curr} applied without excess increments."
                                ]
                            ],
                            'note' => "Weight {$weightKg} kg matched flat slab '{$slabLabel}'."
                        ]
                    ], $country, $serviceCode);
                } else {
                    $slabAddlRate = $addlRate ?? 0.0;
                    $addlUnits = (int)ceil($extraWeight / $increment);
                    $chargeableWeight = $slabWeightKg + ($addlUnits * $increment);
                    $addlCharge = $addlUnits * $slabAddlRate;
                    $finalRate = $slabRate + $addlCharge;
                    $formula = number_format($slabRate, 2) . " [{$slabLabel}] + (" . $addlUnits . " × " . number_format($slabAddlRate, 2) . " [Addl]) = " . number_format($finalRate, 2);

                    return $this->success([
                        'rate_type' => 'regular',
                        'actual_weight' => $weightKg,
                        'chargeable_weight' => $chargeableWeight,
                        'base_rate' => $slabRate,
                        'additional_weight_units' => $addlUnits,
                        'additional_charge' => $addlCharge,
                        'final_rate' => $finalRate,
                        'sheet_name' => $sheetName,
                        'transit_time' => $transitTime,
                        'formula' => $formula,
                        'sheet_row' => $buildSheetRow([$slabLabel, $actualAddlLabel]),
                        'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $slabLabel, $sheetName, [$slabLabel, $actualAddlLabel]),
                        'active_slab' => "{$slabLabel} + {$actualAddlLabel}",
                        'breakdown' => [
                            [
                                'item' => "Flat Slab ({$slabLabel} - {$slabWeightKg} kg)",
                                'unit_price' => $slabRate,
                                'quantity' => "1 package",
                                'amount' => $slabRate
                            ],
                            [
                                'item' => "Additional Weight ({$extraWeight} kg excess above slab)",
                                'unit_price' => $slabAddlRate,
                                'quantity' => "{$addlUnits} units of {$increment} kg",
                                'amount' => $addlCharge
                            ]
                        ],
                        'calculation' => [
                            'method' => 'higher_slab_plus_additional',
                            'selected_slab' => $slabLabel,
                            'slab_weight' => $slabWeightKg,
                            'slab_rate' => $slabRate,
                            'extra_weight' => $extraWeight,
                            'increment_kg' => $increment,
                            'additional_units' => $addlUnits,
                            'additional_rate_per_unit' => $slabAddlRate,
                            'additional_charge' => $addlCharge,
                            'sheet_name' => $sheetName,
                            'transit_time' => $transitTime,
                            'formula' => $formula,
                            'steps' => [
                                [
                                    'step' => 1,
                                    'title' => 'Flat Slab Qualification',
                                    'detail' => "Weight {$weightKg} kg qualifies for flat slab '{$slabLabel}' ({$slabWeightKg} kg) at " . number_format($slabRate, 2) . " {$curr}."
                                ],
                                [
                                    'step' => 2,
                                    'title' => 'Excess Increments Calculation',
                                    'detail' => "Weight exceeds slab by {$extraWeight} kg = {$addlUnits} unit(s) of {$increment} kg."
                                ],
                                [
                                    'step' => 3,
                                    'title' => 'Final Charge Computation',
                                    'detail' => "Flat Slab: " . number_format($slabRate, 2) . " + Additional: (" . $addlUnits . " × " . number_format($slabAddlRate, 2) . " = " . number_format($addlCharge, 2) . ") = " . number_format($finalRate, 2) . " {$curr}."
                                ]
                            ],
                            'note' => "Weight {$weightKg} kg exceeds flat slab {$slabWeightKg} kg."
                        ]
                    ], $country, $serviceCode);
                }
            }
        }

        // =====================================================================
        // CASE 2: No applicable higher slab; Base Rate is available
        // Calculate Base Rate + Additional Increments (properly counted, no skipping)
        // =====================================================================
        if ($baseRate !== null) {
            // Case 2A: Weight within base weight allowance (e.g. <= 0.5 kg)
            if ($weightKg <= $baseWeightKg) {
                $formula = "Base Rate ({$actualBaseLabel}) = " . number_format($baseRate, 2);
                return $this->success([
                    'rate_type' => 'regular',
                    'actual_weight' => $weightKg,
                    'chargeable_weight' => $baseWeightKg,
                    'base_rate' => $baseRate,
                    'additional_weight_units' => 0,
                    'additional_charge' => 0.0,
                    'final_rate' => $baseRate,
                    'sheet_name' => $sheetName,
                    'transit_time' => $transitTime,
                    'formula' => $formula,
                    'sheet_row' => $buildSheetRow([$actualBaseLabel]),
                    'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $actualBaseLabel, $sheetName, [$actualBaseLabel]),
                    'active_slab' => $actualBaseLabel,
                    'breakdown' => [
                        [
                            'item' => "Base tier ({$actualBaseLabel} up to {$baseWeightKg} kg)",
                            'unit_price' => $baseRate,
                            'quantity' => "1 base unit ({$baseWeightKg} kg)",
                            'amount' => $baseRate
                        ]
                    ],
                    'calculation' => [
                        'method' => 'base_rate_only',
                        'base_weight' => $baseWeightKg,
                        'base_rate' => $baseRate,
                        'sheet_name' => $sheetName,
                        'transit_time' => $transitTime,
                        'formula' => $formula,
                        'steps' => [
                            [
                                'step' => 1,
                                'title' => 'Tariff & Slab Identification',
                                'detail' => "Retrieved rates from sheet '{$sheetName}' for service '{$serviceCode}' to '{$country}'. Base tier is '{$actualBaseLabel}' ({$baseWeightKg} kg) at " . number_format($baseRate, 2) . " {$curr}."
                            ],
                            [
                                'step' => 2,
                                'title' => 'Weight Assessment',
                                'detail' => "Actual weight ({$weightKg} kg) is within base allowance ({$baseWeightKg} kg). No excess increments incurred."
                            ],
                            [
                                'step' => 3,
                                'title' => 'Final Charge Calculation',
                                'detail' => "Chargeable weight: {$baseWeightKg} kg. Rate = " . number_format($baseRate, 2) . " {$curr}."
                            ]
                        ],
                        'note' => "Weight {$weightKg} kg ≤ base weight {$baseWeightKg} kg. Base rate applied."
                    ]
                ], $country, $serviceCode);
            }

            // Case 2B: Weight exceeds base weight; additional increments must count properly!
            if ($addlRate === null) {
                return $this->error("Additional weight rate ('{$addlLabel}') not found for service '{$serviceCode}' to '{$country}'. Cannot calculate for weight {$weightKg} kg.");
            }

            $extraWeight = round($weightKg - $baseWeightKg, 4);
            $addlUnits = (int)ceil($extraWeight / $increment);
            $chargeableWeight = $baseWeightKg + ($addlUnits * $increment);
            $addlCharge = $addlUnits * $addlRate;
            $finalRate = $baseRate + $addlCharge;
            $formula = number_format($baseRate, 2) . " [{$actualBaseLabel}] + (" . $addlUnits . " × " . number_format($addlRate, 2) . " [{$actualAddlLabel}]) = " . number_format($finalRate, 2);

            $activeLabels = [$actualBaseLabel, $actualAddlLabel];

            return $this->success([
                'rate_type' => 'regular',
                'actual_weight' => $weightKg,
                'chargeable_weight' => $chargeableWeight,
                'base_rate' => $baseRate,
                'additional_weight_units' => $addlUnits,
                'additional_charge' => $addlCharge,
                'final_rate' => $finalRate,
                'sheet_name' => $sheetName,
                'transit_time' => $transitTime,
                'formula' => $formula,
                'sheet_row' => $buildSheetRow($activeLabels),
                'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $actualBaseLabel, $sheetName, $activeLabels),
                'active_slab' => "{$actualBaseLabel} + {$actualAddlLabel}",
                'breakdown' => [
                    [
                        'item' => "Base tier ({$actualBaseLabel} - first {$baseWeightKg} kg)",
                        'unit_price' => $baseRate,
                        'quantity' => "1 base unit ({$baseWeightKg} kg)",
                        'amount' => $baseRate
                    ],
                    [
                        'item' => "Additional weight ({$actualAddlLabel} - {$extraWeight} kg excess)",
                        'unit_price' => $addlRate,
                        'quantity' => "{$addlUnits} unit(s) of {$increment} kg",
                        'amount' => $addlCharge
                    ]
                ],
                'calculation' => [
                    'method' => 'base_plus_additional',
                    'base_weight' => $baseWeightKg,
                    'base_rate' => $baseRate,
                    'extra_weight' => $extraWeight,
                    'increment_kg' => $increment,
                    'additional_units' => $addlUnits,
                    'additional_rate_per_unit' => $addlRate,
                    'additional_charge' => $addlCharge,
                    'sheet_name' => $sheetName,
                    'transit_time' => $transitTime,
                    'formula' => $formula,
                    'steps' => [
                        [
                            'step' => 1,
                            'title' => 'Tariff Structure Lookup',
                            'detail' => "Identified rate schedule in worksheet '{$sheetName}'. Base tier '{$actualBaseLabel}' ({$baseWeightKg} kg) = " . number_format($baseRate, 2) . " {$curr}, incremental rate '{$actualAddlLabel}' = " . number_format($addlRate, 2) . " {$curr} per {$increment} kg block."
                        ],
                        [
                            'step' => 2,
                            'title' => 'Excess Weight & Increment Calculation',
                            'detail' => "Actual weight is {$weightKg} kg. Subtracting base allowance ({$baseWeightKg} kg) leaves {$extraWeight} kg excess. Dividing by {$increment} kg and rounding up gives {$addlUnits} increment unit(s). Chargeable weight: {$chargeableWeight} kg."
                        ],
                        [
                            'step' => 3,
                            'title' => 'Line-Item Computation',
                            'detail' => "Base: " . number_format($baseRate, 2) . " + Additional ({$addlUnits} units × " . number_format($addlRate, 2) . " = " . number_format($addlCharge, 2) . ") = Total " . number_format($finalRate, 2) . " {$curr}."
                        ]
                    ],
                    'note' => "Weight {$weightKg} kg = base {$baseWeightKg} kg + extra {$extraWeight} kg. Charged as {$addlUnits} × {$increment} kg increments."
                ]
            ], $country, $serviceCode);
        }

        // =====================================================================
        // CASE 3: Base rate is null, but higher slabs with rate exist (e.g. destinations starting at 3 Kg++)
        // =====================================================================
        if (!empty($higherSlabsWithRate)) {
            $firstSlab = $higherSlabsWithRate[0];
            $firstWeightKg = (float)$firstSlab['weight_kg'];
            $slabRate = (float)$firstSlab['rate'];
            $slabLabel = $firstSlab['weight_label'];
            $isPerKg = str_contains($slabLabel, '+');

            $chargeableWeight = max($firstWeightKg, ceil($weightKg / $increment) * $increment);
            $finalRate = $isPerKg ? ($chargeableWeight * $slabRate) : $slabRate;
            $formula = $isPerKg 
                ? (number_format($chargeableWeight, 2) . " kg [Chargeable] × " . number_format($slabRate, 2) . " [Slab {$slabLabel}] = " . number_format($finalRate, 2))
                : ("Slab Rate ({$slabLabel}) = " . number_format($slabRate, 2));

            return $this->success([
                'rate_type' => 'regular',
                'actual_weight' => $weightKg,
                'chargeable_weight' => $chargeableWeight,
                'base_rate' => $slabRate,
                'additional_weight_units' => 0,
                'additional_charge' => 0.0,
                'final_rate' => $finalRate,
                'sheet_name' => $sheetName,
                'transit_time' => $transitTime,
                'formula' => $formula,
                'sheet_row' => $buildSheetRow([$slabLabel]),
                'sheet_grid' => $this->buildRegularSheetGrid($serviceCode, $country, $slabLabel, $sheetName, [$slabLabel]),
                'active_slab' => $slabLabel,
                'breakdown' => [
                    [
                        'item' => "Slab {$slabLabel} (Starting tariff tier)",
                        'unit_price' => $slabRate,
                        'quantity' => $isPerKg ? (number_format($chargeableWeight, 2) . " kg") : "1 package",
                        'amount' => $finalRate
                    ]
                ],
                'calculation' => [
                    'method' => $isPerKg ? 'per_kg_slab' : 'higher_slab',
                    'selected_slab' => $slabLabel,
                    'slab_weight' => $firstWeightKg,
                    'slab_rate' => $slabRate,
                    'is_per_kg' => $isPerKg,
                    'sheet_name' => $sheetName,
                    'transit_time' => $transitTime,
                    'formula' => $formula,
                    'steps' => [
                        [
                            'step' => 1,
                            'title' => 'Minimum Tariff Threshold',
                            'detail' => "Worksheet '{$sheetName}' starts at '{$slabLabel}' ({$firstWeightKg} kg)."
                        ],
                        [
                            'step' => 2,
                            'title' => 'Chargeable Assessment',
                            'detail' => "Input weight {$weightKg} kg evaluated against starting tier {$firstWeightKg} kg. Chargeable weight: {$chargeableWeight} kg."
                        ],
                        [
                            'step' => 3,
                            'title' => 'Final Computation',
                            'detail' => "Total charge: " . number_format($finalRate, 2) . " {$curr}."
                        ]
                    ],
                    'note' => "Rates for this destination begin at {$slabLabel}."
                ]
            ], $country, $serviceCode);
        }

        return $this->error("No valid rate data found for service '{$serviceCode}' to '{$country}'.");
    }

    private function calculateZonewise(string $country, string $serviceCode, float $weightKg, ?string $postcode, string $zone, ?array $zoneDetails = null): array {
        // Get all weight slabs for this service+zone
        $aliases = $this->getCountryAliases($country);
        $placeholders = implode(',', array_fill(0, count($aliases), '?'));

        $st = $this->pdo->prepare(
            "SELECT DISTINCT weight_kg, rate, rate_raw, weight_label, transit_time, sheet_name FROM vendor_rate_rows
             WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise'
             AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?)) 
             AND (zone = ? OR LOWER(TRIM(zone)) = LOWER(?)) 
             AND weight_kg IS NOT NULL
             AND (country IS NULL OR country = '' OR country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))
             ORDER BY weight_kg ASC"
        );
        $st->execute(array_merge([$this->vendorId, $this->batchId, $serviceCode, $serviceCode, $zone, $zone], $aliases, [$country]));
        $slabs = $st->fetchAll();

        if (empty($slabs)) {
            return $this->error("No zone-wise rate data found for service '{$serviceCode}', zone '{$zone}'.");
        }

        $sheetName = $slabs[0]['sheet_name'] ?? 'Zone-wise Rates';
        $curr = $this->config['currency'] ?? 'INR';

        // Find the applicable slab (next available higher slab)
        $applicableSlab = null;
        foreach ($slabs as $s) {
            if ((float)$s['weight_kg'] >= $weightKg) {
                $applicableSlab = $s;
                break;
            }
        }

        if ($applicableSlab === null) {
            $applicableSlab = end($slabs);
            if ((float)$applicableSlab['weight_kg'] < $weightKg) {
                return $this->error("Weight {$weightKg} kg exceeds the maximum available slab of {$applicableSlab['weight_kg']} kg for service '{$serviceCode}', zone '{$zone}'.");
            }
        }

        $rate = $applicableSlab['rate'];
        if ($rate === null) {
            $rawVal = $applicableSlab['rate_raw'] ?? '-';
            return $this->error("Rate is unavailable ('{$rawVal}') for service '{$serviceCode}', zone '{$zone}', slab {$applicableSlab['weight_kg']} kg.");
        }

        $chargeableWeight = (float)$applicableSlab['weight_kg'];
        $transitTime = $applicableSlab['transit_time'] ?? null;
        $availableSlabs = array_map(fn($s) => (float)$s['weight_kg'], $slabs);
        $selectedLabel = $applicableSlab['weight_label'] ?? ($chargeableWeight . ' kg');

        $sheetRow = [];
        foreach ($slabs as $s) {
            $isThisActive = ((float)$s['weight_kg'] == $chargeableWeight);
            $sheetRow[] = [
                'label' => $s['weight_label'] ?? ($s['weight_kg'] . ' kg'),
                'weight_kg' => (float)$s['weight_kg'],
                'rate' => $s['rate'],
                'rate_raw' => $s['rate_raw'],
                'is_active' => $isThisActive
            ];
        }

        return $this->success([
            'rate_type' => 'zonewise',
            'actual_weight' => $weightKg,
            'chargeable_weight' => $chargeableWeight,
            'base_rate' => (float)$rate,
            'additional_weight_units' => 0,
            'additional_charge' => 0.0,
            'final_rate' => (float)$rate,
            'zone' => $zone,
            'postcode' => $postcode,
            'town_city' => $zoneDetails['town_city'] ?? null,
            'sheet_name' => $sheetName,
            'transit_time' => $transitTime,
            'sheet_row' => $sheetRow,
            'active_slab' => $selectedLabel,
            'formula' => "Zone {$zone} Slab ({$selectedLabel}) = " . number_format((float)$rate, 2),
            'sheet_grid' => $this->buildZonewiseSheetGrid($serviceCode, $country, $zone, $selectedLabel, $sheetName),
            'breakdown' => [
                [
                    'item' => "Zone {$zone} Tier ({$selectedLabel} up to {$chargeableWeight} kg)",
                    'unit_price' => (float)$rate,
                    'quantity' => "1 parcel ({$chargeableWeight} kg)",
                    'amount' => (float)$rate
                ]
            ],
            'calculation' => [
                'method' => 'zone_slab_match',
                'zone' => $zone,
                'postcode' => $postcode,
                'matched_slab' => $selectedLabel,
                'slab_rate' => (float)$rate,
                'sheet_name' => $sheetName,
                'transit_time' => $transitTime,
                'formula' => "Zone {$zone} Slab ({$selectedLabel}) = " . number_format((float)$rate, 2),
                'steps' => [
                    [
                        'step' => 1,
                        'title' => 'Postcode to Zone Resolution',
                        'detail' => "Postcode '{$postcode}' in '{$country}' resolved to Zone '{$zone}'" . (!empty($zoneDetails['town_city']) ? " ({$zoneDetails['town_city']})" : "") . "."
                    ],
                    [
                        'step' => 2,
                        'title' => 'Slab Selection',
                        'detail' => "Actual weight {$weightKg} kg mapped to next qualifying zone tier '{$selectedLabel}' ({$chargeableWeight} kg)."
                    ],
                    [
                        'step' => 3,
                        'title' => 'Rate Extraction',
                        'detail' => "Extracted rate from worksheet '{$sheetName}': " . number_format((float)$rate, 2) . " {$curr}."
                    ]
                ],
                'note' => "Weight {$weightKg} kg falls into Zone {$zone} tier '{$selectedLabel}'."
            ]
        ], $country, $serviceCode);
    }

    public function resolveZoneDetails(string $country, ?string $postcode, ?string $state = null): ?array {
        $aliases = $this->getCountryAliases($country);
        $placeholders = implode(',', array_fill(0, count($aliases), '?'));

        $candidates = array_values(array_unique(array_filter([clean($postcode), clean($state)])));
        if (empty($candidates)) return null;

        // 1. Exact match against postcode OR town_city (which can store state code/name)
        $candPlaceholders = implode(',', array_fill(0, count($candidates), '?'));
        $sql = "SELECT zone, town_city, postcode, country FROM vendor_zone_rows 
                WHERE vendor_id = ? AND batch_id = ? 
                  AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?)) 
                  AND (postcode IN ({$candPlaceholders}) OR town_city IN ({$candPlaceholders})) LIMIT 1";
        $st = $this->pdo->prepare($sql);
        $st->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country], $candidates, $candidates));
        $row = $st->fetch();
        if ($row) return $row;

        // 2. Prefix match (e.g. Canadian forward sortation areas like L0H)
        foreach ($candidates as $cand) {
            $stPrefix = $this->pdo->prepare(
                "SELECT zone, town_city, postcode, country FROM vendor_zone_rows 
                 WHERE vendor_id = ? AND batch_id = ? 
                   AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?)) 
                   AND ? LIKE CONCAT(postcode, '%') 
                 ORDER BY LENGTH(postcode) DESC LIMIT 1"
            );
            $stPrefix->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country, $cand]));
            $pRow = $stPrefix->fetch();
            if ($pRow) return $pRow;
        }

        // 3. Dynamic Range Match (e.g. for existing unexpanded rows with "113 to 209" or "BT1 to BT94")
        $stRange = $this->pdo->prepare(
            "SELECT zone, town_city, postcode, country FROM vendor_zone_rows 
             WHERE vendor_id = ? AND batch_id = ? 
               AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?)) 
               AND (postcode LIKE '%to%' OR postcode LIKE '%-%')"
        );
        $stRange->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country]));
        $rangeRows = $stRange->fetchAll();
        foreach ($rangeRows as $rr) {
            foreach ($candidates as $cand) {
                if (matchesPostcodeRangeRule($cand, $rr['postcode'])) {
                    return $rr;
                }
            }
        }

        return null;
    }

    public function resolveZone(string $country, ?string $postcode, ?string $state = null): ?string {
        $details = $this->resolveZoneDetails($country, $postcode, $state);
        return $details['zone'] ?? null;
    }

    public function hasRates(string $rateType, string $serviceCode, ?string $country): bool {
        if ($this->pdo === null) return false;
        $serviceCode = trim($serviceCode);

        if ($rateType === 'zonewise') {
            // Zone-wise is strictly country-wise:
            // A country that is NOT zone-wise CANNOT have zone-wise rates
            if ($country !== null && $country !== '') {
                if (!$this->isCountryZonewise($country)) {
                    return false;
                }
                $aliases = $this->getCountryAliases($country);
                $placeholders = implode(',', array_fill(0, count($aliases), '?'));
                $sql = "SELECT COUNT(*) FROM vendor_rate_rows 
                        WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' 
                          AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))
                          AND (country IS NULL OR country = '' OR country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))";
                $args = array_merge([$this->vendorId, $this->batchId, $serviceCode, $serviceCode], $aliases, [$country]);
                $st = $this->pdo->prepare($sql);
                $st->execute($args);
                return (int)$st->fetchColumn() > 0;
            } else {
                $st = $this->pdo->prepare(
                    "SELECT COUNT(*) FROM vendor_rate_rows 
                     WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' 
                       AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))"
                );
                $st->execute([$this->vendorId, $this->batchId, $serviceCode, $serviceCode]);
                return (int)$st->fetchColumn() > 0;
            }
        }

        // Regular rate type
        $sql = "SELECT COUNT(*) FROM vendor_rate_rows 
                WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' 
                  AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))";
        $args = [$this->vendorId, $this->batchId, $serviceCode, $serviceCode];

        if ($country !== null && $country !== '') {
            $aliases = $this->getCountryAliases($country);
            $placeholders = implode(',', array_fill(0, count($aliases), '?'));
            $sql .= " AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))";
            $args = array_merge($args, $aliases, [$country]);
        }

        $st = $this->pdo->prepare($sql);
        $st->execute($args);
        $count = (int)$st->fetchColumn();

        if ($count > 0) return true;

        // Also check if vendor_country_services links this service to this country and regular rates exist
        if ($country !== null && $country !== '') {
            $aliases = $this->getCountryAliases($country);
            $placeholders = implode(',', array_fill(0, count($aliases), '?'));
            $csSt = $this->pdo->prepare(
                "SELECT COUNT(*) FROM vendor_country_services 
                 WHERE vendor_id = ? AND batch_id = ? 
                   AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))
                   AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))"
            );
            $csSt->execute(array_merge([$this->vendorId, $this->batchId, $serviceCode, $serviceCode], $aliases, [$country]));
            if ((int)$csSt->fetchColumn() > 0) {
                $stAny = $this->pdo->prepare(
                    "SELECT COUNT(*) FROM vendor_rate_rows 
                     WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' 
                       AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))"
                );
                $stAny->execute([$this->vendorId, $this->batchId, $serviceCode, $serviceCode]);
                return (int)$stAny->fetchColumn() > 0;
            }
        }

        return false;
    }

    public function getAvailableServices(?string $country = null): array {
        if ($this->pdo === null) return [];
        $country = trim((string)$country);

        if ($country !== '') {
            $aliases = $this->getCountryAliases($country);
            $placeholders = implode(',', array_fill(0, count($aliases), '?'));
            $isZonewise = $this->isCountryZonewise($country);

            $services = [];

            // 1. Regular services explicitly for this country
            $regSql = "SELECT DISTINCT service_code, service_name, 'regular' as rate_type 
                       FROM vendor_rate_rows 
                       WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular'
                         AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))";
            $regArgs = array_merge([$this->vendorId, $this->batchId], $aliases, [$country]);
            $stReg = $this->pdo->prepare($regSql);
            $stReg->execute($regArgs);
            foreach ($stReg->fetchAll() as $row) {
                $services[$row['service_code'] . '|regular'] = $row;
            }

            // Also check vendor_country_services for regular services
            $csSt = $this->pdo->prepare(
                "SELECT DISTINCT service_code FROM vendor_country_services 
                 WHERE vendor_id = ? AND batch_id = ? 
                   AND (country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))"
            );
            $csSt->execute(array_merge([$this->vendorId, $this->batchId], $aliases, [$country]));
            $csServices = array_column($csSt->fetchAll(), 'service_code');

            if (!empty($csServices)) {
                $inCs = implode(',', array_fill(0, count($csServices), '?'));
                $csRateSt = $this->pdo->prepare(
                    "SELECT DISTINCT service_code, service_name, 'regular' as rate_type 
                     FROM vendor_rate_rows 
                     WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' 
                       AND service_code IN ({$inCs})"
                );
                $csRateSt->execute(array_merge([$this->vendorId, $this->batchId], $csServices));
                foreach ($csRateSt->fetchAll() as $row) {
                    $services[$row['service_code'] . '|regular'] = $row;
                }
            }

            // 2. Zone-wise services ONLY IF this country is zone-wise!
            // If the country is not zone-wise, zone-wise services are NEVER returned for this country.
            if ($isZonewise) {
                $zwSql = "SELECT DISTINCT service_code, service_name, 'zonewise' as rate_type 
                          FROM vendor_rate_rows 
                          WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise'
                            AND (country IS NULL OR country = '' OR country IN ({$placeholders}) OR LOWER(TRIM(country)) = LOWER(?))";
                $zwArgs = array_merge([$this->vendorId, $this->batchId], $aliases, [$country]);
                $stZw = $this->pdo->prepare($zwSql);
                $stZw->execute($zwArgs);
                foreach ($stZw->fetchAll() as $row) {
                    $services[$row['service_code'] . '|zonewise'] = $row;
                }
            }

            $list = array_values($services);
            usort($list, fn($a, $b) => strcmp($a['service_code'], $b['service_code']));
            return $list;
        } else {
            $sql = "SELECT DISTINCT service_code, service_name, rate_type FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? ORDER BY service_code";
            $st = $this->pdo->prepare($sql);
            $st->execute([$this->vendorId, $this->batchId]);
            return $st->fetchAll();
        }
    }

    public function getAvailableCountries(): array {
        if ($this->pdo === null) return [];
        $sql = "SELECT DISTINCT country FROM (
                    SELECT country FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND country IS NOT NULL AND country != ''
                    UNION
                    SELECT country FROM vendor_country_services WHERE vendor_id = ? AND batch_id = ? AND country IS NOT NULL AND country != ''
                    UNION
                    SELECT country FROM vendor_zone_rows WHERE vendor_id = ? AND batch_id = ? AND country IS NOT NULL AND country != ''
                ) as all_c ORDER BY country";
        $st = $this->pdo->prepare($sql);
        $st->execute([$this->vendorId, $this->batchId, $this->vendorId, $this->batchId, $this->vendorId, $this->batchId]);
        return array_column($st->fetchAll(), 'country');
    }

    public function getExcelColumnName(int $index): string {
        $numeric = $index % 26;
        $letter = chr(65 + $numeric);
        $num2 = intdiv($index, 26);
        if ($num2 > 0) {
            return $this->getExcelColumnName($num2 - 1) . $letter;
        }
        return $letter;
    }

    public function buildRegularSheetGrid(string $serviceCode, string $country, ?string $activeSlabLabel, ?string $sheetName, array $activeLabels = []): array {
        try {
            // 1. Get all distinct columns/slabs for this service in original order
            $colSt = $this->pdo->prepare(
                "SELECT DISTINCT weight_label, weight_kg, MIN(id) as first_id
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' AND service_code = ?
                 GROUP BY weight_label, weight_kg
                 ORDER BY weight_kg ASC, first_id ASC"
            );
            $colSt->execute([$this->vendorId, $this->batchId, $serviceCode]);
            $slabs = $colSt->fetchAll();

            $columns = [];
            $columns[] = ['col_letter' => 'A', 'title' => 'SERVICE CODE', 'type' => 'text'];
            $columns[] = ['col_letter' => 'B', 'title' => 'Destination', 'type' => 'text'];

            $colIdx = 2;
            $slabColMap = [];
            foreach ($slabs as $s) {
                $colLetter = $this->getExcelColumnName($colIdx);
                $lbl = $s['weight_label'] ?? ($s['weight_kg'] . ' kg');
                $columns[] = [
                    'col_letter' => $colLetter,
                    'title' => $lbl,
                    'weight_kg' => $s['weight_kg'],
                    'type' => 'rate'
                ];
                $slabColMap[$lbl] = $colLetter;
                $colIdx++;
            }

            // 2. Get distinct countries and source_row for this service
            $cSt = $this->pdo->prepare(
                "SELECT DISTINCT country, source_row
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' AND service_code = ?
                 ORDER BY source_row ASC, country ASC"
            );
            $cSt->execute([$this->vendorId, $this->batchId, $serviceCode]);
            $allCountries = $cSt->fetchAll();

            $targetIndex = false;
            foreach ($allCountries as $idx => $cRow) {
                if (strcasecmp($cRow['country'], $country) === 0) {
                    $targetIndex = $idx;
                    break;
                }
            }

            $selectedWindow = [];
            if ($targetIndex !== false) {
                $total = count($allCountries);
                $start = max(0, $targetIndex - 6);
                $length = min(15, $total - $start);
                $selectedWindow = array_slice($allCountries, $start, $length);
            } else {
                $selectedWindow = array_slice($allCountries, 0, 15);
            }

            $windowCountryNames = array_column($selectedWindow, 'country');
            if (empty($windowCountryNames)) {
                $windowCountryNames = [$country];
            }

            // 3. Fetch rates for all window countries
            $inPlaceholders = implode(',', array_fill(0, count($windowCountryNames), '?'));
            $rateSt = $this->pdo->prepare(
                "SELECT country, source_row, weight_label, rate, rate_raw
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'regular' AND service_code = ?
                 AND country IN ({$inPlaceholders})"
            );
            $params = array_merge([$this->vendorId, $this->batchId, $serviceCode], $windowCountryNames);
            $rateSt->execute($params);
            $rateRows = $rateSt->fetchAll();

            $countryRates = [];
            foreach ($rateRows as $rr) {
                $countryRates[$rr['country']][$rr['weight_label']] = [
                    'rate' => $rr['rate'],
                    'rate_raw' => $rr['rate_raw']
                ];
            }

            $activeCellRef = null;
            $gridRows = [];

            foreach ($selectedWindow as $w) {
                $cName = $w['country'];
                $sRow = (int)($w['source_row'] ?: 1);
                $isSelectedRow = (strcasecmp($cName, $country) === 0);

                $cells = [];
                foreach ($slabs as $s) {
                    $lbl = $s['weight_label'] ?? ($s['weight_kg'] . ' kg');
                    $colLetter = $slabColMap[$lbl] ?? '';
                    $cellRef = $colLetter . $sRow;
                    $cellData = $countryRates[$cName][$lbl] ?? null;

                    $rateVal = $cellData['rate'] ?? null;
                    $rawVal = $cellData['rate_raw'] ?? null;

                    $isActiveCell = false;
                    if ($isSelectedRow) {
                        if (!empty($activeLabels)) {
                            foreach ($activeLabels as $al) {
                                if (strcasecmp(trim($lbl), trim($al)) === 0) {
                                    $isActiveCell = true;
                                    if (!$activeCellRef) {
                                        $activeCellRef = $cellRef;
                                    }
                                    break;
                                }
                            }
                        } elseif ($activeSlabLabel !== null) {
                            if (strcasecmp(trim($lbl), trim($activeSlabLabel)) === 0) {
                                $isActiveCell = true;
                                $activeCellRef = $cellRef;
                            } elseif ((str_contains(strtolower($activeSlabLabel), 'addl') || str_contains(strtolower($activeSlabLabel), 'base')) && (strcasecmp($lbl, (string)($this->config['base_weight_label'] ?? '')) === 0 || strcasecmp($lbl, (string)($this->config['addl_weight_label'] ?? '')) === 0)) {
                                $isActiveCell = true;
                                if (!$activeCellRef) $activeCellRef = $cellRef;
                            }
                        }
                    }

                    $cells[] = [
                        'col_letter' => $colLetter,
                        'cell_ref' => $cellRef,
                        'label' => $lbl,
                        'rate' => $rateVal,
                        'rate_raw' => $rawVal,
                        'is_active' => $isActiveCell
                    ];
                }

                $gridRows[] = [
                    'row_num' => $sRow,
                    'service_code' => $serviceCode,
                    'destination' => $cName,
                    'is_selected' => $isSelectedRow,
                    'cells' => $cells
                ];
            }

            return [
                'sheet_name' => $sheetName ?: 'Pacific_rates_regular',
                'columns' => $columns,
                'rows' => $gridRows,
                'active_cell_ref' => $activeCellRef,
                'active_slab_label' => $activeSlabLabel,
                'total_sheet_destinations' => count($allCountries)
            ];
        } catch (Throwable $e) {
            return [
                'sheet_name' => $sheetName ?: 'Regular Rates',
                'columns' => [],
                'rows' => [],
                'active_cell_ref' => null,
                'active_slab_label' => $activeSlabLabel,
                'error' => $e->getMessage()
            ];
        }
    }

    public function buildZonewiseSheetGrid(string $serviceCode, string $country, ?string $targetZone, ?string $activeSlabLabel, ?string $sheetName): array {
        try {
            $colSt = $this->pdo->prepare(
                "SELECT DISTINCT weight_label, weight_kg, MIN(id) as first_id
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' AND service_code = ?
                 GROUP BY weight_label, weight_kg
                 ORDER BY weight_kg ASC, first_id ASC"
            );
            $colSt->execute([$this->vendorId, $this->batchId, $serviceCode]);
            $slabs = $colSt->fetchAll();

            $columns = [];
            $columns[] = ['col_letter' => 'A', 'title' => 'SERVICE CODE', 'type' => 'text'];
            $columns[] = ['col_letter' => 'B', 'title' => 'Zone', 'type' => 'text'];

            $colIdx = 2;
            $slabColMap = [];
            foreach ($slabs as $s) {
                $colLetter = $this->getExcelColumnName($colIdx);
                $lbl = $s['weight_label'] ?? ($s['weight_kg'] . ' kg');
                $columns[] = [
                    'col_letter' => $colLetter,
                    'title' => $lbl,
                    'weight_kg' => $s['weight_kg'],
                    'type' => 'rate'
                ];
                $slabColMap[$lbl] = $colLetter;
                $colIdx++;
            }

            $zSt = $this->pdo->prepare(
                "SELECT DISTINCT zone, MIN(source_row) as source_row
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' AND service_code = ?
                 GROUP BY zone
                 ORDER BY zone ASC"
            );
            $zSt->execute([$this->vendorId, $this->batchId, $serviceCode]);
            $allZones = $zSt->fetchAll();

            $rateSt = $this->pdo->prepare(
                "SELECT zone, source_row, weight_label, weight_kg, rate, rate_raw
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND rate_type = 'zonewise' AND service_code = ?"
            );
            $rateSt->execute([$this->vendorId, $this->batchId, $serviceCode]);
            $rateRows = $rateSt->fetchAll();

            $zoneRates = [];
            foreach ($rateRows as $rr) {
                $lbl = $rr['weight_label'] ?? ($rr['weight_kg'] . ' kg');
                $zoneRates[$rr['zone']][$lbl] = [
                    'rate' => $rr['rate'],
                    'rate_raw' => $rr['rate_raw']
                ];
            }

            $activeCellRef = null;
            $gridRows = [];
            $rowNum = 2;

            foreach ($allZones as $zRow) {
                $zName = $zRow['zone'];
                $sRow = (int)($zRow['source_row'] ?: $rowNum);
                $isSelected = ($targetZone !== null && strcasecmp(trim($zName), trim($targetZone)) === 0);

                $cells = [];
                foreach ($slabs as $s) {
                    $lbl = $s['weight_label'] ?? ($s['weight_kg'] . ' kg');
                    $colLetter = $slabColMap[$lbl] ?? '';
                    $cellRef = $colLetter . $sRow;
                    $cellData = $zoneRates[$zName][$lbl] ?? null;

                    $rateVal = $cellData['rate'] ?? null;
                    $rawVal = $cellData['rate_raw'] ?? null;

                    $isActiveCell = false;
                    if ($isSelected && $activeSlabLabel !== null) {
                        if (strcasecmp(trim($lbl), trim($activeSlabLabel)) === 0) {
                            $isActiveCell = true;
                            $activeCellRef = $cellRef;
                        }
                    }

                    $cells[] = [
                        'col_letter' => $colLetter,
                        'cell_ref' => $cellRef,
                        'label' => $lbl,
                        'rate' => $rateVal,
                        'rate_raw' => $rawVal,
                        'is_active' => $isActiveCell
                    ];
                }

                $gridRows[] = [
                    'row_num' => $sRow,
                    'service_code' => $serviceCode,
                    'destination' => 'Zone ' . $zName,
                    'is_selected' => $isSelected,
                    'cells' => $cells
                ];
                $rowNum++;
            }

            return [
                'sheet_name' => $sheetName ?: 'Zonewise_Rates',
                'columns' => $columns,
                'rows' => $gridRows,
                'active_cell_ref' => $activeCellRef,
                'active_slab_label' => $activeSlabLabel,
                'total_sheet_destinations' => count($allZones)
            ];
        } catch (Throwable $e) {
            return [
                'sheet_name' => $sheetName ?: 'Zonewise Rates',
                'columns' => [],
                'rows' => [],
                'active_cell_ref' => null,
                'active_slab_label' => $activeSlabLabel,
                'error' => $e->getMessage()
            ];
        }
    }

    private function success(array $data, string $country, string $serviceCode): array {
        // Look up service name
        $st = $this->pdo->prepare(
            "SELECT DISTINCT service_name FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND service_code = ? AND service_name IS NOT NULL LIMIT 1"
        );
        $st->execute([$this->vendorId, $this->batchId, $serviceCode]);
        $serviceName = $st->fetchColumn() ?: $serviceCode;

        return array_merge([
            'success' => true,
            'vendor' => $this->vendorName,
            'service' => $serviceName,
            'service_code' => $serviceCode,
            'country' => $country,
            'currency' => $this->config['currency'],
            'batch_id' => $this->batchId,
        ], $data);
    }

    private function error(string $message): array {
        return [
            'success' => false,
            'error' => $message,
            'vendor' => $this->vendorName
        ];
    }
}
