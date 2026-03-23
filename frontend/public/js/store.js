/* ============================================================
   SoftWave — Store Person Dashboard
   File: js/store.js
   ============================================================ */

var _storeTab = 'overview';

async function loadStore() {
  loadDispatchQueue(); // refresh dispatch badge
  switchStoreTab(_storeTab);
}

/* ── Tab switching ─────────────────────────────────────── */
function switchStoreTab(tab) {
  _storeTab = tab;
  ['dispatch','overview','toner','paper','history'].forEach(function(t) {
    var btn   = document.getElementById('store-tab-' + t);
    var panel = document.getElementById('store-panel-' + t);
    if (btn)   btn.className   = 'svc-tab' + (t === tab ? ' svc-tab-act' : '');
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'dispatch') loadDispatchQueue();
  if (tab === 'overview') loadStoreOverview();
  if (tab === 'toner')    loadStoreToner();
  if (tab === 'paper')    loadStorePaper();
  if (tab === 'history')  loadStoreHistory();
}

/* ══════════════════════════════════════════════════════════
   DISPATCH QUEUE TAB — Main job for store keeper
   ══════════════════════════════════════════════════════════ */
async function loadDispatchQueue() {
  var rows = await silentApi('GET', '/requests/approved-toner');
  rows = rows || [];

  var pending    = rows.filter(function(r){ return r.status === 'approved'; });
  var dispatched = rows.filter(function(r){ return r.status === 'dispatched'; });

  /* ── Update badge on tab ── */
  var badge = document.getElementById('store-dispatch-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'store-dispatch-badge';
    badge.style.cssText = 'background:#ef4444;color:#fff;font-size:10px;font-weight:800;'
      + 'padding:2px 7px;border-radius:10px;margin-left:7px;font-family:var(--m);vertical-align:middle';
    var btn = document.getElementById('store-tab-dispatch');
    if (btn) btn.appendChild(badge);
  }
  badge.textContent   = pending.length || '';
  badge.style.display = pending.length ? '' : 'none';

  var container = document.getElementById('store-panel-dispatch-inner') || document.getElementById('store-panel-dispatch');
  if (!container) return;

  var priMap = { critical:'🔴 Critical', urgent:'🟡 Urgent', normal:'🟢 Normal' };

  /* ── Pending section ── */
  var pendingHtml = '';
  if (pending.length) {
    pendingHtml = '<div class="dq-section-hdr dq-section-pending">'
      + '<span class="dq-section-icon">📋</span>'
      + '<div><div class="dq-section-title">Needs Dispatch (' + pending.length + ')</div>'
      + '<div class="dq-section-sub">Manager approved — please prepare and dispatch these toners</div></div>'
      + '</div>'
      + pending.map(function(r) { return buildDispatchCard(r, true, priMap); }).join('');
  } else {
    pendingHtml = '<div class="dq-empty">'
      + '<div style="font-size:40px;margin-bottom:10px">✅</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--tx)">All clear!</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-top:4px">No pending toner dispatches right now.</div>'
      + '</div>';
  }

  /* ── Recent dispatched section ── */
  var doneHtml = '';
  if (dispatched.length) {
    doneHtml = '<div class="dq-section-hdr" style="margin-top:24px;border-color:#bbf7d0;background:#f0fdf4">'
      + '<span class="dq-section-icon" style="background:#dcfce7;color:#16a34a">📦</span>'
      + '<div><div class="dq-section-title" style="color:#15803d">Recently Dispatched (' + dispatched.length + ')</div>'
      + '<div class="dq-section-sub">Stock has been deducted and printer toner updated</div></div>'
      + '</div>'
      + dispatched.map(function(r) { return buildDispatchCard(r, false, priMap); }).join('');
  }

  container.innerHTML = pendingHtml + doneHtml;
}

function buildDispatchCard(r, isPending, priMap) {
  var dt       = new Date(r.requested_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  var dtDisp   = r.dispatched_at ? new Date(r.dispatched_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;
  var priLabel = priMap[r.priority] || r.priority;

  var actionHtml = isPending
    ? '<div class="dq-card-action">'
      +   '<input class="dq-note-input" id="dn-' + r.id + '" placeholder="Dispatch note (optional)...">'
      +   '<button class="dq-dispatch-btn" onclick="storeDispatchToner(' + r.id + ')">'
      +     '📦 Mark as Dispatched'
      +   '</button>'
      + '</div>'
    : '<div class="dq-card-done">'
      +   '<div style="font-size:22px">✅</div>'
      +   '<div>'
      +     '<div style="font-size:12px;font-weight:700;color:#15803d">Dispatched</div>'
      +     (dtDisp ? '<div style="font-size:11px;color:var(--t3)">' + dtDisp + '</div>' : '')
      +     (r.dispatched_by_name ? '<div style="font-size:11px;color:var(--t3)">by ' + r.dispatched_by_name + '</div>' : '')
      +     (r.dispatch_note ? '<div style="font-size:11px;color:#166534;margin-top:3px">💬 ' + r.dispatch_note + '</div>' : '')
      +   '</div>'
      + '</div>';

  return '<div class="dq-card' + (isPending ? ' dq-card-pending' : ' dq-card-done-wrap') + '">'
    + '<div class="dq-card-main">'
    +   '<div class="dq-card-top">'
    +     '<div class="dq-model">' + (r.toner_model_code || 'Toner Cartridge') + '</div>'
    +     '<span class="dq-pri" style="' + (r.priority==='critical'?'background:#fee2e2;color:#b91c1c':r.priority==='urgent'?'background:#fffbeb;color:#92400e':'background:#f0fdf4;color:#15803d') + '">' + priLabel + '</span>'
    +   '</div>'
    +   '<div class="dq-card-meta">'
    +     '<div class="dq-meta-item"><span class="dq-meta-ico">🏢</span>' + r.branch_name + ' <span class="dq-branch-code">' + r.branch_code + '</span></div>'
    +     '<div class="dq-meta-item"><span class="dq-meta-ico">🖨</span>' + r.printer_code + '</div>'
    +     '<div class="dq-meta-item"><span class="dq-meta-ico">👤</span>Req. by ' + (r.requested_by_name||'—') + ' · ' + dt + '</div>'
    +     (r.reviewed_by_name ? '<div class="dq-meta-item"><span class="dq-meta-ico">✅</span>Approved by ' + r.reviewed_by_name + '</div>' : '')
    +   '</div>'
    +   (r.notes ? '<div class="dq-notes">💬 ' + r.notes + '</div>' : '')
    + '</div>'
    + actionHtml
    + '</div>';
}

async function storeDispatchToner(requestId) {
  var noteEl = document.getElementById('dn-' + requestId);
  var note   = noteEl ? noteEl.value.trim() : '';
  var btn    = noteEl ? noteEl.parentElement.querySelector('.dq-dispatch-btn') : null;
  if (btn)   { btn.disabled = true; btn.textContent = '⏳ Dispatching...'; }

  try {
    await api('PATCH', '/requests/' + requestId + '/dispatch', { dispatch_note: note || null });
    toast('📦', 'Toner dispatched!', 'Stock deducted and printer toner updated.');
    loadDispatchQueue();
    loadStoreOverview();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '📦 Mark as Dispatched'; }
  }
}

function updateDispatchOverviewContainer(pending) {
  var c = document.getElementById('store-dispatch-container');
  if (!c) return;
  if (!pending.length) {
    c.innerHTML = '<div style="padding:18px;text-align:center;color:var(--t3);font-size:13px">✅ No pending dispatches.</div>';
    return;
  }
  var priMap = { critical:'🔴', urgent:'🟡', normal:'🟢' };
  c.innerHTML = pending.map(function(r) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap">'
      + '<div style="width:9px;height:9px;border-radius:50%;background:#f59e0b;flex-shrink:0"></div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:13px;font-weight:700;color:var(--tx)">' + (r.toner_model_code||'Toner') + ' '
      +     '<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;font-family:var(--m)">' + r.branch_code + '</span></div>'
      +   '<div style="font-size:11px;color:var(--t3);margin-top:2px">🖨 ' + r.printer_code + ' · ' + (priMap[r.priority]||'') + ' ' + r.priority + '</div>'
      + '</div>'
      + '<button onclick="switchStoreTab(\'dispatch\')" style="padding:7px 14px;background:linear-gradient(135deg,#6366f1,#0ea5e9);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">Go to Dispatch →</button>'
      + '</div>';
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════════ */
async function loadStoreOverview() {
  var [tonerStock, paperStock] = await Promise.all([
    silentApi('GET', '/toner/stock').then(function(r){ return r || []; }),
    silentApi('GET', '/paper/stock').then(function(r){ return r || []; }),
  ]);

  var totalToner = tonerStock.reduce(function(a, s){ return a + s.quantity; }, 0);
  var totalPaper = paperStock.reduce(function(a, s){ return a + s.quantity; }, 0);
  var lowToner   = tonerStock.filter(function(s){ return s.quantity <= s.min_stock; }).length;
  var lowPaper   = paperStock.filter(function(s){ return s.quantity <= s.min_stock; }).length;

  document.getElementById('st-kpi-toner').textContent  = totalToner;
  document.getElementById('st-kpi-paper').textContent  = totalPaper + ' reams';
  document.getElementById('st-kpi-low-t').textContent  = lowToner;
  document.getElementById('st-kpi-low-p').textContent  = lowPaper;

  var tonerGrid = document.getElementById('st-toner-overview');
  if (tonerGrid) tonerGrid.innerHTML = tonerStock.map(function(s) {
    var col = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#10b981';
    var lbl = s.quantity <= s.min_stock ? 'Reorder Now!' : s.quantity <= s.min_stock * 2 ? 'Running Low' : 'In Stock';
    return '<div class="st-stock-card" style="border-top:3px solid ' + col + '">'
      + '<div class="st-stock-model">' + s.model_code + '</div>'
      + '<div class="st-stock-brand">' + (s.brand || '') + '</div>'
      + '<div class="st-stock-num" style="color:' + col + '">' + s.quantity + '</div>'
      + '<div class="st-stock-unit">units</div>'
      + '<div class="st-stock-badge" style="background:' + col + '18;color:' + col + '">' + lbl + '</div>'
      + '<div class="st-stock-min">Min: ' + s.min_stock + '</div>'
      + '</div>';
  }).join('');

  var paperGrid = document.getElementById('st-paper-overview');
  if (paperGrid) paperGrid.innerHTML = paperStock.map(function(s) {
    var col = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#3b82f6';
    var lbl = s.quantity <= s.min_stock ? 'Reorder Now!' : s.quantity <= s.min_stock * 2 ? 'Running Low' : 'In Stock';
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
  stock.forEach(function(s) { sel.add(new Option(s.model_code + '  (' + s.quantity + ' in stock)', s.id)); });
  renderStoreTonerTable(stock);
}

function renderStoreTonerTable(stock) {
  var tbody = document.getElementById('st-toner-tbody');
  if (!stock.length) { tbody.innerHTML = '<tr><td colspan="5" class="emptys">No toner models found.</td></tr>'; return; }
  tbody.innerHTML = stock.map(function(s) {
    var col    = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#10b981';
    var status = s.quantity <= s.min_stock ? '🔴 Reorder'   : s.quantity <= s.min_stock * 2 ? '🟡 Low' : '🟢 OK';
    return '<tr>'
      + '<td><span style="font-family:var(--m);font-weight:700;color:var(--c1)">' + s.model_code + '</span></td>'
      + '<td>' + (s.brand||'—') + '</td>'
      + '<td><span style="font-family:var(--m);font-size:18px;font-weight:800;color:' + col + '">' + s.quantity + '</span> <span style="font-size:11px;color:var(--t3)">units</span></td>'
      + '<td style="font-size:12px;color:var(--t3)">Min: ' + s.min_stock + '</td>'
      + '<td><span style="font-size:12px;font-weight:700;color:' + col + '">' + status + '</span></td>'
      + '</tr>';
  }).join('');
}

async function storeReceiveToner() {
  var tid   = document.getElementById('st-recv-toner-model').value;
  var qty   = parseInt(document.getElementById('st-recv-toner-qty').value);
  var date  = document.getElementById('st-recv-toner-date').value;
  var notes = document.getElementById('st-recv-toner-notes').value;
  if (!tid || !qty || qty <= 0) { toast('❌', 'Select model and enter quantity', ''); return; }
  var fullNotes = (date ? 'Purchase Date: ' + date : '') + (date && notes ? ' | ' : '') + (notes || '');
  try {
    var r = await api('POST', '/toner/stock/receive', { toner_model_id: parseInt(tid), quantity: qty, notes: fullNotes || null });
    document.getElementById('st-recv-toner-qty').value   = '';
    document.getElementById('st-recv-toner-date').value  = '';
    document.getElementById('st-recv-toner-notes').value = '';
    toast('📦', qty + ' toner units received', 'Balance: ' + r.new_balance);
    loadStoreToner(); loadStoreOverview();
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
  var recvSel = document.getElementById('st-recv-paper-type');
  recvSel.innerHTML = '<option value="">— Select Paper Type —</option>';
  stock.forEach(function(s){ recvSel.add(new Option(s.name + ' (' + s.quantity + ' reams)', s.id)); });

  var dispType = document.getElementById('st-disp-paper-type');
  dispType.innerHTML = '<option value="">— Select Paper Type —</option>';
  stock.forEach(function(s){ dispType.add(new Option(s.name + ' (' + s.quantity + ' reams)', s.id)); });

  var dispBranch = document.getElementById('st-disp-branch');
  dispBranch.innerHTML = '<option value="">— Select Branch —</option>';
  branches.filter(function(b){ return b.is_active; }).forEach(function(b){
    dispBranch.add(new Option(b.code + ' — ' + b.name, b.id));
  });
  renderStorePaperTable(stock);
}

function renderStorePaperTable(stock) {
  var tbody = document.getElementById('st-paper-tbody');
  if (!stock.length) { tbody.innerHTML = '<tr><td colspan="5" class="emptys">No paper types found.</td></tr>'; return; }
  tbody.innerHTML = stock.map(function(s) {
    var col    = s.quantity <= s.min_stock ? '#ef4444' : s.quantity <= s.min_stock * 2 ? '#f59e0b' : '#3b82f6';
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
  var date  = document.getElementById('st-recv-paper-date').value;
  var notes = document.getElementById('st-recv-paper-notes').value;
  if (!tid || !qty || qty <= 0) { toast('❌', 'Select paper type and quantity', ''); return; }
  var fullNotes = (date ? 'Purchase Date: ' + date : '') + (date && notes ? ' | ' : '') + (notes || '');
  try {
    var r = await api('POST', '/paper/stock/receive', { paper_type_id: parseInt(tid), quantity: qty, notes: fullNotes || null });
    document.getElementById('st-recv-paper-qty').value   = '';
    document.getElementById('st-recv-paper-date').value  = '';
    document.getElementById('st-recv-paper-notes').value = '';
    toast('📄', qty + ' reams received', 'Balance: ' + r.new_balance);
    loadStorePaper(); loadStoreOverview();
  } catch(e) {}
}

async function storeDispatchPaper() {
  var tid   = document.getElementById('st-disp-paper-type').value;
  var bid   = document.getElementById('st-disp-branch').value;
  var qty   = parseInt(document.getElementById('st-disp-qty').value);
  var notes = document.getElementById('st-disp-notes').value;
  if (!tid || !bid || !qty || qty <= 0) { toast('❌', 'Select paper type, branch and quantity', ''); return; }
  try {
    var r = await api('POST', '/paper/dispatch', { paper_type_id: parseInt(tid), branch_id: parseInt(bid), quantity: qty, notes: notes || null });
    document.getElementById('st-disp-qty').value   = '';
    document.getElementById('st-disp-notes').value = '';
    toast('📦', qty + ' reams dispatched', 'Warehouse: ' + r.warehouse_balance);
    loadStorePaper(); loadStoreOverview();
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

  var tbody1 = document.getElementById('st-toner-history-tbody');
  tbody1.innerHTML = tonerMov.length ? tonerMov.map(function(m) {
    var dt  = new Date(m.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var col = m.movement_type === 'IN' ? '#10b981' : '#f59e0b';
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td>' + (m.movement_type==='IN' ? '<span class="tag tg">▲ IN</span>' : '<span class="tag ta">▼ OUT</span>') + '</td>'
      + '<td style="font-family:var(--m);font-weight:700">' + (m.model_code||'—') + '</td>'
      + '<td>' + (m.branch_code||'—') + '</td>'
      + '<td style="font-family:var(--m);font-size:14px;font-weight:800;color:' + col + '">' + (m.movement_type==='IN'?'+':'') + m.quantity + '</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (m.performed_by_name||'—') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" class="emptys">No toner movements yet.</td></tr>';

  var tbody2 = document.getElementById('st-paper-history-tbody');
  tbody2.innerHTML = paperMov.length ? paperMov.map(function(m) {
    var dt  = new Date(m.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var col = m.movement_type === 'IN' ? '#3b82f6' : '#f59e0b';
    return '<tr>'
      + '<td style="font-size:11px;color:var(--t3)">' + dt + '</td>'
      + '<td>' + (m.movement_type==='IN' ? '<span class="tag tb">▲ IN</span>' : '<span class="tag ta">▼ OUT</span>') + '</td>'
      + '<td style="font-weight:700">' + (m.paper_name||'—') + '</td>'
      + '<td>' + (m.branch_code||'—') + '</td>'
      + '<td style="font-family:var(--m);font-size:14px;font-weight:800;color:' + col + '">' + (m.movement_type==='IN'?'+':'') + m.quantity + ' reams</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (m.performed_by_name||'—') + '</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="6" class="emptys">No paper movements yet.</td></tr>';
}