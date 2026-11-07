<?php
// Rate Calculator Page
$vendors = $pdo->query("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name")->fetchAll();
$selectedVendor = trim($_GET['vendor'] ?? ($_POST['vendor'] ?? ''));
$selectedCountry = trim($_POST['country'] ?? ($_GET['country'] ?? ''));
$selectedService = trim($_POST['service_code'] ?? ($_GET['service_code'] ?? ''));
$selectedWeight = trim((string)($_POST['weight_kg'] ?? ($_GET['weight_kg'] ?? '')));
$selectedPostcode = trim($_POST['postcode'] ?? ($_GET['postcode'] ?? ''));
$calcResult = null;

$isCalcSubmitted = ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['calculate']))
    || (!empty($_GET['calculate']) || (!empty($selectedVendor) && !empty($selectedCountry) && !empty($selectedService) && !empty($selectedWeight)));

if ($isCalcSubmitted) {
    $vendor = $selectedVendor;
    $country = $selectedCountry;
    $serviceCode = $selectedService;
    $weightKg = (float)$selectedWeight;
    $postcode = $selectedPostcode;

    if ($vendor && $country && $serviceCode && $weightKg > 0) {
        $v = getVendorBySlug($pdo, $vendor);
        if ($v) {
            $batchId = getActiveBatchId($pdo, (int)$v['id']);
            if ($batchId) {
                $calc = new RateCalculator($pdo, (int)$v['id'], $batchId, $v['name']);
                $calcResult = $calc->calculate($country, $serviceCode, $weightKg, $postcode ?: null);
            } else {
                $calcResult = ['success' => false, 'error' => 'No active import version found for this vendor.'];
            }
        } else {
            $calcResult = ['success' => false, 'error' => 'Vendor not found.'];
        }
    } else {
        $calcResult = ['success' => false, 'error' => 'Please fill in all required fields (vendor, country, service, weight).'];
    }
}

// Get countries/services for selected vendor
$vendorCountries = [];
$vendorServices = [];
$isZonewiseCountry = false;
if ($selectedVendor) {
    $v = getVendorBySlug($pdo, $selectedVendor);
    if ($v) {
        $batchId = getActiveBatchId($pdo, (int)$v['id']);
        if ($batchId) {
            $calc = new RateCalculator($pdo, (int)$v['id'], $batchId, $v['name']);
            $vendorCountries = $calc->getAvailableCountries();
            $vendorServices = $selectedCountry !== '' ? $calc->getAvailableServices($selectedCountry) : $calc->getAvailableServices();
            $isZonewiseCountry = $selectedCountry !== '' ? $calc->isCountryZonewise($selectedCountry) : false;
        }
    }
}
?>

<style>
/* ---- Excel Spreadsheet Matrix Component ---- */
.excel-matrix-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04);
    overflow: hidden;
    margin-top: 24px;
}
.excel-matrix-toolbar {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
}
.excel-tab-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-bottom: 2px solid #107c41;
    padding: 6px 14px;
    border-radius: 6px 6px 0 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
}
.excel-formula-bar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 4px 10px;
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 0.82rem;
    color: #334155;
    flex: 1;
    max-width: 520px;
}
.excel-name-box {
    background: #f1f5f9;
    border-radius: 4px;
    padding: 2px 8px;
    font-weight: 700;
    color: #0f172a;
    border: 1px solid #e2e8f0;
}
.excel-fx-icon {
    font-style: italic;
    font-weight: 700;
    color: #64748b;
    user-select: none;
}
.excel-scroll-wrapper {
    overflow-x: auto;
    max-width: 100%;
    background: #ffffff;
}
.excel-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.82rem;
    white-space: nowrap;
}
/* Column letter row */
.excel-letter-row th {
    background: #f8fafc;
    color: #64748b;
    font-weight: 600;
    font-size: 0.72rem;
    text-align: center;
    padding: 4px 10px;
    border: 1px solid #e2e8f0;
    user-select: none;
}
/* Deep Royal Blue Header matching user spreadsheet image */
.excel-blue-header th {
    background: #00008b !important;
    color: #ffffff !important;
    font-weight: 700;
    text-align: center;
    padding: 10px 14px;
    border: 1px solid rgba(255,255,255,0.25);
    font-size: 0.82rem;
    letter-spacing: 0.02em;
}
.excel-gutter-col {
    background: #f1f5f9 !important;
    color: #64748b !important;
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 0.75rem;
    text-align: center !important;
    width: 44px;
    min-width: 44px;
    border-right: 2px solid #cbd5e1 !important;
    border-bottom: 1px solid #e2e8f0 !important;
    user-select: none;
    font-weight: 500;
}
.excel-row-normal td {
    padding: 7px 12px;
    border: 1px solid #e2e8f0;
    color: #334155;
}
.excel-row-selected {
    background: #f0fdf4 !important;
}
.excel-row-selected td {
    background: #f0fdf4;
    border-top: 1px solid #86efac;
    border-bottom: 1px solid #86efac;
}
.excel-cell-text {
    text-align: left;
    font-weight: 500;
}
.excel-cell-rate {
    text-align: right;
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 0.84rem;
}
.excel-dash {
    display: inline-block;
    width: 100%;
    text-align: center;
    color: #94a3b8;
}
/* Active cell box matching Excel green selection border */
.excel-cell-active {
    outline: 2.5px solid #107c41 !important;
    outline-offset: -2px;
    background: #dcfce7 !important;
    color: #14532d !important;
    font-weight: 800 !important;
    position: relative;
    z-index: 2;
}
.excel-cell-active::after {
    content: '';
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 6px;
    height: 6px;
    background: #107c41;
    border: 1px solid #ffffff;
    box-shadow: 0 0 2px rgba(0,0,0,0.3);
}
.excel-matrix-footer {
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: #64748b;
    gap: 8px;
}

/* ---- Detailed Answer Cards Grid ---- */
.answer-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    margin-top: 24px;
}
.answer-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.answer-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.answer-card-title {
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 6px;
}
.answer-card-value {
    font-size: 1.45rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
    margin-bottom: 6px;
}
.answer-card-desc {
    font-size: 0.82rem;
    color: #475569;
    line-height: 1.5;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
}
</style>

<div class="mb-24">
    <h2>Rate Calculator</h2>
    <p class="text-muted text-sm">Calculate shipping rates with live spreadsheet preview and complete mathematical audit</p>
</div>

<!-- Top Section: Form on Left + Hero Result on Right -->
<div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; align-items:start;">
    <!-- Form Card -->
    <div class="card">
        <h3 class="mb-16">📦 Shipment Details</h3>
        <form method="post" id="calc-form" action="?page=rate_calculator">
            <input type="hidden" name="page" value="rate_calculator">
            <div class="form-group">
                <label class="form-label">Vendor *</label>
                <select class="form-control" name="vendor" required onchange="if(this.value){ window.location.href='?page=rate_calculator&vendor='+encodeURIComponent(this.value); } else { window.location.href='?page=rate_calculator'; }">
                    <option value="">Select vendor...</option>
                    <?php foreach ($vendors as $v): ?>
                    <option value="<?= h($v['slug']) ?>" <?= $selectedVendor === $v['slug'] ? 'selected' : '' ?>><?= h($v['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Destination Country *</label>
                <?php if ($vendorCountries): ?>
                <select class="form-control" name="country" id="country-select" required onchange="onCountryChanged(this.value)">
                    <option value="">Select country...</option>
                    <?php foreach ($vendorCountries as $c): ?>
                    <option value="<?= h($c) ?>" <?= $selectedCountry === $c ? 'selected' : '' ?>><?= h($c) ?></option>
                    <?php endforeach; ?>
                </select>
                <?php else: ?>
                <input class="form-control" name="country" id="country-select" placeholder="e.g. Germany" value="<?= h($selectedCountry) ?>" required onchange="onCountryChanged(this.value)">
                <?php endif; ?>
            </div>

            <div class="form-group">
                <label class="form-label">Service Code *</label>
                <?php if ($vendorServices): ?>
                <select class="form-control font-mono" name="service_code" id="service-select" required>
                    <option value="">Select service code...</option>
                    <?php foreach ($vendorServices as $s): ?>
                    <option value="<?= h($s['service_code']) ?>" <?= $selectedService === $s['service_code'] ? 'selected' : '' ?>>
                        <?= h($s['service_code']) ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <?php else: ?>
                <select class="form-control font-mono" name="service_code" id="service-select" required>
                    <option value="">Select country first...</option>
                </select>
                <?php endif; ?>
                <p class="form-hint" id="service-hint">
                    <?= $selectedCountry ? count($vendorServices) . ' service(s) available for ' . h($selectedCountry) : 'Select a destination country to filter available services' ?>
                </p>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Weight (kg) *</label>
                    <input class="form-control" name="weight_kg" type="number" step="0.01" min="0.01" placeholder="e.g. 26.0" value="<?= h($selectedWeight) ?>" required>
                </div>
                <div class="form-group" id="postcode-group">
                    <label class="form-label" id="postcode-label">Postcode / ZIP <?= $isZonewiseCountry ? '<span style="color:#ef4444;">*</span>' : '<span class="text-muted" style="font-size:0.78rem; font-weight:normal;">(Optional)</span>' ?></label>
                    <input class="form-control" name="postcode" id="postcode-input" placeholder="<?= $isZonewiseCountry ? 'e.g. 10001 (required for zone tariff)' : 'e.g. 10115 (optional)' ?>" value="<?= h($selectedPostcode) ?>">
                    <p class="form-hint" id="postcode-hint">
                        <?= $isZonewiseCountry ? 'Destination uses zone-wise pricing. Postcode is required to determine the rate zone.' : 'Destination uses regular country-wise rates. Postcode is not required.' ?>
                    </p>
                </div>
            </div>

            <button type="submit" name="calculate" class="btn btn-primary btn-lg btn-block mt-16">
                🔍 Calculate Rate
            </button>
        </form>
    </div>

    <!-- Right Side: Hero Summary Card or Welcome State -->
    <div>
        <?php if ($calcResult): ?>
            <?php if ($calcResult['success']): ?>
                <?php
                $calc = $calcResult['calculation'] ?? [];
                $breakdown = $calcResult['breakdown'] ?? ($calc['breakdown'] ?? []);
                $steps = $calc['steps'] ?? [];
                $sheetName = $calcResult['sheet_name'] ?? ($calc['sheet_name'] ?? 'Rates Table');
                $transitTime = $calcResult['transit_time'] ?? ($calc['transit_time'] ?? null);
                $formula = $calcResult['formula'] ?? ($calc['formula'] ?? null);
                $activeSlab = $calcResult['active_slab'] ?? ($calc['selected_slab'] ?? 'Base Slab');
                $sheetGrid = $calcResult['sheet_grid'] ?? null;
                $activeCellRef = $sheetGrid['active_cell_ref'] ?? null;
                ?>
                <div class="calc-result" style="margin-top:0;">
                    <div class="flex-between" style="align-items:flex-start;">
                        <div>
                            <span class="badge badge-info" style="margin-bottom:8px; display:inline-block; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">
                                <?= h(strtoupper($calcResult['rate_type'])) ?> RATE
                            </span>
                            <h3 style="margin-bottom:4px;"><?= h($calcResult['vendor']) ?> — <?= h($calcResult['service'] ?? $calcResult['service_code']) ?></h3>
                            <p class="text-sm" style="color:rgba(255,255,255,0.8); margin-bottom:0;">
                                Destination: <strong><?= h($calcResult['country']) ?></strong>
                                <?php if (!empty($calcResult['postcode'])): ?>
                                    | Postcode: <strong><?= h($calcResult['postcode']) ?></strong>
                                <?php endif; ?>
                                <?php if (!empty($calcResult['zone'])): ?>
                                    | Zone: <strong><?= h($calcResult['zone']) ?></strong>
                                    <?php if (!empty($calcResult['town_city'])): ?>
                                        (<?= h($calcResult['town_city']) ?>)
                                    <?php endif; ?>
                                <?php endif; ?>
                            </p>
                        </div>
                        <div style="text-align:right;">
                            <span class="badge badge-success" style="font-size:0.75rem;">Batch #<?= (int)($calcResult['batch_id'] ?? 0) ?> Verified</span>
                        </div>
                    </div>

                    <div class="final-rate">
                        <span style="font-size:1.3rem; font-weight:500; opacity:0.85;"><?= h($calcResult['currency'] ?? 'INR') ?></span>
                        <?= number_format((float)$calcResult['final_rate'], 2) ?>
                    </div>

                    <div class="calc-breakdown">
                        <div class="breakdown-item">
                            <div class="breakdown-label">Actual Weight</div>
                            <div class="breakdown-value"><?= number_format((float)$calcResult['actual_weight'], 2) ?> kg</div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Chargeable Weight</div>
                            <div class="breakdown-value" style="color:#6ee7b7; font-weight:700;"><?= number_format((float)$calcResult['chargeable_weight'], 2) ?> kg</div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Active Slab</div>
                            <div class="breakdown-value" style="color:#fde047; font-weight:700;"><?= h($activeSlab) ?></div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Cell Reference</div>
                            <div class="breakdown-value"><?= h($activeCellRef ?: 'Active Cell') ?></div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Worksheet</div>
                            <div class="breakdown-value" style="font-size:0.85rem; font-weight:400;"><?= h($sheetName) ?></div>
                        </div>
                        <?php if (!empty($transitTime)): ?>
                        <div class="breakdown-item">
                            <div class="breakdown-label">Transit Time</div>
                            <div class="breakdown-value" style="font-size:0.85rem; font-weight:400;"><?= h($transitTime) ?></div>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php else: ?>
                <div class="calc-error" style="margin-top:0;">
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <span style="font-size:1.6rem;">⚠</span>
                        <div>
                            <strong style="font-size:1.05rem;">Rate Calculation Could Not Be Completed</strong>
                            <p style="margin-top:6px; margin-bottom:0; font-size:0.9rem;"><?= h($calcResult['error']) ?></p>
                        </div>
                    </div>
                </div>
            <?php endif; ?>
        <?php else: ?>
            <div class="card" style="text-align:center; padding:44px 30px; margin-top:0;">
                <div style="font-size:3.5rem; opacity:0.3; margin-bottom:12px;">📊</div>
                <h3 class="text-muted" style="margin-bottom:8px;">Ready to Calculate Rates</h3>
                <p class="text-muted text-sm" style="max-width:380px; margin:0 auto;">
                    Select a vendor, destination country, and service, then enter the shipment weight to see the full spreadsheet tariff matrix and step-by-step calculation breakdown.
                </p>
            </div>
        <?php endif; ?>
    </div>
</div>

<?php if ($calcResult && $calcResult['success']): ?>
    <?php
    $sheetGrid = $calcResult['sheet_grid'] ?? null;
    $sheetColumns = $sheetGrid['columns'] ?? [];
    $sheetRows = $sheetGrid['rows'] ?? [];
    $activeCellRef = $sheetGrid['active_cell_ref'] ?? null;
    $totalDestinations = $sheetGrid['total_sheet_destinations'] ?? count($sheetRows);
    ?>

    <!-- ============================================================
         Spreadsheet Replica: Exact Excel Sheet Matrix
         Matches the royal blue header, table gridlines, and green active cell
         ============================================================ -->
    <?php if (!empty($sheetColumns) && !empty($sheetRows)): ?>
    <div class="excel-matrix-card">
        <div class="excel-matrix-toolbar">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="excel-tab-pill">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" fill="#107c41" stroke="#107c41"/>
                        <path d="M7 8h10M7 12h10M7 16h10" stroke="#ffffff" stroke-linecap="round"/>
                    </svg>
                    <span><?= h($sheetName) ?></span>
                </div>
                <?php
                $activeRowBadge = null;
                foreach ($sheetRows as $sr) {
                    if (!empty($sr['is_selected'])) {
                        $activeRowBadge = 'Row ' . (int)$sr['row_num'] . ' Active';
                        break;
                    }
                }
                ?>
                <span class="badge badge-neutral text-xs font-mono"><?= h($activeRowBadge ?: ($activeCellRef ? 'Cell ' . $activeCellRef : 'Tariff Active')) ?></span>
            </div>

            <div class="excel-formula-bar">
                <span class="excel-name-box"><?= h($activeCellRef ?: 'Active') ?></span>
                <span class="excel-fx-icon">fx</span>
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><?= h($formula ?: 'Rate lookup') ?></span>
            </div>

            <div>
                <span class="badge badge-success text-xs">Spreadsheet Synchronized</span>
            </div>
        </div>

        <div class="excel-scroll-wrapper">
            <table class="excel-table">
                <thead>
                    <!-- Excel Column Letters Row: A, B, C, D, ... -->
                    <tr class="excel-letter-row">
                        <th class="excel-gutter-col"></th>
                        <?php foreach ($sheetColumns as $col): ?>
                        <th><?= h($col['col_letter']) ?></th>
                        <?php endforeach; ?>
                    </tr>

                    <!-- Royal Blue Header Row (Just like screenshot!) -->
                    <tr class="excel-blue-header">
                        <th class="excel-gutter-col">1</th>
                        <?php foreach ($sheetColumns as $col): ?>
                        <th><?= h($col['title']) ?></th>
                        <?php endforeach; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($sheetRows as $r): ?>
                    <tr class="excel-row-normal <?= $r['is_selected'] ? 'excel-row-selected' : '' ?>">
                        <td class="excel-gutter-col"><?= (int)$r['row_num'] ?></td>
                        <td class="excel-cell-text" style="font-weight:600; color:#1e293b;"><?= h($r['service_code']) ?></td>
                        <td class="excel-cell-text" style="font-weight:<?= $r['is_selected'] ? '700' : '500' ?>; color:<?= $r['is_selected'] ? '#15803d' : '#0f172a' ?>;">
                            <?= h($r['destination']) ?>
                            <?php if ($r['is_selected']): ?>
                                <span class="badge badge-success" style="font-size:0.65rem; padding:1px 5px; margin-left:6px; vertical-align:middle;">ACTIVE DESTINATION</span>
                            <?php endif; ?>
                        </td>
                        <?php foreach ($r['cells'] as $cell): ?>
                        <td class="excel-cell-rate <?= $cell['is_active'] ? 'excel-cell-active' : '' ?>" title="<?= h($cell['cell_ref']) ?>: <?= h($cell['label']) ?>">
                            <?php if ($cell['rate'] !== null): ?>
                                <?= number_format((float)$cell['rate'], 0) ?>
                            <?php else: ?>
                                <span class="excel-dash"><?= h($cell['rate_raw'] ?: '-') ?></span>
                            <?php endif; ?>
                        </td>
                        <?php endforeach; ?>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="excel-matrix-footer">
            <div style="display:flex; align-items:center; gap:8px;">
                <span>Active Tariff Cell: <strong class="font-mono" style="color:#107c41;"><?= h($activeCellRef ?: 'Selected') ?></strong></span>
                <span>•</span>
                <span>Active Slab: <strong><?= h($activeSlab) ?></strong></span>
                <span>•</span>
                <span>Showing <strong><?= count($sheetRows) ?></strong> neighboring tariff rows from <strong><?= (int)$totalDestinations ?></strong> destinations in sheet</span>
            </div>
            <div>
                <span class="text-xs text-muted">Spreadsheet cell formatting emulates live Excel workbook</span>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- ============================================================
         Each Answer Detailed: 4-Card Structured Answer Schedule
         Answers each specific question cleanly with complete data
         ============================================================ -->
    <div style="margin-top:28px;">
        <div class="flex-between mb-16">
            <div>
                <h3 style="display:flex; align-items:center; gap:8px; font-size:1.15rem;">
                    <span>🔍</span> Detailed Rate Audit & Answer Schedule
                </h3>
                <p class="text-muted text-sm" style="margin-bottom:0;">Itemized breakdown answering every component of this rate calculation</p>
            </div>
            <span class="badge badge-neutral text-xs font-mono">Method: <?= h($calc['method'] ?? 'Standard') ?></span>
        </div>

        <div class="answer-cards-grid">
            <!-- Answer 1: Tariff Slab & Excel Cell -->
            <div class="answer-card" style="border-top:4px solid #10b981;">
                <div>
                    <div class="answer-card-header">
                        <span class="answer-card-title">🎯 1. Applied Tariff Slab</span>
                        <span class="badge badge-success font-mono text-xs"><?= h($activeCellRef ?: 'Active') ?></span>
                    </div>
                    <div class="answer-card-value font-mono"><?= h($activeSlab) ?></div>
                    <div style="font-size:0.9rem; font-weight:600; color:#0f172a;">
                        Rate: <?= h($calcResult['currency'] ?? 'INR') ?> <?= number_format((float)($calc['slab_rate'] ?? $calcResult['base_rate']), 2) ?>
                        <span style="font-weight:400; font-size:0.8rem; color:#64748b;"><?= !empty($calc['is_per_kg']) ? '/ kg' : 'base' ?></span>
                    </div>
                </div>
                <div class="answer-card-desc">
                    Matched row from sheet <strong><?= h($sheetName) ?></strong> for <strong><?= h($calcResult['country']) ?></strong>. 
                    <?= !empty($calc['is_per_kg']) 
                        ? 'Because this slab has "++", the courier tariff rules apply this as a per-kg rate multiplied by total chargeable weight.'
                        : 'Flat base slab rate applied for packages within base weight allowance.' ?>
                </div>
            </div>

            <!-- Answer 2: Weight & Chargeable Assessment -->
            <div class="answer-card" style="border-top:4px solid #3b82f6;">
                <div>
                    <div class="answer-card-header">
                        <span class="answer-card-title">⚖ 2. Weight Assessment</span>
                        <span class="badge badge-info font-mono text-xs">Billing Units</span>
                    </div>
                    <div class="answer-card-value font-mono">
                        <?= number_format((float)$calcResult['chargeable_weight'], 2) ?> <span style="font-size:0.9rem; font-weight:500;">kg</span>
                    </div>
                    <div style="font-size:0.9rem; color:#64748b;">
                        Actual Input Weight: <strong style="color:#0f172a;"><?= number_format((float)$calcResult['actual_weight'], 2) ?> kg</strong>
                    </div>
                </div>
                <div class="answer-card-desc">
                    Chargeable weight is evaluated against the carrier minimum slab threshold and billing increments. 
                    <?php if (($calcResult['additional_weight_units'] ?? 0) > 0): ?>
                        Incurred <?= (int)$calcResult['additional_weight_units'] ?> additional weight increment(s).
                    <?php else: ?>
                        Package weight qualifies directly for the active slab tier without partial remainder.
                    <?php endif; ?>
                </div>
            </div>

            <!-- Answer 3: Calculation Formula & Arithmetic -->
            <div class="answer-card" style="border-top:4px solid #8b5cf6;">
                <div>
                    <div class="answer-card-header">
                        <span class="answer-card-title">🧮 3. Applied Formula</span>
                        <span class="badge badge-purple text-xs">Verified</span>
                    </div>
                    <div class="answer-card-value font-mono" style="font-size:1.15rem; color:#6d28d9; word-break:break-all;">
                        <?= h($formula ?: 'Standard Formula') ?>
                    </div>
                    <div style="font-size:0.9rem; font-weight:600; color:#0f172a;">
                        Total: <?= h($calcResult['currency'] ?? 'INR') ?> <?= number_format((float)$calcResult['final_rate'], 2) ?>
                    </div>
                </div>
                <div class="answer-card-desc">
                    Direct mathematical calculation following carrier contract rules. All unit prices and multipliers are pulled directly from the active verified workbook.
                </div>
            </div>

            <!-- Answer 4: Routing & Audit Details -->
            <div class="answer-card" style="border-top:4px solid #f59e0b;">
                <div>
                    <div class="answer-card-header">
                        <span class="answer-card-title">🚚 4. Logistics & Audit</span>
                        <span class="badge badge-warning text-xs">Batch #<?= (int)($calcResult['batch_id'] ?? 0) ?></span>
                    </div>
                    <div class="answer-card-value" style="font-size:1.15rem;">
                        <?= h($calcResult['service_code']) ?>
                    </div>
                    <div style="font-size:0.85rem; color:#475569;">
                        Transit: <strong><?= h($transitTime ?: 'Carrier Standard Schedule') ?></strong>
                    </div>
                </div>
                <div class="answer-card-desc">
                    Route: <strong>India ➔ <?= h($calcResult['country']) ?></strong>
                    <?php if (!empty($calcResult['zone'])): ?>
                        | Zone: <strong><?= h($calcResult['zone']) ?></strong>
                    <?php endif; ?>
                    <br>Source Worksheet: <strong><?= h($sheetName) ?></strong>
                </div>
            </div>
        </div>
    </div>

    <!-- Itemized Schedule & Step-by-Step Logic -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:24px; align-items:start;">
        <!-- Itemized Cost Table -->
        <div class="card" style="margin-top:0;">
            <div class="card-header" style="margin-bottom:14px;">
                <h3 style="font-size:1.05rem;">📋 Itemized Cost Schedule</h3>
                <span class="badge badge-neutral text-xs">Currency: <?= h($calcResult['currency'] ?? 'INR') ?></span>
            </div>

            <?php if (!empty($breakdown)): ?>
            <div class="table-wrapper">
                <table class="data-table text-sm">
                    <thead>
                        <tr>
                            <th>Charge Component</th>
                            <th>Unit Price</th>
                            <th>Quantity / Weight</th>
                            <th style="text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($breakdown as $item): ?>
                        <tr>
                            <td><strong><?= h($item['item'] ?? $item['description'] ?? 'Charge') ?></strong></td>
                            <td class="font-mono"><?= isset($item['unit_price']) ? h($calcResult['currency'] ?? 'INR') . ' ' . number_format((float)$item['unit_price'], 2) : '—' ?></td>
                            <td class="font-mono"><?= h($item['quantity'] ?? '1') ?></td>
                            <td class="font-mono" style="text-align:right; font-weight:700;">
                                <?= h($calcResult['currency'] ?? 'INR') ?> <?= number_format((float)($item['amount'] ?? 0), 2) ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:700; border-top:2px solid #cbd5e1;">
                            <td colspan="3">Final Calculated Charge</td>
                            <td class="font-mono" style="text-align:right; color:#10b981; font-size:1.1rem;">
                                <?= h($calcResult['currency'] ?? 'INR') ?> <?= number_format((float)$calcResult['final_rate'], 2) ?>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <?php endif; ?>
        </div>

        <!-- Step-by-Step Educational Explanation -->
        <div class="card" style="margin-top:0;">
            <div class="card-header" style="margin-bottom:14px;">
                <h3 style="font-size:1.05rem;">💡 Step-by-Step Calculation Logic</h3>
                <span class="badge badge-info text-xs">Educational Trail</span>
            </div>

            <?php if (!empty($steps)): ?>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <?php foreach ($steps as $s): ?>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span class="badge badge-info" style="font-size:0.72rem; padding:2px 7px;">Step <?= (int)$s['step'] ?></span>
                        <strong style="font-size:0.88rem;"><?= h($s['title']) ?></strong>
                    </div>
                    <p class="text-sm text-secondary" style="margin-bottom:0; line-height:1.5;">
                        <?= h($s['detail']) ?>
                    </p>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
    </div>

<?php endif; ?>

<script>
// Dynamic Dependent Services Dropdown Controller
const currentVendorSlug = <?= json_encode($selectedVendor) ?>;
let activeSelectedService = <?= json_encode($selectedService) ?>;

async function onCountryChanged(country) {
    const serviceSelect = document.getElementById('service-select');
    const serviceHint = document.getElementById('service-hint');
    if (!serviceSelect) return;

    country = (country || '').trim();
    if (!country) {
        serviceSelect.innerHTML = '<option value="">Select country first...</option>';
        if (serviceHint) serviceHint.textContent = 'Please choose a destination country first';
        return;
    }

    serviceSelect.disabled = true;
    serviceSelect.innerHTML = '<option value="">Loading services...</option>';
    if (serviceHint) serviceHint.textContent = `Loading available services for ${country}...`;

    try {
        const url = `api/services.php?vendor=${encodeURIComponent(currentVendorSlug)}&country=${encodeURIComponent(country)}`;
        const res = await fetch(url);
        const data = await res.json();

        const postcodeLabel = document.getElementById('postcode-label');
        const postcodeHint = document.getElementById('postcode-hint');
        const postcodeField = document.getElementById('postcode-input');

        if (data.is_country_zonewise) {
            if (postcodeLabel) postcodeLabel.innerHTML = 'Postcode / ZIP <span style="color:#ef4444;">*</span>';
            if (postcodeHint) postcodeHint.textContent = `Destination '${country}' uses zone-wise pricing. Postcode is required to determine the rate zone.`;
            if (postcodeField) postcodeField.placeholder = 'e.g. 10001 (required for zone tariff)';
        } else {
            if (postcodeLabel) postcodeLabel.innerHTML = 'Postcode / ZIP <span class="text-muted" style="font-size:0.78rem; font-weight:normal;">(Optional)</span>';
            if (postcodeHint) postcodeHint.textContent = `Destination '${country}' uses regular country-wise rates. Postcode is not required.`;
            if (postcodeField) postcodeField.placeholder = 'e.g. 10115 (optional)';
        }

        serviceSelect.innerHTML = '';
        if (data.success && data.service_codes && data.service_codes.length > 0) {
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Select service code...';
            serviceSelect.appendChild(defaultOpt);

            let hasMatch = false;
            data.service_codes.forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = code; // Only service code as requested!
                if (code === activeSelectedService) {
                    opt.selected = true;
                    hasMatch = true;
                }
                serviceSelect.appendChild(opt);
            });

            // If previously selected service is not valid for this country, auto-select first service
            if (!hasMatch && data.service_codes.length === 1) {
                serviceSelect.options[1].selected = true;
                activeSelectedService = data.service_codes[0];
            }

            if (serviceHint) {
                serviceHint.textContent = `${data.service_codes.length} service(s) available for ${country}`;
            }
        } else {
            serviceSelect.innerHTML = '<option value="">No services available for this country</option>';
            if (serviceHint) serviceHint.textContent = `No services found for ${country}`;
        }
    } catch (err) {
        console.error('Error fetching services for country:', err);
        if (serviceHint) serviceHint.textContent = 'Error loading services for this country';
    } finally {
        serviceSelect.disabled = false;
    }
}
</script>
