<?php
// Settings, System Health & Diagnostics Page
$config = getConfig();

// Check database tables & migration status
$dbStatus = [];
$tablesToCheck = [
    'vendors', 'import_batches', 'vendor_rate_rows', 'vendor_zone_rows',
    'vendor_country_services', 'vendor_worksheets', 'vendor_calc_config', 'rate_audit_log'
];

$tableCounts = [];
$missingTables = [];

foreach ($tablesToCheck as $tbl) {
    try {
        $count = (int)$pdo->query("SELECT COUNT(*) FROM `{$tbl}`")->fetchColumn();
        $tableCounts[$tbl] = $count;
    } catch (PDOException $e) {
        $missingTables[] = $tbl;
        $tableCounts[$tbl] = null;
    }
}

// Handle Run Migration request
$migrationNotice = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['run_migration'])) {
    $migrationSqlPath = dirname(__DIR__) . '/migration.sql';
    if (file_exists($migrationSqlPath)) {
        try {
            $sql = file_get_contents($migrationSqlPath);
            // Execute statements
            $pdo->exec($sql);
            $migrationNotice = '<div class="alert alert-success">✓ Migration executed successfully! All additive tables and columns are ready.</div>';
            // Refresh counts
            foreach ($tablesToCheck as $tbl) {
                try {
                    $tableCounts[$tbl] = (int)$pdo->query("SELECT COUNT(*) FROM `{$tbl}`")->fetchColumn();
                } catch (PDOException $e) {
                    $tableCounts[$tbl] = null;
                }
            }
            $missingTables = [];
        } catch (Throwable $e) {
            $migrationNotice = '<div class="alert alert-danger">Migration error: ' . h($e->getMessage()) . '</div>';
        }
    } else {
        $migrationNotice = '<div class="alert alert-danger">migration.sql file not found.</div>';
    }
}

// Storage directory checks
$storageWritable = is_writable($config['upload_dir']);
$logFile = dirname(__DIR__) . '/storage/php-errors.log';
$logSize = file_exists($logFile) ? filesize($logFile) : 0;
?>

<div class="flex-between mb-24">
    <div>
        <h2>System Settings & Health Diagnostics</h2>
        <p class="text-muted text-sm">System configuration, database integrity, and server environment status</p>
    </div>
</div>

<?= $migrationNotice ?>

<div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
    <!-- System Environment -->
    <div class="card">
        <div class="card-header">
            <h3>Environment & Server</h3>
            <span class="badge badge-success">Online</span>
        </div>
        <div class="table-wrapper">
            <table class="data-table text-sm">
                <tbody>
                    <tr><td><strong>PHP Version</strong></td><td class="font-mono"><?= phpversion() ?></td></tr>
                    <tr><td><strong>Database Server</strong></td><td class="font-mono"><?= h($config['db']['host']) ?> (<?= h($config['db']['name']) ?>)</td></tr>
                    <tr><td><strong>Max Upload Size</strong></td><td><?= (int)$config['max_upload_mb'] ?> MB</td></tr>
                    <tr><td><strong>Upload Directory</strong></td><td class="font-mono text-xs"><?= h($config['upload_dir']) ?></td></tr>
                    <tr>
                        <td><strong>Upload Storage Writable</strong></td>
                        <td>
                            <?php if ($storageWritable): ?>
                                <span class="badge badge-success">✓ Writable</span>
                            <?php else: ?>
                                <span class="badge badge-danger">✕ Not Writable (Check permissions)</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>PhpSpreadsheet Library</strong></td>
                        <td>
                            <?php if (class_exists('PhpOffice\PhpSpreadsheet\IOFactory')): ?>
                                <span class="badge badge-success">✓ Installed</span>
                            <?php else: ?>
                                <span class="badge badge-danger">✕ Missing (run composer install)</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- API Settings -->
    <div class="card">
        <div class="card-header">
            <h3>API Configuration</h3>
            <a href="?page=api_docs" class="btn btn-outline btn-sm">View Docs</a>
        </div>
        <p class="text-sm text-secondary mb-16">Active secret key used to authenticate external integrations and CLI scripts.</p>
        
        <div class="form-group mb-16">
            <label class="form-label">Master API Key</label>
            <div style="display:flex; gap:8px;">
                <input type="text" class="form-control font-mono" value="<?= h($config['api_key'] ?? '') ?>" readonly id="settings-api-key">
                <button type="button" class="btn btn-outline" onclick="navigator.clipboard.writeText(document.getElementById('settings-api-key').value); showToast('API Key copied!');">Copy</button>
            </div>
            <p class="form-hint">Stored securely in <code>config.php</code>. Protected from public web access via <code>.htaccess</code>.</p>
        </div>

        <div style="background:var(--gray-50); border:1px solid var(--border-color); border-radius:var(--border-radius-sm); padding:16px;">
            <div style="font-weight:600; margin-bottom:6px; font-size:0.9rem;">CORS & Access Control</div>
            <p class="text-xs text-muted mb-0">API endpoints return standard CORS headers allowing secure consumption by client-side dashboards and microservices.</p>
        </div>
    </div>
</div>

<!-- Database Table Status & Migrations -->
<div class="card mt-24">
    <div class="card-header">
        <div>
            <h3>Database Schema & Table Integrity</h3>
            <p class="text-muted text-sm" style="margin-top:4px;">Verifies core rate tables and upgrade migration status</p>
        </div>
        <?php if (!empty($missingTables)): ?>
            <form method="post" onsubmit="return confirm('Execute migration.sql to create missing additive tables?');">
                <button type="submit" name="run_migration" class="btn btn-primary btn-sm">▶ Apply Additive Migration</button>
            </form>
        <?php else: ?>
            <span class="badge badge-success">All Tables Up to Date</span>
        <?php endif; ?>
    </div>

    <div class="table-wrapper">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Table Name</th>
                    <th>Status</th>
                    <th>Record Count</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                <?php
                $descriptions = [
                    'vendors' => 'Registered shipping vendors and status',
                    'import_batches' => 'Audit log of uploaded spreadsheets and version flags',
                    'vendor_rate_rows' => 'Primary rate data rows across all vendors and sheets',
                    'vendor_zone_rows' => 'Destination postcode to zone mappings',
                    'vendor_country_services' => 'Country and service code availability mappings',
                    'vendor_worksheets' => 'Detected worksheet metadata per workbook import',
                    'vendor_calc_config' => 'Configurable calculation rules (base kg, increments)',
                    'rate_audit_log' => 'Audit trail of inline rate modifications'
                ];
                ?>
                <?php foreach ($tablesToCheck as $tbl): ?>
                    <tr>
                        <td class="font-mono"><strong><?= h($tbl) ?></strong></td>
                        <td>
                            <?php if ($tableCounts[$tbl] !== null): ?>
                                <span class="badge badge-success">✓ Active</span>
                            <?php else: ?>
                                <span class="badge badge-warning">Missing (Run migration)</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($tableCounts[$tbl] !== null): ?>
                                <strong><?= number_format($tableCounts[$tbl]) ?></strong> rows
                            <?php else: ?>
                                <span class="text-muted">—</span>
                            <?php endif; ?>
                        </td>
                        <td class="text-sm text-secondary"><?= $descriptions[$tbl] ?? '' ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- PHP Error Log Preview -->
<div class="card mt-24">
    <div class="card-header">
        <h3>System Error Log (php-errors.log)</h3>
        <span class="text-xs text-muted"><?= number_format($logSize) ?> bytes</span>
    </div>
    <?php
    $logContent = '';
    if (file_exists($logFile)) {
        $lines = file($logFile);
        $recentLines = array_slice($lines, -25);
        $logContent = implode('', $recentLines);
    }
    ?>
    <?php if (empty(trim($logContent))): ?>
        <p class="text-sm text-muted">No errors logged. System is operating cleanly.</p>
    <?php else: ?>
        <pre style="background:#0f172a; color:#f87171; padding:16px; border-radius:var(--border-radius-sm); font-size:0.8rem; max-height:260px; overflow-y:auto;"><?= h($logContent) ?></pre>
    <?php endif; ?>
</div>
