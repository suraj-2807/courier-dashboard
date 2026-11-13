<?php
declare(strict_types=1);

// Postcode Zone Lookup API Endpoint
require_once __DIR__ . '/_middleware.php';

$pdo = db();

try {
    $vendorSlug = trim((string)($_GET['vendor'] ?? ''));
    if ($vendorSlug === '') apiRespond(400, ['ok' => false, 'error' => 'vendor parameter is required.']);

    $v = getVendorBySlug($pdo, $vendorSlug);
    if (!$v) apiRespond(404, ['ok' => false, 'error' => 'Vendor not found.']);

    $batchId = isset($_GET['batch_id']) ? (int)$_GET['batch_id'] : getActiveBatchId($pdo, (int)$v['id']);
    if (!$batchId) apiRespond(404, ['ok' => false, 'error' => 'No active batch found for vendor.']);

    require_once dirname(__DIR__) . '/includes/calculator.php';

    $country = trim((string)($_GET['country'] ?? ''));
    $postcode = trim((string)($_GET['postcode'] ?? ''));
    $state = trim((string)($_GET['state'] ?? ''));

    if ($country === '' || ($postcode === '' && $state === '')) {
        apiRespond(400, ['ok' => false, 'error' => 'Country and either postcode or state parameter are required.']);
    }

    $calc = new RateCalculator($pdo, (int)$v['id'], $batchId, $v['name']);
    $result = $calc->resolveZoneDetails($country, $postcode, $state);

    if (!$result) {
        $loc = trim(($postcode ?: '') . ($postcode && $state ? ' / ' : '') . ($state ?: ''));
        apiRespond(404, [
            'ok' => false,
            'vendor' => ['name' => $v['name'], 'slug' => $v['slug']],
            'country' => $country,
            'postcode' => $postcode,
            'state' => $state,
            'error' => "No zone mapping found for location '{$loc}' in {$country}."
        ]);
    }

    apiRespond(200, [
        'ok' => true,
        'vendor' => ['name' => $v['name'], 'slug' => $v['slug']],
        'country' => $country,
        'postcode' => $postcode,
        'state' => $state,
        'resolved_zone' => $result['zone'],
        'town_city' => $result['town_city'],
        'remote_status' => $result['remote_status'] ?? 'NONE',
        'is_remote' => in_array($result['remote_status'] ?? 'NONE', ['YES', 'BOTH'], true),
        'matched_postcode_rule' => $result['postcode']
    ]);

} catch (Throwable $e) {
    apiRespond(500, ['ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}
