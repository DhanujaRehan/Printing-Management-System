/* ============================================================
   TonerPro Ultra — Printers Module
   File: js/printers.js
   ============================================================ */

// ── Tab switching ─────────────────────────────────────────
function switchPrTab(tab) {
  const isPrinters = tab === 'printers';

  document.getElementById('pr-panel-printers').style.display = isPrinters ? '' : 'none';
  document.getElementById('pr-panel-paper').style.display    = isPrinters ? 'none' : '';
  document.getElementById('pr-actions-printers').style.display = isPrinters ? '' : 'none';
  document.getElementById('pr-actions-paper').style.display    = isPrinters ? 'none' : '';

  document.getElementById('tab-printers').className = 'pr-tab' + (isPrinters ? ' pr-tab-act' : '');
  document.getElementById('tab-paper').className    = 'pr-tab' + (!isPrinters ? ' pr-tab-act' : '');

  if (!isPrinters) loadPaperLevels();
}


async function loadPrinters() {
  const tbody = document.getElementById('prmgmt-tbody');
  tbody.innerHTML = '<tr><td colspan="9"><div class="loading"><div class="spin"></div>Loading...</div></td></tr>';

  try {
    const [printers, branches] = await Promise.all([
      api('GET', '/printers'),
      api('GET', '/branches'),
    ]);

    // Populate branch filter dropdown
    const bf = document.getElementById('pr-filter-branch');
    if (bf.options.length <= 1) {
      branches.forEach(b => bf.add(new Option(`Branch ${b.code}`, b.id)));
    }

    const bid      = bf.value;
    const filtered = bid ? printers.filter(p => String(p.branch_id) === bid) : printers;
    const canEdit  = APP.user.role === 'manager' || APP.user.role === 'dba';

    tbody.innerHTML = filtered.map(p => {
      const pJson = JSON.stringify({
        id: p.printer_id, branch_id: p.branch_id,
        printer_code: p.printer_code, model: p.printer_model, location_note: p.location_note
      }).replace(/'/g, "&#39;");

      return `<tr>
        <td><span style="font-family:var(--m);font-weight:700;color:var(--c1)">${p.printer_code}</span></td>
        <td><span style="font-size:11px;padding:3px 8px;border-radius:5px;background:#f1f5f9;font-weight:600">Branch ${p.branch_code}</span></td>
        <td style="font-size:12px">${p.printer_model || '—'}</td>
        <td style="font-size:11px;color:var(--t2)">${p.location_note || '—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:7px">
            <div class="pb" style="min-width:55px"><div class="pf ${pfClass(p.current_pct || 0)}" style="width:${p.current_pct || 0}%"></div></div>
            <span style="font-family:var(--m);font-size:11px;font-weight:700;color:${pColor(p.current_pct || 0)}">${p.current_pct || 0}%</span>
          </div>
        </td>
        <td style="font-family:var(--m);font-size:12px;font-weight:700;color:${(p.days_remaining ?? 99) <= 3 ? 'var(--er)' : (p.days_remaining ?? 99) <= 7 ? 'var(--wr)' : 'var(--tx)'}">${p.days_remaining ?? '—'}d</td>
        <td style="font-size:11px;color:var(--t2)">${p.toner_model || '—'}</td>
        <td>${statusTag(p.current_pct || 0, p.days_remaining ?? 99)}</td>
        <td>
          ${canEdit ? `
            <div style="display:flex;gap:5px">
              <button class="btn btn-g btn-sm" onclick='editPrinter(${pJson})'>✏️</button>
              <button class="btn btn-er btn-sm" onclick="deletePrinter(${p.printer_id},'${p.printer_code}')">🗑</button>
            </div>` : '—'}
        </td>
      </tr>`;
    }).join('');

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="emptys">No printers found.</td></tr>';
    }

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="9" class="emptys">Error loading printers.</td></tr>';
  }
}


// ════════════════════════════════════════════════════════════
//  PAPER LEVELS PANEL
// ════════════════════════════════════════════════════════════

async function loadPaperLevels() {
  const container = document.getElementById('paper-levels-container');
  if (!container) return;

  try {
    const levels = await api('GET', '/paper/printer-levels');
    if (!levels.length) {
      container.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--t3)">
          No paper data yet — dispatch paper to branches first, then load into printers.
        </div>`;
      return;
    }

    // Group by branch
    const byBranch = {};
    levels.forEach(r => {
      const key = r.branch_code;
      if (!byBranch[key]) byBranch[key] = { name: r.branch_name, code: r.branch_code, printers: {} };
      const pk = r.printer_id;
      if (!byBranch[key].printers[pk]) {
        byBranch[key].printers[pk] = {
          printer_id: r.printer_id,
          printer_code: r.printer_code,
          printer_model: r.printer_model,
          location_note: r.location_note,
          papers: []
        };
      }
      if (r.paper_type_id) {
        byBranch[key].printers[pk].papers.push({
          paper_type_id: r.paper_type_id,
          paper_name: r.paper_name,
          size: r.size,
          gsm: r.gsm,
          quantity: r.quantity,
          capacity: r.capacity,
        });
      }
    });

    container.innerHTML = Object.values(byBranch).map(branch => `
      <div class="paper-branch-block">
        <div class="paper-branch-hdr">
          <span class="paper-branch-badge">Branch ${branch.code}</span>
          <span class="paper-branch-name">${branch.name}</span>
          <span class="paper-branch-ct">${Object.keys(branch.printers).length} printers</span>
        </div>
        <div class="paper-printers-grid">
          ${Object.values(branch.printers).map(pr => renderPrinterPaperCard(pr)).join('')}
        </div>
      </div>
    `).join('');

  } catch(e) { console.error('loadPaperLevels error', e); }
}


function renderPrinterPaperCard(pr) {
  const hasPaper = pr.papers.length > 0;
  const canLoad  = APP.user.role === 'manager' || APP.user.role === 'dba' || APP.user.role === 'service';

  const papersHtml = hasPaper
    ? pr.papers.map(p => renderPaperTray(p)).join('')
    : `<div class="paper-empty-tray">
        <div class="paper-tray-shell empty-shell"></div>
        <div style="font-size:10px;color:var(--t3);margin-top:8px;text-align:center">No paper loaded</div>
       </div>`;

  return `
    <div class="printer-paper-card">
      <div class="ppc-header">
        <div>
          <div class="ppc-code">${pr.printer_code}</div>
          <div class="ppc-model">${pr.printer_model || ''}</div>
          <div class="ppc-loc">${pr.location_note || ''}</div>
        </div>
        ${canLoad
          ? `<button class="ppc-load-btn" onclick="openLoadPaper(${pr.printer_id},'${pr.printer_code}')">
               + Load Paper
             </button>`
          : ''}
      </div>
      <div class="ppc-trays">
        ${papersHtml}
      </div>
    </div>`;
}


function renderPaperTray(p) {
  const pct     = p.capacity > 0 ? Math.round(p.quantity / p.capacity * 100) : 0;
  const clamped = Math.max(0, Math.min(100, pct));

  // Color thresholds
  const fillColor  = clamped <= 20  ? '#ef4444'
                   : clamped <= 40  ? '#f59e0b'
                   : '#3b82f6';
  const fillColor2 = clamped <= 20  ? '#dc2626'
                   : clamped <= 40  ? '#d97706'
                   : '#1d4ed8';
  const statusTxt  = clamped <= 20  ? 'Critical'
                   : clamped <= 40  ? 'Low'
                   : clamped <= 70  ? 'Good'
                   : 'Full';

  // Paper stack sheets — draw N lines to represent sheets of paper
  const totalLines = 12;
  const filledLines = Math.round(totalLines * clamped / 100);
  const sheetsHtml = Array.from({length: totalLines}, (_, i) => {
    const filled = i < filledLines;
    return `<div class="paper-sheet ${filled ? 'sheet-filled' : 'sheet-empty'}"
      style="${filled ? `background:linear-gradient(90deg,${fillColor2},${fillColor});opacity:${0.6 + i/totalLines*0.4}` : ''}">
    </div>`;
  }).reverse().join(''); // reverse so top sheets are lightest

  return `
    <div class="paper-tray-wrap">
      <div class="paper-tray-shell" title="${p.paper_name}: ${p.quantity}/${p.capacity} reams">
        <div class="paper-tray-inner">
          ${sheetsHtml}
        </div>
        <div class="paper-tray-front" style="background:linear-gradient(180deg,#c8d0da,#a0aab6)"></div>
      </div>
      <div class="paper-tray-info">
        <div class="paper-tray-qty" style="color:${fillColor}">${p.quantity}<span style="font-size:9px;font-weight:400;color:var(--t3)">/${p.capacity}</span></div>
        <div class="paper-tray-label">${p.size}</div>
        <div class="paper-tray-status" style="background:${fillColor}22;color:${fillColor};border:1px solid ${fillColor}44">${statusTxt}</div>
      </div>
    </div>`;
}


// ── Load Paper into Printer modal ─────────────────────────
let _loadPrinterId   = null;
let _loadPrinterCode = '';

async function openLoadPaper(printerId, printerCode) {
  _loadPrinterId   = printerId;
  _loadPrinterCode = printerCode;

  document.getElementById('lp-printer-label').textContent = printerCode;
  document.getElementById('lp-qty').value      = '1';
  document.getElementById('lp-capacity').value = '5';
  document.getElementById('lp-notes').value    = '';

  // Populate paper type dropdown from branch stock
  const sel = document.getElementById('lp-paper-type');
  sel.innerHTML = '<option value="">— Loading... —</option>';
  try {
    const branchStock = await api('GET', '/paper/branch-stock');
    // Try to get this printer's branch by looking at printers data
    const allPrinters = await api('GET', '/printers');
    const thisPrinter = allPrinters.find(p => p.printer_id === printerId);
    const branchId    = thisPrinter ? thisPrinter.branch_id : null;

    const relevant = branchId
      ? branchStock.filter(s => String(s.branch_id) === String(branchId) && s.quantity > 0)
      : branchStock.filter(s => s.quantity > 0);

    sel.innerHTML = '<option value="">— Select Paper Type —</option>';
    if (relevant.length) {
      relevant.forEach(s =>
        sel.add(new Option(`${s.paper_name}  (${s.quantity} reams at branch)`, s.paper_type_id || s.id))
      );
    } else {
      sel.innerHTML = '<option value="">No paper at this branch — dispatch first</option>';
    }
  } catch(e) {
    sel.innerHTML = '<option value="">Error loading paper types</option>';
  }

  openModal('m-load-printer-paper');
}


async function doLoadPrinterPaper() {
  const typeId   = document.getElementById('lp-paper-type').value;
  const qty      = parseInt(document.getElementById('lp-qty').value);
  const capacity = parseInt(document.getElementById('lp-capacity').value);
  const notes    = document.getElementById('lp-notes').value;

  if (!typeId || !qty || qty <= 0) {
    toast('❌', 'Select paper type and enter quantity', '');
    return;
  }
  try {
    await api('POST', '/paper/printer-levels/load', {
      paper_type_id: parseInt(typeId),
      printer_id:    _loadPrinterId,
      quantity:      qty,
      capacity:      capacity || 5,
      notes:         notes || null
    });
    closeModal('m-load-printer-paper');
    toast('📄', `${qty} reams loaded into ${_loadPrinterCode}`, '');
    loadPrinters();
  } catch(e) {}
}


// ── Standard printer CRUD ─────────────────────────────────

async function openAddPrinter() {
  document.getElementById('apr-title').textContent = 'Add Printer';
  document.getElementById('apr-id').value = '';
  document.getElementById('apr-code').value = '';
  document.getElementById('apr-loc').value  = '';
  document.getElementById('apr-model').value = 'HP LaserJet Pro M404';

  const sel = document.getElementById('apr-branch');
  if (sel.options.length <= 1) {
    const branches = await api('GET', '/branches');
    branches.forEach(b => sel.add(new Option(`Branch ${b.code}`, b.id)));
  }
  openModal('m-addPrinter');
}

async function editPrinter(p) {
  document.getElementById('apr-title').textContent = 'Edit Printer';
  document.getElementById('apr-id').value    = p.id;
  document.getElementById('apr-code').value  = p.printer_code;
  document.getElementById('apr-model').value = p.model || '';
  document.getElementById('apr-loc').value   = p.location_note || '';

  const sel = document.getElementById('apr-branch');
  if (sel.options.length <= 1) {
    const branches = await api('GET', '/branches');
    branches.forEach(b => sel.add(new Option(`Branch ${b.code}`, b.id)));
  }
  sel.value = p.branch_id;
  openModal('m-addPrinter');
}

async function savePrinter() {
  const id   = document.getElementById('apr-id').value;
  const body = {
    branch_id:     document.getElementById('apr-branch').value,
    printer_code:  document.getElementById('apr-code').value,
    model:         document.getElementById('apr-model').value,
    location_note: document.getElementById('apr-loc').value,
  };
  if (!body.branch_id || !body.printer_code) {
    toast('❌', 'Branch and printer code required', '');
    return;
  }
  try {
    if (id) await api('PUT', `/printers/${id}`, body);
    else    await api('POST', '/printers', body);
    closeModal('m-addPrinter');
    toast('✅', id ? 'Printer updated' : 'Printer added!', body.printer_code);
    loadPrinters();
  } catch (e) {}
}

async function deletePrinter(id, code) {
  if (!confirm(`Deactivate printer "${code}"?`)) return;
  try {
    await api('DELETE', `/printers/${id}`);
    toast('✅', 'Printer deactivated', code);
    loadPrinters();
  } catch (e) {}
}

function filterPrMgmt(q) {
  filterTable(q, 'prmgmt-tbody');
}