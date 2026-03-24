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


/* ============================================================
   DBA — User Audit Log Page
   ============================================================ */

var _auditFull = [];

async function loadDbaAudit() {
  var tbody = document.getElementById('dba-audit-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px"><div class="spin" style="margin:0 auto"></div></td></tr>';

  var [logs, stats] = await Promise.all([
    silentApi('GET', '/users/audit-log/full?limit=300'),
    silentApi('GET', '/users/audit-log/stats'),
  ]);

  _auditFull = logs || [];

  // KPI cards
  if (stats) {
    var kpis = document.getElementById('audit-kpis');
    if (kpis) {
      kpis.innerHTML = [
        { num: stats.total_actions,  lbl: 'Total Actions',     col: '#0ea5e9' },
        { num: stats.actions_24h,    lbl: 'Last 24 Hours',     col: '#10b981' },
        { num: stats.total_logins,   lbl: 'Total Logins',      col: '#6366f1' },
        { num: stats.unique_users,   lbl: 'Unique Users',      col: '#f59e0b' },
      ].map(function(k) {
        return '<div class="dba-audit-kpi" style="border-top-color:' + k.col + '">'
          + '<div class="dba-ak-num">' + (k.num||0).toLocaleString() + '</div>'
          + '<div class="dba-ak-lbl">' + k.lbl + '</div>'
          + '</div>';
      }).join('');
    }
  }

  renderAuditFull(_auditFull);
}

function renderAuditFull(data) {
  var tbody = document.getElementById('dba-audit-tbody');
  var count = document.getElementById('audit-count');
  if (!tbody) return;

  if (count) count.textContent = data.length + ' records';

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptys">No audit entries found.</td></tr>';
    return;
  }

  var actionColors = {
    'LOGIN':         '#dbeafe',
    'TONER_REQUEST': '#fef3c7',
    'APPROVE':       '#d1fae5',
    'REJECT':        '#fee2e2',
    'DISPATCH':      '#ede9fe',
    'PRINT_LOG':     '#f0f9ff',
    'CREATE_USER':   '#f0fdf4',
    'UPDATE_USER':   '#fffbeb',
    'DELETE_USER':   '#fef2f2',
  };

  tbody.innerHTML = data.map(function(a) {
    var dt = a.created_at
      ? new Date(a.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '—';
    var action = (a.action || '').toUpperCase();
    var bgCol  = actionColors[action] || '#f8fafc';
    var roleColors = { manager:'#dbeafe',service:'#d1fae5',store:'#fef3c7',nuwan:'#f3e8ff',dba:'#fce7f3' };
    var roleBg = roleColors[a.role] || '#f1f5f9';

    return '<tr style="background:' + bgCol + '">'
      + '<td style="font-family:var(--m);font-size:11px;color:var(--t3);white-space:nowrap">' + dt + '</td>'
      + '<td style="font-size:12px;font-weight:700">' + (a.full_name||'System') + '<br><span style="font-size:10px;color:var(--t3)">@' + (a.username||'—') + '</span></td>'
      + '<td><span style="background:' + roleBg + ';padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">' + (a.role||'—') + '</span></td>'
      + '<td><span style="background:#f1f5f9;padding:3px 9px;border-radius:6px;font-size:11px;font-family:var(--m);font-weight:700">' + (a.action||'—') + '</span></td>'
      + '<td style="font-size:12px;color:var(--t2);max-width:260px">' + (a.detail||'—') + '</td>'
      + '<td style="font-family:var(--m);font-size:10px;color:var(--t3)">' + (a.ip_address||'—') + '</td>'
      + '</tr>';
  }).join('');
}

function filterAuditLog() {
  var search = (document.getElementById('audit-search')||{}).value||'';
  var role   = (document.getElementById('audit-role-filter')||{}).value||'';
  var action = (document.getElementById('audit-action-filter')||{}).value||'';
  var q = search.toLowerCase();

  var filtered = _auditFull.filter(function(a) {
    var matchSearch = !q
      || (a.username||'').toLowerCase().includes(q)
      || (a.full_name||'').toLowerCase().includes(q)
      || (a.action||'').toLowerCase().includes(q)
      || (a.detail||'').toLowerCase().includes(q);
    var matchRole   = !role   || (a.role||'') === role;
    var matchAction = !action || (a.action||'').toUpperCase().includes(action);
    return matchSearch && matchRole && matchAction;
  });

  renderAuditFull(filtered);
}


/* ============================================================
   DBA — System Health Page
   ============================================================ */

async function loadDbaHealth() {
  // Set API status immediately
  var apiEl = document.getElementById('h-api-status');
  if (apiEl) apiEl.textContent = '🟢 Online';

  var d = await silentApi('GET', '/users/system-health');
  if (!d) {
    var dbEl = document.getElementById('h-db-status');
    if (dbEl) dbEl.textContent = '🔴 Error';
    return;
  }

  var s = d.stats || {};
  var dbEl = document.getElementById('h-db-status');
  if (dbEl) dbEl.textContent = '🟢 Connected';

  // KPI values
  var setEl = function(id, val) {
    var e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  setEl('h-users',    (s.active_users||0) + ' / ' + (s.total_users||0) + ' active');
  setEl('h-printers', (s.active_printers||0) + ' printers');
  setEl('h-logs',     (s.total_logs||0).toLocaleString() + ' entries');
  setEl('h-pending',  (s.pending_requests||0) + ' waiting');

  // Recent logins table
  var lt = document.getElementById('h-logins-tbody');
  if (lt) {
    if (!d.recent_logins || !d.recent_logins.length) {
      lt.innerHTML = '<tr><td colspan="3" class="emptys">No logins recorded yet.</td></tr>';
    } else {
      var roleColors = { manager:'#dbeafe',service:'#d1fae5',store:'#fef3c7',nuwan:'#f3e8ff',dba:'#fce7f3' };
      lt.innerHTML = d.recent_logins.map(function(u) {
        var dt = u.last_login
          ? new Date(u.last_login).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
          : '—';
        var roleBg = roleColors[u.role]||'#f1f5f9';
        return '<tr>'
          + '<td style="font-weight:600">' + (u.full_name||'—') + '<br><span style="font-size:10px;color:var(--t3)">@' + (u.username||'') + '</span></td>'
          + '<td><span style="background:' + roleBg + ';padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">' + (u.role||'') + '</span></td>'
          + '<td style="font-family:var(--m);font-size:12px;color:var(--t2)">' + dt + '</td>'
          + '</tr>';
      }).join('');
    }
  }

  // DB table counts
  var dt = document.getElementById('h-db-tbody');
  if (dt) {
    var goodMin = { users:1, branches:32, printers:59, toner_models:7 };
    dt.innerHTML = (d.db_tables||[]).map(function(t) {
      var min  = goodMin[t.tbl] || 0;
      var ok   = parseInt(t.cnt) >= min;
      var icon = ok ? '✅' : '⚠️';
      return '<tr>'
        + '<td style="font-family:var(--m);font-size:12px;font-weight:600">' + t.tbl + '</td>'
        + '<td style="font-family:var(--m);font-size:14px;font-weight:800;color:var(--c1)">' + parseInt(t.cnt).toLocaleString() + '</td>'
        + '<td style="font-size:14px">' + icon + '</td>'
        + '</tr>';
    }).join('');
  }
}