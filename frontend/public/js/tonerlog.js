/* ============================================================
   SoftWave — Toner Replacement Log
   File: js/tonerlog.js
   Service person marks physical toner replacements
   Mobile-first design
   ============================================================ */

var _tlBranchId   = null;
var _tlPrinters   = [];

/* ── Entry point ─────────────────────────────────────────── */
async function loadTonerLog() {
  var access   = (APP.user.branch_access || '').trim().toUpperCase();
  var branches = (await silentApi('GET', '/branches')) || [];

  if (access && access !== 'ALL') {
    var branch = branches.find(function(b) {
      return b.code.toUpperCase() === access || String(b.id) === access;
    });
    if (branch) {
      _tlBranchId = branch.id;
      document.getElementById('tl-branch-badge').textContent = '🏢 ' + branch.code + ' — ' + branch.name;
      document.getElementById('tl-branch-badge-wrap').style.display = '';
      document.getElementById('tl-branch-select-wrap').style.display = 'none';
      await tlLoadPrinters(branch.id);
    } else {
      document.getElementById('tl-printers').innerHTML = tlEmpty('⚠️', 'Branch not found', 'Contact your administrator.');
    }
  } else {
    // Manager/DBA — show branch selector
    document.getElementById('tl-branch-badge-wrap').style.display  = 'none';
    document.getElementById('tl-branch-select-wrap').style.display = '';
    var sel = document.getElementById('tl-branch-sel');
    sel.innerHTML = '<option value="">— Select Branch —</option>';
    branches.filter(function(b){ return b.is_active; }).forEach(function(b) {
      sel.add(new Option(b.code + ' — ' + b.name, b.id));
    });
    document.getElementById('tl-printers').innerHTML = tlEmpty('🏢', 'Select a branch above', '');
  }
}

async function tlBranchChanged() {
  var sel = document.getElementById('tl-branch-sel');
  if (!sel || !sel.value) {
    document.getElementById('tl-printers').innerHTML = tlEmpty('🏢', 'Select a branch above', '');
    return;
  }
  _tlBranchId = parseInt(sel.value);
  await tlLoadPrinters(_tlBranchId);
}

/* ── Load printers for branch ────────────────────────────── */
async function tlLoadPrinters(branchId) {
  document.getElementById('tl-printers').innerHTML =
    '<div class="tl-loading"><div class="spin"></div> Loading printers…</div>';

  var printers = await silentApi('GET', '/printers/branch-printers-with-toner?branch_id=' + branchId);

  if (printers === null || printers === undefined) {
    document.getElementById('tl-printers').innerHTML = tlEmpty('❌', 'Failed to load printers', 'Check your connection and try Refresh.');
    return;
  }

  _tlPrinters = printers || [];

  if (!_tlPrinters.length) {
    document.getElementById('tl-printers').innerHTML = tlEmpty('🖨️', 'No printers found', 'No active printers in this branch.');
    return;
  }

  renderTlPrinters();
}

/* ── Render printer cards ────────────────────────────────── */
function renderTlPrinters() {
  var html = _tlPrinters.map(function(p) {
    var pct     = p.current_pct != null ? Math.round(p.current_pct) : null;
    var pctTxt  = pct != null ? pct + '%' : '—';
    var pctCol  = pct == null ? '#94a3b8' : pct <= 5 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';
    var barW    = pct != null ? Math.max(3, pct) : 0;

    var lastReplaced = '';
    if (p.last_replaced_at) {
      var dt = new Date(p.last_replaced_at);
      var dtStr = dt.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      lastReplaced = '<div class="tl-last-replaced">'
        + '<span class="tl-last-ico">🕐</span>'
        + '<div>'
        + '<div class="tl-last-label">Last Replaced</div>'
        + '<div class="tl-last-dt">' + dtStr + '</div>'
        + (p.last_replaced_by ? '<div class="tl-last-by">by ' + p.last_replaced_by + '</div>' : '')
        + '</div>'
        + '</div>';
    } else {
      lastReplaced = '<div class="tl-last-replaced tl-never">'
        + '<span class="tl-last-ico">🕐</span>'
        + '<div class="tl-last-label">Never replaced via system</div>'
        + '</div>';
    }

    return '<div class="tl-card" id="tlcard-' + p.printer_id + '">'
      + '<div class="tl-card-top">'
      +   '<div class="tl-card-left">'
      +     '<div class="tl-printer-code">' + p.printer_code + '</div>'
      +     '<div class="tl-printer-model">' + (p.printer_model || '—') + '</div>'
      +     (p.location_note ? '<div class="tl-printer-loc">📍 ' + p.location_note + '</div>' : '')
      +   '</div>'
      +   '<div class="tl-card-right">'
      +     '<div class="tl-pct" style="color:' + pctCol + '">' + pctTxt + '</div>'
      +     '<div class="tl-toner-model">' + (p.toner_model || 'No toner') + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="tl-bar"><div class="tl-bar-fill" style="width:' + barW + '%;background:' + pctCol + '"></div></div>'
      + lastReplaced
      + '<button class="tl-replace-btn" id="tlbtn-' + p.printer_id + '" '
      +   'onclick="tlMarkReplaced(' + p.printer_id + ',' + (p.toner_model_id || 'null') + ')">'
      +   '✅ Toner Replaced'
      + '</button>'
      + '</div>';
  }).join('');

  document.getElementById('tl-printers').innerHTML = html;
}

/* ── Mark toner replaced ─────────────────────────────────── */
async function tlMarkReplaced(printerId, tonerModelId) {
  var btn = document.getElementById('tlbtn-' + printerId);
  if (!btn) return;

  btn.disabled    = true;
  btn.textContent = '⏳ Logging…';

  try {
    var body = { printer_id: printerId };
    if (tonerModelId) body.toner_model_id = tonerModelId;

    var r = await api('POST', '/printers/toner-replaced', body);

    // Update the card to show new timestamp immediately
    var printer = _tlPrinters.find(function(p){ return p.printer_id === printerId; });
    if (printer) {
      printer.last_replaced_at = r.installed_at;
      printer.last_replaced_by = APP.user.full_name || APP.user.username;
      printer.current_pct      = 100;
    }

    toast('✅', 'Toner replacement logged!', 'Toner set to 100% — timestamp saved.');
    renderTlPrinters();

  } catch(e) {
    btn.disabled    = false;
    btn.textContent = '✅ Toner Replaced';
    toast('❌', 'Failed to log replacement', e.message || '');
  }
}

/* ── Helper ──────────────────────────────────────────────── */
function tlEmpty(icon, title, sub) {
  return '<div class="tl-empty">'
    + '<div class="tl-empty-icon">' + icon + '</div>'
    + '<div class="tl-empty-title">' + title + '</div>'
    + (sub ? '<div class="tl-empty-sub">' + sub + '</div>' : '')
    + '</div>';
}