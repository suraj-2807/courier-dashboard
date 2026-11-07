<?php
// API Documentation & Interactive Sandbox Page
$config = getConfig();
$apiKey = $config['api_key'] ?? 'YOUR_API_KEY';
$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . dirname($_SERVER['SCRIPT_NAME'] ?? '');
$baseUrl = rtrim($baseUrl, '/\\');
?>

<div class="flex-between mb-24">
    <div>
        <h2>REST API Documentation & Interactive Console</h2>
        <p class="text-muted text-sm">Integrate shipping rates into your ERP, e-commerce, or warehouse management system</p>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
        <span class="badge badge-success">API v2.0 Active</span>
    </div>
</div>

<!-- Authentication Card -->
<div class="card mb-24">
    <div class="card-header">
        <h3>Authentication</h3>
    </div>
    <p class="mb-16">All requests to the Vendor Rate API require authentication. Pass your secret API key using the <code>X-API-Key</code> HTTP request header (recommended) or as a query parameter <code>?api_key=...</code>.</p>
    
    <div style="background:var(--gray-900); color:#e2e8f0; padding:16px 20px; border-radius:var(--border-radius-sm); font-family:var(--font-mono, monospace); display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
            <span style="color:var(--gray-500);">X-API-Key:</span>
            <span style="color:#38bdf8; font-weight:600; margin-left:8px;" id="api-key-val"><?= h($apiKey) ?></span>
        </div>
        <button class="btn btn-outline btn-sm" style="color:white; border-color:var(--gray-700);" onclick="navigator.clipboard.writeText('<?= addslashes(h($apiKey)) ?>'); showToast('API Key copied to clipboard!');">Copy Key</button>
    </div>
    
    <p class="text-sm text-muted">Keep this key confidential. Configure it in <code>config.php</code>.</p>
</div>

<!-- Interactive Sandbox -->
<div class="card mb-24">
    <div class="card-header">
        <h3>Live API Console / Sandbox</h3>
        <span class="badge badge-info">Try Live Queries</span>
    </div>
    
    <div class="form-row mb-16">
        <div class="form-group" style="width:140px;">
            <label class="form-label">Method</label>
            <select id="sandbox-method" class="form-control">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
            </select>
        </div>
        <div class="form-group" style="flex:1;">
            <label class="form-label">Endpoint URL</label>
            <div style="display:flex; gap:8px;">
                <input id="sandbox-url" class="form-control font-mono" value="<?= h($baseUrl) ?>/api/calculate.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1&postcode=10001">
                <button type="button" class="btn btn-primary" onclick="runSandboxRequest()">Send Request</button>
            </div>
        </div>
    </div>
    
    <div class="mb-16">
        <label class="form-label">Quick Presets</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('calc', '<?= h($baseUrl) ?>/api/calculate.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1.5&postcode=10001', 'GET')">Calculate Rate (Pacific USA)</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('services', '<?= h($baseUrl) ?>/api/services.php?vendor=pacific&country=Germany', 'GET')">Filter Services by Country</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('countries', '<?= h($baseUrl) ?>/api/countries.php?vendor=pacific', 'GET')">List Countries</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('rates', '<?= h($baseUrl) ?>/api/rates.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1', 'GET')">Rate Lookup (Legacy)</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('vendors', '<?= h($baseUrl) ?>/api/vendors.php', 'GET')">List Vendors</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('sheets', '<?= h($baseUrl) ?>/api/sheets.php?vendor=pacific', 'GET')">List Worksheets</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="setPreset('zones', '<?= h($baseUrl) ?>/api/zones.php?vendor=pacific&country=USA&postcode=10001', 'GET')">Lookup Zone</button>
        </div>
    </div>

    <div id="sandbox-body-group" class="form-group mb-16 hidden">
        <label class="form-label">JSON Request Body</label>
        <textarea id="sandbox-body" class="form-control font-mono" rows="4" placeholder='{"vendor": "pacific", "service_code": "..."}'></textarea>
    </div>

    <div>
        <div class="flex-between mb-8">
            <label class="form-label" style="margin-bottom:0;">Response Output</label>
            <span id="sandbox-status" class="text-xs font-mono text-muted">Ready</span>
        </div>
        <pre id="sandbox-output" style="background:#0f172a; color:#38bdf8; padding:16px; border-radius:var(--border-radius-sm); font-size:0.85rem; max-height:360px; overflow-y:auto; white-space:pre-wrap; word-break:break-all;">Click "Send Request" or select a preset above to test the API.</pre>
    </div>
</div>

<!-- Endpoints Reference -->
<div class="card">
    <div class="card-header">
        <h3>Endpoints Reference</h3>
    </div>

    <!-- Endpoint 1: Calculate -->
    <div class="mb-32">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/calculate.php</h4>
            <span class="badge badge-info">Recommended</span>
        </div>
        <p class="text-sm text-secondary mb-12">Calculates the total shipping rate with full breakdown, zone resolution, and incremental weight calculation.</p>
        
        <div class="table-wrapper mb-12">
            <table class="data-table text-sm">
                <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td class="font-mono">vendor</td><td>string</td><td>Yes</td><td>Vendor slug (e.g. <code>pacific</code>)</td></tr>
                    <tr><td class="font-mono">country</td><td>string</td><td>Yes</td><td>Destination country (e.g. <code>USA</code>, <code>United Kingdom</code>)</td></tr>
                    <tr><td class="font-mono">service_code</td><td>string</td><td>Yes</td><td>Service code (e.g. <code>PXC-EX NY SELF</code>)</td></tr>
                    <tr><td class="font-mono">weight_kg</td><td>float</td><td>Yes</td><td>Package weight in kilograms (e.g. <code>1.5</code>)</td></tr>
                    <tr><td class="font-mono">postcode</td><td>string</td><td>Optional</td><td>Destination postcode/ZIP for zone-based pricing</td></tr>
                </tbody>
            </table>
        </div>

        <h5 class="mb-8">Example Request:</h5>
        <div style="background:var(--gray-900); color:#e2e8f0; padding:12px 16px; border-radius:6px; font-family:monospace; font-size:0.85rem; margin-bottom:12px; overflow-x:auto;">
curl -H "X-API-Key: <?= h($apiKey) ?>" \
  "<?= h($baseUrl) ?>/api/calculate.php?vendor=pacific&country=USA&service_code=PXC-EX%20NY%20SELF&weight_kg=1.5&postcode=10001"
        </div>
    </div>

    <!-- Endpoint 2: Rates CRUD -->
    <div class="mb-32" style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <span class="badge badge-info font-mono">POST</span>
            <span class="badge badge-warning font-mono">PATCH</span>
            <span class="badge badge-danger font-mono">DELETE</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/rates.php</h4>
        </div>
        <p class="text-sm text-secondary mb-12">Query rate records or perform administrative CRUD operations.</p>
        
        <ul style="padding-left:20px; font-size:0.88rem; line-height:1.7;" class="text-secondary mb-12">
            <li><strong>GET:</strong> Lookup rates by vendor, country, service_code, weight_kg, postcode, or search query.</li>
            <li><strong>POST:</strong> Create a new rate row (JSON body with <code>vendor</code>, <code>sheet_name</code>, <code>service_code</code>, <code>country</code>, <code>rate</code>, etc.).</li>
            <li><strong>PATCH:</strong> Update rate row by <code>id</code> (JSON body with fields to modify, e.g. <code>{"rate": 450.00}</code>).</li>
            <li><strong>DELETE:</strong> Delete rate row by <code>?id=123</code>.</li>
        </ul>
    </div>

    <!-- Endpoint 3: Vendors -->
    <div class="mb-32" style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <span class="badge badge-info font-mono">POST</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/vendors.php</h4>
        </div>
        <p class="text-sm text-secondary mb-12">List active shipping vendors, view vendor summary metrics, or register a new vendor.</p>
    </div>

    <!-- Endpoint 4: Sheets -->
    <div class="mb-32" style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/sheets.php</h4>
        </div>
        <p class="text-sm text-secondary mb-12">Get worksheet metadata, detected types (regular, zonewise, zones), and schema headers for any vendor workbook.</p>
    </div>

    <!-- Endpoint 5: Zones -->
    <div style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/zones.php</h4>
        </div>
        <p class="text-sm text-secondary mb-12">Resolve destination postcodes to shipping zones (e.g. <code>?vendor=pacific&country=USA&postcode=10001</code> returns <code>Zone 1</code> and City <code>New York</code>).</p>
    </div>

    <!-- Endpoint 6: Services by Country (Dependent Dropdown API) -->
    <div style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/services.php</h4>
            <span class="badge badge-info">Dependent Dropdowns</span>
        </div>
        <p class="text-sm text-secondary mb-12">Returns available shipping service codes filtered for a specific vendor and destination country (e.g. <code>?vendor=pacific&country=Germany</code> returns <code>["PXC-LHR-DDP"]</code>).</p>
        <div class="table-wrapper mb-12">
            <table class="data-table text-sm">
                <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td class="font-mono">vendor</td><td>string</td><td>Yes</td><td>Vendor slug (e.g. <code>pacific</code>)</td></tr>
                    <tr><td class="font-mono">country</td><td>string</td><td>Optional</td><td>Filter services valid for this destination country (e.g. <code>Germany</code>)</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Endpoint 7: Countries -->
    <div style="border-top:1px solid var(--border-color); padding-top:24px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span class="badge badge-success font-mono">GET</span>
            <h4 style="margin:0; font-family:var(--font-mono, monospace);">/api/countries.php</h4>
        </div>
        <p class="text-sm text-secondary mb-12">Returns all available destination countries for a vendor workbook across regular tariffs and zone directories (e.g. <code>?vendor=pacific</code>).</p>
    </div>
</div>

<script>
function setPreset(type, url, method) {
    document.getElementById('sandbox-url').value = url;
    document.getElementById('sandbox-method').value = method;
    toggleBodyGroup();
    runSandboxRequest();
}

function toggleBodyGroup() {
    const method = document.getElementById('sandbox-method').value;
    const group = document.getElementById('sandbox-body-group');
    if (method === 'POST' || method === 'PATCH') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
}
document.getElementById('sandbox-method').addEventListener('change', toggleBodyGroup);

async function runSandboxRequest() {
    const url = document.getElementById('sandbox-url').value;
    const method = document.getElementById('sandbox-method').value;
    const statusEl = document.getElementById('sandbox-status');
    const outEl = document.getElementById('sandbox-output');
    
    statusEl.textContent = 'Sending request...';
    outEl.textContent = 'Loading...';
    
    try {
        const headers = {
            'X-API-Key': '<?= addslashes(h($apiKey)) ?>',
            'Accept': 'application/json'
        };
        const options = { method, headers };
        
        if (method === 'POST' || method === 'PATCH') {
            headers['Content-Type'] = 'application/json';
            options.body = document.getElementById('sandbox-body').value || '{}';
        }
        
        const res = await fetch(url, options);
        statusEl.textContent = `Status: ${res.status} ${res.statusText}`;
        const data = await res.json();
        outEl.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        statusEl.textContent = 'Network or parsing error';
        outEl.textContent = 'Error: ' + err.message;
    }
}
</script>
