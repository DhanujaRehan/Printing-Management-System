/* ============================================================
   TonerPro Ultra — DBA / Administration Module
   File: js/dba.js
   ============================================================ */

// ── State ──────────────────────────────────────────────────
let _allUsers = [];   // cache for client-side search filtering


// ── Load DBA page ──────────────────────────────────────────
async function loadDBA() {
  try {
    const [users, audit] = await Promise.all([
      api('GET', '/users'),
      api('GET', '/users/audit-log?limit=30'),
    ]);

    _allUsers = users;
    renderUserTable(users);
    renderAuditTable(audit);

  } catch (e) { console.error('DBA load error:', e); }
}


// ── Render user table ──────────────────────────────────────
function renderUserTable(users) {
  document.getElementById('user-tbody').innerHTML = users.length
    ? users.map(u => `
      <tr>
        <td style="font-weight:600">${u.full_name}</td>
        <td style="font-family:var(--m);font-size:11px;color:var(--t3)">${u.username}</td>
        <td>
          ${u.role === 'manager' ? '<span class="tag tb">Manager</span>'
          : u.role === 'dba'    ? '<span class="tag tp">DBA</span>'
          :                       '<span class="tag tg">Service</span>'}
        </td>
        <td style="font-size:11px;color:var(--t2)">${u.branch_access}</td>
        <td style="font-size:11px;color:var(--t3)">
          ${u.last_login
            ? new Date(u.last_login).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
            : 'Never'}
        </td>
        <td><span class="tag ${u.is_active ? 'tg' : 'tr'}">${u.is_active ? '● Active' : '○ Inactive'}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          ${APP.user.role === 'dba' ? `
            ${u.is_active
              ? `<button class="btn btn-er btn-sm" onclick="deactivateUser(${u.id},'${u.username}')">Deactivate</button>`
              : `<button class="btn btn-ok btn-sm" onclick="activateUser(${u.id},'${u.username}')">Activate</button>`
            }
            <button class="btn btn-sm" onclick="openResetPassword(${u.id},'${u.username}')"
              style="background:#d97706;color:#fff;border:none;cursor:pointer;padding:4px 10px;border-radius:6px;font-size:11px">
              Reset PW
            </button>
          ` : '—'}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:20px">No users found</td></tr>`;
}


// ── Render audit log table ─────────────────────────────────
function renderAuditTable(audit) {
  document.getElementById('audit-tbody').innerHTML = audit.map(a => `
    <tr>
      <td style="font-family:var(--m);font-size:10px;color:var(--t3)">
        ${new Date(a.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
      </td>
      <td style="font-family:var(--m);font-size:11px;color:var(--c1)">${a.username || '—'}</td>
      <td style="font-size:11px">${a.action}</td>
      <td style="font-size:11px;color:var(--t2)">${a.detail}</td>
    </tr>`).join('');
}


// ── Search users (client-side filter) ──────────────────────
function searchUsers() {
  const q = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
  if (!q) {
    renderUserTable(_allUsers);
    return;
  }
  const filtered = _allUsers.filter(u =>
    u.full_name.toLowerCase().includes(q) ||
    u.username.toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q)
  );
  renderUserTable(filtered);
}

function clearSearch() {
  const el = document.getElementById('user-search');
  if (el) el.value = '';
  renderUserTable(_allUsers);
}


// ── Create user ────────────────────────────────────────────
async function saveUser() {
  const body = {
    full_name:     document.getElementById('au-name').value,
    username:      document.getElementById('au-un').value,
    password:      document.getElementById('au-pw').value,
    role:          document.getElementById('au-role').value,
    branch_access: document.getElementById('au-branch').value,
  };
  if (!body.full_name || !body.username || !body.password) {
    toast('❌', 'All fields are required', '');
    return;
  }
  try {
    await api('POST', '/users', body);
    closeModal('m-addUser');
    toast('✅', 'User created!', body.username);
    loadDBA();
  } catch (e) {}
}


// ── Deactivate user ────────────────────────────────────────
async function deactivateUser(id, username) {
  if (!confirm(`Deactivate user "${username}"?\nThey will no longer be able to log in.`)) return;
  try {
    await api('DELETE', `/users/${id}`);
    toast('✅', 'User deactivated', username);
    loadDBA();
  } catch (e) {}
}


// ── Activate user ──────────────────────────────────────────
async function activateUser(id, username) {
  if (!confirm(`Re-activate user "${username}"?\nThey will regain access to the system.`)) return;
  try {
    await api('PATCH', `/users/${id}/activate`);
    toast('✅', 'User activated', username);
    loadDBA();
  } catch (e) {}
}


// ── Reset Password ─────────────────────────────────────────
function openResetPassword(id, username) {
  const modal = document.getElementById('m-resetPw');
  if (!modal) { console.error('Reset-PW modal not found in HTML'); return; }
  modal.dataset.userId   = id;
  modal.dataset.username = username;
  document.getElementById('rp-username-label').textContent = username;
  document.getElementById('rp-new-pw').value     = '';
  document.getElementById('rp-confirm-pw').value = '';
  openModal('m-resetPw');
}

async function saveResetPassword() {
  const modal    = document.getElementById('m-resetPw');
  const id       = modal.dataset.userId;
  const username = modal.dataset.username;
  const newPw    = document.getElementById('rp-new-pw').value;
  const confPw   = document.getElementById('rp-confirm-pw').value;

  if (!newPw || newPw.length < 6) {
    toast('❌', 'Password must be at least 6 characters', '');
    return;
  }
  if (newPw !== confPw) {
    toast('❌', 'Passwords do not match', '');
    return;
  }
  try {
    await api('PATCH', `/users/${id}/reset-password`, { new_password: newPw });
    closeModal('m-resetPw');
    toast('✅', 'Password reset successfully', username);
  } catch (e) {}
}
