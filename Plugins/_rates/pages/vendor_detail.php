<?php
// Vendor Detail Page — individual vendor workspace with dynamic worksheet tabs
$slug = strtolower(trim($_GET['slug'] ?? ''));
if ($slug === '') { echo '<div class="alert alert-error">Vendor slug is required.</div>'; return; }

$vendor = getVendorBySlug($pdo, $slug);
if (!$vendor) { echo '<div class="alert alert-error">Vendor not found.</div>'; return; }

$vendorId = (int)$vendor['id'];
$batchId = getActiveBatchId($pdo, $vendorId);

// Handle upload for this vendor
if (isset($_POST['upload']) && isset($_FILES['workbook'])) {
    try {
        $_POST['vendor_name'] = $vendor['name'];
        $result = processUpload($_POST, $_FILES['workbook']);
        echo '<div class="alert alert-success">✓ ' . h($result['message']) . '</div>';
        $batchId = $result['batch_id'];
    } catch (Throwable $e) {
        echo '<div class="alert alert-error">✕ ' . h($e->getMessage()) . '</div>';
    }
}

// Handle edit vendor
if (isset($_POST['save_vendor'])) {
    $name = trim($_POST['vendor_name'] ?? '');
    $contact = trim($_POST['contact_info'] ?? '');
    $notes = trim($_POST['notes'] ?? '');
    if ($name !== '') {
        $pdo->prepare("UPDATE vendors SET name = ?, contact_info = ?, notes = ? WHERE id = ?")
            ->execute([$name, $contact ?: null, $notes ?: null, $vendorId]);
        echo '<div class="alert alert-success">✓ Vendor details updated.</div>';
        $vendor = getVendorById($pdo, $vendorId); // refresh
    }
}

// Handle version activation
if (isset($_POST['activate_version'])) {
    $newBatchId = (int)$_POST['batch_id'];
    $pdo->prepare("UPDATE import_batches SET is_latest = 0 WHERE vendor_id = ? AND is_latest = 1")->execute([$vendorId]);
    $pdo->prepare("UPDATE import_batches SET status = 'active', is_latest = 1 WHERE id = ? AND vendor_id = ?")->execute([$newBatchId, $vendorId]);
    echo '<div class="alert alert-success">✓ Version activated.</div>';
    $batchId = $newBatchId;
}

// Get worksheets
$worksheets = $batchId ? getVendorWorksheets($pdo, $vendorId, $batchId) : [];

// Normalize any RATE DATA sheet_type
foreach ($worksheets as &$ws) {
    if (strtoupper($ws['sheet_name']) === 'RATE DATA' && ($ws['sheet_type'] === 'unknown' || empty($ws['sheet_type']))) {
        $ws['sheet_type'] = 'rate_data';
    }
}
unset($ws);

// If no worksheets in metadata table, detect from data
if (empty($worksheets) && $batchId) {
    try {
        $stM = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_matrix WHERE vendor_id = ? AND batch_id = ?");
        $stM->execute([$vendorId, $batchId]);
        $matrixCnt = (int)$stM->fetchColumn();
        if ($matrixCnt > 0) {
            $worksheets[] = ['sheet_name' => 'RATE DATA', 'sheet_type' => 'rate_data', 'row_count' => $matrixCnt];
        }
    } catch (\Throwable $e) {}

    $st = $pdo->prepare("SELECT DISTINCT sheet_name, rate_type FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ?");
    $st->execute([$vendorId, $batchId]);
    foreach ($st->fetchAll() as $row) {
        $worksheets[] = ['sheet_name' => $row['sheet_name'], 'sheet_type' => $row['rate_type'], 'row_count' => 0];
    }
}

// Ensure Postcode Zones tab is present if vendor_zone_rows has data
if ($batchId) {
    $hasZoneWs = false;
    foreach ($worksheets as $ws) {
        if ($ws['sheet_type'] === 'zones' || strtolower($ws['sheet_name']) === 'postcode zones') {
            $hasZoneWs = true;
            break;
        }
    }
    if (!$hasZoneWs) {
        try {
            $stZ = $pdo->prepare("SELECT COUNT(*) FROM vendor_zone_rows WHERE vendor_id = ? AND batch_id = ?");
            $stZ->execute([$vendorId, $batchId]);
            $zoneCnt = (int)$stZ->fetchColumn();
            if ($zoneCnt > 0) {
                $worksheets[] = ['sheet_name' => 'Postcode Zones', 'sheet_type' => 'zones', 'row_count' => $zoneCnt];
            }
        } catch (\Throwable $e) {}
    }
}

// Get all import history for this vendor
$batches = $pdo->prepare("SELECT * FROM import_batches WHERE vendor_id = ? ORDER BY id DESC");
$batches->execute([$vendorId]);
$batches = $batches->fetchAll();

$calcConfig = getVendorCalcConfig($pdo, $vendorId);
$activeTab = $_GET['tab'] ?? ($worksheets[0]['sheet_name'] ?? 'history');
?>

<div class="breadcrumbs">
    <a href="?page=vendors">Vendors</a> <span class="sep">›</span> <strong><?= h($vendor['name']) ?></strong>
</div>

<div class="flex-between mb-16">
    <div>
        <h2><?= h($vendor['name']) ?></h2>
        <p class="text-muted text-sm">
            Slug: <code class="code-inline"><?= h($vendor['slug']) ?></code>
            · Status: <span class="badge <?= $vendor['is_active'] ? 'badge-success' : 'badge-neutral' ?>"><?= $vendor['is_active'] ? 'Active' : 'Inactive' ?></span>
            <?php if ($batchId): ?> · Active Batch: <code class="code-inline">#<?= $batchId ?></code><?php endif; ?>
        </p>
    </div>
    <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('edit-vendor-panel').classList.toggle('hidden')">✏ Edit</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('upload-panel').classList.toggle('hidden')">⬆ Upload</button>
    </div>
</div>

<!-- Edit Vendor Panel -->
<div id="edit-vendor-panel" class="card hidden slide-down mb-16">
    <h3 class="mb-16">Edit Vendor Details</h3>
    <form method="post">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Vendor Name</label>
                <input class="form-control" name="vendor_name" value="<?= h($vendor['name']) ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Contact Info</label>
                <input class="form-control" name="contact_info" value="<?= h($vendor['contact_info'] ?? '') ?>" placeholder="Email, phone, etc.">
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-control" name="notes" placeholder="Internal notes about this vendor..."><?= h($vendor['notes'] ?? '') ?></textarea>
        </div>
        <button type="submit" name="save_vendor" class="btn btn-primary">Save Changes</button>
    </form>
</div>

<!-- Upload Panel -->
<div id="upload-panel" class="card hidden slide-down mb-16">
    <h3 class="mb-16">Upload New Workbook for <?= h($vendor['name']) ?></h3>
    <form method="post" enctype="multipart/form-data">
        <div class="form-group">
            <label class="form-label">Workbook File (.xlsx, .xls, .csv)</label>
            <input class="form-control" type="file" name="workbook" accept=".xlsx,.xls,.csv" required>
        </div>
        <p class="form-hint mb-16">Uploading creates a new version. Previous versions remain available for history.</p>
        <button type="submit" name="upload" class="btn btn-primary">⬆ Upload & Import</button>
    </form>
</div>

<!-- Worksheet Tabs -->
<?php if (!empty($worksheets) || !empty($batches)): ?>
<div class="tabs">
    <?php foreach ($worksheets as $ws): ?>
        <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=<?= urlencode($ws['sheet_name']) ?>"
           class="tab-btn <?= $activeTab === $ws['sheet_name'] ? 'active' : '' ?>">
            <?= h($ws['sheet_name']) ?>
            <?php if ($ws['row_count']): ?><span class="nav-badge" style="font-size:0.65rem;margin-left:6px;"><?= number_format($ws['row_count']) ?></span><?php endif; ?>
        </a>
    <?php endforeach; ?>
    <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=history"
       class="tab-btn <?= $activeTab === 'history' ? 'active' : '' ?>">📜 Import History</a>
    <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=config"
       class="tab-btn <?= $activeTab === 'config' ? 'active' : '' ?>">⚙ Calc Config</a>
</div>
<?php endif; ?>

<?php
// Render active tab content
if ($activeTab === 'history'):
?>
    <div class="card card-flush">
        <div class="card-header"><h3>Import History</h3></div>
        <div class="card-body">
            <div class="table-wrapper">
            <table class="data-table">
                <thead><tr><th>Batch</th><th>File</th><th>Status</th><th>Rows</th><th>Sheets</th><th>Imported</th><th>Actions</th></tr></thead>
                <tbody>
                <?php foreach ($batches as $b): ?>
                <tr>
                    <td><code class="code-inline">#<?= $b['id'] ?></code></td>
                    <td class="truncate" style="max-width:220px" title="<?= h($b['original_filename']) ?>"><?= h($b['original_filename']) ?></td>
                    <td>
                        <span class="badge <?= match($b['status']) { 'active' => 'badge-success', 'failed' => 'badge-danger', default => 'badge-warning' } ?>"><?= h($b['status']) ?></span>
                        <?php if ($b['is_latest'] ?? false): ?><span class="badge badge-info" style="margin-left:4px;">latest</span><?php endif; ?>
                    </td>
                    <td><?= number_format((int)$b['imported_rows']) ?></td>
                    <td class="text-sm"><?= h($b['sheet_names'] ?? '—') ?></td>
                    <td class="text-sm text-muted"><?= h($b['created_at']) ?></td>
                    <td>
                        <?php if ($b['status'] === 'active' && !($b['is_latest'] ?? false)): ?>
                        <form method="post" style="display:inline">
                            <input type="hidden" name="batch_id" value="<?= $b['id'] ?>">
                            <button name="activate_version" class="btn btn-outline btn-sm" onclick="return confirm('Activate this version?')">Activate</button>
                        </form>
                        <?php endif; ?>
                        <?php if ($b['status'] === 'failed' && $b['error_message']): ?>
                            <span class="text-sm" style="color:var(--accent-danger)" title="<?= h($b['error_message']) ?>">ℹ Hover for error</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            </div>
        </div>
    </div>

<?php elseif ($activeTab === 'config'): ?>
    <?php
    // Handle config save
    if (isset($_POST['save_config'])) {
        $keys = ['base_weight_kg','weight_increment_kg','base_weight_label','addl_weight_label','rounding_method','currency'];
        foreach ($keys as $k) {
            $val = trim($_POST[$k] ?? '');
            if ($val !== '') {
                $pdo->prepare("INSERT INTO vendor_calc_config (vendor_id, config_key, config_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)")
                    ->execute([$vendorId, $k, $val]);
            }
        }
        echo '<div class="alert alert-success">✓ Configuration saved.</div>';
        $calcConfig = getVendorCalcConfig($pdo, $vendorId);
    }
    ?>
    <div class="card">
        <h3 class="mb-16">Calculation Configuration</h3>
        <p class="text-muted text-sm mb-24">Configure how the rate calculator interprets this vendor's rate structure.</p>
        <form method="post">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Base Weight (kg)</label>
                    <input class="form-control" name="base_weight_kg" type="number" step="0.01" value="<?= h($calcConfig['base_weight_kg']) ?>">
                    <p class="form-hint">The base/minimum weight for rate calculation</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Weight Increment (kg)</label>
                    <input class="form-control" name="weight_increment_kg" type="number" step="0.01" value="<?= h($calcConfig['weight_increment_kg']) ?>">
                    <p class="form-hint">Additional weight is charged in multiples of this</p>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Base Weight Column Label</label>
                    <input class="form-control" name="base_weight_label" value="<?= h($calcConfig['base_weight_label']) ?>">
                    <p class="form-hint">Column header in workbook for base rate (e.g. "500 Gms")</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Additional Weight Column Label</label>
                    <input class="form-control" name="addl_weight_label" value="<?= h($calcConfig['addl_weight_label']) ?>">
                    <p class="form-hint">Column header for additional weight rate (e.g. "Addl 500 Gms")</p>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Rounding Method</label>
                    <select class="form-control" name="rounding_method">
                        <option value="ceil_increment" <?= $calcConfig['rounding_method'] === 'ceil_increment' ? 'selected' : '' ?>>Ceiling Increment (round up to next increment)</option>
                        <option value="next_slab" <?= $calcConfig['rounding_method'] === 'next_slab' ? 'selected' : '' ?>>Next Available Slab</option>
                        <option value="exact" <?= $calcConfig['rounding_method'] === 'exact' ? 'selected' : '' ?>>Exact Match Only</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Currency</label>
                    <input class="form-control" name="currency" value="<?= h($calcConfig['currency']) ?>">
                </div>
            </div>
            <button type="submit" name="save_config" class="btn btn-primary">Save Configuration</button>
        </form>
    </div>

<?php else:
    // Render worksheet data
    if (!$batchId) { echo '<div class="empty-state card"><div class="empty-icon">📭</div><p>No active import. Upload a workbook to see data.</p></div>'; return; }

    // Determine sheet type
    $sheetType = 'regular';
    foreach ($worksheets as $ws) {
        if ($ws['sheet_name'] === $activeTab) { $sheetType = $ws['sheet_type']; break; }
    }
    if (strtoupper($activeTab) === 'RATE DATA') {
        $sheetType = 'rate_data';
    }

    $pagination = paginationParams();
    $searchQuery = trim($_GET['q'] ?? '');
    $filterCountry = trim($_GET['country'] ?? '');
    $filterService = trim($_GET['service'] ?? '');

    if ($sheetType === 'zones') {
        // Zone data
        $where = "vendor_id = ? AND batch_id = ?";
        $args = [$vendorId, $batchId];
        if ($searchQuery !== '') { $where .= " AND (country LIKE ? OR postcode LIKE ? OR zone LIKE ? OR town_city LIKE ?)"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; }
        if ($filterCountry !== '') { $where .= " AND country = ?"; $args[] = $filterCountry; }

        $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_zone_rows WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
        $st = $pdo->prepare("SELECT * FROM vendor_zone_rows WHERE $where ORDER BY country, postcode LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
        $st->execute($args);
        $rows = $st->fetchAll();

        // Countries for filter
        $countries = $pdo->prepare("SELECT DISTINCT country FROM vendor_zone_rows WHERE vendor_id = ? AND batch_id = ? ORDER BY country");
        $countries->execute([$vendorId, $batchId]);
        $countries = array_column($countries->fetchAll(), 'country');
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($activeTab) ?> <span class="text-muted text-sm">(<?= number_format($total) ?> records)</span></h3>
                <div class="flex gap-8">
                    <button class="btn btn-outline btn-sm" onclick="openAddModal(<?= $vendorId ?>, <?= $batchId ?>, 'zones')">+ Add</button>
                    <button class="btn btn-outline btn-sm" onclick="exportTableCSV('data-table-main', 'zones_export.csv')">⬇ Export CSV</button>
                </div>
            </div>
            <div style="padding:0 24px;">
                <form class="filter-bar" method="get">
                    <input type="hidden" name="page" value="vendor_detail">
                    <input type="hidden" name="slug" value="<?= h($slug) ?>">
                    <input type="hidden" name="tab" value="<?= h($activeTab) ?>">
                    <div class="search-input">
                        <input class="form-control" name="q" placeholder="Search country, postcode, zone..." value="<?= h($searchQuery) ?>">
                    </div>
                    <select class="form-control" name="country" style="width:auto;min-width:150px;">
                        <option value="">All Countries</option>
                        <?php foreach ($countries as $c): ?>
                        <option value="<?= h($c) ?>" <?= $filterCountry === $c ? 'selected' : '' ?>><?= h($c) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" class="btn btn-primary btn-sm">Filter</button>
                    <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=<?= urlencode($activeTab) ?>" class="btn btn-ghost btn-sm">Clear</a>
                </form>
            </div>
            <div class="card-body">
                <div class="table-wrapper">
                <table class="data-table" id="data-table-main">
                    <thead><tr>
                        <th class="sortable">Country</th>
                        <th class="sortable">Postcode</th>
                        <th class="sortable">Zone</th>
                        <th>Town/City</th>
                        <th>Modified</th>
                        <th class="action-col">Actions</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r): ?>
                    <tr data-id="<?= $r['id'] ?>">
                        <td><?= h($r['country']) ?></td>
                        <td class="font-mono"><?= h($r['postcode']) ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'zone', 'vendor_zone_rows')"><?= h($r['zone'] ?? '—') ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'town_city', 'vendor_zone_rows')"><?= h($r['town_city'] ?? '—') ?></td>
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '' ?></td>
                        <td class="action-col"><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_zone_rows', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>
        <?php

    } elseif ($sheetType === 'country_services') {
        // Country services data
        $where = "vendor_id = ? AND batch_id = ?";
        $args = [$vendorId, $batchId];
        if ($searchQuery !== '') { $where .= " AND (service_code LIKE ? OR country LIKE ?)"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; }

        $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_country_services WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
        $st = $pdo->prepare("SELECT * FROM vendor_country_services WHERE $where ORDER BY service_code, country LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
        $st->execute($args);
        $rows = $st->fetchAll();
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($activeTab) ?> <span class="text-muted text-sm">(<?= number_format($total) ?> records)</span></h3>
                <div class="flex gap-8">
                    <button class="btn btn-outline btn-sm" onclick="openAddModal(<?= $vendorId ?>, <?= $batchId ?>, 'country_services')">+ Add</button>
                    <button class="btn btn-outline btn-sm" onclick="exportTableCSV('data-table-main', 'services_export.csv')">⬇ Export CSV</button>
                </div>
            </div>
            <div style="padding:0 24px;">
                <form class="filter-bar" method="get">
                    <input type="hidden" name="page" value="vendor_detail">
                    <input type="hidden" name="slug" value="<?= h($slug) ?>">
                    <input type="hidden" name="tab" value="<?= h($activeTab) ?>">
                    <div class="search-input">
                        <input class="form-control" name="q" placeholder="Search service code or country..." value="<?= h($searchQuery) ?>">
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm">Search</button>
                </form>
            </div>
            <div class="card-body">
                <div class="table-wrapper">
                <table class="data-table" id="data-table-main">
                    <thead><tr><th class="sortable">Service Code</th><th class="sortable">Country</th><th>Modified</th><th class="action-col">Actions</th></tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r): ?>
                    <tr data-id="<?= $r['id'] ?>">
                        <td class="font-mono editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'service_code', 'vendor_country_services')"><?= h($r['service_code']) ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'country', 'vendor_country_services')"><?= h($r['country']) ?></td>
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '' ?></td>
                        <td class="action-col"><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_country_services', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>
        <?php

    } elseif ($sheetType === 'rate_data' || $sheetType === 'matrix') {
        // Standardized 115-Column RATE DATA Matrix
        $where = "vendor_id = ? AND batch_id = ?";
        $args = [$vendorId, $batchId];
        if ($searchQuery !== '') {
            $where .= " AND (destination LIKE ? OR service_code LIKE ? OR service_name LIKE ? OR zone LIKE ? OR state LIKE ? OR town_city LIKE ? OR postcode_raw LIKE ?)";
            $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
        }
        if ($filterCountry !== '') { $where .= " AND destination = ?"; $args[] = $filterCountry; }
        if ($filterService !== '') { $where .= " AND service_code = ?"; $args[] = $filterService; }

        $totalSt = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_matrix WHERE $where");
        $totalSt->execute($args);
        $total = (int)$totalSt->fetchColumn();

        $st = $pdo->prepare("SELECT * FROM vendor_rate_matrix WHERE $where ORDER BY destination, service_code LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
        $st->execute($args);
        $rows = $st->fetchAll();

        // Distinct countries & services for filters
        $countriesSt = $pdo->prepare("SELECT DISTINCT destination FROM vendor_rate_matrix WHERE vendor_id = ? AND batch_id = ? ORDER BY destination");
        $countriesSt->execute([$vendorId, $batchId]);
        $countries = array_column($countriesSt->fetchAll(), 'destination');

        $servicesSt = $pdo->prepare("SELECT DISTINCT service_code FROM vendor_rate_matrix WHERE vendor_id = ? AND batch_id = ? ORDER BY service_code");
        $servicesSt->execute([$vendorId, $batchId]);
        $services = array_column($servicesSt->fetchAll(), 'service_code');
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($activeTab) ?> <span class="text-muted text-sm">(<?= number_format($total) ?> destination records)</span></h3>
                <div class="flex gap-8">
                    <a href="?page=rate_management&vendor=<?= urlencode($slug) ?>&sheet=<?= urlencode($activeTab) ?>&view=grid" class="btn btn-primary btn-sm">📊 Open Spreadsheet Matrix</a>
                    <button class="btn btn-outline btn-sm" onclick="exportTableCSV('data-table-main', 'rate_data_export.csv')">⬇ Export CSV</button>
                </div>
            </div>
            <div style="padding:0 24px;">
                <form class="filter-bar" method="get">
                    <input type="hidden" name="page" value="vendor_detail">
                    <input type="hidden" name="slug" value="<?= h($slug) ?>">
                    <input type="hidden" name="tab" value="<?= h($activeTab) ?>">
                    <div class="search-input">
                        <input class="form-control" name="q" placeholder="Search destination, service, zone, postcode, town..." value="<?= h($searchQuery) ?>">
                    </div>
                    <select class="form-control" name="country" style="width:auto;min-width:150px;">
                        <option value="">All Destinations</option>
                        <?php foreach ($countries as $c): ?>
                        <option value="<?= h($c) ?>" <?= $filterCountry === $c ? 'selected' : '' ?>><?= h($c) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <select class="form-control" name="service" style="width:auto;min-width:150px;">
                        <option value="">All Services</option>
                        <?php foreach ($services as $s): ?>
                        <option value="<?= h($s) ?>" <?= $filterService === $s ? 'selected' : '' ?>><?= h($s) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" class="btn btn-primary btn-sm">Filter</button>
                    <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=<?= urlencode($activeTab) ?>" class="btn btn-ghost btn-sm">Clear</a>
                </form>
            </div>
            <div class="card-body">
                <div class="table-wrapper">
                <table class="data-table" id="data-table-main">
                    <thead><tr>
                        <th class="sortable">Destination</th>
                        <th>State</th>
                        <th class="sortable">Service Code</th>
                        <th>Service</th>
                        <th>Zone</th>
                        <th>Post Code</th>
                        <th>Town / City</th>
                        <th>Duty Paid</th>
                        <th>Transit</th>
                        <th style="text-align:right;">0.5 KG (Flat)</th>
                        <th style="text-align:right;">1 KG</th>
                        <th style="text-align:right;">2 KG</th>
                        <th style="text-align:right;">5 KG</th>
                        <th style="text-align:right;">10 KG</th>
                        <th style="text-align:right;">20 KG</th>
                        <th style="text-align:right;">50 KG</th>
                        <th style="text-align:right;">100 KG</th>
                        <th class="action-col">Actions</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r):
                        $wr = json_decode($r['weight_rates'] ?: '{}', true) ?: [];
                    ?>
                    <tr data-id="<?= $r['id'] ?>">
                        <td style="font-weight:600;"><?= h($r['destination']) ?></td>
                        <td class="text-sm text-muted"><?= h($r['state'] ?: '—') ?></td>
                        <td class="font-mono"><?= h($r['service_code']) ?></td>
                        <td class="text-sm"><?= h($r['service_name'] ?: '—') ?></td>
                        <td><?= $r['zone'] ? '<span class="badge badge-purple font-mono">' . h($r['zone']) . '</span>' : '—' ?></td>
                        <td class="text-xs" style="max-width:220px;"><?= formatPostcodeDisplayHtml($r['postcode_raw'], 2, (int)$r['id'], (string)$r['destination'], (string)$r['zone']) ?></td>
                        <td class="text-sm editable-cell" onclick="makeEditable(this, <?= (int)$r['id'] ?>, 'town_city', 'vendor_rate_matrix')" title="<?= h($r['town_city'] ?: 'Click to edit town/city') ?>"><?= h($r['town_city'] ?: '—') ?></td>
                        <td><?= $r['duty_paid'] ? '<span class="badge badge-success">' . h($r['duty_paid']) . '</span>' : '—' ?></td>
                        <td class="text-sm font-mono"><?= h($r['transit_time'] ?: '—') ?></td>
                        <td class="font-mono text-right" style="font-weight:600; color:#107c41;"><?= (($v = $wr['0.5 KG'] ?? ($wr['0.5'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['1 KG'] ?? ($wr['1'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['2 KG'] ?? ($wr['2'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['5 KG'] ?? ($wr['5'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['10 KG'] ?? ($wr['10'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['20 KG'] ?? ($wr['20'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['50 KG'] ?? ($wr['50'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="font-mono text-right"><?= (($v = $wr['100 KG'] ?? ($wr['100'] ?? null)) !== null && is_numeric($v)) ? number_format((float)$v, 0) : '—' ?></td>
                        <td class="action-col"><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_rate_matrix', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>
        <?php

    } else {
        // Rate data (regular or zonewise)
        $where = "vendor_id = ? AND batch_id = ? AND sheet_name = ?";
        $args = [$vendorId, $batchId, $activeTab];
        if ($searchQuery !== '') {
            $where .= " AND (country LIKE ? OR service_code LIKE ? OR service_name LIKE ? OR zone LIKE ? OR weight_label LIKE ?)";
            $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
        }
        if ($filterCountry !== '') { $where .= " AND country = ?"; $args[] = $filterCountry; }
        if ($filterService !== '') { $where .= " AND service_code = ?"; $args[] = $filterService; }

        $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_rows WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
        $st = $pdo->prepare("SELECT * FROM vendor_rate_rows WHERE $where ORDER BY service_code, country, weight_kg LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
        $st->execute($args);
        $rows = $st->fetchAll();

        // Distinct countries & services for filters
        $countries = $pdo->prepare("SELECT DISTINCT country FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ? AND country IS NOT NULL ORDER BY country");
        $countries->execute([$vendorId, $batchId, $activeTab]);
        $countries = array_column($countries->fetchAll(), 'country');

        $services = $pdo->prepare("SELECT DISTINCT service_code FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ? ORDER BY service_code");
        $services->execute([$vendorId, $batchId, $activeTab]);
        $services = array_column($services->fetchAll(), 'service_code');
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($activeTab) ?> <span class="text-muted text-sm">(<?= number_format($total) ?> records)</span></h3>
                <div class="flex gap-8">
                    <a href="?page=rate_management&vendor=<?= urlencode($slug) ?>&sheet=<?= urlencode($activeTab) ?>&view=grid" class="btn btn-primary btn-sm">📊 Open Spreadsheet Matrix</a>
                    <button class="btn btn-outline btn-sm" onclick="openAddModal(<?= $vendorId ?>, <?= $batchId ?>, '<?= h($sheetType) ?>')">+ Add</button>
                    <button class="btn btn-outline btn-sm" onclick="exportTableCSV('data-table-main', 'rates_export.csv')">⬇ Export CSV</button>
                </div>
            </div>
            <div style="padding:0 24px;">
                <form class="filter-bar" method="get">
                    <input type="hidden" name="page" value="vendor_detail">
                    <input type="hidden" name="slug" value="<?= h($slug) ?>">
                    <input type="hidden" name="tab" value="<?= h($activeTab) ?>">
                    <div class="search-input">
                        <input class="form-control" name="q" placeholder="Search country, service, zone, weight..." value="<?= h($searchQuery) ?>">
                    </div>
                    <select class="form-control" name="country" style="width:auto;min-width:150px;">
                        <option value="">All Countries</option>
                        <?php foreach ($countries as $c): ?>
                        <option value="<?= h($c) ?>" <?= $filterCountry === $c ? 'selected' : '' ?>><?= h($c) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <select class="form-control" name="service" style="width:auto;min-width:150px;">
                        <option value="">All Services</option>
                        <?php foreach ($services as $s): ?>
                        <option value="<?= h($s) ?>" <?= $filterService === $s ? 'selected' : '' ?>><?= h($s) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" class="btn btn-primary btn-sm">Filter</button>
                    <a href="?page=vendor_detail&slug=<?= h($slug) ?>&tab=<?= urlencode($activeTab) ?>" class="btn btn-ghost btn-sm">Clear</a>
                </form>
            </div>
            <div class="card-body">
                <div class="table-wrapper">
                <table class="data-table" id="data-table-main">
                    <thead><tr>
                        <th class="sortable">Service Code</th>
                        <th>Service Name</th>
                        <th class="sortable">Country</th>
                        <th class="sortable">Weight</th>
                        <th>Weight (kg)</th>
                        <?php if ($sheetType === 'zonewise'): ?><th class="sortable">Zone</th><?php endif; ?>
                        <th class="sortable">Rate</th>
                        <th>Raw</th>
                        <th>Transit</th>
                        <th>Modified</th>
                        <th class="action-col">Actions</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r): ?>
                    <tr data-id="<?= $r['id'] ?>">
                        <td class="font-mono"><?= h($r['service_code']) ?></td>
                        <td class="text-sm"><?= h($r['service_name'] ?? '—') ?></td>
                        <td><?= h($r['country'] ?? '—') ?></td>
                        <td class="text-sm"><?= h($r['weight_label'] ?? '—') ?></td>
                        <td class="font-mono"><?= $r['weight_kg'] !== null ? $r['weight_kg'] : '—' ?></td>
                        <?php if ($sheetType === 'zonewise'): ?><td><?= h($r['zone'] ?? '—') ?></td><?php endif; ?>
                        <td class="rate-cell editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'rate', 'vendor_rate_rows')"><?= formatRate($r['rate'], $r['rate_raw']) ?></td>
                        <td class="text-sm text-muted"><?= h($r['rate_raw'] ?? '') ?></td>
                        <td class="text-sm"><?= h($r['transit_time'] ?? '—') ?></td>
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '' ?></td>
                        <td class="action-col"><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_rate_rows', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                </div>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>
        <?php
    }
endif;
?>

<!-- Add Record Modal -->
<div id="add-record-modal" class="modal-overlay" style="display:none">
    <div class="modal">
        <div class="modal-header">
            <h3>Add Record</h3>
            <button class="modal-close" onclick="closeAddModal()">✕</button>
        </div>
        <form id="add-record-form">
            <input type="hidden" name="vendor_id" id="add-vendor-id" value="<?= $vendorId ?>">
            <input type="hidden" name="batch_id" id="add-batch-id" value="<?= $batchId ?>">
            <input type="hidden" name="sheet_type" id="add-sheet-type" value="">
            <input type="hidden" name="sheet_name" value="<?= h($activeTab) ?>">

            <div id="add-rate-fields">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Service Code</label>
                        <input class="form-control" name="service_code" placeholder="e.g. PXC-EX">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Service Name</label>
                        <input class="form-control" name="service_name" placeholder="e.g. Express">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Country</label>
                        <input class="form-control" name="country" placeholder="e.g. USA">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Weight Label</label>
                        <input class="form-control" name="weight_label" placeholder="e.g. 500 Gms">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Weight (kg)</label>
                        <input class="form-control" name="weight_kg" type="number" step="0.0001" placeholder="e.g. 0.5">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Zone</label>
                        <input class="form-control" name="zone" placeholder="e.g. Zone 3 (for zonewise)">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Rate</label>
                        <input class="form-control" name="rate" type="number" step="0.01" placeholder="e.g. 125.00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Transit Time</label>
                        <input class="form-control" name="transit_time" placeholder="e.g. 5-7 days">
                    </div>
                </div>
            </div>

            <div id="add-zone-fields" class="hidden">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Country</label>
                        <input class="form-control" name="zone_country" placeholder="e.g. USA">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Postcode</label>
                        <input class="form-control" name="postcode" placeholder="e.g. 10001">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Zone</label>
                        <input class="form-control" name="zone_value" placeholder="e.g. Zone 3">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Town/City</label>
                        <input class="form-control" name="town_city" placeholder="e.g. New York">
                    </div>
                </div>
            </div>

            <div class="flex gap-8 mt-16">
                <button type="button" class="btn btn-primary" onclick="submitAddRecord()">Add Record</button>
                <button type="button" class="btn btn-ghost" onclick="closeAddModal()">Cancel</button>
            </div>
        </form>
    </div>
</div>
