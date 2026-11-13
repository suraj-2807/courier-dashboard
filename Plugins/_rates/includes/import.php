<?php
declare(strict_types=1);
// Import logic — extracted from original index.php and enhanced with worksheet tracking

use PhpOffice\PhpSpreadsheet\IOFactory;

function insertRate(PDO $pdo, array $r): void {
    $sql = "INSERT INTO vendor_rate_rows
    (batch_id,vendor_id,sheet_name,source_row,rate_type,service_code,service_name,country,weight_label,weight_kg,zone,rate,rate_raw,transit_time,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    $pdo->prepare($sql)->execute([
        $r['batch_id'],$r['vendor_id'],$r['sheet_name'],$r['source_row'],$r['rate_type'],
        $r['service_code'],$r['service_name'],$r['country'],$r['weight_label'],$r['weight_kg'],
        $r['zone'],$r['rate'],$r['rate_raw'],$r['transit_time'],json_encode($r['raw'],JSON_UNESCAPED_UNICODE)
    ]);
}

function recordWorksheet(PDO $pdo, int $vendorId, int $batchId, string $sheetName, string $sheetType, int $rowCount, ?string $headers, int $order): void {
    $st = $pdo->prepare("INSERT INTO vendor_worksheets (vendor_id, batch_id, sheet_name, sheet_type, row_count, column_headers, display_order) VALUES (?,?,?,?,?,?,?)");
    $st->execute([$vendorId, $batchId, $sheetName, $sheetType, $rowCount, $headers, $order]);
}

/**
 * Ingest the standardized 115-column 'RATE DATA' worksheet.
 * When this sheet is present, all other sheets are ignored.
 */
function importRateDataWorksheet(PDO $pdo, \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $ws, int $vendorId, int $batchId): array {
    $pdo = ensureDbConnection($pdo);
    ensureRateMatrixTable($pdo);

    $rows = $ws->toArray(null, true, true, false);
    if (!$rows || count($rows) < 2) {
        return ['count' => 0, 'sheets' => [$ws->getTitle()]];
    }

    $vSt = $pdo->prepare("SELECT slug FROM vendors WHERE id = ?");
    $vSt->execute([$vendorId]);
    $vendorCode = $vSt->fetchColumn() ?: 'pacific';

    $headers = array_map(fn($x) => trim((string)$x), $rows[0]);
    $sheetTitle = $ws->getTitle();

    // Map weight columns (Column index 9 onward, e.g. "0.5 KG", "1 KG", ..., "100 KG")
    $weightColMap = [];
    $totalCols = count($headers);
    for ($c = 9; $c < $totalCols; $c++) {
        $head = $headers[$c] ?? '';
        if (preg_match('/(\d+(?:\.\d+)?)\s*(?:kg|kgs)?/i', $head, $m)) {
            $w = (float)$m[1];
            $key = (fmod($w, 1.0) == 0.0) ? (string)(int)$w : sprintf("%.1f", $w);
            $weightColMap[$c] = [
                'weight' => $w,
                'key' => $key,
                'label' => $head
            ];
        }
    }

    $insertMatrixSt = $pdo->prepare(
        "INSERT INTO vendor_rate_matrix 
         (batch_id, vendor_id, vendor_code, destination, state, service_code, service_name, zone, postcode_raw, town_city, duty_paid, transit_time, weight_rates, min_weight, max_weight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $insertCsSt = $pdo->prepare(
        "INSERT IGNORE INTO vendor_country_services (batch_id, vendor_id, service_code, country)
         VALUES (?, ?, ?, ?)"
    );

    $rowCount = 0;
    $zoneRowCount = 0;
    $uniqueCs = [];
    $zoneChunk = [];

    $flushZoneChunk = function(array &$chunk) use ($pdo, $batchId, $vendorId, &$zoneRowCount) {
        if (empty($chunk)) return;
        $zoneRowCount += count($chunk);
        $rowPlaceholders = [];
        $values = [];
        foreach ($chunk as $item) {
            $rowPlaceholders[] = "(?, ?, ?, ?, ?, ?, ?)";
            $values[] = $batchId;
            $values[] = $vendorId;
            $values[] = $item['country'];
            $values[] = $item['postcode'];
            $values[] = $item['zone'];
            $values[] = $item['town_city'];
            $values[] = $item['remote_status'];
        }
        $sql = "INSERT INTO vendor_zone_rows (batch_id, vendor_id, country, postcode, zone, town_city, remote_status) VALUES " . implode(',', $rowPlaceholders);
        $pdo->prepare($sql)->execute($values);
        $chunk = [];
    };

    $pdo->beginTransaction();

    try {
        foreach (array_slice($rows, 1) as $ri => $row) {
            $dest = clean($row[0] ?? null);
            if (!$dest) continue;

            $state = clean($row[1] ?? null);
            $sc = clean($row[2] ?? null);
            if (!$sc) continue;

            $sName = clean($row[3] ?? null);
            $zone = clean($row[4] ?? null);
            $postcodeRaw = clean($row[5] ?? null);
            $town = clean($row[6] ?? null);
            $dutyPaid = clean($row[7] ?? null);
            $transit = clean($row[8] ?? null);

            // Extract weight rates
            $weightRates = [];
            $minWeight = 0.50;
            $maxWeight = 0.50;

            foreach ($weightColMap as $ci => $info) {
                $val = null;
                // If cell has a formula, retrieve the cached calculated value saved by Excel
                try {
                    $coord = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($ci + 1) . ($ri + 2);
                    $cell = $ws->getCell($coord);
                    if ($cell) {
                        if ($cell->isFormula()) {
                            // Extract pre-computed numeric value stored by Excel
                            $val = $cell->getOldCalculatedValue();
                            if ($val === null || $val === '' || is_object($val)) {
                                try {
                                    $val = $cell->getCalculatedValue();
                                } catch (\Throwable $e) {
                                    $val = null;
                                }
                            }
                        } else {
                            $val = $cell->getValue();
                            if ($val instanceof \PhpOffice\PhpSpreadsheet\RichText\RichText) {
                                $val = $val->getPlainText();
                            }
                        }
                    }
                } catch (\Throwable $e) {}

                if ($val === null || $val === '') {
                    $val = $row[$ci] ?? null;
                }
                if ($val === null || $val === '') continue;

                [$num, $raw] = numericRate($val);
                if ($num !== null && $num > 0) {
                    $weightRates[$info['key']] = $num;
                    $weightRates[$info['key'] . ' KG'] = $num;
                    if ($info['weight'] > $maxWeight) {
                        $maxWeight = $info['weight'];
                    }
                }
            }

            if (empty($weightRates)) continue;

            $insertMatrixSt->execute([
                $batchId,
                $vendorId,
                $vendorCode,
                $dest,
                $state ?: '',
                $sc,
                $sName ?: '',
                $zone ?: '',
                $postcodeRaw,
                $town ?: '',
                $dutyPaid ?: '',
                $transit ?: '',
                json_encode($weightRates, JSON_UNESCAPED_UNICODE),
                $minWeight,
                $maxWeight
            ]);

            $rowCount++;

            // Track country services
            $csKey = $sc . '|' . $dest;
            if (!isset($uniqueCs[$csKey])) {
                $uniqueCs[$csKey] = true;
                $insertCsSt->execute([$batchId, $vendorId, $sc, $dest]);
            }

            // Parse Postcodes with Remote Area Tags (e.g. YES, NO, YES/NO -> BOTH)
            if ($postcodeRaw !== null && $postcodeRaw !== '') {
                $parsedPostcodes = parsePostcodesWithRemoteTags($postcodeRaw);
                foreach ($parsedPostcodes as $pItem) {
                    $zoneChunk[] = [
                        'country' => $dest,
                        'postcode' => $pItem['postcode'],
                        'zone' => $zone ?: null,
                        'town_city' => $town ?: ($state ?: null),
                        'remote_status' => $pItem['remote_status']
                    ];

                    // Flush in chunks of 250 rows for fast bulk insertion
                    if (count($zoneChunk) >= 250) {
                        $flushZoneChunk($zoneChunk);
                    }
                }
            }
        }

        // Flush remaining zone rows
        if (!empty($zoneChunk)) {
            $flushZoneChunk($zoneChunk);
        }

        recordWorksheet($pdo, $vendorId, $batchId, $sheetTitle, 'rate_data', $rowCount, json_encode($headers), 0);
        $importedSheets = [$sheetTitle];
        if ($zoneRowCount > 0) {
            recordWorksheet($pdo, $vendorId, $batchId, 'Postcode Zones', 'zones', $zoneRowCount, null, 1);
            $importedSheets[] = 'Postcode Zones';
        }

        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return ['count' => $rowCount, 'sheets' => $importedSheets];
}

function importWorkbook(string $path, int $vendorId, int $batchId): array {
    $pdo = db();

    // Use readDataOnly for faster loading and reduced memory usage
    $reader = IOFactory::createReaderForFile($path);
    if (method_exists($reader, 'setReadDataOnly')) {
        $reader->setReadDataOnly(true);
    }
    $book = $reader->load($path);

    // Ensure DB connection is active after workbook loading
    $pdo = ensureDbConnection($pdo);

    $count = 0;
    $sheetNames = [];
    $sheetOrder = 0;

    // PRIORITY: Check for standardized 'RATE DATA' sheet first
    // If present, ONLY process this worksheet and ignore all other sheets
    foreach ($book->getWorksheetIterator() as $ws) {
        $sheetTitle = trim($ws->getTitle());
        if (strcasecmp($sheetTitle, 'RATE DATA') === 0 || strcasecmp($sheetTitle, 'RATEDATA') === 0) {
            return importRateDataWorksheet($pdo, $ws, $vendorId, $batchId);
        }
    }

    foreach ($book->getWorksheetIterator() as $ws) {
        $sheet = $ws->getTitle();
        $rows = $ws->toArray(null, true, true, false);
        if (!$rows || count($rows) < 2) continue;

        $headers = array_map(fn($x) => strtolower(trim((string)$x)), $rows[0]);
        $headerLabels = array_map(fn($x) => trim((string)$x), $rows[0]);

        $find = function(array $needles) use ($headers): int|false {
            foreach ($headers as $i => $head) {
                foreach ($needles as $needle) {
                    if ($head === strtolower($needle)) return $i;
                }
            }
            return false;
        };

        $serviceI = $find(['service code','service_code']);
        $destI = $find(['destination']);
        $weightI = $find(['weight (kg)','weight','weight(kg)']);
        $countryI = $find(['country']);
        $zipI = $find(['zipcode','zip code','postcode','postal code','zip']);
        $zoneI = $find(['zone']);
        $townI = $find(['town/city','town','city']);
        $serviceNameI = $find(['service','service name','service_name']);
        $transitI = $find(['transit time ex-bom','transit time','transit']);

        $isZones = ($countryI !== false && $zipI !== false && $zoneI !== false);
        $isCountryServices = ($serviceI !== false && $countryI !== false && $destI === false && $weightI === false && $zoneI === false && $zipI === false);
        $isZonewise = ($serviceI !== false && $weightI !== false && $destI === false && !$isZones && !$isCountryServices);
        $isRegular = ($serviceI !== false && $destI !== false);

        $sheetRowCount = 0;
        $sheetType = 'unknown';

        if ($isZones) {
            $sheetType = 'zones';
            $st = $pdo->prepare("INSERT INTO vendor_zone_rows(batch_id,vendor_id,country,postcode,zone,town_city) VALUES(?,?,?,?,?,?)");
            foreach (array_slice($rows, 1) as $ri => $row) {
                $country = clean($row[$countryI] ?? null);
                $zipRaw = clean($row[$zipI] ?? null);
                if (!$country || !$zipRaw) continue;
                $zone = clean($row[$zoneI] ?? null);
                $town = $townI !== false ? clean($row[$townI] ?? null) : null;

                // Expand ranges like "113 to 209", "BT1 to BT94", "FK17 to FK21", "113-209", etc.
                // Every in-between number is counted and inserted individually
                $expandedZips = expandPostcodeRange($zipRaw);
                foreach ($expandedZips as $zip) {
                    $st->execute([$batchId, $vendorId, $country, $zip, $zone, $town]);
                    $count++; 
                    $sheetRowCount++;
                }
            }
        } elseif ($isCountryServices) {
            $sheetType = 'country_services';
            $st = $pdo->prepare("INSERT INTO vendor_country_services(batch_id,vendor_id,service_code,country) VALUES(?,?,?,?)");
            foreach (array_slice($rows, 1) as $row) {
                $sc = clean($row[$serviceI] ?? null);
                $co = clean($row[$countryI] ?? null);
                if ($sc && $co) {
                    $st->execute([$batchId, $vendorId, $sc, $co]);
                    $count++; $sheetRowCount++;
                }
            }
        } elseif ($isRegular) {
            $sheetType = 'regular';
            $weightCols = [];
            foreach ($headers as $i => $head) {
                if ($i === $serviceI || $i === $destI || $i === $serviceNameI || $i === $transitI) continue;
                if (preg_match('/\d/', $head)) $weightCols[$i] = trim((string)$rows[0][$i]);
            }
            foreach (array_slice($rows, 1) as $ri => $row) {
                $sc = clean($row[$serviceI] ?? null);
                $country = clean($row[$destI] ?? null);
                if (!$sc || !$country) continue;
                foreach ($weightCols as $ci => $label) {
                    [$rate, $raw] = numericRate($row[$ci] ?? null);
                    insertRate($pdo, [
                        'batch_id' => $batchId, 'vendor_id' => $vendorId, 'sheet_name' => $sheet, 'source_row' => $ri + 2,
                        'rate_type' => 'regular', 'service_code' => $sc,
                        'service_name' => $serviceNameI !== false ? clean($row[$serviceNameI] ?? null) : null,
                        'country' => $country, 'weight_label' => $label, 'weight_kg' => weightKg($label),
                        'zone' => null, 'rate' => $rate, 'rate_raw' => $raw,
                        'transit_time' => $transitI !== false ? clean($row[$transitI] ?? null) : null, 'raw' => $row
                    ]);
                    $count++; $sheetRowCount++;
                }
            }
        } elseif ($isZonewise) {
            $sheetType = 'zonewise';
            $zoneCols = [];
            foreach ($headers as $i => $head) {
                if (preg_match('/^zone\s*\d+(?:\/\d+)?$/i', $head)) {
                    $zoneCols[$i] = trim((string)$rows[0][$i]);
                }
            }
            foreach (array_slice($rows, 1) as $ri => $row) {
                $sc = clean($row[$serviceI] ?? null);
                $country = clean($countryI !== false ? ($row[$countryI] ?? null) : null);
                if (!$sc) continue;
                foreach ($zoneCols as $ci => $zone) {
                    [$rate, $raw] = numericRate($row[$ci] ?? null);
                    insertRate($pdo, [
                        'batch_id' => $batchId, 'vendor_id' => $vendorId, 'sheet_name' => $sheet, 'source_row' => $ri + 2,
                        'rate_type' => 'zonewise', 'service_code' => $sc,
                        'service_name' => $serviceNameI !== false ? clean($row[$serviceNameI] ?? null) : null,
                        'country' => $country, 'weight_label' => clean($row[$weightI] ?? null),
                        'weight_kg' => is_numeric($row[$weightI] ?? null) ? (float)$row[$weightI] : null,
                        'zone' => $zone, 'rate' => $rate, 'rate_raw' => $raw,
                        'transit_time' => $transitI !== false ? clean($row[$transitI] ?? null) : null, 'raw' => $row
                    ]);
                    $count++; $sheetRowCount++;
                }
            }
        }

        $sheetNames[] = $sheet;
        recordWorksheet($pdo, $vendorId, $batchId, $sheet, $sheetType, $sheetRowCount, json_encode($headerLabels), $sheetOrder++);
    }

    return ['count' => $count, 'sheets' => $sheetNames];
}

function processUpload(array $postData, array $fileData): array {
    $config = getConfig();
    $vendorName = trim((string)($postData['vendor_name'] ?? ''));
    if ($vendorName === '') throw new RuntimeException('Enter a vendor name.');

    $f = $fileData;
    if ($f['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Upload failed. Check PHP upload limits.');
    if ($f['size'] > $config['max_upload_mb'] * 1024 * 1024) throw new RuntimeException('File exceeds configured upload limit.');

    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) throw new RuntimeException('Only XLSX, XLS or CSV files are allowed.');

    $pdo = db();
    $pdo->beginTransaction();

    $slug = slugify($vendorName);
    $q = $pdo->prepare("SELECT id FROM vendors WHERE slug = ?");
    $q->execute([$slug]);
    $vendor = $q->fetch();

    if ($vendor) {
        $vendorId = (int)$vendor['id'];
    } else {
        $pdo->prepare("INSERT INTO vendors(name, slug) VALUES(?, ?)")->execute([$vendorName, $slug]);
        $vendorId = (int)$pdo->lastInsertId();
    }

    $stored = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!is_dir($config['upload_dir'])) mkdir($config['upload_dir'], 0750, true);
    $dest = $config['upload_dir'] . '/' . $stored;
    if (!move_uploaded_file($f['tmp_name'], $dest)) throw new RuntimeException('Could not store uploaded workbook.');

    $pdo->prepare("INSERT INTO import_batches(vendor_id, original_filename, stored_filename, file_sha256, status) VALUES(?, ?, ?, ?, 'processing')")
        ->execute([$vendorId, $f['name'], $stored, hash_file('sha256', $dest)]);
    $batchId = (int)$pdo->lastInsertId();
    $pdo->commit();

    try {
        $result = importWorkbook($dest, $vendorId, $batchId);
        $count = $result['count'];
        $sheets = $result['sheets'];

        if ($count === 0) throw new RuntimeException('No recognized rate/zone/service rows were found. Check the workbook headers.');

        $pdo = ensureDbConnection($pdo);
        $pdo->beginTransaction();
        // Clear is_latest for previous batches of this vendor
        $pdo->prepare("UPDATE import_batches SET is_latest = 0 WHERE vendor_id = ? AND is_latest = 1")->execute([$vendorId]);
        // Mark this batch as active and latest
        $pdo->prepare("UPDATE import_batches SET status = 'active', is_latest = 1, imported_rows = ?, sheet_names = ? WHERE id = ?")
            ->execute([$count, json_encode($sheets), $batchId]);
        $pdo->commit();

        return [
            'success' => true,
            'message' => "Imported {$count} rows across " . count($sheets) . " worksheets for {$vendorName}.",
            'vendor_id' => $vendorId,
            'batch_id' => $batchId,
            'count' => $count,
            'sheets' => $sheets
        ];
    } catch (Throwable $e) {
        try {
            $pdo = ensureDbConnection($pdo);
            if ($pdo->inTransaction()) $pdo->rollBack();
            $pdo->prepare("UPDATE import_batches SET status = 'failed', error_message = ? WHERE id = ?")->execute([$e->getMessage(), $batchId]);
        } catch (\Throwable $suppressed) {}
        throw $e;
    }
}
