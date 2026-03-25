/* ── Paper card toggle ───────────────────────────────────── */
function eodTogglePaper(type) {
  var inputs = document.getElementById('eod3-inputs-' + type);
  var arrow  = document.getElementById('eod3-arrow-'  + type);
  var card   = document.getElementById('eod3-paper-'  + type);
  if (!inputs) return;
  var open = inputs.style.display !== 'none';
  inputs.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (card)  card.classList.toggle('eod3-paper-open', !open);
  if (!open) {
    setTimeout(function(){
      var first = inputs.querySelector('input');
      if (first) first.focus();
    }, 100);
  }
}

/* ============================================================
   SoftWave — End of Day Print Log v3
   Ultra-simple for non-technical mobile users
   Flow: Date selector → Printer cards → Click printer popup
         → Paper type cards → Summary → Save All
   ============================================================ */

var _eodPrinters  = [];
var _eodBranchId  = null;
var _eodLogDate   = null;   // YYYY-MM-DD string
var _eodActivePid = null;   // printer being edited in popup

/* ── Helpers ─────────────────────────────────────────────── */
function eodToday() {
  var d = new Date();
  return d.toISOString().slice(0,10);
}
function eodYesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0,10);
}
function eodFmtDate(iso) {
  var d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}

/* ── Entry point ─────────────────────────────────────────── */
async function loadEOD() {
  _eodLogDate = eodToday();
  eodSetDateUI();

  var access   = (APP.user.branch_access || '').trim().toUpperCase();
  var branches = (await silentApi('GET', '/branches')) || [];

  if (access && access !== 'ALL') {
    var branch = branches.find(function(b) {
      return b.code.toUpperCase() === access || String(b.id) === access;
    });
    if (branch) {
      _eodBranchId = branch.id;
      document.getElementById('eod-branch-row').style.display    = 'none';
      document.getElementById('eod-assigned-wrap').style.display = '';
      document.getElementById('eod-branch-badge').textContent    = '🏢  ' + branch.code + ' — ' + branch.name;
      await eodLoadPrinters(branch.id);
    } else {
      document.getElementById('eod-branch-row').style.display    = 'none';
      document.getElementById('eod-assigned-wrap').style.display = '';
      document.getElementById('eod-branch-badge').textContent    = '⚠️ Branch not found — contact administrator';
      document.getElementById('eod-printers').innerHTML = eodEmpty('⚠️','Branch not found','Ask your administrator.');
    }
  } else {
    document.getElementById('eod-branch-row').style.display    = '';
    document.getElementById('eod-assigned-wrap').style.display = 'none';
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

/* ── Date selector UI ────────────────────────────────────── */
function eodSetDateUI() {
  var today = eodToday();
  var yesterday = eodYesterday();
  var btnToday = document.getElementById('eod-btn-today');
  var btnYest  = document.getElementById('eod-btn-yest');
  if (btnToday) {
    btnToday.classList.toggle('eod-date-active', _eodLogDate === today);
    btnYest.classList.toggle('eod-date-active',  _eodLogDate === yesterday);
  }
  var lbl = document.getElementById('eod-date');
  if (lbl) lbl.textContent = eodFmtDate(_eodLogDate);
}

function eodSelectDate(which) {
  _eodLogDate = (which === 'today') ? eodToday() : eodYesterday();
  eodSetDateUI();
  if (_eodBranchId) eodLoadPrinters(_eodBranchId);
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

/* ── Load printers ───────────────────────────────────────── */
async function eodLoadPrinters(branchId) {
  var wrap = document.getElementById('eod-printers');
  wrap.innerHTML = '<div class="eod-loading"><div class="spin"></div> Loading printers…</div>';

  var all = (await silentApi('GET', '/printers')) || [];
  _eodPrinters = all.filter(function(p) { return p.branch_id === branchId; });

  if (!_eodPrinters.length) {
    wrap.innerHTML = eodEmpty('🖨️','No printers in this branch','Contact your administrator');
    return;
  }

  // Check which printers already have a log for this date
  var existingLogs = (await silentApi('GET', '/requests/print-logs?branch_id=' + branchId)) || [];
  var loggedMap = {};
  existingLogs.forEach(function(l) {
    if (l.log_date && l.log_date.slice(0,10) === _eodLogDate) {
      loggedMap[l.printer_id] = l;
    }
  });

  wrap.innerHTML = '<div class="eod3-printer-grid" id="eod3-grid">'
    + _eodPrinters.map(function(p, idx) {
        var pid  = p.printer_id;
        var pct  = Math.round(p.current_pct || 0);
        var tc   = pct <= 10 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';
        var done = !!loggedMap[pid];
        var log  = loggedMap[pid] || {};

        return '<div class="eod3-printer-card ' + (done ? 'eod3-done' : '') + '" id="eod3-card-' + pid + '" onclick="eodOpenPrinter(' + pid + ')">'
          + '<div class="eod3-card-num">' + (idx+1) + '</div>'
          + (done ? '<div class="eod3-done-badge">✅ Logged</div>' : '')
          + '<div class="eod3-printer-icon">🖨️</div>'
          + '<div class="eod3-printer-code">' + p.printer_code + '</div>'
          + '<div class="eod3-printer-model">' + (p.printer_model||'') + '</div>'
          + '<div class="eod3-toner-bar-wrap">'
          +   '<div class="eod3-toner-bar" style="width:' + pct + '%;background:' + tc + '"></div>'
          + '</div>'
          + '<div class="eod3-toner-pct" style="color:' + tc + '">' + pct + '% Toner</div>'
          + (done
              ? '<div class="eod3-logged-total">' + (log.print_count||0).toLocaleString() + ' prints</div>'
              : '<div class="eod3-tap-hint">Tap to log prints</div>')
          + '</div>';
      }).join('')
    + '</div>';

  eodUpdateSummaryBar();
}

/* ── Open printer popup ──────────────────────────────────── */
function eodOpenPrinter(pid) {
  _eodActivePid = pid;
  var p   = _eodPrinters.find(function(x){ return x.printer_id === pid; });
  var pct = Math.round((p && p.current_pct) || 0);
  var tc  = pct <= 10 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';

  // Set printer info
  document.getElementById('eod-pop-code').textContent  = p ? p.printer_code : '';
  document.getElementById('eod-pop-model').textContent = p ? (p.printer_model||'') : '';
  document.getElementById('eod-pop-pct').textContent   = pct + '% Toner';
  document.getElementById('eod-pop-pct').style.color   = tc;

  // Clear all inputs
  ['eod-pop-total','eod-pop-a4s','eod-pop-a4d','eod-pop-b4s','eod-pop-b4d','eod-pop-lgs','eod-pop-lgd'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('eod-pop-save').textContent = '✓ Save This Printer';
  document.getElementById('eod-pop-save').disabled    = false;
  document.getElementById('eod-pop-save').style.background = '';

  eodPopCalcPaper();

  // Show popup
  document.getElementById('eod-pop-overlay').style.display = 'flex';
  setTimeout(function(){ document.getElementById('eod-pop-box').classList.add('open'); }, 10);
  // Focus total input
  setTimeout(function(){
    var t = document.getElementById('eod-pop-total');
    if (t) t.focus();
  }, 200);
}

function eodClosePop() {
  document.getElementById('eod-pop-box').classList.remove('open');
  setTimeout(function(){ document.getElementById('eod-pop-overlay').style.display = 'none'; }, 300);
}

/* ── Popup calculation ───────────────────────────────────── */
function eodPopCalcPaper() {
  var a4s = parseInt(document.getElementById('eod-pop-a4s').value)||0;
  var a4d = parseInt(document.getElementById('eod-pop-a4d').value)||0;
  var b4s = parseInt(document.getElementById('eod-pop-b4s').value)||0;
  var b4d = parseInt(document.getElementById('eod-pop-b4d').value)||0;
  var lgs = parseInt(document.getElementById('eod-pop-lgs').value)||0;
  var lgd = parseInt(document.getElementById('eod-pop-lgd').value)||0;

  var paperTotal = a4s + a4d + b4s + b4d + lgs + lgd;

  // Show paper total preview
  var pt = document.getElementById('eod-pop-paper-total');
  if (pt) {
    pt.textContent = paperTotal > 0 ? 'Paper total: ' + paperTotal.toLocaleString() : '';
  }
}

function eodPopTotalChanged() {
  // If user typed total, show it prominently
  var val = parseInt(document.getElementById('eod-pop-total').value)||0;
  var preview = document.getElementById('eod-pop-total-preview');
  if (preview) {
    preview.textContent = val > 0 ? val.toLocaleString() + ' prints' : '';
    preview.style.color = val > 0 ? '#0ea5e9' : '#94a3b8';
  }
}

/* ── Save from popup ─────────────────────────────────────── */
async function eodPopSave() {
  var pid   = _eodActivePid;
  var total = parseInt(document.getElementById('eod-pop-total').value)||0;
  var a4s   = parseInt(document.getElementById('eod-pop-a4s').value)||0;
  var a4d   = parseInt(document.getElementById('eod-pop-a4d').value)||0;
  var b4s   = parseInt(document.getElementById('eod-pop-b4s').value)||0;
  var b4d   = parseInt(document.getElementById('eod-pop-b4d').value)||0;
  var lgs   = parseInt(document.getElementById('eod-pop-lgs').value)||0;
  var lgd   = parseInt(document.getElementById('eod-pop-lgd').value)||0;

  if (total <= 0) {
    toast('⚠️','Enter total prints','Please enter the total print count');
    return;
  }

  var btn = document.getElementById('eod-pop-save');
  btn.textContent = '⏳ Saving…';
  btn.disabled    = true;

  try {
    await api('POST', '/requests/print-logs', {
      printer_id:    pid,
      print_count:   total,
      log_date:      _eodLogDate,
      a4_single:     a4s, a4_double:     a4d,
      b4_single:     b4s, b4_double:     b4d,
      letter_single: lgs, letter_double: lgd
    });

    // Mark card as done
    var card = document.getElementById('eod3-card-' + pid);
    if (card) {
      card.classList.add('eod3-done');
      var hint = card.querySelector('.eod3-tap-hint');
      if (hint) hint.textContent = total.toLocaleString() + ' prints';
      hint.className = 'eod3-logged-total';
      var badge = card.querySelector('.eod3-done-badge');
      if (!badge) {
        var b = document.createElement('div');
        b.className = 'eod3-done-badge';
        b.textContent = '✅ Logged';
        card.insertBefore(b, card.firstChild.nextSibling);
      }
    }

    toast('✅','Saved!', total.toLocaleString() + ' prints logged');
    eodClosePop();
    eodUpdateSummaryBar();
    eodLoadHistory();

  } catch(e) {
    btn.textContent = '✓ Save This Printer';
    btn.disabled    = false;
    toast('❌','Save failed','Please try again');
  }
}

/* ── Summary bar ─────────────────────────────────────────── */
function eodUpdateSummaryBar() {
  var logged = document.querySelectorAll('.eod3-done').length;
  var total  = _eodPrinters.length;
  var fc = document.getElementById('eod-filled-count');
  var gt = document.getElementById('eod-grand-total');
  if (fc) fc.textContent = logged + ' / ' + total;
  // Grand total from logged-total elements
  var grand = 0;
  document.querySelectorAll('.eod3-logged-total').forEach(function(el) {
    grand += parseInt((el.textContent||'0').replace(/,/g,''))||0;
  });
  if (gt) gt.textContent = grand.toLocaleString();
}

/* ── History ─────────────────────────────────────────────── */
async function eodLoadHistory() {
  var wrap = document.getElementById('eod-history-wrap');
  if (!wrap) return;
  var logs = (await silentApi('GET', '/requests/my-print-logs')) || [];
  if (!logs.length) {
    wrap.innerHTML = '<div class="eod3-no-history">No logs yet — start logging!</div>';
    return;
  }
  wrap.innerHTML = logs.slice(0,15).map(function(l) {
    var dt = l.log_date
      ? new Date(l.log_date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'})
      : '—';
    var papers = [];
    if (l.a4_single||l.a4_double)         papers.push('A4 '+(l.a4_single||0)+'+'+(l.a4_double||0));
    if (l.b4_single||l.b4_double)         papers.push('B4 '+(l.b4_single||0)+'+'+(l.b4_double||0));
    if (l.letter_single||l.letter_double) papers.push('Legal '+(l.letter_single||0)+'+'+(l.letter_double||0));
    return '<div class="eod3-hist-row">'
      + '<div class="eod3-hist-date">' + dt + '</div>'
      + '<div class="eod3-hist-code">' + (l.printer_code||'—') + '</div>'
      + '<div class="eod3-hist-total">' + (l.print_count||0).toLocaleString() + '</div>'
      + '<div class="eod3-hist-papers">' + (papers.join(' · ')||'—') + '</div>'
      + '</div>';
  }).join('');
}

function eodEmpty(icon, title, sub) {
  return '<div class="eod-empty">'
    + '<div class="eod-empty-icon">' + icon + '</div>'
    + '<div class="eod-empty-title">' + title + '</div>'
    + (sub ? '<div class="eod-empty-sub">' + sub + '</div>' : '')
    + '</div>';
}