/* ============================================================
   TonerPro Ultra — Stock Module
   File: js/stock.js
   ============================================================ */

async function loadStock() {
  try {
    const [stock, movements] = await Promise.all([
      api('GET', '/toner/stock'),
      api('GET', '/toner/movements?limit=30'),
    ]);

    // ── Tube Visualisation ──────────────────────────────────
    document.getElementById('stock-grid').innerHTML = stock.map(s => {
      const pct  = Math.max(8, Math.min(100, Math.round(s.quantity / 50 * 100)));
      const hex  = s.quantity <= s.min_stock ? '#ef4444'
                 : s.quantity <= s.min_stock * 2 ? '#f59e0b'
                 : '#10b981';
      const hex2 = s.quantity <= s.min_stock ? '#dc2626'
                 : s.quantity <= s.min_stock * 2 ? '#d97706'
                 : '#059669';

      return `
        <div class="stc">
          <div class="stcode">${s.model_code.split(' ').pop()}</div>
          <div style="width:52px;height:120px;margin:0 auto 14px;position:relative">
            <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);width:60%;height:10px;background:linear-gradient(180deg,#c8d0da,#b0bac6);border-radius:6px 6px 0 0;border:1px solid #a0aab6;z-index:3"></div>
            <div style="width:100%;height:100%;border-radius:26px;border:2px solid #d1d5db;background:linear-gradient(135deg,#f0f4f8,#dce3ea);overflow:hidden;position:relative;box-shadow:inset 0 2px 6px rgba(0,0,0,.12)">
              <div style="position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:linear-gradient(0deg,${hex2},${hex});border-radius:0 0 24px 24px;z-index:1"></div>
              <div style="position:absolute;top:8px;left:16%;width:22%;height:72%;background:linear-gradient(180deg,rgba(255,255,255,.75),rgba(255,255,255,.1) 70%,transparent);border-radius:4px;z-index:2;pointer-events:none"></div>
              <div style="position:absolute;top:0;right:8%;width:10%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.3),transparent 60%);border-radius:4px;z-index:2;pointer-events:none"></div>
            </div>
          </div>
          <div class="stqty" style="color:${hex}">${s.quantity}</div>
          <div class="stunit">units</div>
          <div class="stmod">${s.model_code}</div>
          ${s.quantity <= s.min_stock ? '<div class="stlow">⚠ Reorder Now</div>' : ''}
        </div>`;
    }).join('');

    // ── Populate receive modal dropdown ─────────────────────
    const sel = document.getElementById('recv-model');
    sel.innerHTML = '';
    stock.forEach(s => sel.add(new Option(`${s.model_code} (${s.quantity} in stock)`, s.id)));

    // ── Movement Log ────────────────────────────────────────
    document.getElementById('log-ct').textContent = `${movements.length} movements`;
    document.getElementById('stock-log-tbody').innerHTML = movements.map(m => `
      <tr>
        <td style="font-family:var(--m);font-size:11px;color:var(--t3)">${new Date(m.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
        <td>${m.movement_type === 'IN' ? '<span class="tag tg">▲ IN</span>' : '<span class="tag ta">▼ OUT</span>'}</td>
        <td style="font-size:12px">${m.model_code || '—'}</td>
        <td style="font-family:var(--m);font-size:12px">${m.branch_code || '—'}</td>
        <td style="font-family:var(--m);font-size:12px">${m.printer_code || '—'}</td>
        <td style="font-family:var(--m);font-size:13px;font-weight:700;color:${m.quantity > 0 ? 'var(--ok)' : 'var(--er)'}">
          ${m.quantity > 0 ? '+' : ''}${m.quantity}
        </td>
        <td style="font-size:11px;color:var(--t2)">${m.performed_by_name || '—'}</td>
      </tr>`).join('');

  } catch (e) { console.error('Stock load error:', e); }
}


async function doReceive() {
  const tid  = document.getElementById('recv-model').value;
  const qty  = parseInt(document.getElementById('recv-qty').value);
  const notes = document.getElementById('recv-notes').value;

  if (!tid || !qty || qty <= 0) { toast('❌', 'Select model and enter valid quantity', ''); return; }

  try {
    const r = await api('POST', '/toner/stock/receive', {
      toner_model_id: parseInt(tid), quantity: qty, notes
    });
    closeModal('m-receive');
    toast('📦', `${qty} units received`, `New balance: ${r.new_balance}`);
    loadStock();
  } catch (e) {}
}


async function saveTonerModel() {
  const body = {
    model_code:   document.getElementById('am-code').value,
    brand:        document.getElementById('am-brand').value,
    yield_copies: parseInt(document.getElementById('am-yield').value),
    min_stock:    parseInt(document.getElementById('am-min').value),
  };
  if (!body.model_code || !body.yield_copies) {
    toast('❌', 'Model code and yield are required', '');
    return;
  }
  try {
    await api('POST', '/toner/models', body);
    closeModal('m-addModel');
    toast('✅', 'Toner model added', body.model_code);
    loadStock();
  } catch (e) {}
} 