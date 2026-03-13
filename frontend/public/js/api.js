/* ============================================================
   TonerPro Ultra — API & Auth Module
   File: js/api.js
   ============================================================ */

const API_BASE = 'http://localhost:4000/api';

// Shared state
window.APP = {
  token:    '',
  user:     {},
  curRole:  'manager',
};


/**
 * Core API fetch wrapper.
 * Automatically adds Authorization header and handles errors.
 */
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': APP.token ? `Bearer ${APP.token}` : '',
    }
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const r = await fetch(API_BASE + path, opts);
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
    return d;
  } catch (e) {
    toast('❌', e.message, '');
    throw e;
  }
}


/* ── Auth helpers ─────────────────────────────────────── */

function selectRole(el, role) {
  APP.curRole = role;
  document.querySelectorAll('.rb').forEach(b => b.classList.remove('a'));
  el.classList.add('a');
}

async function doLogin() {
  const u = document.getElementById('lu').value.trim();
  const p = document.getElementById('lp').value;
  const errEl = document.getElementById('lerr');
  errEl.style.display = 'none';

  try {
    const d = await api('POST', '/auth/login', { username: u, password: p });

    if (d.user.role !== APP.curRole) {
      showLoginErr(`This account is a "${d.user.role}" — please select the correct role tab.`);
      return;
    }

    APP.token = d.token;
    APP.user  = d.user;

    // Populate sidebar user info
    document.getElementById('sb-name').textContent = APP.user.full_name;
    document.getElementById('sb-av').textContent =
      APP.user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);

    const roleLabels = { manager: 'Manager', service: 'Service Person', dba: 'Database Admin' };
    const roleColors = { manager: 'var(--c1)', service: 'var(--c3)', dba: 'var(--c4)' };
    document.getElementById('sb-role').textContent  = roleLabels[APP.user.role];
    document.getElementById('sb-role').style.color  = roleColors[APP.user.role];

    // Hide login, show app
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display   = 'block';

    buildNav();
    setInterval(updateClock, 1000);
    updateClock();

  } catch (e) {
    showLoginErr('Invalid username or password. Please try again.');
  }
}

function showLoginErr(msg) {
  const e = document.getElementById('lerr');
  e.textContent     = msg;
  e.style.display   = 'block';
  setTimeout(() => e.style.display = 'none', 4500);
}

function doLogout() {
  APP.token = '';
  APP.user  = {};
  location.reload();
}

// Allow Enter key on login form
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login').style.display !== 'none') doLogin();
});
