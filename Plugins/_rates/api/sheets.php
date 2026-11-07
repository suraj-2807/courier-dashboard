<?php
declare(strict_types=1);

// Worksheets API Endpoint
require_once __DIR__ . '/_middleware.php';

$pdo = db();

try {
    $vendorSlug = trim((string)($_GET['vendor'] ?? ''));
    if ($vendorSlug === '') apiRespond(400, ['ok' => false, 'error' => 'vendor parameter is required.']);

    $v = getVendorBySlug($pdo, $vendorSlug);
    if (!$v) apiRespond(404, ['ok' => false, 'error' => 'Vendor not found.']);

    $batchId = isset($_GET['batch_id']) ? (int)$_GET['batch_id'] : getActiveBatchId($pdo, (int)$v['id']);
    if (!$batchId) apiRespond(404, ['ok' => false, 'error' => 'No active batch found for vendor.']);

    // If specific sheet name is requested to fetch rows
    $sheetName = trim((string)($_GET['sheet'] ?? ''));
    if ($sheetName !== '') {
        $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        $countSt = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ?");
        $countSt->execute([$v['id'], $batchId, $sheetName]);
        $total = (int)$countSt->fetchColumn();

        $rowsSt = $pdo->prepare("SELECT * FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ? ORDER BY id ASC LIMIT ? OFFSET ?");
        $rowsSt->execute([$v['id'], $batchId, $sheetName, $limit, $offset]);
        $rows = $rowsSt->fetchAll();

        apiRespond(200, [
            'ok' => true,
            'vendor' => ['name' => $v['name'], 'slug' => $v['slug']],
            'batch_id' => $batchId,
            'sheet_name' => $sheetName,
            'total_rows' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'rows' => $rows
        ]);
    }

    // List all worksheets for this batch
    $worksheets = getVendorWorksheets($pdo, (int)$v['id'], $batchId);
    
    // Fallback if vendor_worksheets table is not yet populated
    if (empty($worksheets)) {
        $st = $pdo->prepare("SELECT DISTINCT sheet_name, rate_type FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ?");
        $st->execute([$v['id'], $batchId]);
        $rawSheets = $st->fetchAll();
        $worksheets = [];
        foreach ($rawSheets as $rs) {
            $worksheets[] = [
                'sheet_name' => $rs['sheet_name'],
                'sheet_type' => $rs['rate_type'],
                'row_count' => 0
            ];
        }
    }

    apiRespond(200, [
        'ok' => true,
        'vendor' => ['name' => $v['name'], 'slug' => $v['slug']],
        'batch_id' => $batchId,
        'worksheets' => $worksheets,
        'count' => count($worksheets)
    ]);

} catch (Throwable $e) {
    apiRespond(500, ['ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}
