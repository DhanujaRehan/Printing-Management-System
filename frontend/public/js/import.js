/* ============================================================
   SoftWave — Excel Import Module (DBA)
   File: js/import.js
   ============================================================ */

var _importTab     = 'upload';
var _importParsed  = [];
var _importType    = '';
var _importFile    = '';

function loadImport() {
  switchImportTab('upload');
  loadImportHistory();
}

function switchImportTab(tab) {
  _importTab = tab;
  ['upload','pending','history'].forEach(function(t) {
    var btn   = document.getElementById('imp-tab-' + t);
    var panel = document.getElementById('imp-panel-' + t);
    if (btn)   btn.className   = 'svc-tab' + (t === tab ? ' svc-tab-act' : '');
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'pending') loadImportPending();
  if (tab === 'history') loadImportHistory();
}

/* ══════════════════════════════════════════════════════════
   UPLOAD TAB
   ══════════════════════════════════════════════════════════ */
function importTypeChanged() {
  _importType = document.getElementById('imp-type').value;
  document.getElementById('imp-template-hint').innerHTML = _importType ? getTemplateHint(_importType) : '';
  clearImportPreview();
}

function getTemplateHint(type) {
  var cols = {
    branches:     '<b>Required columns:</b> code, name &nbsp;|&nbsp; <b>Optional:</b> location, contact',
    printers:     '<b>Required columns:</b> branch_code, printer_code &nbsp;|&nbsp; <b>Optional:</b> model, location_note',
    toner_models: '<b>Required columns:</b> model_code &nbsp;|&nbsp; <b>Optional:</b> brand, yield_copies, min_stock',
    toner_stock:  '<b>Required columns:</b> model_code, quantity',
  };
  return '<div class="imp-hint">' + (cols[type] || '') + '</div>';
}

function handleImportFile(input) {
  var file = input.files[0];
  if (!file) return;
  if (!_importType) {
    toast('❌', 'Select import type first', '');
    input.value = '';
    return;
  }
  _importFile = file.name;
  document.getElementById('imp-filename').textContent = file.name;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      parseExcelFile(e.target.result);
    } catch(err) {
      toast('❌', 'Could not read file: ' + err.message, '');
    }
  };
  reader.readAsBinaryString(file);
}

function parseExcelFile(binaryStr) {
  /* Use SheetJS (xlsx) loaded from CDN */
  if (typeof XLSX === 'undefined') {
    toast('❌', 'Excel parser not loaded — check internet connection', '');
    return;
  }
  var wb   = XLSX.read(binaryStr, { type: 'binary' });
  var ws   = wb.Sheets[wb.SheetNames[0]];
  var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (!rows.length) {
    toast('❌', 'No data found in the Excel file', '');
    return;
  }

  /* Normalize column names to lowercase with underscores */
  var normalized = rows.map(function(row) {
    var obj = {};
    Object.keys(row).forEach(function(k) {
      obj[k.toLowerCase().replace(/\s+/g, '_')] = String(row[k]).trim();
    });
    return obj;
  });

  _importParsed = normalized;
  renderImportPreview(normalized);
}

function renderImportPreview(rows) {
  if (!rows.length) return;
  var cols = Object.keys(rows[0]);
  var previewRows = rows.slice(0, 10);

  var html = '<div class="imp-preview-wrap">'
    + '<div class="imp-preview-hdr">'
    + '<span class="imp-preview-count">📊 ' + rows.length + ' rows ready to import' + (rows.length > 10 ? ' (showing first 10)' : '') + '</span>'
    + '</div>'
    + '<div class="scx"><table class="tbl imp-preview-table">'
    + '<thead><tr>' + cols.map(function(c){ return '<th>' + c + '</th>'; }).join('') + '</tr></thead>'
    + '<tbody>'
    + previewRows.map(function(r) {
        return '<tr>' + cols.map(function(c){ return '<td style="font-size:12px">' + (r[c] || '—') + '</td>'; }).join('') + '</tr>';
      }).join('')
    + '</tbody></table></div>'
    + '<button class="imp-submit-btn" onclick="submitImport()">📤 Submit for Manager Approval (' + rows.length + ' rows)</button>'
    + '</div>';

  document.getElementById('imp-preview').innerHTML = html;
}

function clearImportPreview() {
  _importParsed = [];
  _importFile   = '';
  document.getElementById('imp-preview').innerHTML = '';
  document.getElementById('imp-filename').textContent = '';
  var fi = document.getElementById('imp-file-input');
  if (fi) fi.value = '';
}

async function submitImport() {
  if (!_importParsed.length) { toast('❌', 'No data to submit', ''); return; }
  if (!_importType)          { toast('❌', 'Select import type', ''); return; }

  var btn = document.querySelector('.imp-submit-btn');
  if (btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }

  try {
    var r = await api('POST', '/imports/submit', {
      import_type: _importType,
      filename:    _importFile,
      payload:     _importParsed
    });
    toast('✅', 'Import submitted for manager approval!', r.row_count + ' rows pending review');
    clearImportPreview();
    document.getElementById('imp-type').value = '';
    document.getElementById('imp-template-hint').innerHTML = '';
    loadImportHistory();
  } catch(e) {
    if (btn) { btn.textContent = '📤 Submit for Manager Approval'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════
   PENDING / HISTORY TABS
   ══════════════════════════════════════════════════════════ */
async function loadImportPending() {
  var container = document.getElementById('imp-pending-container');
  container.innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';
  var imports = await silentApi('GET', '/imports/all').then(function(r){ return r || []; });
  var pending = imports.filter(function(i){ return i.status === 'pending'; });

  if (!pending.length) {
    container.innerHTML = '<div class="svc-empty" style="padding:50px">'
      + '<div style="font-size:44px;margin-bottom:14px">📭</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--tx)">No pending imports</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-top:6px">All submitted imports have been reviewed</div>'
      + '</div>';
    return;
  }
  container.innerHTML = pending.map(function(i){ return renderImportCard(i, true); }).join('');
}

async function loadImportHistory() {
  var tbody = document.getElementById('imp-history-tbody');
  if (!tbody) return;
  var imports = await silentApi('GET', '/imports/all').then(function(r){ return r || []; });

  if (!imports.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptys">No import history yet.</td></tr>';
    return;
  }
  tbody.innerHTML = imports.map(function(i) {
    var statusCol = i.status === 'approved' ? '#10b981' : i.status === 'rejected' ? '#ef4444' : '#f59e0b';
    var dt = new Date(i.submitted_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td><span class="imp-type-badge">' + i.import_type.replace('_',' ') + '</span></td>'
      + '<td style="font-size:12px;color:var(--t2)">' + (i.filename || '—') + '</td>'
      + '<td style="font-family:var(--m);font-weight:700">' + i.row_count + '</td>'
      + '<td><span style="font-size:11px;font-weight:700;color:' + statusCol + '">'
      + (i.status === 'approved' ? '✅ Approved' : i.status === 'rejected' ? '❌ Rejected' : '⏳ Pending') + '</span></td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (i.submitted_by_name || '—') + '</td>'
      + '</tr>';
  }).join('');
}

function renderImportCard(i, showActions) {
  var typeLabels = { branches:'🏢 Branches', printers:'🖨️ Printers', toner_models:'🖨 Toner Models', toner_stock:'📦 Toner Stock' };
  var dt = new Date(i.submitted_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  return '<div class="imp-card">'
    + '<div class="imp-card-left">'
    + '<div class="imp-card-type">' + (typeLabels[i.import_type] || i.import_type) + '</div>'
    + '<div class="imp-card-meta">'
    + '<span>📁 ' + (i.filename || 'Unknown file') + '</span>'
    + '<span>📊 ' + i.row_count + ' rows</span>'
    + '<span>👤 ' + (i.submitted_by_name || '—') + '</span>'
    + '<span>🕐 ' + dt + '</span>'
    + '</div>'
    + (i.review_note ? '<div class="imp-card-note">' + i.review_note + '</div>' : '')
    + '</div>'
    + (showActions
        ? '<div class="imp-card-actions">'
            + '<input class="appr-note-input" id="imp-note-' + i.id + '" placeholder="Review note (optional)...">'
            + '<button class="appr-approve-btn" onclick="reviewImport(' + i.id + ',\'approved\')">✅ Approve & Import</button>'
            + '<button class="appr-reject-btn"  onclick="reviewImport(' + i.id + ',\'rejected\')">❌ Reject</button>'
          + '</div>'
        : '')
    + '</div>';
}

async function reviewImport(id, status) {
  var noteEl = document.getElementById('imp-note-' + id);
  var note   = noteEl ? noteEl.value : '';
  try {
    var r = await api('PATCH', '/imports/' + id + '/review', { status: status, review_note: note || null });
    toast(status === 'approved' ? '✅' : '❌',
          status === 'approved' ? 'Import approved! Data added to database.' : 'Import rejected.',
          status === 'approved' ? (r.success + ' rows imported') : '');
    loadImportPending();
    loadImportHistory();
    refreshImportBadge();
  } catch(e) {}
}

async function refreshImportBadge() {
  var r = await silentApi('GET', '/imports/pending-count');
  var badge = document.getElementById('import-badge');
  if (!badge) return;
  var count = (r && r.count) ? r.count : 0;
  badge.textContent   = count;
  badge.style.display = count > 0 ? '' : 'none';
}