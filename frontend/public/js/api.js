/* ============================================================
   TonerPro Ultra — API & Auth Module
   File: js/api.js
   ============================================================ */

const API_BASE = 'http://localhost:4000/api';

window.APP = {
  token:   '',
  user:    {},
  curRole: 'manager',
};

/* Core fetch — shows toast on error */
async function api(method, path, body) {
  var opts = {
    method: method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': APP.token ? 'Bearer ' + APP.token : '',
    }
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    var r = await fetch(API_BASE + path, opts);
    var text = await r.text();
    var d;
    try {
      d = JSON.parse(text);
    } catch(e) {
      /* Server returned non-JSON (HTML error page) */
      toast('❌', 'Server error — please restart the backend', '');
      throw new Error('Server returned non-JSON response');
    }
    if (!r.ok) {
      var msg = (d && (d.detail || d.error)) ? (d.detail || d.error) : ('HTTP ' + r.status);
      toast('❌', msg, '');
      throw new Error(msg);
    }
    return d;
  } catch(e) {
    if (e.message !== 'Server returned non-JSON response') {
      /* Only re-throw, toast already shown above */
    }
    throw e;
  }
}

/* Silent fetch — never shows toast, returns null on any error */
async function silentApi(method, path, body) {
  var opts = {
    method: method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': APP.token ? 'Bearer ' + APP.token : '',
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    var r = await fetch(API_BASE + path, opts);
    var text = await r.text();
    try { return JSON.parse(text); } catch(e) { return null; }
  } catch(e) {
    return null;
  }
}


/* ── Auth helpers ─────────────────────────────────────── */

function selectRole(el, role) {
  APP.curRole = role;
  document.querySelectorAll('.rb').forEach(function(b) { b.classList.remove('a'); });
  el.classList.add('a');
}

async function doLogin() {
  var u = document.getElementById('lu').value.trim();
  var p = document.getElementById('lp').value;
  var errEl = document.getElementById('lerr');
  errEl.style.display = 'none';

  try {
    var d = await api('POST', '/auth/login', { username: u, password: p });

    if (d.user.role !== APP.curRole) {
      showLoginErr('This account is a "' + d.user.role + '" — please select the correct role tab.');
      return;
    }

    APP.token = d.token;
    APP.user  = d.user;

    document.getElementById('sb-name').textContent = APP.user.full_name;
    document.getElementById('sb-av').textContent =
      APP.user.full_name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2);

    var roleLabels = { manager: 'Manager', service: 'Service Person', dba: 'Database Admin', store: 'Store Person' };
    var roleColors = { manager: 'var(--c1)', service: 'var(--c3)', dba: 'var(--c4)', store: '#10b981' };
    document.getElementById('sb-role').textContent = roleLabels[APP.user.role];
    document.getElementById('sb-role').style.color = roleColors[APP.user.role];

    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display   = 'block';

    buildNav();
    setInterval(updateClock, 1000);
    updateClock();

  } catch(e) {
    showLoginErr('Invalid username or password. Please try again.');
  }
}

function showLoginErr(msg) {
  var e = document.getElementById('lerr');
  e.textContent   = msg;
  e.style.display = 'block';
  setTimeout(function() { e.style.display = 'none'; }, 4500);
}

function doLogout() {
  APP.token = '';
  APP.user  = {};
  location.reload();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login').style.display !== 'none') doLogin();
});