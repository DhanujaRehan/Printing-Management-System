/* ============================================================
   TonerPro Ultra — Service Person Module
   File: js/service.js
   ============================================================ */

var _svcBranches         = [];
var _svcPrinters         = [];
var _svcTonerStock       = [];
var _svcPaperBranchStock = [];
var _svcMyRequests       = [];
var _svcAlerts           = [];
var _svcTab              = 'requests';
var _reqType             = 'toner';
var _logPrinters         = [];

/* ── Entry point ─────────────────────────────────────────── */
async function loadService() {
  /* Use silentApi so background fetches never show error toasts */
  var s = function(url) { return silentApi('GET', url).then(function(r){ return r || []; }); };

  var results = await Promise.all([
    s('/branches'),
    s('/toner/stock'),
    s('/paper/branch-stock'),
    s('/requests/my'),
    s('/toner/alerts'),
  ]);

  _svcBranches         = results[0];
  _svcTonerStock       = results[1];
  _svcPaperBranchStock = results[2];
  _svcMyRequests       = results[3];
  _svcAlerts           = results[4];

  renderSvcKPIs();
  renderMyRequests();
  renderUrgentAlerts();
  if (_svcTab === 'log') loadLogBranches();
}

/* ── Tab switching ──────────────────────────────────────── */
function switchSvcTab(tab) {
  _svcTab = tab;
  ['requests','new','log'].forEach(function(t) {
    document.getElementById('svc-tab-' + t).className =
      'svc-tab' + (t === tab ? ' svc-tab-act' : '');
    document.getElementById('svc-panel-' + t).style.display = t === tab ? '' : 'none';
  });
  if (tab === 'new') initNewRequestForm();
  if (tab === 'log') loadLogBranches();
}

/* ── KPIs ────────────────────────────────────────────────── */
function renderSvcKPIs() {
  var pending  = _svcMyRequests.filter(function(r){ return r.status === 'pending';  }).length;
  var approved = _svcMyRequests.filter(function(r){ return r.status === 'approved'; }).length;
  var rejected = _svcMyRequests.filter(function(r){ return r.status === 'rejected'; }).length;
  var urgent   = _svcAlerts.filter(function(p){ return (p.days_remaining != null ? p.days_remaining : 99) <= 5; }).length;
  document.getElementById('svc-kpi-pending').textContent  = pending;
  document.getElementById('svc-kpi-approved').textContent = approved;
  document.getElementById('svc-kpi-rejected').textContent = rejected;
  document.getElementById('svc-kpi-urgent').textContent   = urgent;
}

/* ── Urgent alerts ──────────────────────────────────────── */
function renderUrgentAlerts() {
  var el  = document.getElementById('svc-urgent-list');
  var urg = _svcAlerts.filter(function(p){ return (p.days_remaining != null ? p.days_remaining : 99) <= 7; });
  if (!urg.length) {
    el.innerHTML = '<div class="svc-empty">✅ All printers are in good condition!</div>';
    return;
  }
  el.innerHTML = urg.map(function(p) {
    var days = p.days_remaining != null ? p.days_remaining : 0;
    var col  = days <= 2 ? '#ef4444' : days <= 5 ? '#f59e0b' : '#6366f1';
    return '<div class="svc-alert-row">'
      + '<div class="svc-alert-dot" style="background:' + col + '"></div>'
      + '<div class="svc-alert-info">'
      + '<div class="svc-alert-code">' + p.printer_code + '</div>'
      + '<div class="svc-alert-sub">Branch ' + p.branch_code + ' · ' + (p.toner_model || 'No toner') + '</div>'
      + '</div>'
      + '<div class="svc-alert-right">'
      + '<div class="svc-alert-days" style="color:' + col + '">' + days + 'd</div>'
      + '<div class="svc-alert-pct">' + Math.round(p.current_pct || 0) + '%</div>'
      + '</div>'
      + '<button class="svc-quick-req" onclick="quickRequest(' + p.printer_id + ',\'' + p.printer_code + '\',\'toner\')">+ Request</button>'
      + '</div>';
  }).join('');
}

/* ── My Requests ─────────────────────────────────────────── */
function renderMyRequests() {
  var el = document.getElementById('svc-my-requests');
  if (!_svcMyRequests.length) {
    el.innerHTML = '<div class="svc-empty" style="padding:40px 20px">'
      + '<div style="font-size:32px;margin-bottom:10px">📋</div>'
      + '<div style="font-weight:600;color:var(--tx)">No requests yet</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px">Use the New Request tab to raise a toner or paper request</div>'
      + '</div>';
    return;
  }

  var pending = _svcMyRequests.filter(function(r){ return r.status === 'pending'; });
  var rest    = _svcMyRequests.filter(function(r){ return r.status !== 'pending'; });
  var ordered = pending.concat(rest);

  el.innerHTML = ordered.slice(0, 30).map(function(r) {
    var sMap = {
      pending:  { col:'#f59e0b', label:'⏳ Pending'  },
      approved: { col:'#10b981', label:'✅ Approved'  },
      rejected: { col:'#ef4444', label:'❌ Rejected'  }
    };
    var pMap = {
      critical: { col:'#ef4444', label:'🔴 Critical' },
      urgent:   { col:'#f59e0b', label:'🟡 Urgent'   },
      normal:   { col:'#10b981', label:'🟢 Normal'   }
    };
    var s = sMap[r.status]   || { col:'#94a3b8', label: r.status };
    var p = pMap[r.priority] || { col:'#94a3b8', label: r.priority };
    var what = r.request_type === 'toner'
      ? (r.toner_model_code || 'Toner')
      : (r.paper_name || 'Paper') + (r.size ? ' ' + r.size : '');
    var isToner = r.request_type === 'toner';
    var dt = new Date(r.requested_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

    return '<div class="req2-card" style="border-left:3px solid ' + s.col + '">'
      + '<div class="req2-left"><div class="req2-icon" style="background:' + (isToner ? '#eff6ff' : '#f0fdf4') + ';color:' + (isToner ? '#1d4ed8' : '#15803d') + '">' + (isToner ? '🖨' : '📄') + '</div></div>'
      + '<div class="req2-body">'
      + '<div class="req2-top"><span class="req2-what">' + what + '</span>'
      + '<span class="req2-status" style="background:' + s.col + '22;color:' + s.col + ';border:1px solid ' + s.col + '44">' + s.label + '</span></div>'
      + '<div class="req2-meta">'
      + '<span class="req2-printer">🖨 ' + r.printer_code + '</span>'
      + '<span class="req2-branch">🏢 ' + r.branch_code + '</span>'
      + '<span class="req2-qty">× ' + r.quantity + '</span>'
      + '<span class="req2-pri" style="color:' + p.col + '">' + p.label + '</span>'
      + '</div>'
      + (r.review_note ? '<div class="req2-note">💬 Manager: ' + r.review_note + '</div>' : '')
      + '</div>'
      + '<div class="req2-right"><div class="req2-date">' + dt + '</div>'
      + (r.status === 'pending' ? '<div class="req2-awaiting">Awaiting approval</div>' : '')
      + '</div>'
      + '</div>';
  }).join('');
}

/* ── New Request form ────────────────────────────────────── */
async function initNewRequestForm() {
  document.getElementById('nreq-notes').value    = '';
  document.getElementById('nreq-priority').value = 'normal';
  document.getElementById('nreq-qty').value      = '1';

  /* Reset radio buttons to Normal */
  var radios = document.querySelectorAll('input[name="nreq-priority-radio"]');
  radios.forEach(function(r) { r.checked = r.value === 'normal'; });

  if (!_svcBranches.length || !_svcTonerStock.length) {
    try {
      var results = await Promise.all([
        silentApi('GET', '/branches'),
        silentApi('GET', '/toner/stock'),
        silentApi('GET', '/paper/branch-stock'),
      ]);
      _svcBranches         = results[0] || [];
      _svcTonerStock       = results[1] || [];
      _svcPaperBranchStock = results[2] || [];
    } catch(e) {}
  }

  var brSel = document.getElementById('nreq-branch');
  brSel.innerHTML = '<option value="">— Select Branch —</option>';
  _svcBranches.filter(function(b){ return b.is_active; }).forEach(function(b) {
    brSel.add(new Option('Branch ' + b.code + ' — ' + b.name, b.id));
  });
  document.getElementById('nreq-printer').innerHTML     = '<option value="">— Select Branch First —</option>';
  document.getElementById('nreq-toner-model').innerHTML = '<option value="">— Select Toner Model —</option>';
  _svcTonerStock.forEach(function(s) {
    document.getElementById('nreq-toner-model').add(new Option(s.model_code + ' (' + s.quantity + ' in stock)', s.id));
  });
  document.getElementById('nreq-paper-type').innerHTML = '<option value="">— Select Branch First —</option>';
  switchNReqType('toner');
}

function switchNReqType(type) {
  _reqType = type;
  document.getElementById('nreq-tab-toner').className = 'nreq-type-tab' + (type === 'toner' ? ' nreq-type-act' : '');
  document.getElementById('nreq-tab-paper').className = 'nreq-type-tab' + (type === 'paper' ? ' nreq-type-act' : '');
  document.getElementById('nreq-toner-fields').style.display = type === 'toner' ? '' : 'none';
  document.getElementById('nreq-paper-fields').style.display = type === 'paper' ? '' : 'none';
}

async function nreqLoadPrinters() {
  var bid    = document.getElementById('nreq-branch').value;
  var prSel  = document.getElementById('nreq-printer');
  var papSel = document.getElementById('nreq-paper-type');
  prSel.innerHTML  = '<option value="">— Loading... —</option>';
  papSel.innerHTML = '<option value="">— Loading... —</option>';
  if (!bid) {
    prSel.innerHTML = '<option value="">— Select Branch First —</option>';
    return;
  }
  if (!_svcPaperBranchStock.length) {
    var ps = await silentApi('GET', '/paper/branch-stock');
    _svcPaperBranchStock = ps || [];
  }
  try {
    var prs = await api('GET', '/printers/branch/' + bid);
    _svcPrinters = prs;
    prSel.innerHTML = '<option value="">— Select Printer —</option>';
    prs.forEach(function(p) {
      prSel.add(new Option(p.printer_code + ' — ' + Math.round(p.current_pct || 0) + '% toner', p.printer_id));
    });
    var branchPaper = _svcPaperBranchStock.filter(function(s){ return String(s.branch_id) === String(bid) && s.quantity > 0; });
    papSel.innerHTML = '<option value="">— Select Paper Type —</option>';
    branchPaper.forEach(function(s) {
      papSel.add(new Option(s.paper_name + ' ' + s.size + ' — ' + s.quantity + ' reams available', s.paper_type_id));
    });
    if (!branchPaper.length) papSel.innerHTML = '<option value="">No paper stock at this branch</option>';
  } catch(e) {
    prSel.innerHTML = '<option value="">Error loading printers</option>';
  }
}

async function submitNewRequest() {
  var printerId = document.getElementById('nreq-printer').value;
  var priority  = document.getElementById('nreq-priority').value;
  var notes     = document.getElementById('nreq-notes').value;

  if (!printerId) { toast('❌', 'Select a printer', ''); return; }

  var body = {
    request_type: _reqType,
    printer_id:   parseInt(printerId),
    priority:     priority,
    notes:        notes || null,
    quantity:     1,
  };

  if (_reqType === 'toner') {
    var mid = document.getElementById('nreq-toner-model').value;
    if (!mid) { toast('❌', 'Select a toner model', ''); return; }
    body.toner_model_id = parseInt(mid);
  } else {
    var pid = document.getElementById('nreq-paper-type').value;
    var qty = parseInt(document.getElementById('nreq-qty').value) || 1;
    if (!pid) { toast('❌', 'Select a paper type', ''); return; }
    body.paper_type_id = parseInt(pid);
    body.quantity = qty;
  }

  try {
    var btn = document.getElementById('nreq-submit-btn');
    btn.textContent = 'Submitting...';
    btn.disabled = true;
    await api('POST', '/requests/create', body);
    btn.textContent = '✓ Request Submitted!';
    btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
    toast('📋', 'Request submitted! Awaiting manager approval.', priority + ' priority');
    await loadService();
    setTimeout(function() {
      switchSvcTab('requests');
      btn.textContent = '📤 Submit Request to Manager';
      btn.style.background = '';
      btn.disabled = false;
    }, 1500);
  } catch(e) {
    var btn2 = document.getElementById('nreq-submit-btn');
    btn2.textContent = '📤 Submit Request to Manager';
    btn2.disabled = false;
  }
}

function quickRequest(printerId, printerCode, type) {
  switchSvcTab('new');
  setTimeout(async function() {
    var pr = _svcAlerts.find(function(p){ return p.printer_id === printerId; });
    if (pr && pr.branch_id) {
      document.getElementById('nreq-branch').value = pr.branch_id;
      await nreqLoadPrinters();
      document.getElementById('nreq-printer').value = printerId;
    }
    switchNReqType(type);
  }, 80);
}

/* ── End of Day Log ─────────────────────────────────────── */
async function loadLogBranches() {
  if (!_svcBranches.length) {
    var b = await silentApi('GET', '/branches');
    _svcBranches = b || [];
  }
  var brSel = document.getElementById('log2-branch');
  brSel.innerHTML = '<option value="">— Select Branch —</option>';
  _svcBranches.filter(function(b){ return b.is_active; }).forEach(function(b) {
    brSel.add(new Option('Branch ' + b.code + ' — ' + b.name, b.id));
  });
  loadLogHistory();
}

async function loadLogPrinters2() {
  var bid  = document.getElementById('log2-branch').value;
  var grid = document.getElementById('log2-grid');
  grid.innerHTML = '<div class="svc-empty" style="grid-column:1/-1;padding:30px">Loading printers...</div>';
  if (!bid) {
    grid.innerHTML = '<div class="svc-empty" style="grid-column:1/-1">Select a branch above.</div>';
    return;
  }
  try {
    var prs = await api('GET', '/printers/branch/' + bid);
    _logPrinters = prs;
    if (!prs.length) {
      grid.innerHTML = '<div class="svc-empty" style="grid-column:1/-1">No printers in this branch.</div>';
      return;
    }
    grid.innerHTML = prs.map(function(p) {
      var pct = Math.round(p.current_pct || 0);
      var tc  = pct <= 10 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';
      return '<div class="log2-card" id="log2-card-' + p.printer_id + '">'
        + '<div class="log2-header">'
        + '<div class="log2-code">' + p.printer_code + '</div>'
        + '<div class="log2-model">' + (p.printer_model || '') + '</div>'
        + '</div>'
        + '<div class="log2-stats">'
        + '<div class="log2-stat-item">'
        + '<div class="log2-stat-label">Toner Level</div>'
        + '<div class="log2-stat-val" style="color:' + tc + '">' + pct + '%</div>'
        + '<div class="pb" style="margin-top:4px"><div class="pf ' + pfClass(pct) + '" style="width:' + pct + '%"></div></div>'
        + '</div>'
        + '<div class="log2-stat-item">'
        + '<div class="log2-stat-label">Days Left</div>'
        + '<div class="log2-stat-val" style="color:' + ((p.days_remaining != null && p.days_remaining <= 3) ? '#ef4444' : (p.days_remaining != null && p.days_remaining <= 7) ? '#f59e0b' : 'var(--tx)') + '">'
        + (p.days_remaining != null ? p.days_remaining + 'd' : '—') + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="log2-input-section">'
        + '<label class="log2-input-label">📊 Total Prints Today</label>'
        + '<input type="number" class="log2-big-input" id="log2-count-' + p.printer_id + '" min="0" placeholder="0">'
        + '<label class="log2-input-label" style="margin-top:8px">📝 Notes</label>'
        + '<input type="text" class="log2-note-input" id="log2-note-' + p.printer_id + '" placeholder="e.g. Paper jam resolved">'
        + '</div>'
        + '<button class="log2-submit-btn" id="log2-btn-' + p.printer_id + '" onclick="submitLog2(' + p.printer_id + ')">'
        + '✓ Log Prints'
        + '</button>'
        + '</div>';
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div class="svc-empty" style="grid-column:1/-1">Error loading printers.</div>';
  }
}

async function submitLog2(printerId) {
  var countEl = document.getElementById('log2-count-' + printerId);
  var noteEl  = document.getElementById('log2-note-'  + printerId);
  var btn     = document.getElementById('log2-btn-'   + printerId);
  var count   = parseInt(countEl.value);
  if (isNaN(count) || count < 0) { toast('❌', 'Enter a valid print count (0 or more)', ''); return; }
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    await api('POST', '/requests/print-logs', {
      printer_id:  printerId,
      print_count: count,
      notes:       noteEl.value || null
    });
    document.getElementById('log2-card-' + printerId).classList.add('log2-card-done');
    btn.textContent = '✅ Logged — ' + count.toLocaleString() + ' prints';
    toast('✅', 'Logged!', count.toLocaleString() + ' prints');
    loadLogHistory();
  } catch(e) {
    btn.textContent = '✓ Log Prints';
    btn.disabled = false;
  }
}

async function submitAllLogs() {
  var btn = document.getElementById('log2-submit-all-btn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;
  var count = 0;
  for (var i = 0; i < _logPrinters.length; i++) {
    var p  = _logPrinters[i];
    var el = document.getElementById('log2-count-' + p.printer_id);
    if (el && el.value !== '' && !isNaN(parseInt(el.value))) {
      try {
        await api('POST', '/requests/print-logs', {
          printer_id:  p.printer_id,
          print_count: parseInt(el.value),
          notes:       (document.getElementById('log2-note-' + p.printer_id) || {}).value || null
        });
        var card = document.getElementById('log2-card-' + p.printer_id);
        if (card) card.classList.add('log2-card-done');
        document.getElementById('log2-btn-' + p.printer_id).textContent = '✅ Logged';
        count++;
      } catch(e) {}
    }
  }
  btn.textContent = '✓ Submit All';
  btn.disabled = false;
  if (count) {
    toast('✅', count + ' printers logged!', 'End of day report submitted');
    loadLogHistory();
  } else {
    toast('❌', 'Enter at least one print count', '');
  }
}

async function loadLogHistory() {
  var tbody = document.getElementById('log2-history-tbody');
  try {
    var logs = await silentApi('GET', '/requests/my-print-logs');
    logs = logs || [];
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="emptys">No print logs yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(function(l) {
      var d = new Date(l.log_date + 'T00:00:00');
      return '<tr>'
        + '<td style="font-size:11px;color:var(--t2)">' + d.toLocaleDateString('en-GB', {weekday:'short',day:'2-digit',month:'short'}) + '</td>'
        + '<td><span style="font-family:var(--m);font-weight:700;color:var(--c1)">' + l.printer_code + '</span></td>'
        + '<td><span style="font-size:11px;padding:2px 7px;background:#f1f5f9;border-radius:4px">Branch ' + l.branch_code + '</span></td>'
        + '<td style="font-family:var(--m);font-size:15px;font-weight:800;color:var(--tx)">' + l.print_count.toLocaleString() + '</td>'
        + '<td style="font-size:11px;color:var(--t3)">' + (l.notes || '—') + '</td>'
        + '</tr>';
    }).join('');
  } catch(e) {}
}

/* ── Legacy stubs ───────────────────────────────────────── */
async function loadPrintLog() { loadService(); }
async function loadRepPrinters() {
  var bid = document.getElementById('r-branch').value;
  var ps  = document.getElementById('r-printer');
  ps.innerHTML = '<option value="">— Select Printer —</option>';
  if (!bid) return;
  try {
    var prs = await api('GET', '/printers/branch/' + bid);
    prs.forEach(function(p) {
      ps.add(new Option(p.printer_code + ' (' + (p.current_pct != null ? p.current_pct : 0) + '% toner)', p.printer_id));
    });
  } catch(e) {}
}
async function submitReplacement() {
  var pid   = document.getElementById('r-printer').value;
  var mid   = document.getElementById('r-model').value;
  var yld   = parseInt(document.getElementById('r-yield').value) || 3000;
  var daily = parseInt(document.getElementById('r-daily').value) || 150;
  var notes = document.getElementById('r-notes').value;
  if (!pid || !mid) { toast('❌', 'Select printer and toner model', ''); return; }
  try {
    var r = await api('POST', '/toner/install', {
      printer_id: parseInt(pid), toner_model_id: parseInt(mid),
      yield_copies: yld, avg_daily_copies: daily, notes: notes
    });
    toast('✅', 'Toner replaced successfully!', 'Stock balance: ' + r.new_stock_balance);
    loadService();
  } catch(e) {}
}
function openNewRequest(prefillPrinterId, prefillCode, prefillType) {
  switchSvcTab('new');
  if (prefillType) setTimeout(function(){ switchNReqType(prefillType); }, 60);
}

/* Set today's date label */
(function() {
  var el = document.getElementById('log2-date-label');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
})();