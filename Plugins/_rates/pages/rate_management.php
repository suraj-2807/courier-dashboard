<?php
// Rate Management & Tariff Matrix Editor — Live Spreadsheet Grid
// Professional Excel replica matching user workbook layout
$vendors = $pdo->query("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name")->fetchAll();

$selectedVendor = trim($_GET['vendor'] ?? '');
if (!$selectedVendor && !empty($vendors)) {
    // Default to first active vendor (e.g. Pacific Express)
    $selectedVendor = $vendors[0]['slug'];
}

$selectedSheet = trim($_GET['sheet'] ?? '');
$viewMode = trim($_GET['view'] ?? 'grid'); // 'grid' (Spreadsheet Matrix) or 'list' (Flat Table)
$selectedServiceFilter = trim($_GET['service'] ?? '');
$searchQuery = trim($_GET['q'] ?? '');

$vendorObj = null;
$worksheets = [];
$batchId = null;

if ($selectedVendor) {
    $vendorObj = getVendorBySlug($pdo, $selectedVendor);
    if ($vendorObj) {
        $batchId = getActiveBatchId($pdo, (int)$vendorObj['id']);
        if ($batchId) {
            $worksheets = getVendorWorksheets($pdo, (int)$vendorObj['id'], $batchId);

            // Normalize RATE DATA sheet_type
            foreach ($worksheets as &$ws) {
                if (strtoupper($ws['sheet_name']) === 'RATE DATA' && ($ws['sheet_type'] === 'unknown' || empty($ws['sheet_type']))) {
                    $ws['sheet_type'] = 'rate_data';
                }
            }
            unset($ws);

            if (empty($worksheets)) {
                // Auto-detect from data
                try {
                    $stM = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_matrix WHERE vendor_id = ? AND batch_id = ?");
                    $stM->execute([(int)$vendorObj['id'], $batchId]);
                    $matrixCnt = (int)$stM->fetchColumn();
                    if ($matrixCnt > 0) {
                        $worksheets[] = ['sheet_name' => 'RATE DATA', 'sheet_type' => 'rate_data', 'row_count' => $matrixCnt];
                    }
                } catch (\Throwable $e) {}

                $st = $pdo->prepare("SELECT DISTINCT sheet_name, rate_type FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ?");
                $st->execute([(int)$vendorObj['id'], $batchId]);
                foreach ($st->fetchAll() as $row) {
                    $worksheets[] = ['sheet_name' => $row['sheet_name'], 'sheet_type' => $row['rate_type'], 'row_count' => 0];
                }
            }

            // Ensure Postcode Zones is present if vendor_zone_rows has data
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
                    $stZ->execute([(int)$vendorObj['id'], $batchId]);
                    $zoneCnt = (int)$stZ->fetchColumn();
                    if ($zoneCnt > 0) {
                        $worksheets[] = ['sheet_name' => 'Postcode Zones', 'sheet_type' => 'zones', 'row_count' => $zoneCnt];
                    }
                } catch (\Throwable $e) {}
            }

            if (!$selectedSheet && !empty($worksheets)) {
                $selectedSheet = $worksheets[0]['sheet_name'];
            }
        }
    }
}

$vendorId = $vendorObj ? (int)$vendorObj['id'] : null;

// Determine current sheet type
$sheetType = 'regular';
foreach ($worksheets as $ws) {
    if ($ws['sheet_name'] === $selectedSheet) {
        $sheetType = $ws['sheet_type'];
        break;
    }
}
if (strtoupper($selectedSheet) === 'RATE DATA') {
    $sheetType = 'rate_data';
}
?>

<style>
/* ============================================================
   Excel Spreadsheet Matrix — Direct Inlined Styles
   Guaranteed immediate application matching workbook image
   ============================================================ */
.excel-matrix-card {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04) !important;
    overflow: hidden !important;
    margin-top: 16px !important;
}
.excel-matrix-toolbar {
    background: #f8fafc !important;
    border-bottom: 1px solid #cbd5e1 !important;
    padding: 10px 16px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    flex-wrap: wrap !important;
    gap: 12px !important;
}
.excel-tab-pill {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    border-bottom: 2px solid #107c41 !important;
    padding: 6px 14px !important;
    border-radius: 6px 6px 0 0 !important;
    font-size: 0.85rem !important;
    font-weight: 700 !important;
    color: #1e293b !important;
}
.excel-formula-bar {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    padding: 4px 10px !important;
    font-family: 'SF Mono', Consolas, monospace !important;
    font-size: 0.82rem !important;
    color: #334155 !important;
    flex: 1 !important;
    max-width: 620px !important;
}
.excel-name-box {
    background: #f1f5f9 !important;
    border-radius: 4px !important;
    padding: 2px 8px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
    border: 1px solid #cbd5e1 !important;
    min-width: 44px !important;
    text-align: center !important;
}
.excel-fx-icon {
    font-style: italic !important;
    font-weight: 700 !important;
    color: #64748b !important;
    user-select: none !important;
}
.excel-formula-display {
    border: none !important;
    background: transparent !important;
    font-family: inherit !important;
    font-size: inherit !important;
    color: #1e293b !important;
    width: 100% !important;
    outline: none !important;
    font-weight: 500 !important;
}
.excel-scroll-wrapper {
    overflow-x: auto !important;
    overflow-y: auto !important;
    max-height: 720px !important;
    max-width: 100% !important;
    background: #ffffff !important;
    position: relative !important;
}
.excel-table {
    width: max-content !important;
    min-width: 100% !important;
    border-collapse: collapse !important;
    border-spacing: 0 !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 0.82rem !important;
    white-space: nowrap !important;
}
/* Column letter row: A, B, C, D... */
.excel-letter-row th {
    background: #f1f5f9 !important;
    color: #475569 !important;
    font-weight: 600 !important;
    font-size: 0.72rem !important;
    text-align: center !important;
    padding: 3px 8px !important;
    border: 1px solid #cbd5e1 !important;
    user-select: none !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 20 !important;
    height: 24px !important;
}
/* Deep Royal Blue Header matching user spreadsheet image */
.excel-blue-header th {
    background-color: #00008b !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    text-align: center !important;
    padding: 10px 14px !important;
    border: 1px solid rgba(255,255,255,0.25) !important;
    font-size: 0.82rem !important;
    letter-spacing: 0.02em !important;
    position: sticky !important;
    top: 24px !important;
    z-index: 20 !important;
}
.excel-blue-header th.text-left {
    text-align: left !important;
}
.excel-gutter-col {
    background-color: #f1f5f9 !important;
    color: #64748b !important;
    font-family: 'SF Mono', Consolas, monospace !important;
    font-size: 0.75rem !important;
    text-align: center !important;
    width: 46px !important;
    min-width: 46px !important;
    max-width: 46px !important;
    border: 1px solid #cbd5e1 !important;
    border-right: 2px solid #94a3b8 !important;
    user-select: none !important;
    font-weight: 600 !important;
    position: sticky !important;
    left: 0 !important;
    z-index: 10 !important;
}
.excel-letter-row th.excel-gutter-col {
    z-index: 30 !important;
    background-color: #e2e8f0 !important;
}
.excel-blue-header th.excel-gutter-col {
    z-index: 30 !important;
    background-color: #000066 !important;
    color: #ffffff !important;
}
.excel-row-normal td {
    padding: 6px 12px !important;
    border: 1px solid #cbd5e1 !important;
    background-color: #ffffff !important;
    color: #0f172a !important;
    transition: background 100ms ease !important;
}
.excel-row-normal:nth-child(even) td {
    background-color: #fcfdfe !important;
}
.excel-row-normal:hover td {
    background-color: #f1f5f9 !important;
}
.excel-cell-text {
    text-align: left !important;
    color: #1e293b !important;
    font-size: 0.82rem !important;
}
.excel-cell-rate {
    text-align: right !important;
    font-family: 'SF Mono', Consolas, monospace !important;
    font-size: 0.82rem !important;
    color: #0f172a !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    user-select: none !important;
    min-width: 68px !important;
}
.excel-dash {
    color: #94a3b8 !important;
    text-align: center !important;
    display: block !important;
    width: 100% !important;
}
.excel-cell-active {
    outline: 2.5px solid #107c41 !important;
    outline-offset: -2px !important;
    background-color: #dcfce7 !important;
    color: #14532d !important;
    font-weight: 800 !important;
    position: relative !important;
    z-index: 5 !important;
}
.excel-cell-active::after {
    content: '' !important;
    position: absolute !important;
    right: -2px !important;
    bottom: -2px !important;
    width: 6px !important;
    height: 6px !important;
    background: #107c41 !important;
    border: 1px solid #ffffff !important;
    box-shadow: 0 0 2px rgba(0,0,0,0.3) !important;
}
.excel-matrix-footer {
    background: #f8fafc !important;
    border-top: 1px solid #cbd5e1 !important;
    padding: 10px 16px !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    font-size: 0.8rem !important;
    color: #64748b !important;
    gap: 8px !important;
}
.cell-modified-indicator {
    display: inline-block !important;
    width: 6px !important;
    height: 6px !important;
    border-radius: 50% !important;
    background: #f59e0b !important;
    margin-left: 4px !important;
    vertical-align: middle !important;
}
</style>

<div class="mb-20 flex-between" style="align-items:flex-end;">
    <div>
        <h2>Rate Management & Tariff Sheet</h2>
        <p class="text-muted text-sm" style="margin-bottom:0;">
            Interactive spreadsheet matrix view and live rate cell editor matching courier Excel workbooks
        </p>
    </div>
    <div class="flex gap-8">
        <?php if ($vendorObj && $batchId): ?>
        <button class="btn btn-primary btn-sm" onclick="openAddModal(<?= $vendorId ?>, <?= $batchId ?>, '<?= h($sheetType) ?>')">
            ➕ Add Record
        </button>
        <button class="btn btn-outline btn-sm" onclick="exportTableCSV('mgmt-table', '<?= h(slugify($selectedSheet)) ?>.csv')">
            ⬇ Export CSV
        </button>
        <?php endif; ?>
    </div>
</div>

<!-- Vendor & Sheet Selector Toolbar -->
<div class="card" style="padding:16px 20px; margin-bottom:16px;">
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
        <form id="vendor-selector-form" method="get" style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin:0;">
            <input type="hidden" name="page" value="rate_management">
            <input type="hidden" name="view" value="<?= h($viewMode) ?>">

            <div style="display:flex; align-items:center; gap:8px;">
                <label class="form-label" style="margin:0; font-weight:700; font-size:0.85rem; color:#475569;">Vendor:</label>
                <select class="form-control" name="vendor" onchange="this.form.submit()" style="min-width:210px; font-weight:600;">
                    <?php foreach ($vendors as $v): ?>
                    <option value="<?= h($v['slug']) ?>" <?= $selectedVendor === $v['slug'] ? 'selected' : '' ?>><?= h($v['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <?php if (!empty($worksheets)): ?>
            <div style="display:flex; align-items:center; gap:8px;">
                <label class="form-label" style="margin:0; font-weight:700; font-size:0.85rem; color:#475569;">Worksheet:</label>
                <select class="form-control" name="sheet" onchange="this.form.submit()" style="min-width:240px; font-weight:600;">
                    <?php foreach ($worksheets as $ws): 
                        $typeName = match($ws['sheet_type'] ?? '') {
                            'rate_data', 'matrix' => 'Tariff Matrix' . (!empty($ws['row_count']) ? ' - ' . number_format($ws['row_count']) . ' rows' : ''),
                            'zones' => 'Zone Directory' . (!empty($ws['row_count']) ? ' - ' . number_format($ws['row_count']) . ' postcodes' : ''),
                            'country_services' => 'Country Services',
                            'zonewise' => 'Zonewise',
                            'regular' => 'Regular',
                            default => $ws['sheet_name'] === 'RATE DATA' ? 'Tariff Matrix' : 'Worksheet'
                        };
                    ?>
                    <option value="<?= h($ws['sheet_name']) ?>" <?= $selectedSheet === $ws['sheet_name'] ? 'selected' : '' ?>>
                        <?= h($ws['sheet_name']) ?> (<?= h($typeName) ?>)
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php endif; ?>
        </form>

        <!-- View Mode Switcher: Spreadsheet Matrix vs Flat List -->
        <div style="display:flex; align-items:center; background:#f1f5f9; padding:3px; border-radius:8px; border:1px solid #cbd5e1;">
            <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=grid&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>"
               class="btn btn-sm <?= $viewMode === 'grid' ? 'btn-primary' : 'btn-ghost' ?>"
               style="font-size:0.82rem; padding:5px 12px; border-radius:6px; <?= $viewMode === 'grid' ? 'box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#475569;' ?>">
                📊 Spreadsheet Grid
            </a>
            <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=list&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>"
               class="btn btn-sm <?= $viewMode === 'list' ? 'btn-primary' : 'btn-ghost' ?>"
               style="font-size:0.82rem; padding:5px 12px; border-radius:6px; <?= $viewMode === 'list' ? 'box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#475569;' ?>">
                📋 Flat Records List
            </a>
        </div>
    </div>
</div>

<?php if ($vendorObj && $batchId && $selectedSheet): ?>

    <!-- Secondary Filters Bar -->
    <div class="card" style="padding:12px 18px; margin-bottom:16px;">
        <form method="get" class="filter-bar" style="margin:0; gap:12px; align-items:center;">
            <input type="hidden" name="page" value="rate_management">
            <input type="hidden" name="vendor" value="<?= h($selectedVendor) ?>">
            <input type="hidden" name="sheet" value="<?= h($selectedSheet) ?>">
            <input type="hidden" name="view" value="<?= h($viewMode) ?>">

            <div class="search-input" style="flex:1; max-width:320px;">
                <input class="form-control" name="q" placeholder="Search destination country or service..." value="<?= h($searchQuery) ?>" style="font-size:0.85rem;">
            </div>

            <?php if ($sheetType !== 'zones'): ?>
            <?php
            // Distinct services for dropdown
            if ($sheetType === 'rate_data' || $sheetType === 'matrix') {
                $srvSt = $pdo->prepare("SELECT DISTINCT service_code FROM vendor_rate_matrix WHERE vendor_id = ? AND batch_id = ? ORDER BY service_code");
                $srvSt->execute([$vendorId, $batchId]);
            } else {
                $srvSt = $pdo->prepare("SELECT DISTINCT service_code FROM vendor_rate_rows WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ? ORDER BY service_code");
                $srvSt->execute([$vendorId, $batchId, $selectedSheet]);
            }
            $sheetServices = array_column($srvSt->fetchAll(), 'service_code');
            ?>
            <?php if (!empty($sheetServices)): ?>
            <select class="form-control" name="service" style="width:auto; min-width:180px; font-size:0.85rem;" onchange="this.form.submit()">
                <option value="">All Services (<?= count($sheetServices) ?>)</option>
                <?php foreach ($sheetServices as $sc): ?>
                <option value="<?= h($sc) ?>" <?= $selectedServiceFilter === $sc ? 'selected' : '' ?>><?= h($sc) ?></option>
                <?php endforeach; ?>
            </select>
            <?php endif; ?>
            <?php endif; ?>

            <button type="submit" class="btn btn-primary btn-sm">Filter</button>
            <?php if ($searchQuery !== '' || $selectedServiceFilter !== ''): ?>
            <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=<?= urlencode($viewMode) ?>" class="btn btn-ghost btn-sm">Reset</a>
            <?php endif; ?>
        </form>
    </div>

    <!-- ============================================================
         VIEW MODE 1: SPREADSHEET MATRIX (Exact Excel Replica)
         ============================================================ -->
    <?php if ($viewMode === 'grid'): ?>

        <?php if ($sheetType === 'regular'): ?>
        <?php
            // 1. Distinct weight column slabs in order of weight_kg ASC, MIN(id) ASC
            $colSt = $pdo->prepare(
                "SELECT DISTINCT weight_label, weight_kg, MIN(id) as first_id
                 FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ?
                 GROUP BY weight_label, weight_kg
                 ORDER BY weight_kg ASC, first_id ASC"
            );
            $colSt->execute([$vendorId, $batchId, $selectedSheet]);
            $slabs = $colSt->fetchAll();

            // Build Column Letter Map: Col A = SERVICE CODE, Col B = Destination, Col C.. = Slabs
            $columns = [];
            $columns[] = ['col_letter' => 'A', 'title' => 'SERVICE CODE', 'type' => 'text'];
            $columns[] = ['col_letter' => 'B', 'title' => 'Destination', 'type' => 'text'];

            $colIdx = 2; // start at C
            $slabColMap = [];
            foreach ($slabs as $s) {
                $letter = getExcelColName($colIdx);
                $columns[] = [
                    'col_letter' => $letter,
                    'title' => $s['weight_label'] ?? ($s['weight_kg'] . ' kg'),
                    'weight_kg' => $s['weight_kg'],
                    'type' => 'rate'
                ];
                $slabColMap[$s['weight_label']] = $letter;
                $colIdx++;
            }

            // 2. Query destinations
            $rowWhere = "vendor_id = ? AND batch_id = ? AND sheet_name = ?";
            $rowArgs = [$vendorId, $batchId, $selectedSheet];
            if ($searchQuery !== '') {
                $rowWhere .= " AND (country LIKE ? OR service_code LIKE ?)";
                $rowArgs[] = "%$searchQuery%";
                $rowArgs[] = "%$searchQuery%";
            }
            if ($selectedServiceFilter !== '') {
                $rowWhere .= " AND service_code = ?";
                $rowArgs[] = $selectedServiceFilter;
            }

            $destSt = $pdo->prepare(
                "SELECT service_code, country, MIN(source_row) as source_row
                 FROM vendor_rate_rows
                 WHERE {$rowWhere}
                 GROUP BY service_code, country
                 ORDER BY source_row ASC, country ASC"
            );
            $destSt->execute($rowArgs);
            $allDestinations = $destSt->fetchAll();
            $totalDestinations = count($allDestinations);

            // Pagination for destinations
            $limit = min(200, max(20, (int)($_GET['limit'] ?? 60)));
            $pageNo = max(1, (int)($_GET['p'] ?? 1));
            $totalPages = max(1, (int)ceil($totalDestinations / $limit));
            $offset = ($pageNo - 1) * $limit;
            $pageDestinations = array_slice($allDestinations, $offset, $limit);

            // 3. Fetch all rate cells for this page's destinations
            $matrix = [];
            if (!empty($pageDestinations)) {
                $countries = array_unique(array_column($pageDestinations, 'country'));
                $inQ = implode(',', array_fill(0, count($countries), '?'));
                $rateQuery = "SELECT id, service_code, country, weight_label, rate, rate_raw, is_manually_modified
                              FROM vendor_rate_rows
                              WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ?
                              AND country IN ({$inQ})";
                $rateSt = $pdo->prepare($rateQuery);
                $rateSt->execute(array_merge([$vendorId, $batchId, $selectedSheet], $countries));
                foreach ($rateSt->fetchAll() as $cell) {
                    $key = $cell['service_code'] . '|' . $cell['country'] . '|' . $cell['weight_label'];
                    $matrix[$key] = $cell;
                }
            }
        ?>

        <div class="excel-matrix-card">
            <!-- Formula Bar & Sheet Toolbar -->
            <div class="excel-matrix-toolbar">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="excel-tab-pill">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" fill="#107c41" stroke="#107c41"/>
                            <path d="M7 8h10M7 12h10M7 16h10" stroke="#ffffff" stroke-linecap="round"/>
                        </svg>
                        <span><?= h($selectedSheet) ?></span>
                    </div>
                    <span class="badge badge-success text-xs">Live Matrix Mode</span>
                </div>

                <!-- Excel Formula Bar -->
                <div class="excel-formula-bar">
                    <span id="excel-name-box" class="excel-name-box">fx</span>
                    <span class="excel-fx-icon">fx</span>
                    <input id="excel-formula-input" class="excel-formula-display" readonly value="Click any rate cell to view details or double-click to edit live">
                    <button type="button" id="excel-edit-btn" class="btn btn-sm btn-primary" style="display:none; font-size:0.75rem; padding:2px 8px;" onclick="triggerActiveCellEdit()">
                        ✏ Edit Rate
                    </button>
                </div>

                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge badge-neutral text-xs font-mono">
                        <?= (int)$totalDestinations ?> Destinations • <?= count($slabs) ?> Weight Slabs
                    </span>
                </div>
            </div>

            <!-- Scrollable Excel Grid -->
            <div class="excel-scroll-wrapper">
                <table class="excel-table" id="mgmt-table">
                    <thead>
                        <!-- Column Letter Row: A, B, C, D, ... -->
                        <tr class="excel-letter-row">
                            <th class="excel-gutter-col"></th>
                            <?php foreach ($columns as $col): ?>
                            <th><?= h($col['col_letter']) ?></th>
                            <?php endforeach; ?>
                        </tr>

                        <!-- Deep Royal Blue Header Row (Just like screenshot!) -->
                        <tr class="excel-blue-header">
                            <th class="excel-gutter-col">1</th>
                            <?php foreach ($columns as $col): ?>
                            <th class="<?= $col['type'] === 'text' ? 'text-left' : '' ?>"><?= h($col['title']) ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($pageDestinations)): ?>
                        <tr>
                            <td colspan="<?= count($columns) + 1 ?>" style="text-align:center; padding:32px; color:#64748b;">
                                No destinations found matching your filters.
                            </td>
                        </tr>
                        <?php else: ?>
                        <?php foreach ($pageDestinations as $i => $d): ?>
                        <?php
                            $sRow = (int)($d['source_row'] ?: ($offset + $i + 2));
                        ?>
                        <tr class="excel-row-normal" id="row-<?= $sRow ?>">
                            <td class="excel-gutter-col"><?= $sRow ?></td>
                            <td class="excel-cell-text font-mono" style="font-weight:600; color:#1e293b;"><?= h($d['service_code']) ?></td>
                            <td class="excel-cell-text" style="font-weight:600; color:#0f172a;"><?= h($d['country']) ?></td>

                            <?php foreach ($slabs as $s): ?>
                            <?php
                                $cellKey = $d['service_code'] . '|' . $d['country'] . '|' . $s['weight_label'];
                                $cell = $matrix[$cellKey] ?? null;
                                $colLetter = $slabColMap[$s['weight_label']] ?? '';
                                $cellRef = $colLetter . $sRow;
                                $rateVal = $cell && $cell['rate'] !== null ? (float)$cell['rate'] : null;
                                $rawVal = $cell['rate_raw'] ?? null;
                                $cellId = $cell ? (int)$cell['id'] : 0;
                                $isEdited = !empty($cell['is_manually_modified']);
                            ?>
                            <td class="excel-cell-rate editable-cell"
                                id="cell-<?= h($cellRef) ?>"
                                data-cell-ref="<?= h($cellRef) ?>"
                                data-service="<?= h($d['service_code']) ?>"
                                data-country="<?= h($d['country']) ?>"
                                data-slab="<?= h($s['weight_label']) ?>"
                                data-rate-id="<?= $cellId ?>"
                                data-val="<?= $rateVal !== null ? number_format($rateVal, 0) : '' ?>"
                                onclick="selectExcelCell(this)"
                                ondblclick="editExcelCell(this)"
                                title="<?= h($cellRef) ?>: <?= h($d['service_code']) ?> to <?= h($d['country']) ?> (<?= h($s['weight_label']) ?>) — Double-click to edit">
                                <?php if ($rateVal !== null): ?>
                                    <?= number_format($rateVal, 0) ?>
                                    <?php if ($isEdited): ?><span class="cell-modified-indicator" title="Manually edited"></span><?php endif; ?>
                                <?php else: ?>
                                    <span class="excel-dash"><?= h($rawVal ?: '-') ?></span>
                                <?php endif; ?>
                            </td>
                            <?php endforeach; ?>
                        </tr>
                        <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <!-- Footer Pagination & Guide -->
            <div class="excel-matrix-footer">
                <div>
                    <span>Showing <strong><?= count($pageDestinations) ?></strong> of <strong><?= (int)$totalDestinations ?></strong> destination rows (Page <?= (int)$pageNo ?> of <?= (int)$totalPages ?>)</span>
                    <span style="margin:0 8px; color:#cbd5e1;">•</span>
                    <span class="text-xs">💡 Tip: Click any cell to inspect in the formula bar, or double-click to edit live with instant auto-save.</span>
                </div>

                <!-- Page navigation -->
                <?php if ($totalPages > 1): ?>
                <div style="display:flex; align-items:center; gap:6px;">
                    <?php if ($pageNo > 1): ?>
                    <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=grid&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>&p=<?= $pageNo - 1 ?>" class="btn btn-outline btn-sm">‹ Prev</a>
                    <?php endif; ?>

                    <span class="font-mono text-xs" style="padding:4px 8px;">Page <?= $pageNo ?> / <?= $totalPages ?></span>

                    <?php if ($pageNo < $totalPages): ?>
                    <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=grid&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>&p=<?= $pageNo + 1 ?>" class="btn btn-outline btn-sm">Next ›</a>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <?php elseif ($sheetType === 'zonewise'): ?>
        <?php
            // Zonewise Spreadsheet Matrix View
            $zoneColSt = $pdo->prepare(
                "SELECT DISTINCT zone FROM vendor_rate_rows
                 WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ? AND zone IS NOT NULL
                 ORDER BY LENGTH(zone), zone ASC"
            );
            $zoneColSt->execute([$vendorId, $batchId, $selectedSheet]);
            $zones = array_column($zoneColSt->fetchAll(), 'zone');

            // Columns
            $columns = [];
            $columns[] = ['col_letter' => 'A', 'title' => 'SERVICE CODE', 'type' => 'text'];
            $columns[] = ['col_letter' => 'B', 'title' => 'Weight Slab', 'type' => 'text'];
            $columns[] = ['col_letter' => 'C', 'title' => 'Country', 'type' => 'text'];
            $colIdx = 3;
            $zoneColMap = [];
            foreach ($zones as $z) {
                $letter = getExcelColName($colIdx);
                $columns[] = ['col_letter' => $letter, 'title' => $z, 'type' => 'rate'];
                $zoneColMap[$z] = $letter;
                $colIdx++;
            }

            // Rows: distinct service, weight_label, country
            $zwWhere = "vendor_id = ? AND batch_id = ? AND sheet_name = ?";
            $zwArgs = [$vendorId, $batchId, $selectedSheet];
            if ($searchQuery !== '') {
                $zwWhere .= " AND (country LIKE ? OR service_code LIKE ? OR weight_label LIKE ?)";
                $zwArgs[] = "%$searchQuery%"; $zwArgs[] = "%$searchQuery%"; $zwArgs[] = "%$searchQuery%";
            }
            if ($selectedServiceFilter !== '') {
                $zwWhere .= " AND service_code = ?";
                $zwArgs[] = $selectedServiceFilter;
            }

            $zwRowSt = $pdo->prepare(
                "SELECT service_code, weight_label, weight_kg, country, MIN(source_row) as source_row
                 FROM vendor_rate_rows
                 WHERE {$zwWhere}
                 GROUP BY service_code, weight_label, weight_kg, country
                 ORDER BY weight_kg ASC, service_code ASC, country ASC"
            );
            $zwRowSt->execute($zwArgs);
            $zwRows = $zwRowSt->fetchAll();

            // Fetch matrix data
            $zwMatrix = [];
            if (!empty($zwRows)) {
                $zwRatesSt = $pdo->prepare(
                    "SELECT id, service_code, weight_label, country, zone, rate, rate_raw, is_manually_modified
                     FROM vendor_rate_rows
                     WHERE vendor_id = ? AND batch_id = ? AND sheet_name = ?"
                );
                $zwRatesSt->execute([$vendorId, $batchId, $selectedSheet]);
                foreach ($zwRatesSt->fetchAll() as $cell) {
                    $key = $cell['service_code'] . '|' . $cell['weight_label'] . '|' . ($cell['country'] ?? '') . '|' . $cell['zone'];
                    $zwMatrix[$key] = $cell;
                }
            }
        ?>

        <div class="excel-matrix-card">
            <div class="excel-matrix-toolbar">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="excel-tab-pill">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" fill="#107c41" stroke="#107c41"/>
                            <path d="M7 8h10M7 12h10M7 16h10" stroke="#ffffff" stroke-linecap="round"/>
                        </svg>
                        <span><?= h($selectedSheet) ?> (Zonewise Matrix)</span>
                    </div>
                    <span class="badge badge-purple text-xs">Zone Tariff Matrix</span>
                </div>

                <div class="excel-formula-bar">
                    <span id="excel-name-box" class="excel-name-box">fx</span>
                    <span class="excel-fx-icon">fx</span>
                    <input id="excel-formula-input" class="excel-formula-display" readonly value="Click any cell to view rate details or double-click to edit">
                </div>

                <div>
                    <span class="badge badge-neutral text-xs font-mono"><?= count($zwRows) ?> Weight Rows • <?= count($zones) ?> Zones</span>
                </div>
            </div>

            <div class="excel-scroll-wrapper">
                <table class="excel-table" id="mgmt-table">
                    <thead>
                        <tr class="excel-letter-row">
                            <th class="excel-gutter-col"></th>
                            <?php foreach ($columns as $col): ?>
                            <th><?= h($col['col_letter']) ?></th>
                            <?php endforeach; ?>
                        </tr>
                        <tr class="excel-blue-header">
                            <th class="excel-gutter-col">1</th>
                            <?php foreach ($columns as $col): ?>
                            <th class="<?= $col['type'] === 'text' ? 'text-left' : '' ?>"><?= h($col['title']) ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($zwRows as $i => $r): ?>
                        <?php $sRow = (int)($r['source_row'] ?: ($i + 2)); ?>
                        <tr class="excel-row-normal">
                            <td class="excel-gutter-col"><?= $sRow ?></td>
                            <td class="excel-cell-text font-mono" style="font-weight:600;"><?= h($r['service_code']) ?></td>
                            <td class="excel-cell-text font-mono" style="font-weight:600; color:#107c41;"><?= h($r['weight_label']) ?></td>
                            <td class="excel-cell-text"><?= h($r['country'] ?? 'All') ?></td>

                            <?php foreach ($zones as $z): ?>
                            <?php
                                $key = $r['service_code'] . '|' . $r['weight_label'] . '|' . ($r['country'] ?? '') . '|' . $z;
                                $cell = $zwMatrix[$key] ?? null;
                                $colLetter = $zoneColMap[$z] ?? '';
                                $cellRef = $colLetter . $sRow;
                                $rateVal = $cell && $cell['rate'] !== null ? (float)$cell['rate'] : null;
                                $rawVal = $cell['rate_raw'] ?? null;
                                $cellId = $cell ? (int)$cell['id'] : 0;
                            ?>
                            <td class="excel-cell-rate editable-cell"
                                id="cell-<?= h($cellRef) ?>"
                                data-cell-ref="<?= h($cellRef) ?>"
                                data-service="<?= h($r['service_code']) ?>"
                                data-country="<?= h($r['country'] ?? 'Global') ?>"
                                data-slab="<?= h($r['weight_label']) . ' (' . $z . ')' ?>"
                                data-rate-id="<?= $cellId ?>"
                                data-val="<?= $rateVal !== null ? number_format($rateVal, 0) : '' ?>"
                                onclick="selectExcelCell(this)"
                                ondblclick="editExcelCell(this)">
                                <?php if ($rateVal !== null): ?>
                                    <?= number_format($rateVal, 0) ?>
                                    <?php if (!empty($cell['is_manually_modified'])): ?><span class="cell-modified-indicator"></span><?php endif; ?>
                                <?php else: ?>
                                    <span class="excel-dash"><?= h($rawVal ?: '-') ?></span>
                                <?php endif; ?>
                            </td>
                            <?php endforeach; ?>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <?php elseif ($sheetType === 'rate_data' || $sheetType === 'matrix'): ?>
        <?php
            // RATE DATA Spreadsheet Matrix View — 115-column tariff grid
            // Columns: Destination, State, Service Code, Service, Zone, Duty Paid, Transit, then weight slabs from JSON
            $matWhere = "vendor_id = ? AND batch_id = ?";
            $matArgs = [$vendorId, $batchId];
            if ($searchQuery !== '') {
                $matWhere .= " AND (destination LIKE ? OR service_code LIKE ? OR service_name LIKE ? OR zone LIKE ?)";
                $matArgs[] = "%$searchQuery%"; $matArgs[] = "%$searchQuery%"; $matArgs[] = "%$searchQuery%"; $matArgs[] = "%$searchQuery%";
            }
            if ($selectedServiceFilter !== '') {
                $matWhere .= " AND service_code = ?";
                $matArgs[] = $selectedServiceFilter;
            }

            // Get all rows (paginated)
            $matTotalSt = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_matrix WHERE $matWhere");
            $matTotalSt->execute($matArgs);
            $matTotal = (int)$matTotalSt->fetchColumn();

            $matLimit = min(200, max(20, (int)($_GET['limit'] ?? 60)));
            $matPageNo = max(1, (int)($_GET['p'] ?? 1));
            $matTotalPages = max(1, (int)ceil($matTotal / $matLimit));
            $matOffset = ($matPageNo - 1) * $matLimit;

            $matSt = $pdo->prepare("SELECT * FROM vendor_rate_matrix WHERE $matWhere ORDER BY destination, service_code LIMIT {$matLimit} OFFSET {$matOffset}");
            $matSt->execute($matArgs);
            $matRows = $matSt->fetchAll();

            // Build column definitions: metadata + representative weight slabs
            $sampleSlabs = ['0.5 KG','1 KG','1.5 KG','2 KG','2.5 KG','3 KG','3.5 KG','4 KG','4.5 KG','5 KG','5.5 KG',
                            '6 KG','7 KG','8 KG','9 KG','10 KG','12 KG','15 KG','20 KG','25 KG','30 KG','40 KG','50 KG','60 KG','70 KG','80 KG','90 KG','100 KG'];

            // Detect which slabs actually have data
            $activeSlabs = [];
            foreach ($matRows as $mr) {
                $wr = json_decode($mr['weight_rates'] ?: '{}', true) ?: [];
                foreach ($sampleSlabs as $sl) {
                    $cleanSl = str_replace(' KG', '', $sl);
                    if ((isset($wr[$sl]) || isset($wr[$cleanSl])) && !isset($activeSlabs[$sl])) {
                        $activeSlabs[$sl] = true;
                    }
                }
            }
            $displaySlabs = array_keys($activeSlabs);
            if (empty($displaySlabs)) $displaySlabs = $sampleSlabs;

            // Build Excel-style columns
            $matColumns = [];
            $matColumns[] = ['col_letter' => 'A', 'title' => 'Destination', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'B', 'title' => 'State', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'C', 'title' => 'Service Code', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'D', 'title' => 'Service', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'E', 'title' => 'Zone', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'F', 'title' => 'Duty Paid', 'type' => 'text'];
            $matColumns[] = ['col_letter' => 'G', 'title' => 'Transit', 'type' => 'text'];
            $colIdx = 7;
            $slabColMap = [];
            foreach ($displaySlabs as $sl) {
                $letter = getExcelColName($colIdx);
                $matColumns[] = ['col_letter' => $letter, 'title' => $sl, 'type' => 'rate', 'slab' => $sl];
                $slabColMap[$sl] = $letter;
                $colIdx++;
            }
        ?>

        <div class="excel-matrix-card">
            <div class="excel-matrix-toolbar">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="excel-tab-pill">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" fill="#107c41" stroke="#107c41"/>
                            <path d="M7 8h10M7 12h10M7 16h10" stroke="#ffffff" stroke-linecap="round"/>
                        </svg>
                        <span><?= h($selectedSheet) ?> — Tariff Matrix</span>
                    </div>
                    <span class="badge badge-success text-xs">RATE DATA Matrix</span>
                </div>

                <div class="excel-formula-bar">
                    <span id="excel-name-box" class="excel-name-box">fx</span>
                    <span class="excel-fx-icon">fx</span>
                    <input id="excel-formula-input" class="excel-formula-display" readonly value="Click any rate cell to view details or double-click to edit live">
                    <button type="button" id="excel-edit-btn" class="btn btn-sm btn-primary" style="display:none; font-size:0.75rem; padding:2px 8px;" onclick="triggerActiveCellEdit()">
                        ✏ Edit Rate
                    </button>
                </div>

                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge badge-neutral text-xs font-mono">
                        <?= number_format($matTotal) ?> Destinations • <?= count($displaySlabs) ?> Weight Slabs
                    </span>
                </div>
            </div>

            <div class="excel-scroll-wrapper">
                <table class="excel-table" id="mgmt-table">
                    <thead>
                        <tr class="excel-letter-row">
                            <th class="excel-gutter-col"></th>
                            <?php foreach ($matColumns as $col): ?>
                            <th><?= h($col['col_letter']) ?></th>
                            <?php endforeach; ?>
                        </tr>
                        <tr class="excel-blue-header">
                            <th class="excel-gutter-col">1</th>
                            <?php foreach ($matColumns as $col): ?>
                            <th class="<?= $col['type'] === 'text' ? 'text-left' : '' ?>"><?= h($col['title']) ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($matRows)): ?>
                        <tr>
                            <td colspan="<?= count($matColumns) + 1 ?>" style="text-align:center; padding:32px; color:#64748b;">
                                No tariff matrix rows found matching your filters.
                            </td>
                        </tr>
                        <?php else: ?>
                        <?php foreach ($matRows as $i => $mr):
                            $sRow = $matOffset + $i + 2;
                            $wr = json_decode($mr['weight_rates'] ?: '{}', true) ?: [];
                        ?>
                        <tr class="excel-row-normal" id="row-<?= $sRow ?>">
                            <td class="excel-gutter-col"><?= $sRow ?></td>
                            <td class="excel-cell-text" style="font-weight:600; color:#0f172a;"><?= h($mr['destination']) ?></td>
                            <td class="excel-cell-text text-sm text-muted"><?= h($mr['state'] ?: '—') ?></td>
                            <td class="excel-cell-text font-mono" style="font-weight:600;"><?= h($mr['service_code']) ?></td>
                            <td class="excel-cell-text text-sm"><?= h($mr['service_name'] ?: '—') ?></td>
                            <td class="excel-cell-text"><?= $mr['zone'] ? '<span class="badge badge-purple font-mono">' . h($mr['zone']) . '</span>' : '—' ?></td>
                            <td class="excel-cell-text"><?= $mr['duty_paid'] ? '<span class="badge badge-success">' . h($mr['duty_paid']) . '</span>' : '—' ?></td>
                            <td class="excel-cell-text text-sm font-mono"><?= h($mr['transit_time'] ?: '—') ?></td>

                            <?php foreach ($displaySlabs as $sl):
                                $colLetter = $slabColMap[$sl] ?? '';
                                $cellRef = $colLetter . $sRow;
                                $cleanSl = str_replace(' KG', '', $sl);
                                $rawNum = $wr[$sl] ?? ($wr[$cleanSl] ?? ($wr[$sl . ' KG'] ?? null));
                                $rateVal = ($rawNum !== null && is_numeric($rawNum)) ? (float)$rawNum : null;
                                $isFirstSlab = ($sl === '0.5 KG' || $sl === '0.5');
                                $cellId = (int)$mr['id'];
                                $isEdited = !empty($mr['is_manually_modified']);
                            ?>
                            <td class="excel-cell-rate editable-cell"
                                id="cell-<?= h($cellRef) ?>"
                                data-cell-ref="<?= h($cellRef) ?>"
                                data-service="<?= h($mr['service_code']) ?>"
                                data-country="<?= h($mr['destination']) ?>"
                                data-slab="<?= h($sl) ?>"
                                data-rate-id="<?= $cellId ?>"
                                data-table="vendor_rate_matrix"
                                data-val="<?= $rateVal !== null ? number_format($rateVal, 0) : '' ?>"
                                onclick="selectExcelCell(this)"
                                ondblclick="editMatrixCell(this)"
                                title="<?= h($cellRef) ?>: <?= h($mr['service_code']) ?> to <?= h($mr['destination']) ?> (<?= h($sl) ?>) — Double-click to edit"
                                <?php if ($isFirstSlab): ?>style="font-weight:600; color:#107c41;"<?php endif; ?>>
                                <?php if ($rateVal !== null): ?>
                                    <?= number_format($rateVal, 0) ?>
                                    <?php if ($isEdited): ?><span class="cell-modified-indicator" title="Manually edited"></span><?php endif; ?>
                                <?php else: ?>
                                    <span class="excel-dash">-</span>
                                <?php endif; ?>
                            </td>
                            <?php endforeach; ?>
                        </tr>
                        <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <div class="excel-matrix-footer">
                <div>
                    <span>Showing <strong><?= count($matRows) ?></strong> of <strong><?= number_format($matTotal) ?></strong> tariff rows (Page <?= $matPageNo ?> of <?= $matTotalPages ?>)</span>
                    <span style="margin:0 8px; color:#cbd5e1;">•</span>
                    <span class="text-xs">💡 0.5 KG = flat base charge · Other slabs = rate per KG × billable weight</span>
                </div>
                <?php if ($matTotalPages > 1): ?>
                <div style="display:flex; align-items:center; gap:6px;">
                    <?php if ($matPageNo > 1): ?>
                    <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=grid&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>&p=<?= $matPageNo - 1 ?>" class="btn btn-outline btn-sm">‹ Prev</a>
                    <?php endif; ?>
                    <span class="font-mono text-xs" style="padding:4px 8px;">Page <?= $matPageNo ?> / <?= $matTotalPages ?></span>
                    <?php if ($matPageNo < $matTotalPages): ?>
                    <a href="?page=rate_management&vendor=<?= urlencode($selectedVendor) ?>&sheet=<?= urlencode($selectedSheet) ?>&view=grid&q=<?= urlencode($searchQuery) ?>&service=<?= urlencode($selectedServiceFilter) ?>&p=<?= $matPageNo + 1 ?>" class="btn btn-outline btn-sm">Next ›</a>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <?php else: ?>
        <!-- Zone Mappings in Grid view -->
        <?php
            $pagination = paginationParams();
            $where = "vendor_id = ? AND batch_id = ?";
            $args = [$vendorId, $batchId];
            if ($searchQuery !== '') {
                $where .= " AND (country LIKE ? OR postcode LIKE ? OR zone LIKE ?)";
                $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
            }
            $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_zone_rows WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
            $st = $pdo->prepare("SELECT * FROM vendor_zone_rows WHERE $where ORDER BY country, postcode LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
            $st->execute($args);
            $rows = $st->fetchAll();
        ?>
        <div class="excel-matrix-card">
            <div class="excel-matrix-toolbar">
                <div class="excel-tab-pill">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" fill="#107c41" stroke="#107c41"/>
                        <path d="M7 8h10M7 12h10M7 16h10" stroke="#ffffff" stroke-linecap="round"/>
                    </svg>
                    <span><?= h($selectedSheet) ?> — Postcode Zone Directory</span>
                </div>
                <span class="badge badge-neutral text-xs font-mono"><?= number_format($total) ?> Total Postcodes</span>
            </div>
            <div class="excel-scroll-wrapper">
                <table class="excel-table" id="mgmt-table">
                    <thead>
                        <tr class="excel-letter-row">
                            <th class="excel-gutter-col"></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th>
                        </tr>
                        <tr class="excel-blue-header">
                            <th class="excel-gutter-col">1</th>
                            <th class="text-left">Country</th>
                            <th class="text-left">Postcode / ZIP</th>
                            <th class="text-left">Zone</th>
                            <th class="text-left">Town / City</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($rows as $i => $r): ?>
                        <tr class="excel-row-normal">
                            <td class="excel-gutter-col"><?= $pagination['offset'] + $i + 2 ?></td>
                            <td class="excel-cell-text" style="font-weight:600;"><?= h($r['country']) ?></td>
                            <td class="excel-cell-text font-mono"><?= h($r['postcode']) ?></td>
                            <td class="editable-cell excel-cell-text font-mono" style="color:#107c41; font-weight:700;" onclick="makeEditable(this, <?= $r['id'] ?>, 'zone', 'vendor_zone_rows')"><?= h($r['zone'] ?? '—') ?></td>
                            <td class="editable-cell excel-cell-text" onclick="makeEditable(this, <?= $r['id'] ?>, 'town_city', 'vendor_zone_rows')"><?= h($r['town_city'] ?? '—') ?></td>
                            <td style="text-align:center;">
                                <button class="btn btn-ghost btn-sm" style="color:var(--accent-danger);" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_zone_rows', this.closest('tr'))">🗑</button>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php include __DIR__ . '/_pagination.php'; ?>
        </div>
        <?php endif; ?>

    <!-- ============================================================
         VIEW MODE 2: FLAT RECORDS LIST VIEW
         ============================================================ -->
    <?php else: ?>

        <?php
        $pagination = paginationParams();
        if ($sheetType === 'zones'):
            $where = "vendor_id = ? AND batch_id = ?";
            $args = [$vendorId, $batchId];
            if ($searchQuery !== '') {
                $where .= " AND (country LIKE ? OR postcode LIKE ? OR zone LIKE ?)";
                $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
            }
            $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_zone_rows WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
            $st = $pdo->prepare("SELECT * FROM vendor_zone_rows WHERE $where ORDER BY country, postcode LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
            $st->execute($args);
            $rows = $st->fetchAll();
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($selectedSheet) ?> — Zone Records <span class="text-muted text-sm">(<?= number_format($total) ?>)</span></h3>
            </div>
            <div class="card-body table-wrapper">
                <table class="data-table" id="mgmt-table">
                    <thead><tr><th class="sortable">Country</th><th class="sortable">Postcode</th><th class="sortable">Zone</th><th>Town/City</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r): ?>
                    <tr>
                        <td><?= h($r['country']) ?></td>
                        <td class="font-mono"><?= h($r['postcode']) ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'zone', 'vendor_zone_rows')"><?= h($r['zone'] ?? '—') ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'town_city', 'vendor_zone_rows')"><?= h($r['town_city'] ?? '—') ?></td>
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '<span class="badge badge-neutral">imported</span>' ?></td>
                        <td><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_zone_rows', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>

        <?php elseif ($sheetType === 'rate_data' || $sheetType === 'matrix'): ?>
        <?php
            $where = "vendor_id = ? AND batch_id = ?";
            $args = [$vendorId, $batchId];
            if ($searchQuery !== '') {
                $where .= " AND (destination LIKE ? OR service_code LIKE ? OR service_name LIKE ? OR zone LIKE ? OR state LIKE ?)";
                $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
            }
            if ($selectedServiceFilter !== '') {
                $where .= " AND service_code = ?";
                $args[] = $selectedServiceFilter;
            }
            $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_matrix WHERE $where");
            $total->execute($args);
            $total = (int)$total->fetchColumn();

            $st = $pdo->prepare("SELECT * FROM vendor_rate_matrix WHERE $where ORDER BY destination, service_code LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
            $st->execute($args);
            $rows = $st->fetchAll();
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($selectedSheet) ?> — Tariff Matrix Records <span class="text-muted text-sm">(<?= number_format($total) ?>)</span></h3>
            </div>
            <div class="card-body table-wrapper">
                <table class="data-table" id="mgmt-table">
                    <thead><tr>
                        <th class="sortable">Destination</th>
                        <th>State</th>
                        <th class="sortable">Service Code</th>
                        <th>Service</th>
                        <th>Zone</th>
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
                        <th>Status</th>
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
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '<span class="badge badge-neutral">imported</span>' ?></td>
                        <td class="action-col"><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_rate_matrix', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>

        <?php else: ?>
        <?php
            $where = "vendor_id = ? AND batch_id = ? AND sheet_name = ?";
            $args = [$vendorId, $batchId, $selectedSheet];
            if ($searchQuery !== '') {
                $where .= " AND (service_code LIKE ? OR country LIKE ? OR service_name LIKE ?)";
                $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%"; $args[] = "%$searchQuery%";
            }
            if ($selectedServiceFilter !== '') {
                $where .= " AND service_code = ?";
                $args[] = $selectedServiceFilter;
            }
            $total = $pdo->prepare("SELECT COUNT(*) FROM vendor_rate_rows WHERE $where"); $total->execute($args); $total = (int)$total->fetchColumn();
            $st = $pdo->prepare("SELECT * FROM vendor_rate_rows WHERE $where ORDER BY service_code, country, weight_kg LIMIT {$pagination['per_page']} OFFSET {$pagination['offset']}");
            $st->execute($args);
            $rows = $st->fetchAll();
        ?>
        <div class="card card-flush">
            <div class="card-header">
                <h3><?= h($selectedSheet) ?> — Rate Entries <span class="text-muted text-sm">(<?= number_format($total) ?>)</span></h3>
            </div>
            <div class="card-body table-wrapper">
                <table class="data-table" id="mgmt-table">
                    <thead><tr>
                        <th class="sortable">Service Code</th><th>Service</th><th class="sortable">Country</th>
                        <th class="sortable">Weight</th><th>kg</th>
                        <?php if ($sheetType === 'zonewise'): ?><th class="sortable">Zone</th><?php endif; ?>
                        <th class="sortable">Rate</th><th>Raw</th><th>Transit</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($rows as $r): ?>
                    <tr>
                        <td class="font-mono editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'service_code', 'vendor_rate_rows')"><?= h($r['service_code']) ?></td>
                        <td class="text-sm editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'service_name', 'vendor_rate_rows')"><?= h($r['service_name'] ?? '—') ?></td>
                        <td class="editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'country', 'vendor_rate_rows')"><?= h($r['country'] ?? '—') ?></td>
                        <td class="text-sm"><?= h($r['weight_label'] ?? '—') ?></td>
                        <td class="font-mono"><?= $r['weight_kg'] !== null ? $r['weight_kg'] : '—' ?></td>
                        <?php if ($sheetType === 'zonewise'): ?><td><?= h($r['zone'] ?? '—') ?></td><?php endif; ?>
                        <td class="rate-cell editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'rate', 'vendor_rate_rows')"><?= formatRate($r['rate'], $r['rate_raw']) ?></td>
                        <td class="text-sm text-muted"><?= h($r['rate_raw'] ?? '') ?></td>
                        <td class="text-sm editable-cell" onclick="makeEditable(this, <?= $r['id'] ?>, 'transit_time', 'vendor_rate_rows')"><?= h($r['transit_time'] ?? '—') ?></td>
                        <td><?= ($r['is_manually_modified'] ?? 0) ? '<span class="badge-modified">edited</span>' : '<span class="badge badge-neutral">imported</span>' ?></td>
                        <td><button class="btn btn-ghost btn-sm" style="color:var(--accent-danger)" onclick="deleteRecord(<?= $r['id'] ?>, 'vendor_rate_rows', this.closest('tr'))">🗑</button></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php include __DIR__ . '/_pagination.php'; ?>
            </div>
        </div>
        <?php endif; ?>

    <?php endif; ?>

<!-- Add Record Modal -->
<div id="add-record-modal" class="modal-overlay" style="display:none">
    <div class="modal">
        <div class="modal-header"><h3>Add Record</h3><button class="modal-close" onclick="closeAddModal()">✕</button></div>
        <form id="add-record-form">
            <input type="hidden" name="vendor_id" id="add-vendor-id" value="<?= $vendorId ?>">
            <input type="hidden" name="batch_id" id="add-batch-id" value="<?= $batchId ?>">
            <input type="hidden" name="sheet_type" id="add-sheet-type" value="<?= h($sheetType) ?>">
            <input type="hidden" name="sheet_name" value="<?= h($selectedSheet) ?>">
            <div id="add-rate-fields">
                <div class="form-row"><div class="form-group"><label class="form-label">Service Code</label><input class="form-control" name="service_code"></div><div class="form-group"><label class="form-label">Service Name</label><input class="form-control" name="service_name"></div></div>
                <div class="form-row"><div class="form-group"><label class="form-label">Country</label><input class="form-control" name="country"></div><div class="form-group"><label class="form-label">Weight Label</label><input class="form-control" name="weight_label"></div></div>
                <div class="form-row"><div class="form-group"><label class="form-label">Weight (kg)</label><input class="form-control" name="weight_kg" type="number" step="0.0001"></div><div class="form-group"><label class="form-label">Zone</label><input class="form-control" name="zone"></div></div>
                <div class="form-row"><div class="form-group"><label class="form-label">Rate</label><input class="form-control" name="rate" type="number" step="0.01"></div><div class="form-group"><label class="form-label">Transit</label><input class="form-control" name="transit_time"></div></div>
            </div>
            <div id="add-zone-fields" class="hidden">
                <div class="form-row"><div class="form-group"><label class="form-label">Country</label><input class="form-control" name="zone_country"></div><div class="form-group"><label class="form-label">Postcode</label><input class="form-control" name="postcode"></div></div>
                <div class="form-row"><div class="form-group"><label class="form-label">Zone</label><input class="form-control" name="zone_value"></div><div class="form-group"><label class="form-label">Town/City</label><input class="form-control" name="town_city"></div></div>
            </div>
            <div class="flex gap-8 mt-16"><button type="button" class="btn btn-primary" onclick="submitAddRecord()">Add Record</button><button type="button" class="btn btn-ghost" onclick="closeAddModal()">Cancel</button></div>
        </form>
    </div>
</div>

<?php elseif ($vendorObj && !$batchId): ?>
    <div class="empty-state card mt-16"><div class="empty-icon">📭</div><p>No active import version found for this vendor. Upload an Excel workbook first.</p></div>
<?php elseif (!$selectedVendor): ?>
    <div class="empty-state card mt-16"><div class="empty-icon">👆</div><p>Select a vendor to manage rates.</p></div>
<?php endif; ?>

<script>
// Live Excel Spreadsheet Matrix Controller
let currentActiveCell = null;

function selectExcelCell(td) {
    if (currentActiveCell) {
        currentActiveCell.classList.remove('excel-cell-active');
    }
    currentActiveCell = td;
    td.classList.add('excel-cell-active');

    const cellRef = td.dataset.cellRef || '';
    const service = td.dataset.service || '';
    const country = td.dataset.country || '';
    const slab = td.dataset.slab || '';
    const val = td.dataset.val || '';
    const rateId = td.dataset.rateId || '';

    const nameBox = document.getElementById('excel-name-box');
    const formulaInput = document.getElementById('excel-formula-input');
    const editBtn = document.getElementById('excel-edit-btn');

    if (nameBox) nameBox.textContent = cellRef || 'fx';
    if (formulaInput) {
        if (val !== '') {
            formulaInput.value = `=${service}!${country}[${slab}] = ₹ ${val} INR`;
        } else {
            formulaInput.value = `=${service}!${country}[${slab}] = - (No tariff quoted)`;
        }
    }
    if (editBtn) {
        if (rateId && rateId !== '0') {
            editBtn.style.display = 'inline-block';
        } else {
            editBtn.style.display = 'none';
        }
    }
}

function editExcelCell(td) {
    selectExcelCell(td);
    const rateId = td.dataset.rateId;
    if (rateId && rateId !== '0') {
        makeEditable(td, parseInt(rateId, 10), 'rate', 'vendor_rate_rows');
    }
}

function editMatrixCell(td) {
    selectExcelCell(td);
    const rateId = td.dataset.rateId;
    const slab = td.dataset.slab;
    const table = td.dataset.table || 'vendor_rate_matrix';
    if (rateId && rateId !== '0') {
        makeEditable(td, parseInt(rateId, 10), slab, table);
    }
}

function triggerActiveCellEdit() {
    if (currentActiveCell) {
        if (currentActiveCell.dataset.table === 'vendor_rate_matrix') {
            editMatrixCell(currentActiveCell);
        } else {
            editExcelCell(currentActiveCell);
        }
    }
}
</script>
