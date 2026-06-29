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
    renderDbaEmailPanel();

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
  var tbody    = document.getElementById('user-tbody');
  var cardWrap = document.getElementById('user-cards');
  if (!tbody && !cardWrap) return;

  if (!users || !users.length) {
    if (tbody)    tbody.innerHTML    = '<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:20px">No users found</td></tr>';
    if (cardWrap) cardWrap.innerHTML = '<div style="text-align:center;color:var(--t3);padding:30px">No users found</div>';
    return;
  }

  var roleColors = {
    manager: { bg:'#dbeafe', color:'#1d4ed8', label:'Manager' },
    dba:     { bg:'#ede9fe', color:'#6d28d9', label:'DBA'     },
    store:   { bg:'#d1fae5', color:'#065f46', label:'Store'   },
    service: { bg:'#fef9c3', color:'#92400e', label:'Service' },
    nuwan:   { bg:'#fce7f3', color:'#9d174d', label:'Nuwan'   },
  };

  var rows = users.map(function(u) {
    var rc = roleColors[u.role] || { bg:'#f1f5f9', color:'#475569', label: u.role };
    var roleTag   = '<span style="background:' + rc.bg + ';color:' + rc.color + ';padding:2px 9px;border-radius:6px;font-size:11px;font-weight:700">' + rc.label + '</span>';
    var branch    = (u.branch_access && u.branch_access !== 'ALL') ? u.branch_access : 'All';
    var lastLogin = u.last_login
      ? new Date(u.last_login).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
      : 'Never';
    var statusTag = '<span style="background:' + (u.is_active?'#d1fae5':'#fee2e2') + ';color:' + (u.is_active?'#065f46':'#991b1b') + ';padding:2px 9px;border-radius:6px;font-size:11px;font-weight:700">'
      + (u.is_active ? 'Active' : 'Inactive') + '</span>';
    var isDba = APP.user.role === 'dba';

    var trHtml = '<tr>'
      + '<td style="font-weight:600">' + u.full_name + '</td>'
      + '<td style="font-family:var(--m);font-size:11px;color:var(--t3)">@' + u.username + '</td>'
      + '<td>' + roleTag + '</td>'
      + '<td style="font-size:11px">' + branch + '</td>'
      + '<td style="font-size:11px;color:var(--t3)">' + lastLogin + '</td>'
      + '<td>' + statusTag + '</td>'
      + '<td><div style="display:flex;gap:4px;flex-wrap:wrap">'
      + (isDba
          ? '<button class="btn btn-g btn-sm" onclick="openEditUser(' + u.id + ')">Edit</button>'
          + (u.is_active
              ? '<button class="btn btn-er btn-sm" onclick="deactivateUser(' + u.id + ',\'' + u.username + '\')">Off</button>'
              : '<button class="btn btn-ok btn-sm" onclick="activateUser(' + u.id + ',\'' + u.username + '\')">On</button>')
          + '<button class="btn btn-sm" onclick="openResetPassword(' + u.id + ',\'' + u.username + '\')" style="background:#d97706;color:#fff;border:none;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer">PW</button>'
          : '—')
      + '</div></td></tr>';

    var cardHtml = '<div class="um-card" style="border-left:4px solid ' + rc.color + '">'
      + '<div class="um-card-top">'
      +   '<div class="um-card-info">'
      +     '<div class="um-card-name">' + u.full_name + '</div>'
      +     '<div class="um-card-user">@' + u.username + ' &nbsp;·&nbsp; Branch: ' + branch + '</div>'
      +   '</div>'
      +   '<div class="um-card-badges">' + roleTag + statusTag + '</div>'
      + '</div>'
      + '<div class="um-card-meta">🕐 Last login: ' + lastLogin + '</div>'
      + (isDba ? '<div class="um-card-actions">'
          + '<button class="btn btn-g btn-sm" onclick="openEditUser(' + u.id + ')">✏️ Edit</button>'
          + (u.is_active
              ? '<button class="btn btn-er btn-sm" onclick="deactivateUser(' + u.id + ',\'' + u.username + '\')">Deactivate</button>'
              : '<button class="btn btn-ok btn-sm" onclick="activateUser(' + u.id + ',\'' + u.username + '\')">Activate</button>')
          + '<button class="btn btn-sm" onclick="openResetPassword(' + u.id + ',\'' + u.username + '\')" style="background:#d97706;color:#fff;border:none;padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:700">🔑 Reset PW</button>'
          + '</div>' : '')
      + '</div>';

    return { tr: trHtml, card: cardHtml };
  });

  if (tbody)    tbody.innerHTML    = rows.map(function(r){ return r.tr;   }).join('');
  if (cardWrap) cardWrap.innerHTML = rows.map(function(r){ return r.card; }).join('');
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
   DBA — Audit Log Viewer (full rebuild)
   ============================================================ */

var _auditFull    = [];
var _auditPage    = 1;
var _auditPerPage = 50;

/* Action badge config */
var AUDIT_ACTIONS = {
  'LOGIN':            { icon: '🔑', label: 'Login',            bg: '#dbeafe', color: '#1d4ed8' },
  'CREATE_USER':      { icon: '👤', label: 'Create User',       bg: '#d1fae5', color: '#065f46' },
  'DEACTIVATE_USER':  { icon: '🚫', label: 'Deactivate User',   bg: '#fee2e2', color: '#991b1b' },
  'ACTIVATE_USER':    { icon: '✅', label: 'Activate User',     bg: '#d1fae5', color: '#065f46' },
  'RESET_PASSWORD':   { icon: '🔒', label: 'Reset Password',    bg: '#fef3c7', color: '#92400e' },
  'TONER_REQUEST':    { icon: '🖨', label: 'Toner Request',     bg: '#fef3c7', color: '#92400e' },
  'APPROVE':          { icon: '✔', label: 'Approve',            bg: '#d1fae5', color: '#065f46' },
  'REJECT':           { icon: '✖', label: 'Reject',             bg: '#fee2e2', color: '#991b1b' },
  'DISPATCH':         { icon: '📦', label: 'Dispatch',          bg: '#ede9fe', color: '#5b21b6' },
  'PRINT_LOG':        { icon: '📄', label: 'Print Log',         bg: '#e0f2fe', color: '#0369a1' },
  'HARDWARE_REQUEST': { icon: '🔧', label: 'Hardware Request',  bg: '#f3e8ff', color: '#6d28d9' },
  'UPDATE_USER':      { icon: '✏',  label: 'Update User',       bg: '#fffbeb', color: '#92400e' },
  'ANOMALY_WARNING':  { icon: '⚠️', label: 'Anomaly Warning',   bg: '#fef3c7', color: '#92400e' },
  'IMPORT':           { icon: '📥', label: 'Import',             bg: '#e0f2fe', color: '#0369a1' },
  'EXPORT':           { icon: '📤', label: 'Export',             bg: '#e0f2fe', color: '#0369a1' },
};

var AUDIT_ROLES = {
  manager: { bg: '#dbeafe', color: '#1d4ed8' },
  service: { bg: '#d1fae5', color: '#065f46' },
  store:   { bg: '#fef3c7', color: '#92400e' },
  nuwan:   { bg: '#f3e8ff', color: '#6d28d9' },
  dba:     { bg: '#fce7f3', color: '#9d174d' },
};

async function loadDbaAudit() {
  var tbody = document.getElementById('dba-audit-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:36px"><div class="spin" style="margin:0 auto;width:28px;height:28px"></div></td></tr>';

  var [logs, stats] = await Promise.all([
    silentApi('GET', '/users/audit-log/full?limit=500'),
    silentApi('GET', '/users/audit-log/stats'),
  ]);

  _auditFull = logs || [];
  _auditPage = 1;

  /* KPI strip */
  if (stats) {
    var kpis = document.getElementById('audit-kpis');
    if (kpis) {
      kpis.innerHTML = [
        { num: stats.total_actions, lbl: 'Total Actions',  col: '#0ea5e9', icon: '📊' },
        { num: stats.actions_24h,   lbl: 'Last 24 Hours',  col: '#10b981', icon: '🕐' },
        { num: stats.total_logins,  lbl: 'Total Logins',   col: '#6366f1', icon: '🔑' },
        { num: stats.unique_users,  lbl: 'Unique Users',   col: '#f59e0b', icon: '👥' },
      ].map(function(k) {
        return '<div class="dba-audit-kpi" style="border-top-color:' + k.col + '">'
          + '<div class="dba-ak-icon">' + k.icon + '</div>'
          + '<div class="dba-ak-num">' + (k.num||0).toLocaleString() + '</div>'
          + '<div class="dba-ak-lbl">' + k.lbl + '</div>'
          + '</div>';
      }).join('');
    }
  }

  renderAuditFull(_auditFull);
  renderAuditSparkline(_auditFull);
}

/* ── 7-day activity sparkline ──────────────────────────────── */
function renderAuditSparkline(data) {
  var wrap = document.getElementById('audit-sparkline-wrap');
  if (!wrap) return;

  /* Count entries per day for last 14 days */
  var days = [];
  var labels = [];
  var today = new Date();
  for (var i = 13; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    var iso = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    var cnt = data.filter(function(a) {
      return a.created_at && a.created_at.slice(0, 10) === iso;
    }).length;
    days.push(cnt);
  }

  var maxVal = Math.max.apply(null, days) || 1;
  var barW   = 100 / days.length;

  var barsHtml = days.map(function(cnt, i) {
    var pct = Math.round((cnt / maxVal) * 100);
    var isToday = (i === days.length - 1);
    var color   = isToday ? '#0ea5e9' : '#6366f1';
    var opacity = pct === 0 ? '0.2' : '1';
    return '<div class="audit-spark-bar-wrap" title="' + labels[i] + ': ' + cnt + ' actions">'
      + '<div class="audit-spark-count">' + (cnt > 0 ? cnt : '') + '</div>'
      + '<div class="audit-spark-bar" style="height:' + Math.max(pct, 3) + '%;background:' + color + ';opacity:' + opacity + '"></div>'
      + '<div class="audit-spark-lbl">' + labels[i].split(' ')[0] + '</div>'
      + '</div>';
  }).join('');

  wrap.innerHTML = '<div class="audit-spark-title">Activity — last 14 days</div>'
    + '<div class="audit-spark-bars">' + barsHtml + '</div>';
}

function renderAuditFull(data) {
  var tbody = document.getElementById('dba-audit-tbody');
  var countEl = document.getElementById('audit-count');
  var pgEl    = document.getElementById('audit-pagination');
  if (!tbody) return;

  var total = data.length;
  var pages = Math.ceil(total / _auditPerPage) || 1;
  if (_auditPage > pages) _auditPage = 1;

  var start = (_auditPage - 1) * _auditPerPage;
  var slice = data.slice(start, start + _auditPerPage);

  if (countEl) countEl.textContent = total.toLocaleString() + ' record' + (total !== 1 ? 's' : '');

  /* Show/hide "Filters active" badge */
  var hasFilter = !!(
    (document.getElementById('audit-search')||{}).value ||
    (document.getElementById('audit-role-filter')||{}).value ||
    (document.getElementById('audit-action-filter')||{}).value ||
    (document.getElementById('audit-date-from')||{}).value ||
    (document.getElementById('audit-date-to')||{}).value
  );
  var badge = document.getElementById('audit-filter-active');
  if (badge) badge.style.display = hasFilter ? '' : 'none';

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptys" style="padding:40px;font-size:14px">No audit entries match the current filters.</td></tr>';
    if (pgEl) pgEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map(function(a, idx) {
    var realIdx = start + idx;
    var dt = a.created_at
      ? new Date(a.created_at).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '—';
    var actionKey = (a.action || '').toUpperCase();
    var ac  = AUDIT_ACTIONS[actionKey] || { icon: '•', label: a.action||'—', bg: '#f1f5f9', color: '#475569' };
    var rc  = AUDIT_ROLES[a.role] || { bg: '#f1f5f9', color: '#475569' };
    var detail = (a.detail || '—');
    var shortDetail = detail.length > 60 ? detail.slice(0, 60) + '…' : detail;

    return '<tr class="audit-row" onclick="auditOpenDrawer(' + realIdx + ')" title="Click for detail">'
      + '<td class="audit-td-date">' + dt + '</td>'
      + '<td class="audit-td-user">'
      +   '<div class="audit-user-name">' + (a.full_name || 'System') + '</div>'
      +   '<div class="audit-user-sub">@' + (a.username || '—') + '</div>'
      + '</td>'
      + '<td><span class="audit-role-badge" style="background:' + rc.bg + ';color:' + rc.color + '">' + (a.role||'—') + '</span></td>'
      + '<td><span class="audit-action-badge" style="background:' + ac.bg + ';color:' + ac.color + '">'
      +   ac.icon + ' ' + ac.label
      + '</span></td>'
      + '<td class="audit-td-detail">' + shortDetail + '</td>'
      + '<td class="audit-td-ip">' + (a.ip_address || '—') + '</td>'
      + '</tr>';
  }).join('');

  /* Pagination */
  if (pgEl) {
    if (pages <= 1) { pgEl.innerHTML = ''; return; }
    var btns = '';
    btns += '<button class="audit-pg-btn" onclick="auditGoPage(' + Math.max(1,_auditPage-1) + ')" ' + (_auditPage===1?'disabled':'') + '>‹ Prev</button>';
    var lo = Math.max(1, _auditPage-2), hi = Math.min(pages, _auditPage+2);
    if (lo > 1)     btns += '<button class="audit-pg-btn" onclick="auditGoPage(1)">1</button>' + (lo>2?'<span class="audit-pg-ellipsis">…</span>':'');
    for (var p=lo; p<=hi; p++) {
      btns += '<button class="audit-pg-btn' + (p===_auditPage?' audit-pg-active':'') + '" onclick="auditGoPage(' + p + ')">' + p + '</button>';
    }
    if (hi < pages) btns += (hi<pages-1?'<span class="audit-pg-ellipsis">…</span>':'') + '<button class="audit-pg-btn" onclick="auditGoPage(' + pages + ')">' + pages + '</button>';
    btns += '<button class="audit-pg-btn" onclick="auditGoPage(' + Math.min(pages,_auditPage+1) + ')" ' + (_auditPage===pages?'disabled':'') + '>Next ›</button>';
    btns += '<span class="audit-pg-info">Page ' + _auditPage + ' of ' + pages + ' &nbsp;·&nbsp; ' + total.toLocaleString() + ' records</span>';
    pgEl.innerHTML = btns;
  }
}

function auditGoPage(n) {
  _auditPage = n;
  renderAuditFull(_auditFiltered || _auditFull);
  var card = document.querySelector('.audit-table-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

var _auditFiltered = null;

function filterAuditLog() {
  var search = (document.getElementById('audit-search')||{}).value||'';
  var role   = (document.getElementById('audit-role-filter')||{}).value||'';
  var action = (document.getElementById('audit-action-filter')||{}).value||'';
  var dfrom  = (document.getElementById('audit-date-from')||{}).value||'';
  var dto    = (document.getElementById('audit-date-to')||{}).value||'';
  var q = search.toLowerCase();

  _auditFiltered = _auditFull.filter(function(a) {
    var matchSearch = !q
      || (a.username||'').toLowerCase().includes(q)
      || (a.full_name||'').toLowerCase().includes(q)
      || (a.action||'').toLowerCase().includes(q)
      || (a.detail||'').toLowerCase().includes(q)
      || (a.ip_address||'').toLowerCase().includes(q);
    var matchRole   = !role   || (a.role||'') === role;
    var matchAction = !action || (a.action||'').toUpperCase().includes(action.toUpperCase());
    var rowDate = a.created_at ? a.created_at.slice(0,10) : '';
    var matchFrom = !dfrom || rowDate >= dfrom;
    var matchTo   = !dto   || rowDate <= dto;
    return matchSearch && matchRole && matchAction && matchFrom && matchTo;
  });

  _auditPage = 1;
  renderAuditFull(_auditFiltered);
}

function auditClearSearch() {
  var el = document.getElementById('audit-search');
  if (el) { el.value = ''; filterAuditLog(); }
}

function auditResetFilters() {
  ['audit-search','audit-role-filter','audit-action-filter','audit-date-from','audit-date-to'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  _auditFiltered = null;
  _auditPage = 1;
  renderAuditFull(_auditFull);
  renderAuditSparkline(_auditFull);
}

/* ── 7-day activity sparkline ──────────────────────────────── */

/* ── Detail Drawer ──────────────────────────────────────── */
function auditOpenDrawer(idx) {
  var data = _auditFiltered || _auditFull;
  var a = data[idx];
  if (!a) return;

  var overlay = document.getElementById('audit-drawer-overlay');
  var body    = document.getElementById('audit-drawer-body');
  var title   = document.getElementById('audit-drawer-title');
  if (!overlay || !body) return;

  /* Teleport to <body> so position:fixed is never broken by parent transforms */
  if (overlay.parentNode !== document.body) {
    document.body.appendChild(overlay);
  }

  var actionKey = (a.action||'').toUpperCase();
  var ac = AUDIT_ACTIONS[actionKey] || { icon:'•', label: a.action||'—', bg:'#f1f5f9', color:'#475569' };
  var rc = AUDIT_ROLES[a.role] || { bg:'#f1f5f9', color:'#475569' };

  if (title) title.textContent = ac.icon + ' ' + ac.label;

  var dt = a.created_at
    ? new Date(a.created_at).toLocaleString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    : '—';

  body.innerHTML =
    '<div class="audit-drawer-field"><span class="audit-df-label">Date &amp; Time</span><span class="audit-df-value">' + dt + '</span></div>'
  + '<div class="audit-drawer-field"><span class="audit-df-label">User</span><span class="audit-df-value"><strong>' + (a.full_name||'System') + '</strong><br><span style="font-size:12px;color:#64748b">@' + (a.username||'—') + '</span></span></div>'
  + '<div class="audit-drawer-field"><span class="audit-df-label">Role</span><span class="audit-df-value"><span class="audit-role-badge" style="background:' + rc.bg + ';color:' + rc.color + '">' + (a.role||'—') + '</span></span></div>'
  + '<div class="audit-drawer-field"><span class="audit-df-label">Action</span><span class="audit-df-value"><span class="audit-action-badge" style="background:' + ac.bg + ';color:' + ac.color + '">' + ac.icon + ' ' + ac.label + '</span></span></div>'
  + '<div class="audit-drawer-field audit-drawer-detail"><span class="audit-df-label">Detail</span><span class="audit-df-value audit-detail-full">' + (a.detail||'—') + '</span></div>'
  + '<div class="audit-drawer-field"><span class="audit-df-label">IP Address</span><span class="audit-df-value audit-ip-mono">' + (a.ip_address||'—') + '</span></div>'
  + '<div class="audit-drawer-field"><span class="audit-df-label">Record ID</span><span class="audit-df-value audit-ip-mono">#' + (a.id||'—') + '</span></div>';

  overlay.classList.add('is-open');
}

function auditCloseDrawer() {
  var overlay = document.getElementById('audit-drawer-overlay');
  if (overlay) overlay.classList.remove('is-open');
}

/* ── CSV Export ─────────────────────────────────────────── */
async function auditExportCSV() {
  var params = new URLSearchParams();
  var search = (document.getElementById('audit-search')||{}).value||'';
  var role   = (document.getElementById('audit-role-filter')||{}).value||'';
  var action = (document.getElementById('audit-action-filter')||{}).value||'';
  var dfrom  = (document.getElementById('audit-date-from')||{}).value||'';
  var dto    = (document.getElementById('audit-date-to')||{}).value||'';
  if (search) params.append('search', search);
  if (role)   params.append('role',   role);
  if (action) params.append('action', action);
  if (dfrom)  params.append('date_from', dfrom);
  if (dto)    params.append('date_to',   dto);
  /* Pass token as query param — backend accepts both header and query param */
  if (APP.token) params.append('token', APP.token);

  toast('⏳', 'Preparing export…', 'Building your CSV file');
  try {
    var resp = await fetch('/api/users/audit-log/export-csv?' + params.toString(), {
      headers: { 'Authorization': 'Bearer ' + (APP.token || '') }
    });
    if (!resp.ok) { toast('❌', 'Export failed', 'Please try again'); return; }
    var blob = await resp.blob();
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    var now  = new Date().toISOString().slice(0,10);
    a.download = 'audit_log_' + now + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✅', 'CSV downloaded!', 'Audit log export complete');
  } catch(e) {
    toast('❌', 'Export failed', 'Please try again');
  }
}

/* ── DBA Email Dashboard ──────────────────────────────────── */
function renderDbaEmailPanel() {
  var container = document.getElementById('dba-email-panel');
  if (!container) return;

  container.innerHTML = `
    <div class="card mb20">
      <div class="ch">
        <h3>📧 Send System Message to Nuwan</h3>
      </div>
      <div style="padding:22px 24px">
        <div class="ff">
          <label class="ffl">Message Type</label>
          <select class="fs" id="dba-email-type" onchange="dbaEmailTypeChanged()">
            <option value="custom">💬 Custom Message</option>
            <option value="maintenance">🔧 System Maintenance Notice</option>
            <option value="update">📢 System Update</option>
            <option value="reminder">🔔 General Reminder</option>
          </select>
        </div>
        <div class="ff">
          <label class="ffl">Subject</label>
          <input class="fi2" id="dba-email-subject" placeholder="Email subject line...">
        </div>
        <div class="ff">
          <label class="ffl">Message</label>
          <textarea class="fi2" id="dba-email-body" rows="5"
            style="resize:vertical;min-height:100px;line-height:1.6"
            placeholder="Type your message to Nuwan here..."></textarea>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn btn-p" onclick="dbaSendSystemEmail()" id="dba-email-send-btn">
            📤 Send to Nuwan
          </button>
          <span style="font-size:12px;color:var(--t3)">
            Sends from system@softwave.lk → nuwan@softwave.lk
          </span>
        </div>
      </div>
    </div>`;
}

function dbaEmailTypeChanged() {
  var type    = document.getElementById('dba-email-type').value;
  var subject = document.getElementById('dba-email-subject');
  var body    = document.getElementById('dba-email-body');
  var presets = {
    maintenance: {
      s: 'SoftWave — Scheduled System Maintenance',
      b: 'Dear Mr. Nuwan,\n\nPlease be informed that scheduled system maintenance will be carried out.\n\nThe system may be temporarily unavailable during this period.\n\nWe apologize for any inconvenience caused.\n\nBest Regards,\nSoftWave System'
    },
    update: {
      s: 'SoftWave — System Update Notice',
      b: 'Dear Mr. Nuwan,\n\nA system update has been applied to the SoftWave Print Management System.\n\nPlease refresh your browser to get the latest version.\n\nBest Regards,\nSoftWave System'
    },
    reminder: {
      s: 'SoftWave — General Reminder',
      b: 'Dear Mr. Nuwan,\n\n'
    },
    custom: { s: '', b: '' }
  };
  var p = presets[type] || presets.custom;
  if (p.s) subject.value = p.s;
  if (p.b) body.value = p.b;
}

async function dbaSendSystemEmail() {
  var subject = document.getElementById('dba-email-subject').value.trim();
  var message = document.getElementById('dba-email-body').value.trim();
  var btn     = document.getElementById('dba-email-send-btn');

  if (!subject) { toast('⚠️', 'Please enter a subject', ''); return; }
  if (!message) { toast('⚠️', 'Please enter a message', ''); return; }

  btn.textContent = '⏳ Sending...';
  btn.disabled = true;

  try {
    await api('POST', '/users/send-system-email', { subject: subject, message: message });
    toast('✅', 'Email sent to Nuwan!', subject);
    document.getElementById('dba-email-subject').value = '';
    document.getElementById('dba-email-body').value    = '';
    document.getElementById('dba-email-type').value    = 'custom';
  } catch(e) {
    // error toast shown by api()
  } finally {
    btn.textContent = '📤 Send to Nuwan';
    btn.disabled = false;
  }
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