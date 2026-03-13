/* ============================================================
   TonerPro Ultra — Paper Stock Module
   File: js/paper.js
   ============================================================ */

let _paperTypes = [];
let _branches   = [];


// ── Load paper page ───────────────────────────────────────
async function loadPaper() {
  try {
    const [stock, branchStock, movements, branches] = await Promise.all([
      api('GET', '/paper/stock'),
      api('GET', '/paper/branch-stock'),
      api('GET', '/paper/movements?limit=40'),
      api('GET', '/branches'),
    ]);

    _branches = branches;
    renderWarehouseGrid(stock);
    renderBranchStock(branchStock);
    renderPaperLog(movements);
    populatePaperDropdowns(stock, branches);

  } catch (e) { console.error('Paper load error:', e); }
}


// ── Warehouse stock cards — blue tubes, same style as toner ──
function renderWarehouseGrid(stock) {
  const grid = document.getElementById('paper-grid');
  if (!stock.length) {
    grid.innerHTML = `<div style="padding:30px;color:var(--t3);text-align:center;grid-column:1/-1">No paper types added yet — click "+ Paper Type" to get started.</div>`;
    return;
  }
  // Max scale: 200 reams = 100% fill
  const MAX = 200;
  grid.innerHTML = stock.map(s => {
    const pct  = Math.max(8, Math.min(100, Math.round(s.quantity / MAX * 100)));
    const hex  = s.quantity <= s.min_stock         ? '#ef4444'
               : s.quantity <= s.min_stock * 2     ? '#f59e0b'
               : '#3b82f6';
    const hex2 = s.quantity <= s.min_stock         ? '#dc2626'
               : s.quantity <= s.min_stock * 2     ? '#d97706'
               : '#1d4ed8';

    return `
      <div class="stc">
        <div class="stcode">${s.size} · ${s.gsm}gsm</div>
        <div style="width:52px;height:120px;margin:0 auto 14px;position:relative">
          <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);width:60%;height:10px;background:linear-gradient(180deg,#c8d0da,#b0bac6);border-radius:6px 6px 0 0;border:1px solid #a0aab6;z-index:3"></div>
          <div style="width:100%;height:100%;border-radius:26px;border:2px solid #d1d5db;background:linear-gradient(135deg,#f0f4f8,#dce3ea);overflow:hidden;position:relative;box-shadow:inset 0 2px 6px rgba(0,0,0,.12)">
            <div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:linear-gradient(0deg,${hex2},${hex});border-radius:0 0 24px 24px;z-index:1"></div>
            <div style="position:absolute;top:8px;left:16%;width:22%;height:72%;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,.1) 70%,transparent);border-radius:4px;z-index:2;pointer-events:none"></div>
            <div style="position:absolute;top:0;right:8%;width:10%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.3),transparent 60%);border-radius:4px;z-index:2;pointer-events:none"></div>
          </div>
        </div>
        <div class="stqty" style="color:${hex}">${s.quantity}</div>
        <div class="stunit">reams</div>
        <div class="stmod">${s.name}</div>
        ${s.quantity <= s.min_stock ? '<div class="stlow">⚠ Reorder Now</div>' : ''}
      </div>`;
  }).join('');
}


// ── Branch stock table ────────────────────────────────────
function renderBranchStock(rows) {
  const tbody = document.getElementById('paper-branch-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:20px">No paper dispatched to branches yet</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const qtyCol = r.quantity <= 5  ? '#ef4444'
                 : r.quantity <= 15 ? '#f59e0b'
                 : '#10b981';
    return `
    <tr>
      <td><span class="tag tb">${r.branch_code}</span>&nbsp;${r.branch_name}</td>
      <td style="font-size:12px;font-weight:600">${r.paper_name}</td>
      <td style="font-size:11px;color:var(--t3)">${r.size} · ${r.gsm}gsm</td>
      <td style="font-family:var(--m);font-weight:700;color:${qtyCol}">${r.quantity} reams</td>
      <td style="font-size:10px;color:var(--t3)">${new Date(r.updated_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
    </tr>`;
  }).join('');
}


// ── Movement log ──────────────────────────────────────────
function renderPaperLog(movements) {
  document.getElementById('paper-log-ct').textContent = `${movements.length} movements`;
  document.getElementById('paper-log-tbody').innerHTML = movements.length
    ? movements.map(m => `
      <tr>
        <td style="font-family:var(--m);font-size:11px;color:var(--t3)">
          ${new Date(m.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
        </td>
        <td>${m.movement_type === 'IN'
          ? '<span class="tag tg">▲ IN</span>'
          : '<span class="tag ta">▼ OUT</span>'}</td>
        <td style="font-size:12px">
          ${m.paper_name || '—'}
          <span style="font-size:10px;color:var(--t3)">${m.size ? m.size + ' ' + m.gsm + 'gsm' : ''}</span>
        </td>
        <td style="font-family:var(--m);font-size:12px">${m.branch_code || '—'}</td>
        <td style="font-family:var(--m);font-size:12px">${m.printer_code || '—'}</td>
        <td style="font-family:var(--m);font-size:13px;font-weight:700;color:${m.movement_type === 'IN' ? '#10b981' : '#f59e0b'}">
          ${m.movement_type === 'IN' ? '+' : '-'}${m.quantity}
        </td>
        <td style="font-size:11px;color:var(--t2)">${m.performed_by_name || '—'}</td>
      </tr>`)
    .join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:20px">No movements yet</td></tr>`;
}


// ── Populate modal dropdowns ──────────────────────────────
function populatePaperDropdowns(stock, branches) {
  // Receive modal — paper type selector
  const recvSel = document.getElementById('pr-recv-type');
  recvSel.innerHTML = '<option value="">— Select Type —</option>';
  stock.forEach(s => recvSel.add(new Option(`${s.name}  (${s.quantity} reams in stock)`, s.id)));

  // Dispatch modal — paper type selector
  const dispType = document.getElementById('pr-disp-type');
  dispType.innerHTML = '<option value="">— Select Type —</option>';
  stock.forEach(s => dispType.add(new Option(`${s.name}  (${s.quantity} reams available)`, s.id)));

  // Dispatch modal — branch selector
  const dispBranch = document.getElementById('pr-disp-branch');
  dispBranch.innerHTML = '<option value="">— Select Branch —</option>';
  branches.filter(b => b.is_active).forEach(b =>
    dispBranch.add(new Option(`${b.code} — ${b.name}`, b.id))
  );
}


// ── Load printers for selected branch (dispatch modal) ────
async function loadPaperPrinters() {
  const branchId = document.getElementById('pr-disp-branch').value;
  const sel = document.getElementById('pr-disp-printer');
  sel.innerHTML = '<option value="">— Whole Branch (no specific printer) —</option>';
  if (!branchId) return;
  try {
    // Uses the existing /api/printers/branch/{id} endpoint
    const printers = await api('GET', `/printers/branch/${branchId}`);
    printers.forEach(p =>
      sel.add(new Option(`${p.printer_code}  —  ${p.printer_model || p.model || ''}`, p.printer_id || p.id))
    );
  } catch(e) { console.error('loadPaperPrinters error', e); }
}


// ── Receive paper into warehouse ──────────────────────────
async function doReceivePaper() {
  const typeId = document.getElementById('pr-recv-type').value;
  const qty    = parseInt(document.getElementById('pr-recv-qty').value);
  const notes  = document.getElementById('pr-recv-notes').value;

  if (!typeId || !qty || qty <= 0) {
    toast('❌', 'Select paper type and enter a valid quantity', '');
    return;
  }
  try {
    const r = await api('POST', '/paper/stock/receive', {
      paper_type_id: parseInt(typeId),
      quantity: qty,
      notes: notes || null
    });
    closeModal('m-paper-receive');
    toast('📄', `${qty} reams received into warehouse`, `New balance: ${r.new_balance} reams`);
    loadPaper();
  } catch(e) {}
}


// ── Dispatch paper to branch ──────────────────────────────
async function doDispatchPaper() {
  const typeId    = document.getElementById('pr-disp-type').value;
  const branchId  = document.getElementById('pr-disp-branch').value;
  const printerId = document.getElementById('pr-disp-printer').value;
  const qty       = parseInt(document.getElementById('pr-disp-qty').value);
  const notes     = document.getElementById('pr-disp-notes').value;

  if (!typeId || !branchId || !qty || qty <= 0) {
    toast('❌', 'Select paper type, branch and enter a valid quantity', '');
    return;
  }
  try {
    const r = await api('POST', '/paper/dispatch', {
      paper_type_id: parseInt(typeId),
      branch_id:     parseInt(branchId),
      printer_id:    printerId ? parseInt(printerId) : null,
      quantity:      qty,
      notes:         notes || null
    });
    closeModal('m-paper-dispatch');
    toast('📦', `${qty} reams dispatched to branch`, `Warehouse balance: ${r.warehouse_balance} reams`);
    loadPaper();
  } catch(e) {}
}


// ── Add paper type ────────────────────────────────────────
async function savePaperType() {
  const name     = document.getElementById('pt-name').value.trim();
  const size     = document.getElementById('pt-size').value;
  const gsm      = parseInt(document.getElementById('pt-gsm').value);
  const minStock = parseInt(document.getElementById('pt-min').value);

  if (!name || !gsm) {
    toast('❌', 'Name and GSM are required', '');
    return;
  }
  try {
    await api('POST', '/paper/types', { name, size, gsm, min_stock: minStock });
    closeModal('m-paper-type');
    // clear form
    ['pt-name','pt-gsm','pt-min'].forEach(id => document.getElementById(id).value = '');
    toast('✅', 'Paper type added', name);
    loadPaper();
  } catch(e) {}
}