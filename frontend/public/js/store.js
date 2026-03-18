/* ============================================================
   SoftWave — Store Person Dashboard
   File: js/store.js
   ============================================================ */

var _storeTab = 'overview';

async function loadStore() {
  switchStoreTab(_storeTab);
  loadStoreOverview();
}

/* ── Tab switching ─────────────────────────────────────── */
function switchStoreTab(tab) {
  _storeTab = tab;
  ['overview','toner','paper','history'].forEach(function(t) {
    var btn   = document.getElementById('store-tab-' + t);
    var panel = document.getElementById('store-panel-' + t);
    if (btn)   btn.className   = 'svc-tab' + (t === tab ? ' svc-tab-act' : '');
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'overview') loadStoreOverview();
  if (tab === 'toner')    loadStoreToner();
  if (tab === 'paper')    loadStorePaper();
  if (tab === 'history')  loadStoreHistory();
}

/* ══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════════ */
async function loadStoreOverview() {
  var [tonerStock, paperStock, movements, paperMovements] = await Promise.all([
    silentApi('GET', '/toner/stock').then(function(r){ return r || []; }),
    silentApi('GET', '/paper/stock').then(function(r){ return r || []; }),
    silentApi('GET', '/toner/movements?limit=8').then(function(r){ return r || []; }),
    silentApi('GET', '/paper/movements?limit=8').then(function(r){ return r || []; }),  // wait, need branch-stock too
  ]);

  // KPIs
  var totalToner  = tonerStock.reduce(function(a, s){ return a + s.quantity; }, 0);
  var totalPaper  = paperStock.reduce(function(a, s){ return a + s.quantity; }, 0);
  var lowToner    = tonerStock.filter(function(s){ return s.quantity <= s.min_stock; }).length;
  var lowPaper    = paperStock.filter(function(s){ return s.quantity <= s.min_stock; }).length;

  document.getElementById('st-kpi-toner').textContent  = totalToner;
  document.getElementById('st-kpi-paper').textContent  = totalPaper + ' reams';
  document.getElementById('st-kpi-low-t').textContent  = lowToner;
  document.getElementById('st-kpi-low-p').textContent  = lowPaper;

  // Toner stock cards
  var tonerGrid = document.getElementById('st-toner-overview');
  tonerGrid.innerHTML = tonerStock.map(function(s) {
    var pct  = Math.max(5, Math.min(100, Math.round(s.quantity / 50 * 100)));
    var col  = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#10b981';
    var lbl  = s.quantity <= s.min_stock ? 'Reorder Now!' : s.quantity <= s.min_stock * 2 ? 'Running Low' : 'In Stock';
    return '<div class="st-stock-card" style="border-top:3px solid ' + col + '">'
      + '<div class="st-stock-model">' + s.model_code + '</div>'
      + '<div class="st-stock-brand">' + (s.brand || '') + '</div>'
      + '<div class="st-stock-num" style="color:' + col + '">' + s.quantity + '</div>'
      + '<div class="st-stock-unit">units</div>'
      + '<div class="st-stock-badge" style="background:' + col + '18;color:' + col + '">' + lbl + '</div>'
      + '<div class="st-stock-min">Min: ' + s.min_stock + '</div>'
      + '</div>';
  }).join('');

  // Paper stock cards
  var paperGrid = document.getElementById('st-paper-overview');
  paperGrid.innerHTML = paperStock.map(function(s) {
    var col  = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#3b82f6';
    var lbl  = s.quantity <= s.min_stock ? 'Reorder Now!' : s.quantity <= s.min_stock * 2 ? 'Running Low' : 'In Stock';
    return '<div class="st-stock-card" style="border-top:3px solid ' + col + '">'
      + '<div class="st-stock-model">' + s.name + '</div>'
      + '<div class="st-stock-brand">' + s.size + ' · ' + s.gsm + 'gsm</div>'
      + '<div class="st-stock-num" style="color:' + col + '">' + s.quantity + '</div>'
      + '<div class="st-stock-unit">reams</div>'
      + '<div class="st-stock-badge" style="background:' + col + '18;color:' + col + '">' + lbl + '</div>'
      + '<div class="st-stock-min">Min: ' + s.min_stock + '</div>'
      + '</div>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   TONER TAB — Receive & Manage
   ══════════════════════════════════════════════════════════ */
async function loadStoreToner() {
  var stock = await silentApi('GET', '/toner/stock').then(function(r){ return r || []; });

  var sel = document.getElementById('st-recv-toner-model');
  sel.innerHTML = '<option value="">— Select Toner Model —</option>';
  stock.forEach(function(s) {
    sel.add(new Option(s.model_code + '  (' + s.quantity + ' in stock)', s.id));
  });

  renderStoreTonerTable(stock);
}

function renderStoreTonerTable(stock) {
  var tbody = document.getElementById('st-toner-tbody');
  if (!stock.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="emptys">No toner models found.</td></tr>';
    return;
  }
  tbody.innerHTML = stock.map(function(s) {
    var col = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#10b981';
    var status = s.quantity <= s.min_stock ? '🔴 Reorder' : s.quantity <= s.min_stock * 2 ? '🟡 Low' : '🟢 OK';
    return '<tr>'
      + '<td><span style="font-family:var(--m);font-weight:700;color:var(--c1)">' + s.model_code + '</span></td>'
      + '<td>' + (s.brand || '—') + '</td>'
      + '<td><span style="font-family:var(--m);font-size:18px;font-weight:800;color:' + col + '">' + s.quantity + '</span> <span style="font-size:11px;color:var(--t3)">units</span></td>'
      + '<td style="font-size:12px;color:var(--t3)">Min: ' + s.min_stock + '</td>'
      + '<td><span style="font-size:12px;font-weight:700;color:' + col + '">' + status + '</span></td>'
      + '</tr>';
  }).join('');
}

async function storeReceiveToner() {
  var tid   = document.getElementById('st-recv-toner-model').value;
  var qty   = parseInt(document.getElementById('st-recv-toner-qty').value);
  var notes = document.getElementById('st-recv-toner-notes').value;
  if (!tid || !qty || qty <= 0) { toast('❌', 'Select model and enter quantity', ''); return; }
  try {
    var r = await api('POST', '/toner/stock/receive', { toner_model_id: parseInt(tid), quantity: qty, notes: notes || null });
    document.getElementById('st-recv-toner-qty').value   = '';
    document.getElementById('st-recv-toner-notes').value = '';
    toast('📦', qty + ' toner units received into warehouse', 'New balance: ' + r.new_balance);
    loadStoreToner();
    loadStoreOverview();
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════════
   PAPER TAB — Receive & Dispatch
   ══════════════════════════════════════════════════════════ */
async function loadStorePaper() {
  var [stock, branches] = await Promise.all([
    silentApi('GET', '/paper/stock').then(function(r){ return r || []; }),
    silentApi('GET', '/branches').then(function(r){ return r || []; }),
  ]);

  // Populate receive dropdown
  var recvSel = document.getElementById('st-recv-paper-type');
  recvSel.innerHTML = '<option value="">— Select Paper Type —</option>';
  stock.forEach(function(s) { recvSel.add(new Option(s.name + ' (' + s.quantity + ' reams)', s.id)); });

  // Populate dispatch dropdowns
  var dispType = document.getElementById('st-disp-paper-type');
  dispType.innerHTML = '<option value="">— Select Paper Type —</option>';
  stock.forEach(function(s) { dispType.add(new Option(s.name + ' (' + s.quantity + ' reams available)', s.id)); });

  var dispBranch = document.getElementById('st-disp-branch');
  dispBranch.innerHTML = '<option value="">— Select Branch —</option>';
  branches.filter(function(b){ return b.is_active; }).forEach(function(b) {
    dispBranch.add(new Option(b.code + ' — ' + b.name, b.id));
  });

  renderStorePaperTable(stock);
}

function renderStorePaperTable(stock) {
  var tbody = document.getElementById('st-paper-tbody');
  if (!stock.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="emptys">No paper types found.</td></tr>';
    return;
  }
  tbody.innerHTML = stock.map(function(s) {
    var col = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#3b82f6';
    var status = s.quantity <= s.min_stock ? '🔴 Reorder' : s.quantity <= s.min_stock * 2 ? '🟡 Low' : '🔵 OK';
    return '<tr>'
      + '<td><span style="font-weight:700;color:var(--tx)">' + s.name + '</span></td>'
      + '<td>' + s.size + ' · ' + s.gsm + 'gsm</td>'
      + '<td><span style="font-family:var(--m);font-size:18px;font-weight:800;color:' + col + '">' + s.quantity + '</span> <span style="font-size:11px;color:var(--t3)">reams</span></td>'
      + '<td style="font-size:12px;color:var(--t3)">Min: ' + s.min_stock + '</td>'
      + '<td><span style="font-size:12px;font-weight:700;color:' + col + '">' + status + '</span></td>'
      + '</tr>';
  }).join('');
}

async function storeReceivePaper() {
  var tid   = document.getElementById('st-recv-paper-type').value;
  var qty   = parseInt(document.getElementById('st-recv-paper-qty').value);
  var notes = document.getElementById('st-recv-paper-notes').value;
  if (!tid || !qty || qty <= 0) { toast('❌', 'Select paper type and enter quantity', ''); return; }
  try {
    var r = await api('POST', '/paper/stock/receive', { paper_type_id: parseInt(tid), quantity: qty, notes: notes || null });
    document.getElementById('st-recv-paper-qty').value   = '';
    document.getElementById('st-recv-paper-notes').value = '';
    toast('📄', qty + ' reams received into warehouse', 'New balance: ' + r.new_balance);
    loadStorePaper();
    loadStoreOverview();
  } catch(e) {}
}

async function storeDispatchPaper() {
  var tid    = document.getElementById('st-disp-paper-type').value;
  var bid    = document.getElementById('st-disp-branch').value;
  var qty    = parseInt(document.getElementById('st-disp-qty').value);
  var notes  = document.getElementById('st-disp-notes').value;
  if (!tid || !bid || !qty || qty <= 0) { toast('❌', 'Select paper type, branch and enter quantity', ''); return; }
  try {
    var r = await api('POST', '/paper/dispatch', {
      paper_type_id: parseInt(tid), branch_id: parseInt(bid),
      quantity: qty, notes: notes || null
    });
    document.getElementById('st-disp-qty').value   = '';
    document.getElementById('st-disp-notes').value = '';
    toast('📦', qty + ' reams dispatched to branch', 'Warehouse balance: ' + r.warehouse_balance);
    loadStorePaper();
    loadStoreOverview();
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════════
   HISTORY TAB
   ══════════════════════════════════════════════════════════ */
async function loadStoreHistory() {
  var [tonerMov, paperMov] = await Promise.all([
    silentApi('GET', '/toner/movements?limit=30').then(function(r){ return r || []; }),
    silentApi('GET', '/paper/movements?limit=30').then(function(r){ return r || []; }),
  ]);

  // Toner history
  var tbody1 = document.getElementById('st-toner-history-tbody');
  tbody1.innerHTML = tonerMov.length ? tonerMov.map(function(m) {
    var dt = new Date(m.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var col = m.movement_type === 'IN' ? '#10b981' : '#f59e0b';
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td>' + (m.movement_type === 'IN' ? '<span class="tag tg">▲ IN</span>' : '<span class="tag ta">▼ OUT</span>') + '</td>'
      + '<td style="font-family:var(--m);font-weight:700">' + (m.model_code || '—') + '</td>'
      + '<td>' + (m.branch_code || '—') + '</td>'
      + '<td style="font-family:var(--m);font-size:14px;font-weight:800;color:' + col + '">'
      + (m.movement_type === 'IN' ? '+' : '') + m.quantity + '</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (m.performed_by_name || '—') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" class="emptys">No toner movements yet.</td></tr>';

  // Paper history
  var tbody2 = document.getElementById('st-paper-history-tbody');
  tbody2.innerHTML = paperMov.length ? paperMov.map(function(m) {
    var dt = new Date(m.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var col = m.movement_type === 'IN' ? '#3b82f6' : '#f59e0b';
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td>' + (m.movement_type === 'IN' ? '<span class="tag tb">▲ IN</span>' : '<span class="tag ta">▼ OUT</span>') + '</td>'
      + '<td style="font-weight:700">' + (m.paper_name || '—') + '</td>'
      + '<td>' + (m.branch_code || '—') + '</td>'
      + '<td style="font-family:var(--m);font-size:14px;font-weight:800;color:' + col + '">'
      + (m.movement_type === 'IN' ? '+' : '') + m.quantity + ' reams</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (m.performed_by_name || '—') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" class="emptys">No paper movements yet.</td></tr>';
}