/* ============================================================
   SoftWave — DBA / Administration Module
   File: js/dba.js
   ============================================================ */

var _allUsers       = [];
var _dbaAllBranches = [];


/* ── Load DBA page ────────────────────────────────────────── */
async function loadDBA() {
  try {
    var results = await Promise.all([
      silentApi('GET', '/users'),
      silentApi('GET', '/users/audit-log?limit=30'),
      silentApi('GET', '/branches'),
    ]);

    var users    = results[0] || [];
    var audit    = results[1] || [];
    var branches = results[2] || [];

    _allUsers       = users;
    _dbaAllBranches = branches.filter(function(b){ return b.is_active; });

    renderUserTable(users);
    renderAuditTable(audit);

  } catch(e) {
    console.error('DBA load error:', e);
  }
}


/* ── Open Add User modal ──────────────────────────────────── */
async function openAddUserModal() {
  /* Reset fields */
  document.getElementById('au-name').value = '';
  document.getElementById('au-un').value   = '';
  document.getElementById('au-pw').value   = '';
  document.getElementById('au-role').value = 'manager';
  document.getElementById('au-branch').value = 'ALL';

  /* Always reload branches fresh so dropdown is populated */
  var branches = (await silentApi('GET', '/branches')) || [];
  _dbaAllBranches = branches.filter(function(b){ return b.is_active; });

  var sel = document.getElementById('au-branch-sel');
  if (sel) {
    sel.innerHTML = '<option value="ALL">— All Branches (no restriction) —</option>';
    _dbaAllBranches.forEach(function(b) {
      sel.add(new Option(b.code + ' — ' + b.name, b.code));
    });
    sel.value = 'ALL';
  }

  /* Reset branch hint for default role (manager) */
  auRoleChanged();

  openModal('m-addUser');
}


/* ── Role changed — update branch hint text ───────────────── */
function auRoleChanged() {
  var role  = document.getElementById('au-role').value;
  var hint  = document.getElementById('au-branch-hint');
  var sel   = document.getElementById('au-branch-sel');

  if (hint) {
    if (role === 'service') {
      hint.innerHTML = '📌 <strong>Required for Service:</strong> This person will only see this branch\'s printers in the End of Day Log.';
      hint.style.color = '#1d4ed8';
    } else if (role === 'store') {
      hint.innerHTML = '📌 <strong>Required for Store:</strong> This person will only manage stock for this branch.';
      hint.style.color = '#1d4ed8';
    } else {
      hint.innerHTML = '📌 Manager &amp; DBA roles have access to all branches by default. You can still restrict to one branch if needed.';
      hint.style.color = 'var(--t3)';
      /* Reset to ALL for manager/dba */
      if (sel) sel.value = 'ALL';
      var hidden = document.getElementById('au-branch');
      if (hidden) hidden.value = 'ALL';
    }
  }
}


/* ── Sync hidden input when branch dropdown changes ────────── */
function auBranchSelChanged() {
  var sel    = document.getElementById('au-branch-sel');
  var hidden = document.getElementById('au-branch');
  if (sel && hidden) hidden.value = sel.value;
}


/* ── Create user ──────────────────────────────────────────── */
async function saveUser() {
  var nameEl = document.getElementById('au-name');
  var unEl   = document.getElementById('au-un');
  var pwEl   = document.getElementById('au-pw');
  var roleEl = document.getElementById('au-role');
  var sel    = document.getElementById('au-branch-sel');
  var hidden = document.getElementById('au-branch');

  /* Sync branch from dropdown */
  if (sel && hidden) hidden.value = sel.value || 'ALL';

  var body = {
    full_name:     nameEl.value.trim(),
    username:      unEl.value.trim(),
    password:      pwEl.value,
    role:          roleEl.value,
    branch_access: (hidden && hidden.value) ? hidden.value : 'ALL',
  };

  if (!body.full_name)  { toast('❌', 'Full name is required', ''); return; }
  if (!body.username)   { toast('❌', 'Username is required', '');  return; }
  if (!body.password || body.password.length < 4) { toast('❌', 'Password must be at least 4 characters', ''); return; }

  var btn = document.querySelector('#m-addUser .mok');
  if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }

  try {
    await api('POST', '/users', body);
    closeModal('m-addUser');
    toast('✅', 'User created!', body.username);
    loadDBA();
  } catch(e) {
    /* error toast already shown by api() */
  } finally {
    if (btn) { btn.textContent = 'Create User'; btn.disabled = false; }
  }
}


/* ── Render user table ────────────────────────────────────── */
function renderUserTable(users) {
  var tbody = document.getElementById('user-tbody');
  if (!tbody) return;

  if (!users || !users.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:20px">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(function(u) {
    var roleTag = u.role === 'manager' ? '<span class="tag tb">Manager</span>'
                : u.role === 'dba'    ? '<span class="tag tp">DBA</span>'
                : u.role === 'store'  ? '<span class="tag tg">Store</span>'
                :                       '<span class="tag ta">Service</span>';

    var branchCell = (u.branch_access && u.branch_access !== 'ALL')
      ? '<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;font-family:var(--m)">' + u.branch_access + '</span>'
      : '<span style="color:var(--t3);font-size:11px">All</span>';

    var lastLogin = u.last_login
      ? new Date(u.last_login).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
      : 'Never';

    var statusTag = '<span class="tag ' + (u.is_active ? 'tg' : 'tr') + '">' + (u.is_active ? '● Active' : '○ Inactive') + '</span>';

    var actions = APP.user.role === 'dba'
      ? '<button class="btn btn-g btn-sm" onclick="openEditUser(' + u.id + ')">✏️ Edit</button>'
        + (u.is_active
          ? '<button class="btn btn-er btn-sm" onclick="deactivateUser(' + u.id + ',\'' + u.username + '\')">Deactivate</button>'
          : '<button class="btn btn-ok btn-sm" onclick="activateUser(' + u.id + ',\'' + u.username + '\')">Activate</button>')
        + '<button class="btn btn-sm" onclick="openResetPassword(' + u.id + ',\'' + u.username + '\')" style="background:#d97706;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">🔑 Reset PW</button>'
      : '—';

    return '<tr>'
      + '<td style="font-weight:600">' + u.full_name + '</td>'
      + '<td style="font-family:var(--m);font-size:11px;color:var(--t3)">' + u.username + '</td>'
      + '<td>' + roleTag + '</td>'
      + '<td>' + branchCell + '</td>'
      + '<td style="font-size:11px;color:var(--t3)">' + lastLogin + '</td>'
      + '<td>' + statusTag + '</td>'
      + '<td style="display:flex;gap:4px;flex-wrap:wrap">' + actions + '</td>'
      + '</tr>';
  }).join('');
}


/* ── Render audit log ─────────────────────────────────────── */
function renderAuditTable(audit) {
  var tbody = document.getElementById('audit-tbody');
  if (!tbody) return;
  if (!audit || !audit.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="emptys">No audit entries yet.</td></tr>';
    return;
  }
  tbody.innerHTML = audit.map(function(a) {
    var dt = new Date(a.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    return '<tr>'
      + '<td style="font-family:var(--m);font-size:10px;color:var(--t3)">' + dt + '</td>'
      + '<td style="font-family:var(--m);font-size:11px;color:var(--c1)">' + (a.username || '—') + '</td>'
      + '<td style="font-size:11px">' + (a.action || '') + '</td>'
      + '<td style="font-size:11px;color:var(--t2)">' + (a.detail || '') + '</td>'
      + '</tr>';
  }).join('');
}


/* ── Search users ─────────────────────────────────────────── */
function searchUsers() {
  var q = (document.getElementById('user-search') || {}).value || '';
  q = q.trim().toLowerCase();
  if (!q) { renderUserTable(_allUsers); return; }
  renderUserTable(_allUsers.filter(function(u) {
    return u.full_name.toLowerCase().includes(q)
      || u.username.toLowerCase().includes(q)
      || u.role.toLowerCase().includes(q);
  }));
}

function clearSearch() {
  var el = document.getElementById('user-search');
  if (el) el.value = '';
  renderUserTable(_allUsers);
}


/* ── Deactivate user ──────────────────────────────────────── */
async function deactivateUser(id, username) {
  if (!confirm('Deactivate user "' + username + '"?\nThey will no longer be able to log in.')) return;
  try {
    await api('DELETE', '/users/' + id);
    toast('✅', 'User deactivated', username);
    loadDBA();
  } catch(e) {}
}


/* ── Activate user ────────────────────────────────────────── */
async function activateUser(id, username) {
  if (!confirm('Re-activate user "' + username + '"?')) return;
  try {
    await api('PATCH', '/users/' + id + '/activate');
    toast('✅', 'User activated', username);
    loadDBA();
  } catch(e) {}
}


/* ── Edit user ────────────────────────────────────────────── */
async function openEditUser(userId) {
  var user = _allUsers.find(function(u){ return u.id === userId; });
  if (!user) return;

  document.getElementById('eu-id').value   = user.id;
  document.getElementById('eu-name').value = user.full_name;
  document.getElementById('eu-un').value   = user.username;
  document.getElementById('eu-role').value = user.role;

  /* Always reload branches */
  if (!_dbaAllBranches.length) {
    var branches = (await silentApi('GET', '/branches')) || [];
    _dbaAllBranches = branches.filter(function(b){ return b.is_active; });
  }

  var sel = document.getElementById('eu-branch-sel');
  if (sel) {
    sel.innerHTML = '<option value="ALL">— All Branches (no restriction) —</option>';
    _dbaAllBranches.forEach(function(b) {
      sel.add(new Option(b.code + ' — ' + b.name, b.code));
    });
    sel.value = user.branch_access || 'ALL';
  }

  var hidden = document.getElementById('eu-branch');
  if (hidden) hidden.value = user.branch_access || 'ALL';

  euRoleChanged();
  openModal('m-editUser');
}

function euRoleChanged() {
  var role       = document.getElementById('eu-role').value;
  var field      = document.getElementById('eu-branch-field');
  var hidden     = document.getElementById('eu-branch');
  var sel        = document.getElementById('eu-branch-sel');
  var needBranch = (role === 'service' || role === 'store');
  if (field) field.style.display = needBranch ? '' : 'none';
  if (!needBranch) {
    if (hidden) hidden.value = 'ALL';
    if (sel)    sel.value    = 'ALL';
  } else {
    if (sel && hidden) hidden.value = sel.value;
  }
}

async function saveEditUser() {
  var id     = document.getElementById('eu-id').value;
  var sel    = document.getElementById('eu-branch-sel');
  var hidden = document.getElementById('eu-branch');
  var role   = document.getElementById('eu-role').value;
  var needBranch = (role === 'service' || role === 'store');
  var branch = needBranch ? (sel ? sel.value : 'ALL') : 'ALL';
  if (hidden) hidden.value = branch;

  var fullName = document.getElementById('eu-name').value.trim();
  var username = document.getElementById('eu-un').value.trim();

  if (!fullName) { toast('❌', 'Full name is required', ''); return; }
  if (!username) { toast('❌', 'Username is required', '');  return; }

  var btn = document.querySelector('#m-editUser .mok');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    await api('PUT', '/users/' + id, {
      full_name:     fullName,
      username:      username,
      role:          role,
      branch_access: branch,
      password:      '',
    });
    closeModal('m-editUser');
    toast('✅', 'User updated!', fullName);
    loadDBA();
  } catch(e) {
  } finally {
    if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
  }
}


/* ── Reset Password ───────────────────────────────────────── */
function openResetPassword(id, username) {
  var modal = document.getElementById('m-resetPw');
  if (!modal) { toast('❌','Reset modal not found',''); return; }
  modal.dataset.userId   = id;
  modal.dataset.username = username;
  document.getElementById('rp-username-label').textContent = username;
  document.getElementById('rp-new-pw').value     = '';
  document.getElementById('rp-confirm-pw').value = '';
  openModal('m-resetPw');
}

async function saveResetPassword() {
  var modal    = document.getElementById('m-resetPw');
  var id       = modal.dataset.userId;
  var username = modal.dataset.username;
  var newPw    = document.getElementById('rp-new-pw').value;
  var confPw   = document.getElementById('rp-confirm-pw').value;

  if (!newPw || newPw.length < 6) { toast('❌', 'Password must be at least 6 characters', ''); return; }
  if (newPw !== confPw)           { toast('❌', 'Passwords do not match', ''); return; }

  var btn = document.querySelector('#m-resetPw .mok');
  if (btn) { btn.textContent = 'Resetting…'; btn.disabled = true; }

  try {
    await api('PATCH', '/users/' + id + '/reset-password', { new_password: newPw });
    closeModal('m-resetPw');
    toast('✅', 'Password reset!', username);
  } catch(e) {
  } finally {
    if (btn) { btn.textContent = 'Reset Password'; btn.disabled = false; }
  }
}