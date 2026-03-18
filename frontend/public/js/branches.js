/* ============================================================
   SoftWave — Branches Module
   File: js/branches.js
   ============================================================ */

const BR_COLORS = [
  '#0ea5e9','#6366f1','#10b981','#f59e0b','#ec4899',
  '#14b8a6','#8b5cf6','#22c55e','#f97316','#06b6d4'
];

async function loadBranches() {
  const grid = document.getElementById('branch-grid');
  const searchEl = document.getElementById('branch-search');
  if (searchEl) searchEl.value = '';
  grid.innerHTML = '<div class="loading"><div class="spin"></div>Loading branches...</div>';

  try {
    const [branches, printers] = await Promise.all([
      silentApi('GET', '/branches').then(r => r || []),
      silentApi('GET', '/printers').then(r => r || []),
    ]);

    const canEdit = APP.user.role === 'manager' || APP.user.role === 'dba';

    grid.innerHTML = branches.map((b, bi) => {
      const bp  = printers.filter(p => p.branch_id === b.id || p.branch_code === b.code);
      const avg = bp.length ? Math.round(bp.reduce((a, p) => a + (p.current_pct || 0), 0) / bp.length) : 0;
      const col = BR_COLORS[bi % BR_COLORS.length];
      const bJson = JSON.stringify(b).replace(/'/g, "&#39;");

      const critCount = bp.filter(p => (p.current_pct || 0) <= 10).length;
      const lowCount  = bp.filter(p => (p.current_pct || 0) > 10 && (p.current_pct || 0) <= 25).length;
      const goodCount = bp.filter(p => (p.current_pct || 0) > 25).length;

      const avgCol = avg <= 10 ? '#ef4444' : avg <= 25 ? '#f59e0b' : col;

      return `
        <div class="bc" style="border-top:4px solid ${col}">

          <!-- Branch Header -->
          <div class="bchead">
            <div class="bcbadge" style="background:${col}18;color:${col}">${b.code}</div>
            <div style="flex:1;min-width:0">
              <div class="bcn">${b.name}</div>
              <div class="bcs">${b.location || b.name + ' Branch'} · ${bp.length} printer${bp.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="bca">
              ${canEdit ? `<button class="btn btn-g btn-sm" onclick='editBranch(${bJson})'>✏️ Edit</button>` : ''}
              ${canEdit ? `<button class="btn btn-er btn-sm" onclick="deleteBranch(${b.id},'${b.name}')">🗑</button>` : ''}
            </div>
          </div>

          <!-- Branch summary strip -->
          <div class="bc-summary-strip">
            <div class="bc-summary-stat">
              <div class="bc-summary-num" style="color:${avgCol}">${avg}%</div>
              <div class="bc-summary-lbl">Avg Toner</div>
            </div>
            <div class="bc-summary-divider"></div>
            <div class="bc-summary-stat">
              <div class="bc-summary-num" style="color:#10b981">${goodCount}</div>
              <div class="bc-summary-lbl">Good</div>
            </div>
            <div class="bc-summary-stat">
              <div class="bc-summary-num" style="color:#f59e0b">${lowCount}</div>
              <div class="bc-summary-lbl">Low</div>
            </div>
            <div class="bc-summary-stat">
              <div class="bc-summary-num" style="color:#ef4444">${critCount}</div>
              <div class="bc-summary-lbl">Critical</div>
            </div>
          </div>

          <!-- Printer cards -->
          <div class="bc-printer-list">
            ${bp.map(p => {
              const pct  = Math.round(p.current_pct || 0);
              const days = p.days_remaining ?? null;
              const fillCol = pct <= 10 ? '#ef4444' : pct <= 25 ? '#f59e0b' : '#10b981';
              const statusLabel = pct <= 10 ? 'Critical' : pct <= 25 ? 'Low' : pct <= 60 ? 'Good' : 'Full';
              const statusBg    = pct <= 10 ? '#fef2f2'  : pct <= 25 ? '#fffbeb' : '#f0fdf4';

              return `
              <div class="bc-printer-row">
                <div class="bc-pr-left">
                  <div class="bc-pr-dot" style="background:${fillCol}"></div>
                  <div>
                    <div class="bc-pr-code">${p.printer_code}</div>
                    <div class="bc-pr-model">${p.toner_model || '—'}</div>
                  </div>
                </div>
                <div class="bc-pr-right">
                  <div class="bc-pr-pct" style="color:${fillCol}">${pct}%</div>
                  <div class="bc-pr-badge" style="background:${statusBg};color:${fillCol}">${statusLabel}</div>
                  <div class="bc-pr-days">${days !== null ? days + 'd' : '—'}</div>
                </div>
              </div>`;
            }).join('')}
          </div>

        </div>`;
    }).join('');

    if (!branches.length) {
      grid.innerHTML = '<div class="emptys">No branches found.</div>';
    }
  } catch(e) {
    grid.innerHTML = '<div class="emptys">Error loading branches.</div>';
  }
}


function filterBranches(q) {
  const term = q.trim().toLowerCase();
  document.querySelectorAll('#branch-grid .bc').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = (!term || text.includes(term)) ? '' : 'none';
  });
}


function openAddBranch() {
  document.getElementById('abr-title').textContent = 'Add New Branch';
  document.getElementById('abr-id').value = '';
  ['abr-code','abr-name','abr-loc','abr-contact'].forEach(id => document.getElementById(id).value = '');
  openModal('m-addBranch');
}

function editBranch(b) {
  document.getElementById('abr-title').textContent = 'Edit Branch';
  document.getElementById('abr-id').value      = b.id;
  document.getElementById('abr-code').value    = b.code;
  document.getElementById('abr-name').value    = b.name;
  document.getElementById('abr-loc').value     = b.location || '';
  document.getElementById('abr-contact').value = b.contact || '';
  openModal('m-addBranch');
}

async function saveBranch() {
  const id   = document.getElementById('abr-id').value;
  const body = {
    code:     document.getElementById('abr-code').value,
    name:     document.getElementById('abr-name').value,
    location: document.getElementById('abr-loc').value,
    contact:  document.getElementById('abr-contact').value,
  };
  if (!body.code || !body.name) { toast('❌', 'Code and name are required', ''); return; }
  try {
    if (id) await api('PUT', `/branches/${id}`, body);
    else    await api('POST', '/branches', body);
    closeModal('m-addBranch');
    toast('✅', id ? 'Branch updated' : 'Branch created!', body.name);
    loadBranches();
  } catch(e) {}
}

async function deleteBranch(id, name) {
  if (!confirm(`Deactivate branch "${name}"?`)) return;
  try {
    await api('DELETE', `/branches/${id}`);
    toast('✅', 'Branch deactivated', name);
    loadBranches();
  } catch(e) {}
}