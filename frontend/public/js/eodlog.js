/* ============================================================
   SoftWave — End of Day Print Log
   File: js/eodlog.js
   Service person ONLY — mobile-first, ultra simple
   ============================================================ */

var _eodPrinters = [];
var _eodBranchId = null;

/* ── Entry point called by nav ─────────────────────────── */
async function loadEOD() {
  var el = document.getElementById('eod-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  var access   = (APP.user.branch_access || '').trim().toUpperCase();
  var branches = (await silentApi('GET', '/branches')) || [];

  if (access && access !== 'ALL') {
    var branch = branches.find(function(b) {
      return b.code.toUpperCase() === access || String(b.id) === access;
    });
    if (branch) {
      _eodBranchId = branch.id;
      document.getElementById('eod-branch-row').style.display    = 'none';
      document.getElementById('eod-assigned-wrap').style.display  = '';
      document.getElementById('eod-branch-badge').textContent     = '🏢  ' + branch.code + ' — ' + branch.name;
      await eodLoadPrinters(branch.id);
    } else {
      document.getElementById('eod-branch-row').style.display    = 'none';
      document.getElementById('eod-assigned-wrap').style.display  = '';
      document.getElementById('eod-branch-badge').textContent     = '⚠️ Branch not found — contact your administrator';
      document.getElementById('eod-printers').innerHTML = eodEmpty('⚠️','Branch not found','Ask your administrator to assign your account to a branch.');
    }
  } else {
    document.getElementById('eod-branch-row').style.display    = '';
    document.getElementById('eod-assigned-wrap').style.display  = 'none';
    var sel = document.getElementById('eod-branch-sel');
    if (sel) {
      sel.innerHTML = '<option value="">— Select Branch —</option>';
      branches.filter(function(b){ return b.is_active; }).forEach(function(b) {
        sel.add(new Option(b.code + ' — ' + b.name, b.id + '|' + b.code));
      });
    }
    document.getElementById('eod-printers').innerHTML = eodEmpty('🏢','Select a branch above','');
  }

  eodLoadHistory();
}

async function eodBranchChanged() {
  var sel = document.getElementById('eod-branch-sel');
  if (!sel || !sel.value) {
    document.getElementById('eod-printers').innerHTML = eodEmpty('🏢','Select a branch above','');
    return;
  }
  _eodBranchId = parseInt(sel.value.split('|')[0]);
  await eodLoadPrinters(_eodBranchId);
}

async function eodLoadPrinters(branchId) {
  var wrap = document.getElementById('eod-printers');
  wrap.innerHTML = '<div class="eod-loading"><div class="spin"></div> Loading printers…</div>';

  /* API returns v_printer_status fields — key is printer_id NOT id */
  var all = (await silentApi('GET', '/printers')) || [];
  _eodPrinters = all.filter(function(p) { return p.branch_id === branchId; });

  if (!_eodPrinters.length) {
    wrap.innerHTML = eodEmpty('🖨️','No printers in this branch','Contact your administrator');
    return;
  }

  wrap.innerHTML = _eodPrinters.map(function(p, idx) {
    /* Use printer_id — the field from v_printer_status */
    var pid = p.printer_id;
    var pct = Math.round(p.current_pct || 0);
    var tc  = pct <= 10 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';

    return (
      '<div class="eod-card" id="eod-card-' + pid + '">' +

        '<div class="eod-card-hdr">' +
          '<div class="eod-card-num">' + (idx + 1) + '</div>' +
          '<div class="eod-card-meta">' +
            '<div class="eod-card-code">' + p.printer_code + '</div>' +
            '<div class="eod-card-model">' + (p.printer_model || '') + '</div>' +
          '</div>' +
          '<div class="eod-toner-ring" style="border-color:' + tc + ';color:' + tc + '">' +
            '<span class="eod-toner-pct">' + pct + '%</span>' +
            '<span class="eod-toner-word"> toner</span>' +
          '</div>' +
          '<div class="eod-done-tick" id="eod-tick-' + pid + '" style="display:none">✅</div>' +
        '</div>' +

        /* 3-column paper grid */
        '<div class="eod-paper-grid">' +
          eodPaperCol(pid, 'a4',  '📄', 'A4') +
          eodPaperCol(pid, 'b4',  '📋', 'B4') +
          eodPaperCol(pid, 'lt',  '📃', 'Letter') +
        '</div>' +

        '<div class="eod-card-footer">' +
          '<div class="eod-total-row">' +
            '<span class="eod-total-label">Total Prints</span>' +
            '<span class="eod-total-num" id="eod-tot-' + pid + '">0</span>' +
          '</div>' +
          '<button class="eod-save-btn" id="eod-btn-' + pid + '" onclick="eodSave(' + pid + ')">Save ✓</button>' +
        '</div>' +

      '</div>'
    );
  }).join('');

  eodUpdateSummary();
}

function eodPaperCol(pid, prefix, icon, label) {
  return (
    '<div class="eod-paper-col">' +
      '<div class="eod-paper-name">' + icon + ' ' + label + '</div>' +
      '<label class="eod-side-lbl">Single Side</label>' +
      '<input type="number" class="eod-input" id="eod-' + pid + '-' + prefix + 's"' +
        ' min="0" placeholder="0" inputmode="numeric" oninput="eodCalcTotal(' + pid + ')">' +
      '<label class="eod-side-lbl">Double Side</label>' +
      '<input type="number" class="eod-input" id="eod-' + pid + '-' + prefix + 'd"' +
        ' min="0" placeholder="0" inputmode="numeric" oninput="eodCalcTotal(' + pid + ')">' +
    '</div>'
  );
}

function eodCalcTotal(pid) {
  var keys  = ['a4s','a4d','b4s','b4d','lts','ltd'];
  var total = 0;
  keys.forEach(function(k) {
    var inp = document.getElementById('eod-' + pid + '-' + k);
    total  += (inp && inp.value !== '') ? (parseInt(inp.value) || 0) : 0;
  });
  var el = document.getElementById('eod-tot-' + pid);
  if (el) {
    el.textContent = total.toLocaleString();
    el.style.color = total > 0 ? 'var(--c1)' : 'var(--t3)';
  }
  eodUpdateSummary();
}

function eodUpdateSummary() {
  var grand = 0, filled = 0;
  _eodPrinters.forEach(function(p) {
    var el = document.getElementById('eod-tot-' + p.printer_id);
    var v  = el ? (parseInt(el.textContent.replace(/,/g,'')) || 0) : 0;
    grand += v;
    if (v > 0) filled++;
  });
  var gt = document.getElementById('eod-grand-total');
  var fc = document.getElementById('eod-filled-count');
  if (gt) gt.textContent = grand.toLocaleString();
  if (fc) fc.textContent = filled + ' / ' + _eodPrinters.length;
}

function eodGetVal(pid, key) {
  var el = document.getElementById('eod-' + pid + '-' + key);
  return el && el.value !== '' ? (parseInt(el.value) || 0) : 0;
}

async function eodSave(pid) {
  var a4s = eodGetVal(pid,'a4s'), a4d = eodGetVal(pid,'a4d');
  var b4s = eodGetVal(pid,'b4s'), b4d = eodGetVal(pid,'b4d');
  var lts = eodGetVal(pid,'lts'), ltd = eodGetVal(pid,'ltd');
  var total = a4s + a4d + b4s + b4d + lts + ltd;

  var btn = document.getElementById('eod-btn-' + pid);
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    await api('POST', '/requests/print-logs', {
      printer_id:    pid,
      print_count:   total,
      a4_single:     a4s,
      a4_double:     a4d,
      b4_single:     b4s,
      b4_double:     b4d,
      letter_single: lts,
      letter_double: ltd
    });

    var card = document.getElementById('eod-card-' + pid);
    if (card) card.classList.add('eod-card-done');
    var tick = document.getElementById('eod-tick-' + pid);
    if (tick) tick.style.display = '';
    btn.textContent = '✅ Saved — ' + total.toLocaleString() + ' prints';
    btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
    btn.style.boxShadow  = 'none';

    toast('✅', 'Saved!', total.toLocaleString() + ' total prints');
    eodLoadHistory();
    eodUpdateSummary();

  } catch(e) {
    btn.textContent = 'Save ✓';
    btn.disabled    = false;
  }
}

async function eodSaveAll() {
  var btn = document.getElementById('eod-save-all-btn');
  btn.textContent = 'Saving…';
  btn.disabled    = true;
  var count = 0;

  for (var i = 0; i < _eodPrinters.length; i++) {
    var p   = _eodPrinters[i];
    var pid = p.printer_id;
    var tot = parseInt((document.getElementById('eod-tot-' + pid) || {}).textContent || '0') || 0;
    if (tot <= 0) continue;

    try {
      await api('POST', '/requests/print-logs', {
        printer_id:    pid,
        print_count:   tot,
        a4_single:     eodGetVal(pid,'a4s'),
        a4_double:     eodGetVal(pid,'a4d'),
        b4_single:     eodGetVal(pid,'b4s'),
        b4_double:     eodGetVal(pid,'b4d'),
        letter_single: eodGetVal(pid,'lts'),
        letter_double: eodGetVal(pid,'ltd')
      });

      var card = document.getElementById('eod-card-' + pid);
      if (card) card.classList.add('eod-card-done');
      var tick = document.getElementById('eod-tick-' + pid);
      if (tick) tick.style.display = '';
      var sb = document.getElementById('eod-btn-' + pid);
      if (sb) {
        sb.textContent = '✅ Saved';
        sb.style.background = 'linear-gradient(135deg,#10b981,#059669)';
      }
      count++;
    } catch(e) {}
  }

  btn.textContent = '✓ Save All';
  btn.disabled    = false;

  if (count > 0) {
    toast('✅', count + ' printers logged', 'End of day complete');
    eodLoadHistory();
  } else {
    toast('⚠️', 'Nothing to save', 'Enter at least one print count first');
  }
}

async function eodLoadHistory() {
  var tbody = document.getElementById('eod-history-tbody');
  if (!tbody) return;
  var logs = (await silentApi('GET', '/requests/my-print-logs')) || [];
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="emptys">No logs yet.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.slice(0, 20).map(function(l) {
    var dt = l.log_date
      ? new Date(l.log_date + 'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
      : '—';
    var parts = [];
    if (l.a4_single || l.a4_double)       parts.push('A4: '  + (l.a4_single||0) + 'S/' + (l.a4_double||0) + 'D');
    if (l.b4_single || l.b4_double)       parts.push('B4: '  + (l.b4_single||0) + 'S/' + (l.b4_double||0) + 'D');
    if (l.letter_single || l.letter_double) parts.push('LT: ' + (l.letter_single||0) + 'S/' + (l.letter_double||0) + 'D');
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td style="font-family:var(--m);font-weight:700;color:var(--c1)">' + (l.printer_code || '—') + '</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (l.branch_name || '—') + '</td>'
      + '<td style="font-family:var(--m);font-size:15px;font-weight:800">' + (l.print_count || 0).toLocaleString() + '</td>'
      + '<td style="font-size:10px;color:var(--t3);font-family:var(--m)">' + (parts.join(' · ') || '—') + '</td>'
      + '</tr>';
  }).join('');
}

function eodEmpty(icon, title, sub) {
  return '<div class="eod-empty">'
    + '<div class="eod-empty-icon">' + icon + '</div>'
    + '<div class="eod-empty-title">' + title + '</div>'
    + (sub ? '<div class="eod-empty-sub">' + sub + '</div>' : '')
    + '</div>';
}