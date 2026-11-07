<?php
// Import History Page — audit log and management of all uploaded workbooks
$vendors = $pdo->query("SELECT * FROM vendors ORDER BY name")->fetchAll();

$filterVendor = trim($_GET['vendor'] ?? '');
$filterStatus = trim($_GET['status'] ?? '');

// Handle status change or set latest
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $batchId = (int)($_POST['batch_id'] ?? 0);
    $action = $_POST['action'];

    if ($action === 'set_latest' && $batchId > 0) {
        $batch = $pdo->prepare("SELECT vendor_id FROM import_batches WHERE id = ?");
        $batch->execute([$batchId]);
        $b = $batch->fetch();
        if ($b) {
            $vid = (int)$b['vendor_id'];
            $pdo->beginTransaction();
            $pdo->prepare("UPDATE import_batches SET is_latest = 0 WHERE vendor_id = ?")->execute([$vid]);
            $pdo->prepare("UPDATE import_batches SET is_latest = 1, status = 'active' WHERE id = ?")->execute([$batchId]);
            $pdo->commit();
            echo '<div class="alert alert-success">✓ Batch #' . $batchId . ' is now the active version for this vendor.</div>';
        }
    } elseif ($action === 'archive' && $batchId > 0) {
        $pdo->prepare("UPDATE import_batches SET status = 'archived', is_latest = 0 WHERE id = ?")->execute([$batchId]);
        echo '<div class="alert alert-info">Batch #' . $batchId . ' marked as archived.</div>';
    }
}

// Build query
$where = ["1=1"];
$params = [];

if ($filterVendor !== '') {
    $where[] = "v.slug = ?";
    $params[] = $filterVendor;
}
if ($filterStatus !== '') {
    $where[] = "b.status = ?";
    $params[] = $filterStatus;
}

$whereSql = implode(' AND ', $where);

// Count for pagination
$countSt = $pdo->prepare("SELECT COUNT(*) FROM import_batches b JOIN vendors v ON v.id = b.vendor_id WHERE {$whereSql}");
$countSt->execute($params);
$total = (int)$countSt->fetchColumn();

$pagination = paginationParams();
$params[] = $pagination['per_page'];
$params[] = $pagination['offset'];

$st = $pdo->prepare("
    SELECT b.*, v.name as vendor_name, v.slug as vendor_slug,
    (SELECT COUNT(*) FROM vendor_worksheets ws WHERE ws.batch_id = b.id) as worksheet_count
    FROM import_batches b
    JOIN vendors v ON v.id = b.vendor_id
    WHERE {$whereSql}
    ORDER BY b.id DESC
    LIMIT ? OFFSET ?
");
$st->execute($params);
$batches = $st->fetchAll();
?>

<div class="flex-between mb-24">
    <div>
        <h2>Import History & Versions</h2>
        <p class="text-muted text-sm">Audit log of all uploaded workbooks, versions, and import statuses</p>
    </div>
    <div style="display:flex; gap:10px;">
        <button class="btn btn-primary" onclick="document.getElementById('upload-modal').classList.remove('hidden')">⬆ Upload Workbook</button>
    </div>
</div>

<!-- Filters -->
<div class="card mb-20" style="padding:16px 20px;">
    <form method="get" class="filter-bar" style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
        <input type="hidden" name="page" value="import_history">
        <div style="flex:1; min-width:200px;">
            <select name="vendor" class="form-control" onchange="this.form.submit()">
                <option value="">All Vendors</option>
                <?php foreach ($vendors as $v): ?>
                    <option value="<?= h($v['slug']) ?>" <?= $filterVendor === $v['slug'] ? 'selected' : '' ?>><?= h($v['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div style="width:180px;">
            <select name="status" class="form-control" onchange="this.form.submit()">
                <option value="">All Statuses</option>
                <option value="active" <?= $filterStatus === 'active' ? 'selected' : '' ?>>Active</option>
                <option value="failed" <?= $filterStatus === 'failed' ? 'selected' : '' ?>>Failed</option>
                <option value="processing" <?= $filterStatus === 'processing' ? 'selected' : '' ?>>Processing</option>
                <option value="archived" <?= $filterStatus === 'archived' ? 'selected' : '' ?>>Archived</option>
            </select>
        </div>
        <?php if ($filterVendor !== '' || $filterStatus !== ''): ?>
            <a href="?page=import_history" class="btn btn-outline btn-sm">Clear Filters</a>
        <?php endif; ?>
        <span class="text-sm text-muted" style="margin-left:auto;">Found <?= number_format($total) ?> batch<?= $total !== 1 ? 'es' : '' ?></span>
    </form>
</div>

<!-- Batches Table -->
<div class="card card-flush">
    <div class="table-wrapper">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:70px;">ID</th>
                    <th>Vendor</th>
                    <th>Original Filename</th>
                    <th>Status</th>
                    <th>Rows</th>
                    <th>Sheets</th>
                    <th>SHA-256 Hash</th>
                    <th>Uploaded At</th>
                    <th style="text-align:right;">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($batches)): ?>
                    <tr>
                        <td colspan="9" class="text-center py-24 text-muted">No import batches found.</td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($batches as $b): ?>
                        <tr>
                            <td class="font-mono text-sm">#<?= $b['id'] ?></td>
                            <td>
                                <a href="?page=vendor_detail&slug=<?= h($b['vendor_slug']) ?>" style="font-weight:600;">
                                    <?= h($b['vendor_name']) ?>
                                </a>
                            </td>
                            <td>
                                <div style="font-weight:500;"><?= h($b['original_filename']) ?></div>
                                <div class="text-xs text-muted font-mono"><?= h($b['stored_filename']) ?></div>
                            </td>
                            <td>
                                <?php
                                $badgeClass = match($b['status']) {
                                    'active' => 'badge-success',
                                    'failed' => 'badge-danger',
                                    'archived' => 'badge-neutral',
                                    default => 'badge-warning'
                                };
                                ?>
                                <span class="badge <?= $badgeClass ?>"><?= h($b['status']) ?></span>
                                <?php if (!empty($b['is_latest'])): ?>
                                    <span class="badge badge-info" style="margin-left:4px;" title="Current active version">Current Active</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <strong><?= number_format((int)$b['imported_rows']) ?></strong>
                            </td>
                            <td>
                                <span class="badge badge-neutral"><?= (int)$b['worksheet_count'] ?> sheets</span>
                            </td>
                            <td class="font-mono text-xs text-muted" title="<?= h($b['file_sha256'] ?? '') ?>">
                                <?= substr(h($b['file_sha256'] ?? '—'), 0, 12) ?>...
                            </td>
                            <td class="text-sm text-muted">
                                <?= date('M j, Y H:i', strtotime($b['created_at'])) ?>
                            </td>
                            <td style="text-align:right; white-space:nowrap;">
                                <?php if ($b['status'] === 'failed' && !empty($b['error_message'])): ?>
                                    <button class="btn btn-outline btn-sm text-danger" onclick="alert('Error Details:\n\n<?= addslashes(h($b['error_message'])) ?>')">View Error</button>
                                <?php endif; ?>

                                <?php if (empty($b['is_latest']) && $b['status'] !== 'failed'): ?>
                                    <form method="post" action="?page=import_history" style="display:inline;" onsubmit="return confirm('Make Batch #<?= $b['id'] ?> the active rate sheet for <?= h($b['vendor_name']) ?>?');">
                                        <input type="hidden" name="batch_id" value="<?= $b['id'] ?>">
                                        <input type="hidden" name="action" value="set_latest">
                                        <button type="submit" class="btn btn-outline btn-sm" title="Rollback or promote to active version">Set Active</button>
                                    </form>
                                <?php endif; ?>

                                <?php if ($b['status'] === 'active' && empty($b['is_latest'])): ?>
                                    <form method="post" action="?page=import_history" style="display:inline;">
                                        <input type="hidden" name="batch_id" value="<?= $b['id'] ?>">
                                        <input type="hidden" name="action" value="archive">
                                        <button type="submit" class="btn btn-outline btn-sm text-muted">Archive</button>
                                    </form>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    <?php require __DIR__ . '/_pagination.php'; ?>
</div>

<!-- Upload Modal -->
<div id="upload-modal" class="modal-overlay hidden">
    <div class="modal-card">
        <div class="modal-header">
            <h3>Upload Vendor Rate Sheet</h3>
            <button class="modal-close" onclick="document.getElementById('upload-modal').classList.add('hidden')">&times;</button>
        </div>
        <form method="post" enctype="multipart/form-data" action="?page=import_history">
            <div class="modal-body">
                <div class="form-group mb-16">
                    <label class="form-label">Vendor Name</label>
                    <input class="form-control" name="vendor_name" list="vendor-list" placeholder="Select or type vendor name" required>
                    <datalist id="vendor-list">
                        <?php foreach ($vendors as $v): ?>
                            <option value="<?= h($v['name']) ?>">
                        <?php endforeach; ?>
                    </datalist>
                    <p class="form-hint">Typing a new name automatically registers the vendor.</p>
                </div>
                <div class="form-group mb-16">
                    <label class="form-label">Workbook File (.xlsx, .xls, .csv)</label>
                    <input class="form-control" type="file" name="workbook" accept=".xlsx,.xls,.csv" required>
                    <p class="form-hint">Supports multi-sheet workbooks with regular, zonewise, and postcode sheets.</p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="document.getElementById('upload-modal').classList.add('hidden')">Cancel</button>
                <button type="submit" name="upload" class="btn btn-primary">Start Import</button>
            </div>
        </form>
    </div>
</div>
