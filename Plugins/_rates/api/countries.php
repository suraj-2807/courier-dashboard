<?php
declare(strict_types=1);

// Available Destination Countries API Endpoint — Filter by Vendor
require_once __DIR__ . '/_middleware.php';
require_once dirname(__DIR__) . '/includes/calculator.php';

$pdo = db();

try {
    $vendorSlug = trim((string)($_GET['vendor'] ?? ''));
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

    $calc = new RateCalculator($pdo, (int)$v['id'], $batchId, $v['name']);
    $countries = $calc->getAvailableCountries();
    $zonewiseCountries = $calc->getZonewiseCountries();

    apiRespond(200, [
        'success' => true,
        'ok' => true,
        'vendor' => [
            'name' => $v['name'],
            'slug' => $v['slug'],
            'batch_id' => $batchId
        ],
        'count' => count($countries),
        'countries' => $countries,
        'zonewise_countries' => $zonewiseCountries
    ]);

} catch (Throwable $e) {
    apiRespond(500, ['success' => false, 'ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}
