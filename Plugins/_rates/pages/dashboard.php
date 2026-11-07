<?php
// Dashboard Page
$stats = getDashboardStats($pdo);
?>
<div class="stats-grid">
    <div class="stat-card blue">
        <div class="stat-label">Total Vendors</div>
        <div class="stat-value"><?= $stats['total_vendors'] ?></div>
        <div class="stat-icon">📦</div>
    </div>
    <div class="stat-card green">
        <div class="stat-label">Active Versions</div>
        <div class="stat-value"><?= $stats['active_versions'] ?></div>
        <div class="stat-icon">✓</div>
    </div>
    <div class="stat-card purple">
        <div class="stat-label">Rate Records</div>
        <div class="stat-value"><?= number_format($stats['total_rate_rows']) ?></div>
        <div class="stat-icon">📊</div>
    </div>
    <div class="stat-card orange">
        <div class="stat-label">Zone Mappings</div>
        <div class="stat-value"><?= number_format($stats['total_zone_rows']) ?></div>
        <div class="stat-icon">🗺</div>
    </div>
    <div class="stat-card blue">
        <div class="stat-label">Service Mappings</div>
        <div class="stat-value"><?= number_format($stats['total_service_rows']) ?></div>
        <div class="stat-icon">🔗</div>
    </div>
    <div class="stat-card red">
        <div class="stat-label">Failed Imports</div>
        <div class="stat-value"><?= $stats['failed_imports'] ?></div>
        <div class="stat-icon">⚠</div>
    </div>
</div>

<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
    <div class="card card-flush">
        <div class="card-header">
            <h3>Recent Uploads</h3>
            <a href="?page=import_history" class="btn btn-outline btn-sm">View All</a>
        </div>
        <div class="card-body">
            <?php if (empty($stats['recent_uploads'])): ?>
                <div class="empty-state"><p>No uploads yet</p></div>
            <?php else: ?>
                <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Vendor</th><th>File</th><th>Status</th><th>Rows</th><th>Date</th></tr></thead>
                    <tbody>
                    <?php foreach ($stats['recent_uploads'] as $b): ?>
                    <tr>
                        <td><a href="?page=vendor_detail&slug=<?= h(strtolower($b['vendor_name'])) ?>"><?= h($b['vendor_name']) ?></a></td>
                        <td class="truncate" style="max-width:200px" title="<?= h($b['original_filename']) ?>"><?= h($b['original_filename']) ?></td>
                        <td>
                            <?php
                            $badgeClass = match($b['status']) { 'active' => 'badge-success', 'failed' => 'badge-danger', default => 'badge-warning' };
                            ?>
                            <span class="badge <?= $badgeClass ?>"><?= h($b['status']) ?></span>
                            <?php if (!empty($b['is_latest'])): ?><span class="badge badge-info" style="margin-left:4px;">latest</span><?php endif; ?>
                        </td>
                        <td><?= number_format((int)$b['imported_rows']) ?></td>
                        <td class="text-sm text-muted"><?= h($b['created_at']) ?></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="card card-flush">
        <div class="card-header">
            <h3>Recent Edits</h3>
            <a href="?page=rate_management" class="btn btn-outline btn-sm">Manage Rates</a>
        </div>
        <div class="card-body">
            <?php if (empty($stats['recent_edits'])): ?>
                <div class="empty-state"><p>No edits recorded yet</p></div>
            <?php else: ?>
                <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Table</th><th>Field</th><th>Action</th><th>Old</th><th>New</th><th>Date</th></tr></thead>
                    <tbody>
                    <?php foreach ($stats['recent_edits'] as $e): ?>
                    <tr>
                        <td class="font-mono text-sm"><?= h($e['table_name']) ?></td>
                        <td><?= h($e['field_name']) ?></td>
                        <td><span class="badge badge-neutral"><?= h($e['action']) ?></span></td>
                        <td class="text-sm truncate" style="max-width:100px"><?= h($e['old_value'] ?? '—') ?></td>
                        <td class="text-sm truncate" style="max-width:100px"><?= h($e['new_value'] ?? '—') ?></td>
                        <td class="text-sm text-muted"><?= h($e['created_at']) ?></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<div class="card mt-24">
    <div class="card-header">
        <h3>Quick Upload</h3>
    </div>
    <form method="post" enctype="multipart/form-data" action="?page=dashboard">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Vendor Name</label>
                <input class="form-control" name="vendor_name" placeholder="e.g. Pacific, DHL, FedEx" required>
            </div>
            <div class="form-group">
                <label class="form-label">Workbook File (.xlsx, .xls, .csv)</label>
                <input class="form-control" type="file" name="workbook" accept=".xlsx,.xls,.csv" required>
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end;">
                <button type="submit" name="upload" class="btn btn-primary">⬆ Upload & Import</button>
            </div>
        </div>
        <p class="form-hint">A new vendor name creates a vendor record automatically. Re-uploading creates a new version; older versions are kept.</p>
    </form>
</div>
