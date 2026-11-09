<?php
declare(strict_types=1);

// Rate API — Read rates with zone resolution + full CRUD capability
// 100% backward compatible with existing GET callers
require_once __DIR__ . '/_middleware.php';
require_once dirname(__DIR__) . '/includes/calculator.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // Query single rate by ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
            $st = $pdo->prepare("SELECT * FROM vendor_rate_rows WHERE id = ?");
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) apiRespond(404, ['ok' => false, 'error' => 'Rate row not found.']);
            apiRespond(200, ['ok' => true, 'rate' => $row]);
        }

        $vendor = trim((string)($_GET['vendor'] ?? ''));
        if ($vendor === '') apiRespond(400, ['ok' => false, 'error' => 'vendor is required']);

        // Check active batch
        $batchIdParam = isset($_GET['batch_id']) ? (int)$_GET['batch_id'] : null;
        if ($batchIdParam) {
            $st = $pdo->prepare("SELECT v.id, v.name, v.slug, b.id as batch_id FROM vendors v JOIN import_batches b ON b.vendor_id = v.id WHERE v.slug = ? AND b.id = ?");
            $st->execute([strtolower($vendor), $batchIdParam]);
            $v = $st->fetch();
        } else {
            $st = $pdo->prepare("SELECT v.id, v.name, v.slug, b.id as batch_id FROM vendors v JOIN import_batches b ON b.vendor_id = v.id AND b.status = 'active' WHERE v.slug = ? ORDER BY b.is_latest DESC, b.id DESC LIMIT 1");
            $st->execute([strtolower($vendor)]);
            $v = $st->fetch();
        }

        if (!$v) apiRespond(404, ['ok' => false, 'error' => 'Vendor or active import not found']);

        $country = trim((string)($_GET['country'] ?? ''));
        $service = trim((string)($_GET['service_code'] ?? ''));
        $weight = isset($_GET['weight_kg']) && $_GET['weight_kg'] !== '' ? (float)$_GET['weight_kg'] : null;
        $postcode = trim((string)($_GET['postcode'] ?? ''));
        $sheet = trim((string)($_GET['sheet_name'] ?? ''));
        $rateType = trim((string)($_GET['rate_type'] ?? ''));

        $calc = new RateCalculator($pdo, (int)$v['id'], (int)$v['batch_id'], $v['name']);
        $isCountryZonewise = ($country !== '') ? $calc->isCountryZonewise($country) : false;
        $countryAliases = ($country !== '') ? $calc->getCountryAliases($country) : [];

        $zone = null;
        if ($postcode !== '' && ($country === '' || $isCountryZonewise)) {
            $zoneDetails = $calc->resolveZoneDetails($country ?: '', $postcode);
            $zone = $zoneDetails['zone'] ?? null;
        }

        $where = "vendor_id = ? AND batch_id = ?";
        $args = [$v['id'], $v['batch_id']];

        if ($country !== '') {
            $cPlaceholders = implode(',', array_fill(0, count($countryAliases), '?'));
            if ($isCountryZonewise) {
                // Zone-wise country: can match regular country tariff OR global zonewise tariff rows
                $where .= " AND (country IN ({$cPlaceholders}) OR LOWER(TRIM(country)) = LOWER(?) OR (rate_type = 'zonewise' AND (country IS NULL OR country = '')))";
                $args = array_merge($args, $countryAliases, [$country]);
            } else {
                // Regular country: strictly regular country rates (zonewise is never matched)
                $where .= " AND (country IN ({$cPlaceholders}) OR LOWER(TRIM(country)) = LOWER(?))";
                $args = array_merge($args, $countryAliases, [$country]);
            }
        }
        if ($service !== '') { $where .= " AND (service_code = ? OR LOWER(TRIM(service_code)) = LOWER(?))"; $args[] = $service; $args[] = $service; }
        if ($weight !== null) { $where .= " AND weight_kg = ?"; $args[] = $weight; }
        if ($sheet !== '') { $where .= " AND sheet_name = ?"; $args[] = $sheet; }
        if ($rateType !== '') { $where .= " AND rate_type = ?"; $args[] = $rateType; }
        if ($zone) { $where .= " AND (rate_type = 'regular' OR zone = ?)"; $args[] = $zone; }

        $limit = isset($_GET['limit']) ? min(1000, max(1, (int)$_GET['limit'])) : null;
        $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

        $sql = "SELECT id, rate_type, service_code, service_name, country, weight_label, weight_kg, zone, rate, rate_raw, transit_time, sheet_name FROM vendor_rate_rows WHERE {$where} ORDER BY rate_type, service_code, weight_kg, zone";
        if ($limit !== null) {
            $sql .= " LIMIT {$limit} OFFSET {$offset}";
        }

        $q = $pdo->prepare($sql);
        $q->execute($args);
        $rates = $q->fetchAll();

        apiRespond(200, [
            'ok' => true,
            'vendor' => [
                'name' => $v['name'],
                'slug' => $v['slug'],
                'batch_id' => (int)$v['batch_id']
            ],
            'lookup' => [
                'country' => $country ?: null,
                'service_code' => $service ?: null,
                'weight_kg' => $weight,
                'postcode' => $postcode ?: null,
                'resolved_zone' => $zone
            ],
            'rates' => $rates,
            'count' => count($rates),
            'note' => 'A null rate with rate_raw "-" means unavailable/not quoted; numeric 0 is a genuine zero rate.'
        ]);

    } elseif ($method === 'POST') {
        // Create new rate or zone row
        $input = getJsonInput();
        if (empty($input)) {
            $input = !empty($_POST) ? $_POST : $_GET;
        }

        $vendorSlug = trim((string)($input['vendor'] ?? ''));
        $vendorId = (int)($input['vendor_id'] ?? 0);
        if ($vendorSlug !== '') {
            $v = getVendorBySlug($pdo, $vendorSlug);
        } elseif ($vendorId > 0) {
            $v = getVendorById($pdo, $vendorId);
        } else {
            apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'vendor slug or vendor_id is required.']);
        }
        if (!$v) apiRespond(404, ['ok' => false, 'success' => false, 'error' => 'Vendor not found.']);

        $batchId = (int)($input['batch_id'] ?? getActiveBatchId($pdo, (int)$v['id']));
        if (!$batchId) apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'No active batch found for this vendor.']);

        $sheetType = trim((string)($input['sheet_type'] ?? 'regular'));

        if ($sheetType === 'zones') {
            $country = clean($input['zone_country'] ?? ($input['country'] ?? null));
            $postcode = clean($input['postcode'] ?? null);
            $zone = clean($input['zone_value'] ?? ($input['zone'] ?? null));
            $townCity = clean($input['town_city'] ?? null);

            if (!$country || !$postcode || !$zone) {
                apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'Country, postcode, and zone are required for zone records.']);
            }

            $st = $pdo->prepare("
                INSERT INTO vendor_zone_rows
                (batch_id, vendor_id, source_row, country, postcode, zone, town_city, is_manually_modified, modified_at)
                VALUES (?, ?, 0, ?, ?, ?, ?, 1, NOW())
            ");
            $st->execute([$batchId, $v['id'], $country, $postcode, $zone, $townCity]);
            $newId = (int)$pdo->lastInsertId();
            auditLog($pdo, 'vendor_zone_rows', $newId, 'zone', null, $zone, 'insert');

            apiRespond(201, ['ok' => true, 'success' => true, 'id' => $newId, 'table' => 'vendor_zone_rows', 'message' => 'Zone record created successfully.']);
        }

        $sheetName = trim((string)($input['sheet_name'] ?? 'Custom Rates'));
        $rateType = trim((string)($input['rate_type'] ?? ($sheetType ?: 'regular')));
        $serviceCode = trim((string)($input['service_code'] ?? ''));
        $serviceName = clean($input['service_name'] ?? null);
        $country = clean($input['country'] ?? null);
        $weightLabel = clean($input['weight_label'] ?? null);
        $weightKg = isset($input['weight_kg']) && is_numeric($input['weight_kg']) ? (float)$input['weight_kg'] : weightKg($weightLabel ?? '');
        $zone = clean($input['zone'] ?? null);
        $rate = isset($input['rate']) && is_numeric($input['rate']) ? (float)$input['rate'] : (isset($input['price']) && is_numeric($input['price']) ? (float)$input['price'] : null);
        $rateRaw = clean($input['rate_raw'] ?? ($rate !== null ? (string)$rate : null));
        $transitTime = clean($input['transit_time'] ?? null);

        if ($serviceCode === '') apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'service_code is required.']);

        $st = $pdo->prepare("
            INSERT INTO vendor_rate_rows
            (batch_id, vendor_id, sheet_name, source_row, rate_type, service_code, service_name, country, weight_label, weight_kg, zone, rate, rate_raw, transit_time, is_manually_modified, modified_at)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ");
        $st->execute([
            $batchId, $v['id'], $sheetName, $rateType, $serviceCode, $serviceName,
            $country, $weightLabel, $weightKg, $zone, $rate, $rateRaw, $transitTime
        ]);
        $newId = (int)$pdo->lastInsertId();

        auditLog($pdo, 'vendor_rate_rows', $newId, 'rate', null, $rate, 'insert');

        apiRespond(201, ['ok' => true, 'success' => true, 'id' => $newId, 'table' => 'vendor_rate_rows', 'message' => 'Rate record created successfully.']);

    } elseif ($method === 'PATCH') {
        // Update rate or zone row
        $input = getJsonInput();
        if (empty($input)) {
            $input = !empty($_POST) ? $_POST : $_GET;
        }

        $id = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        if ($id <= 0) apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'id is required.']);

        $table = trim((string)($_GET['table'] ?? ($input['table'] ?? 'vendor_rate_rows')));
        if ($table !== 'vendor_zone_rows') {
            $table = 'vendor_rate_rows';
        }

        // Support { field: "rate", value: 120 } or { field: "price", value: 120 } format from client makeEditable
        if (isset($input['field']) && array_key_exists('value', $input)) {
            $fieldName = trim((string)$input['field']);
            $input[$fieldName] = $input['value'];
        }

        // Support price / unit_price / amount aliases for rate
        if ((array_key_exists('price', $input) || array_key_exists('unit_price', $input) || array_key_exists('amount', $input)) && !array_key_exists('rate', $input)) {
            $input['rate'] = $input['price'] ?? ($input['unit_price'] ?? $input['amount']);
        }
        if (array_key_exists('service', $input) && !array_key_exists('service_code', $input)) {
            $input['service_code'] = $input['service'];
        }
        if (array_key_exists('zone_value', $input) && !array_key_exists('zone', $input)) {
            $input['zone'] = $input['zone_value'];
        }
        if (array_key_exists('city', $input) && !array_key_exists('town_city', $input)) {
            $input['town_city'] = $input['city'];
        }

        $existing = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
        $existing->execute([$id]);
        $row = $existing->fetch();
        if (!$row) apiRespond(404, ['ok' => false, 'success' => false, 'error' => ($table === 'vendor_zone_rows' ? 'Zone' : 'Rate') . ' row not found.']);

        $updates = [];
        $params = [];

        if ($table === 'vendor_zone_rows') {
            $allowedZoneFields = ['zone', 'town_city', 'country', 'postcode', 'state'];
            foreach ($allowedZoneFields as $field) {
                if (array_key_exists($field, $input)) {
                    $newVal = clean($input[$field]);
                    $updates[] = "{$field} = ?";
                    $params[] = $newVal;
                    auditLog($pdo, $table, $id, $field, $row[$field] ?? null, $newVal, 'update');
                }
            }
        } else {
            $allowedRateFields = ['rate', 'rate_raw', 'transit_time', 'service_code', 'service_name', 'country', 'zone', 'weight_label', 'weight_kg', 'sheet_name', 'rate_type'];
            foreach ($allowedRateFields as $field) {
                if (array_key_exists($field, $input)) {
                    $newVal = $input[$field];
                    if ($field === 'rate') {
                        $newVal = ($newVal !== null && is_numeric($newVal)) ? (float)$newVal : null;
                    }
                    $updates[] = "{$field} = ?";
                    $params[] = $newVal;
                    auditLog($pdo, $table, $id, $field, $row[$field] ?? null, $newVal, 'update');
                }
            }

            // If rate was updated and rate_raw was not explicitly provided, keep rate_raw in sync
            if (array_key_exists('rate', $input) && !array_key_exists('rate_raw', $input)) {
                $rateVal = $input['rate'];
                $rateRawVal = ($rateVal !== null && is_numeric($rateVal)) ? (string)$rateVal : '-';
                $updates[] = "rate_raw = ?";
                $params[] = $rateRawVal;
            }
        }

        if (empty($updates)) {
            apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'No valid fields provided to update.']);
        }

        $updates[] = "is_manually_modified = 1";
        $updates[] = "modified_at = NOW()";
        $params[] = $id;

        $sql = "UPDATE {$table} SET " . implode(', ', $updates) . " WHERE id = ?";
        $pdo->prepare($sql)->execute($params);

        apiRespond(200, [
            'ok' => true,
            'success' => true,
            'id' => $id,
            'table' => $table,
            'message' => ($table === 'vendor_zone_rows' ? 'Zone' : 'Rate') . ' record updated successfully.'
        ]);

    } elseif ($method === 'DELETE') {
        // Delete rate or zone row
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'id parameter is required.']);

        $table = trim((string)($_GET['table'] ?? 'vendor_rate_rows'));
        if ($table !== 'vendor_zone_rows') {
            $table = 'vendor_rate_rows';
        }

        $existing = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
        $existing->execute([$id]);
        $row = $existing->fetch();
        if (!$row) apiRespond(404, ['ok' => false, 'success' => false, 'error' => ($table === 'vendor_zone_rows' ? 'Zone' : 'Rate') . ' row not found.']);

        $pdo->prepare("DELETE FROM {$table} WHERE id = ?")->execute([$id]);
        auditLog($pdo, $table, $id, '*', json_encode($row), null, 'delete');

        apiRespond(200, ['ok' => true, 'success' => true, 'id' => $id, 'table' => $table, 'message' => 'Record deleted successfully.']);

    } else {
        apiRespond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }
} catch (Throwable $e) {
    apiRespond(500, ['ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}
