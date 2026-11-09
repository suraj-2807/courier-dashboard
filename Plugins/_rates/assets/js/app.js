/* ============================================================
   Vendor Rate Management Portal — Client-side JavaScript
   ============================================================ */

// ---- Toast Notifications ----
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---- Mobile Sidebar Toggle ----
function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
}

// ---- Tab Switching ----
function initTabs() {
    document.querySelectorAll('.tabs').forEach(tabGroup => {
        const buttons = tabGroup.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const parent = tabGroup.parentElement;
                parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                const content = parent.querySelector(`#tab-${target}`);
                if (content) content.classList.add('active');
            });
        });
    });
}

// ---- Table Sorting ----
function initTableSort() {
    document.querySelectorAll('table.data-table thead th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const idx = Array.from(th.parentNode.children).indexOf(th);
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const asc = !th.classList.contains('sort-asc');

            // Clear other sort indicators
            th.parentNode.querySelectorAll('th').forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); });
            th.classList.add(asc ? 'sort-asc' : 'sort-desc');

            rows.sort((a, b) => {
                let va = a.children[idx]?.textContent.trim() || '';
                let vb = b.children[idx]?.textContent.trim() || '';
                const na = parseFloat(va.replace(/[^0-9.-]/g, ''));
                const nb = parseFloat(vb.replace(/[^0-9.-]/g, ''));
                if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
                return asc ? va.localeCompare(vb) : vb.localeCompare(va);
            });
            rows.forEach(r => tbody.appendChild(r));
        });
    });
}

// ---- Table Search ----
function initTableSearch() {
    document.querySelectorAll('[data-search-table]').forEach(input => {
        const tableId = input.dataset.searchTable;
        input.addEventListener('input', () => {
            const query = input.value.toLowerCase();
            const table = document.getElementById(tableId);
            if (!table) return;
            table.querySelectorAll('tbody tr').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    });
}

// ---- Inline Editing ----
function makeEditable(cell, recordId, field, table) {
    if (cell.querySelector('input')) return; // already editing
    const currentValue = cell.textContent.trim();
    const originalBg = cell.style.background;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue === '—' ? '' : currentValue;
    input.className = 'form-control';
    input.style.cssText = 'padding:4px 8px; font-size:inherit; width:100%;';
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
        const newValue = input.value.trim();
        if (newValue === currentValue || (newValue === '' && currentValue === '—')) {
            cell.textContent = currentValue;
            return;
        }
        try {
            const payload = {
                field: field,
                value: newValue,
                table: table || 'vendor_rate_rows',
                [field]: newValue
            };
            if (field === 'rate' || field === 'price') {
                payload.rate = newValue;
                payload.price = newValue;
            }
            const response = await apiRequest('PATCH', `/api/rates.php?id=${recordId}`, payload);
            if (response.success || response.ok) {
                cell.textContent = newValue || '—';
                cell.style.background = '#d1fae5';
                setTimeout(() => { cell.style.background = originalBg; }, 1500);
                showToast('Rate updated successfully');
            } else {
                cell.textContent = currentValue;
                showToast(response.error || 'Update failed', 'error');
            }
        } catch (err) {
            cell.textContent = currentValue;
            showToast('Network error', 'error');
        }
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { cell.textContent = currentValue; }
    });
}

// ---- API Helper ----
async function apiRequest(method, url, data = null) {
    let cleanUrl = url;
    if (!cleanUrl.startsWith('/') && !cleanUrl.startsWith('http')) {
        cleanUrl = '/' + cleanUrl;
    }
    const opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data && method !== 'GET') {
        opts.body = JSON.stringify(data);
    }
    const response = await fetch(cleanUrl, opts);
    return response.json();
}

// ---- Calculator ----
async function calculateRate(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const resultDiv = document.getElementById('calc-result');
    const loadingDiv = document.getElementById('calc-loading');

    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (resultDiv) resultDiv.innerHTML = '';

    const data = Object.fromEntries(new FormData(form));
    try {
        const resp = await fetch('api/calculate.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (resultDiv) renderCalcResult(resultDiv, result);
    } catch (err) {
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (resultDiv) resultDiv.innerHTML = `<div class="calc-error">⚠ Network error: ${escapeHtml(err.message)}</div>`;
    }
}

function renderCalcResult(container, result) {
    if (!result.success) {
        container.innerHTML = `<div class="calc-error"><strong>⚠ Calculation Error</strong><br>${escapeHtml(result.error)}</div>`;
        return;
    }
    const calc = result.calculation || {};
    container.innerHTML = `
    <div class="calc-result">
        <h3>💰 Rate Calculation Result</h3>
        <div class="final-rate">${result.currency || 'INR'} ${Number(result.final_rate).toFixed(2)}</div>
        <div class="calc-breakdown">
            <div class="breakdown-item">
                <div class="breakdown-label">Vendor</div>
                <div class="breakdown-value">${escapeHtml(result.vendor || '')}</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Service</div>
                <div class="breakdown-value">${escapeHtml(result.service || result.service_code || '')}</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Country</div>
                <div class="breakdown-value">${escapeHtml(result.country || '')}</div>
            </div>
            ${result.postcode ? `<div class="breakdown-item"><div class="breakdown-label">Postcode</div><div class="breakdown-value">${escapeHtml(result.postcode)}</div></div>` : ''}
            ${result.zone ? `<div class="breakdown-item"><div class="breakdown-label">Zone</div><div class="breakdown-value">${escapeHtml(result.zone)}</div></div>` : ''}
            <div class="breakdown-item">
                <div class="breakdown-label">Rate Type</div>
                <div class="breakdown-value">${escapeHtml(result.rate_type || '')}</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Actual Weight</div>
                <div class="breakdown-value">${result.actual_weight} kg</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Chargeable Weight</div>
                <div class="breakdown-value">${result.chargeable_weight} kg</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Base Rate</div>
                <div class="breakdown-value">${result.currency || 'INR'} ${Number(result.base_rate).toFixed(2)}</div>
            </div>
            ${result.additional_weight_units > 0 ? `
            <div class="breakdown-item">
                <div class="breakdown-label">Additional Units</div>
                <div class="breakdown-value">${result.additional_weight_units}</div>
            </div>
            <div class="breakdown-item">
                <div class="breakdown-label">Additional Charge</div>
                <div class="breakdown-value">${result.currency || 'INR'} ${Number(result.additional_charge).toFixed(2)}</div>
            </div>` : ''}
        </div>
        ${calc.note ? `<div style="margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.85rem; color:rgba(255,255,255,0.6);"><strong>Method:</strong> ${escapeHtml(calc.method || '')} — ${escapeHtml(calc.note)}</div>` : ''}
        <div style="margin-top:12px; font-size:0.75rem; color:rgba(255,255,255,0.35);">Batch ID: ${result.batch_id || 'N/A'}</div>
    </div>`;
}

// ---- Dynamic Service Loader for Calculator ----
async function loadServices(vendorSlug, countryValue) {
    const serviceSelect = document.getElementById('calc-service') || document.getElementById('service-select');
    if (!serviceSelect) return;
    serviceSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        let url = `api/services.php?vendor=${encodeURIComponent(vendorSlug)}`;
        if (countryValue) url += `&country=${encodeURIComponent(countryValue)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        serviceSelect.innerHTML = '<option value="">Select service...</option>';
        if (data.success && data.services) {
            data.services.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.service_code;
                opt.textContent = `${s.service_code}${s.service_name ? ' — ' + s.service_name : ''} (${s.rate_type})`;
                serviceSelect.appendChild(opt);
            });
        }
    } catch (e) {
        serviceSelect.innerHTML = '<option value="">Error loading services</option>';
    }
}

// ---- Export Table to CSV ----
function exportTableCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let csv = [];
    table.querySelectorAll('tr').forEach(row => {
        if (row.style.display === 'none') return;
        let cols = [];
        row.querySelectorAll('th, td').forEach(cell => {
            // Skip action columns
            if (cell.classList.contains('action-col')) return;
            let text = cell.textContent.replace(/"/g, '""').trim();
            cols.push(`"${text}"`);
        });
        csv.push(cols.join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'export.csv';
    a.click();
}

// ---- Delete Record ----
async function deleteRecord(id, table, row) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
        const resp = await apiRequest('DELETE', `api/rates.php?id=${id}&table=${encodeURIComponent(table || 'vendor_rate_rows')}`);
        if (resp.success || resp.ok) {
            if (row) row.style.display = 'none';
            showToast('Record deleted');
        } else {
            showToast(resp.error || 'Delete failed', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ---- Add Record Modal ----
function openAddModal(vendorId, batchId, sheetType) {
    const modal = document.getElementById('add-record-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('add-vendor-id').value = vendorId;
    document.getElementById('add-batch-id').value = batchId;
    document.getElementById('add-sheet-type').value = sheetType;

    // Show/hide fields based on type
    const zoneFields = document.getElementById('add-zone-fields');
    const rateFields = document.getElementById('add-rate-fields');
    if (sheetType === 'zones') {
        if (zoneFields) zoneFields.classList.remove('hidden');
        if (rateFields) rateFields.classList.add('hidden');
    } else {
        if (zoneFields) zoneFields.classList.add('hidden');
        if (rateFields) rateFields.classList.remove('hidden');
    }
}

function closeAddModal() {
    const modal = document.getElementById('add-record-modal');
    if (modal) modal.style.display = 'none';
}

async function submitAddRecord() {
    const form = document.getElementById('add-record-form');
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    try {
        const resp = await apiRequest('POST', 'api/rates.php', data);
        if (resp.success || resp.ok) {
            showToast('Record added successfully');
            closeAddModal();
            location.reload();
        } else {
            showToast(resp.error || 'Failed to add record', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ---- Copy to clipboard ----
function copyCode(btn) {
    const block = btn.closest('.code-block');
    const code = block?.querySelector('code')?.textContent || block?.textContent.replace('Copy', '').trim();
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
}

// ---- Dropdown Toggle ----
function toggleDropdown(btn) {
    const menu = btn.nextElementSibling;
    document.querySelectorAll('.dropdown-menu.show').forEach(m => { if (m !== menu) m.classList.remove('show'); });
    menu?.classList.toggle('show');
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initTableSort();
    initTableSearch();
});
