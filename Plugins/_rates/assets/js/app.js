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

// ---- Postcodes Inspector Modal ----
let modalPostcodesList = [];

function openPostcodesModal(btn) {
    let modal = document.getElementById('postcodes-inspector-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'postcodes-inspector-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(2px);';
        modal.innerHTML = `
            <div class="card" style="width:90%; max-width:680px; max-height:85vh; display:flex; flex-direction:column; background:#ffffff; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; padding:0;">
                <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <div>
                        <h3 id="pc-modal-title" style="margin:0; font-size:1.1rem; color:#0f172a; font-weight:700;">Postcodes Directory</h3>
                        <span id="pc-modal-subtitle" class="text-xs text-muted"></span>
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="closePostcodesModal()" style="font-size:1.2rem; line-height:1; padding:4px 8px;">✕</button>
                </div>
                <div style="padding:12px 20px; border-bottom:1px solid #f1f5f9; background:#fff; display:flex; gap:10px; align-items:center;">
                    <input type="text" id="pc-search-input" class="form-control form-control-sm" placeholder="Filter postcodes (e.g. 2000, Remote, Yes, No)..." oninput="filterPostcodesInModal(this.value)" style="flex:1;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="copyPostcodesFromModal()" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                        📋 Copy All
                    </button>
                </div>
                <div id="pc-modal-body" style="padding:16px 20px; overflow-y:auto; flex:1; display:flex; flex-wrap:wrap; gap:6px; max-height:55vh; align-content:flex-start;">
                </div>
                <div style="padding:12px 20px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                    <span id="pc-modal-count" class="text-xs text-muted" style="font-weight:600;"></span>
                    <button type="button" class="btn btn-primary btn-sm" onclick="closePostcodesModal()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePostcodesModal();
        });
    }

    const raw = btn.dataset.raw || '';
    const title = btn.dataset.title || 'Postcodes Directory';
    document.getElementById('pc-modal-title').textContent = title;
    document.getElementById('pc-modal-subtitle').textContent = `Full postcode list with remote area status`;
    document.getElementById('pc-search-input').value = '';

    // Parse postcodes
    const items = raw.split(/[,;\r\n]+/).map(s => s.trim()).filter(Boolean);
    modalPostcodesList = items.map(item => {
        let clean = item;
        let remoteStatus = 'NONE';
        const m = item.match(/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i);
        if (m) {
            const tag = m[1].toUpperCase().trim();
            if (tag === 'YES' || tag === 'Y') remoteStatus = 'YES';
            else if (tag === 'NO' || tag === 'N') remoteStatus = 'NO';
            else remoteStatus = 'BOTH';
            clean = item.replace(/\(\s*(YES\/NO|NO\/YES|YES|NO|Y|N)\s*\)/i, '').trim();
        }
        return { original: item, clean, remoteStatus };
    });

    renderPostcodesInModal(modalPostcodesList);
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('pc-search-input')?.focus(), 50);
}

function renderPostcodesInModal(list) {
    const body = document.getElementById('pc-modal-body');
    const countEl = document.getElementById('pc-modal-count');
    if (!body) return;

    if (list.length === 0) {
        body.innerHTML = '<div style="color:#64748b; font-size:0.9rem; padding:20px; width:100%; text-align:center;">No matching postcodes found.</div>';
        if (countEl) countEl.textContent = '0 postcodes';
        return;
    }

    let remoteCount = 0;
    body.innerHTML = list.map(item => {
        let tagHtml = '';
        if (item.remoteStatus === 'YES') {
            remoteCount++;
            tagHtml = `<span style="font-size:0.6rem; padding:1px 4px; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:3px; font-weight:700; margin-left:4px;">Remote</span>`;
        } else if (item.remoteStatus === 'NO') {
            tagHtml = `<span style="font-size:0.6rem; padding:1px 4px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; border-radius:3px; margin-left:4px;">No</span>`;
        } else if (item.remoteStatus === 'BOTH') {
            remoteCount++;
            tagHtml = `<span style="font-size:0.6rem; padding:1px 4px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:3px; margin-left:4px;">Both</span>`;
        }
        return `<span style="display:inline-flex; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px; padding:3px 8px; font-family:monospace; font-size:0.8rem; color:#0f172a;">${escapeHtml(item.clean)}${tagHtml}</span>`;
    }).join('');

    if (countEl) {
        countEl.textContent = `${list.length} postcode${list.length === 1 ? '' : 's'}${remoteCount > 0 ? ` (${remoteCount} remote)` : ''}`;
    }
}

function filterPostcodesInModal(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        renderPostcodesInModal(modalPostcodesList);
        return;
    }
    const filtered = modalPostcodesList.filter(item => {
        if (item.clean.toLowerCase().includes(q)) return true;
        if (q === 'remote' || q === 'yes') return item.remoteStatus === 'YES' || item.remoteStatus === 'BOTH';
        if (q === 'no') return item.remoteStatus === 'NO';
        return false;
    });
    renderPostcodesInModal(filtered);
}

function copyPostcodesFromModal() {
    const text = modalPostcodesList.map(item => item.original).join(', ');
    navigator.clipboard.writeText(text).then(() => {
        showToast('All postcodes copied to clipboard');
    });
}

function closePostcodesModal() {
    const modal = document.getElementById('postcodes-inspector-modal');
    if (modal) modal.style.display = 'none';
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initTableSort();
    initTableSearch();
});
