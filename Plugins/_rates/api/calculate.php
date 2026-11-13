<?php
declare(strict_types=1);

// Rate Calculation API Endpoint
// Supports GET, POST with JSON body or form data
require_once __DIR__ . '/_middleware.php';
require_once dirname(__DIR__) . '/includes/calculator.php';

$pdo = db();

try {
    $json = getJsonInput();
    
    // Resolve inputs from JSON body, POST, or GET
    $vendorSlug = trim((string)($json['vendor'] ?? ($_POST['vendor'] ?? ($_GET['vendor'] ?? ''))));
    $country = trim((string)($json['country'] ?? ($_POST['country'] ?? ($_GET['country'] ?? ''))));
    $serviceCode = trim((string)($json['service_code'] ?? ($_POST['service_code'] ?? ($_GET['service_code'] ?? ''))));
    $postcode = clean($json['postcode'] ?? ($_POST['postcode'] ?? ($_GET['postcode'] ?? null)));
    $state = clean($json['state'] ?? ($_POST['state'] ?? ($_GET['state'] ?? null)));
    
    $rawWeight = $json['weight_kg'] ?? ($_POST['weight_kg'] ?? ($_GET['weight_kg'] ?? null));
    $weightKg = ($rawWeight !== null && is_numeric($rawWeight)) ? (float)$rawWeight : 0.0;

    if ($vendorSlug === '') {
        apiRespond(400, ['success' => false, 'ok' => false, 'error' => "Parameter 'vendor' is required."]);
    }

    $v = getVendorBySlug($pdo, $vendorSlug);
    if (!$v) {
        apiRespond(404, ['success' => false, 'ok' => false, 'error' => "Vendor '{$vendorSlug}' not found."]);
    }

    $batchId = getActiveBatchId($pdo, (int)$v['id']);
    if (!$batchId) {
        apiRespond(404, ['success' => false, 'ok' => false, 'error' => "No active rate workbook found for vendor '{$vendorSlug}'."]);
    }

    if (empty($country)) {
        apiRespond(400, ['success' => false, 'ok' => false, 'error' => "Parameter 'country' is required."]);
    }
    if (empty($serviceCode)) {
        apiRespond(400, ['success' => false, 'ok' => false, 'error' => "Parameter 'service_code' is required."]);
    }
    if ($weightKg <= 0) {
        apiRespond(400, ['success' => false, 'ok' => false, 'error' => "Parameter 'weight_kg' must be greater than 0."]);
    }

    $calc = new RateCalculator($pdo, (int)$v['id'], $batchId, $v['name']);
    $result = $calc->calculate($country, $serviceCode, $weightKg, $postcode, $state);

    if (empty($result['success'])) {
        apiRespond(422, [
            'success' => false,
            'ok' => false,
            'vendor' => $v['name'],
            'service' => $serviceCode,
            'country' => $country,
            'postcode' => $postcode,
            'state' => $state,
            'actual_weight' => $weightKg,
            'error' => $result['error'] ?? 'Rate calculation failed.'
        ]);
    }

    // Build standard response structure
    apiRespond(200, [
        'success' => true,
        'ok' => true,
        'vendor' => $v['name'],
        'service' => $serviceCode,
        'country' => $country,
        'postcode' => $postcode,
        'state' => $state,
        'zone' => $result['zone'] ?? null,
        'town_city' => $result['town_city'] ?? null,
        'remote_status' => $result['remote_status'] ?? 'NONE',
        'is_remote' => !empty($result['is_remote']),
        'duty_paid' => $result['duty_paid'] ?? null,
        'actual_weight' => $weightKg,
        'chargeable_weight' => (float)($result['chargeable_weight'] ?? $weightKg),
        'rate_type' => $result['rate_type'] ?? 'regular',
        'rate_per_kg' => (float)($result['base_rate'] ?? 0.0),
        'final_rate' => (float)($result['final_rate'] ?? 0.0),
        'currency' => $result['currency'] ?? 'INR',
        'sheet_name' => $result['sheet_name'] ?? null,
        'transit_time' => $result['transit_time'] ?? null,
        'active_slab' => $result['active_slab'] ?? null,
        'sheet_grid' => $result['sheet_grid'] ?? null,
        'formula' => $result['formula'] ?? ($result['calculation']['formula'] ?? null),
        'calculation' => $result['calculation'] ?? [
            'method' => 'standard',
            'base_rate' => (float)($result['base_rate'] ?? 0.0),
            'additional_charge' => (float)($result['additional_charge'] ?? 0.0),
            'breakdown' => $result['breakdown'] ?? []
        ],
        'meta' => [
            'vendor_slug' => $v['slug'],
            'batch_id' => $batchId
        ]
    ]);

} catch (Throwable $e) {
    apiRespond(500, ['success' => false, 'ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}
