/* ============================================================
   TonerPro Ultra — Branches Module
   File: js/branches.js
   ============================================================ */

const BR_COLORS = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ec4899',
                   '#14b8a6','#8b5cf6','#22c55e','#f97316','#06b6d4'];


async function loadBranches() {
  const grid = document.getElementById('branch-grid');
  grid.innerHTML = '<div class="loading"><div class="spin"></div>Loading branches...</div>';

  try {
    const [branches, printers] = await Promise.all([
      api('GET', '/branches'),
      api('GET', '/printers'),
    ]);

    const canEdit = APP.user.role === 'manager' || APP.user.role === 'dba';

    grid.innerHTML = branches.map((b, bi) => {
      const bp  = printers.filter(p => p.branch_id === b.id || p.branch_code === b.code);
      const avg = bp.length ? Math.round(bp.reduce((a, p) => a + (p.current_pct || 0), 0) / bp.length) : 0;
      const col = BR_COLORS[bi % BR_COLORS.length];
      const bJson = JSON.stringify(b).replace(/'/g, "&#39;");

      return `
        <div class="bc" style="border-top:3px solid ${col}">
          <div class="bchead">
            <div class="bcbadge" style="background:${col}18;color:${col}">${b.code}</div>
            <div>
              <div class="bcn">${b.name}</div>
              <div class="bcs">${b.location || '—'} · ${b.printer_count || bp.length} printers</div>
            </div>
            <div class="bca">
              ${canEdit ? `<button class="btn btn-g btn-sm" onclick='editBranch(${bJson})'>✏️ Edit</button>` : ''}
              ${canEdit ? `<button class="btn btn-er btn-sm" onclick="deleteBranch(${b.id},'${b.name}')">🗑</button>` : ''}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
            <span style="font-size:11px;color:var(--t2)">Avg toner:</span>
            <div style="flex:1;height:5px;border-radius:3px;background:#f1f5f9;overflow:hidden">
              <div style="height:100%;width:${avg}%;background:${avg<=15?'var(--er)':avg<=30?'var(--wr)':col};border-radius:3px;transition:width 1s"></div>
            </div>
            <span style="font-size:11px;font-weight:700;font-family:var(--m);color:${pColor(avg)}">${avg}%</span>
            ${statusTag(avg, 99)}
          </div>

          <div class="prl">
            ${bp.map(p => `
              <div class="pr">
                <div class="prid">${p.printer_code}</div>
                <div class="pb"><div class="pf ${pfClass(p.current_pct || 0)}" style="width:${p.current_pct || 0}%"></div></div>
                <div class="prpct" style="color:${pColor(p.current_pct || 0)}">${p.current_pct || 0}%</div>
                <div class="prdays">${p.days_remaining ?? '—'}d left</div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');

    if (!branches.length) {
      grid.innerHTML = '<div class="emptys">No branches found. Click "Add Branch" to get started.</div>';
    }
  } catch (e) {
    grid.innerHTML = '<div class="emptys">Error loading branches.</div>';
  }
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
  } catch (e) {}
}

async function deleteBranch(id, name) {
  if (!confirm(`Deactivate branch "${name}"?`)) return;
  try {
    await api('DELETE', `/branches/${id}`);
    toast('✅', 'Branch deactivated', name);
    loadBranches();
  } catch (e) {}
}
