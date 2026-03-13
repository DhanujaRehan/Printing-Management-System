/* ============================================================
   TonerPro Ultra — Service / Toner Replacement Module
   File: js/service.js
   ============================================================ */

async function loadService() {
  try {
    const [branches, stock, alerts, movements] = await Promise.all([
      api('GET', '/branches'),
      api('GET', '/toner/stock'),
      api('GET', '/toner/alerts'),
      api('GET', '/toner/movements?limit=10'),
    ]);

    // ── Branch dropdown ────────────────────────────────────
    const bs = document.getElementById('r-branch');
    bs.innerHTML = '<option value="">— Select Branch —</option>';
    branches.forEach(b => bs.add(new Option(`Branch ${b.code}`, b.id)));

    // ── Toner model dropdown ───────────────────────────────
    const ms = document.getElementById('r-model');
    ms.innerHTML = '<option value="">— Select Model —</option>';
    stock.forEach(s => ms.add(new Option(`${s.model_code} (${s.quantity} available)`, s.id)));

    // ── Urgent replacements list ───────────────────────────
    const urg = alerts.filter(p => p.days_remaining <= 5);
    document.getElementById('urgent-list').innerHTML = urg.length
      ? urg.map(p => `
          <div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #f1f5f9">
            <span class="sdot sdr"></span>
            <div style="flex:1">
              <div style="font-family:var(--m);font-size:13px;font-weight:700;color:var(--er)">${p.printer_code}</div>
              <div style="font-size:10px;color:var(--t2)">${p.toner_model} · Branch ${p.branch_code}</div>
            </div>
            <span style="font-family:var(--m);font-size:11px;font-weight:700;color:${(p.days_remaining || 0) <= 2 ? 'var(--er)' : 'var(--wr)'}">
              ${p.days_remaining ?? 0}d
            </span>
          </div>`).join('')
      : '<div style="font-size:12px;color:var(--t3);padding:8px">✅ No urgent replacements!</div>';

    // ── My recent log ──────────────────────────────────────
    const mine = movements.filter(m =>
      m.performed_by_name === APP.user.full_name && m.movement_type === 'OUT'
    );
    document.getElementById('my-log').innerHTML = mine.length
      ? mine.slice(0, 5).map(m => `
          <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
            <div>
              <span style="font-family:var(--m);font-weight:700;color:var(--c1)">${m.printer_code || '—'}</span>
              <span style="color:var(--t2);margin-left:8px">${m.model_code}</span>
            </div>
            <span style="font-size:10px;color:var(--t3)">${new Date(m.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>
          </div>`).join('')
      : '<div style="font-size:12px;color:var(--t3);padding:8px">No replacements yet.</div>';

    // ── Available stock list ───────────────────────────────
    document.getElementById('avail-stock').innerHTML = stock.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
        <span style="color:var(--t2)">${s.model_code}</span>
        <span class="tag ${s.quantity <= s.min_stock ? 'tr' : s.quantity <= s.min_stock * 2 ? 'ta' : 'tg'}"
              style="font-family:var(--m)">${s.quantity} units</span>
      </div>`).join('');

  } catch (e) { console.error('Service load error:', e); }
}


async function loadRepPrinters() {
  const bid = document.getElementById('r-branch').value;
  const ps  = document.getElementById('r-printer');
  ps.innerHTML = '<option value="">— Select Printer —</option>';
  if (!bid) return;

  try {
    const prs = await api('GET', `/printers/branch/${bid}`);
    prs.forEach(p => ps.add(new Option(`${p.printer_code} (${p.current_pct ?? 0}% toner)`, p.printer_id)));
  } catch (e) {}
}


async function submitReplacement() {
  const pid   = document.getElementById('r-printer').value;
  const mid   = document.getElementById('r-model').value;
  const yld   = parseInt(document.getElementById('r-yield').value) || 3000;
  const daily = parseInt(document.getElementById('r-daily').value) || 150;
  const notes = document.getElementById('r-notes').value;

  if (!pid || !mid) { toast('❌', 'Select printer and toner model', ''); return; }

  try {
    const r = await api('POST', '/toner/install', {
      printer_id: parseInt(pid), toner_model_id: parseInt(mid),
      yield_copies: yld, avg_daily_copies: daily, notes
    });
    toast('✅', 'Toner replaced successfully!', `Stock balance: ${r.new_stock_balance} units`);
    loadService();
  } catch (e) {}
}
