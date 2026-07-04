/* ============================================================
   TonerPro Ultra — API & Auth Module
   File: js/api.js
   ============================================================ */

const API_BASE = '/api';

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
      var detail = d && (d.detail || d.error);
      var msg;
      if (Array.isArray(detail)) {
        /* FastAPI validation error — extract the first message */
        msg = detail.map(function(e) { return (e.loc ? e.loc.join('.') + ': ' : '') + e.msg; }).join(', ');
      } else if (detail && typeof detail === 'object') {
        msg = JSON.stringify(detail);
      } else {
        msg = detail || ('HTTP ' + r.status);
      }
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

  /* Hide any previous error */
  var errEl  = document.getElementById('lerr');
  var errTx  = document.getElementById('lerr-tx');
  errEl.classList.remove('vis');

  /* Basic empty-field validation */
  if (!u || !p) {
    var emptyWrap = !u
      ? document.getElementById('lu-wrap')
      : document.getElementById('lp-wrap');
    if (emptyWrap) {
      emptyWrap.classList.add('lp-input-err');
      emptyWrap.addEventListener('animationend', function() {
        emptyWrap.classList.remove('lp-input-err');
      }, { once: true });
      var inp = emptyWrap.querySelector('.lpf-input');
      if (inp) { inp.classList.add('err'); setTimeout(function(){ inp.classList.remove('err'); }, 1500); }
    }
    showLoginErr(!u ? 'Please enter your username.' : 'Please enter your password.');
    return;
  }

  /* Loading state on button */
  var btn = document.getElementById('lp-submit-btn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    var d = await api('POST', '/auth/login', { username: u, password: p });

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

    runLoadingScreen(function() {
      document.getElementById('app').style.display = 'block';

      buildNav();
      setInterval(updateClock, 1000);
      updateClock();
    });

  } catch(e) {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    /* Shake both inputs */
    ['lu-wrap','lp-wrap'].forEach(function(id) {
      var w = document.getElementById(id);
      if (!w) return;
      w.classList.add('lp-input-err');
      w.addEventListener('animationend', function() { w.classList.remove('lp-input-err'); }, { once: true });
      var inp = w.querySelector('.lpf-input');
      if (inp) { inp.classList.add('err'); setTimeout(function(){ inp.classList.remove('err'); }, 1500); }
    });
    showLoginErr('Invalid username or password. Please try again.');
  }
}

function showLoginErr(msg) {
  var errEl = document.getElementById('lerr');
  var errTx = document.getElementById('lerr-tx');
  if (errTx) errTx.textContent = msg;
  errEl.classList.add('vis');
  setTimeout(function() { errEl.classList.remove('vis'); }, 4500);
}

function doLogout() {
  APP.token = '';
  APP.user  = {};
  location.reload();
}

/* ── Forgot password ─────────────────────────────────────
   Requires a username to be entered first. Notifies the
   admins by email (server-side), then shows a confirmation
   popup — never a real password reset from this screen. */
async function forgotPassword() {
  var u = document.getElementById('lu').value.trim();

  if (!u) {
    var wrap = document.getElementById('lu-wrap');
    if (wrap) {
      wrap.classList.add('lp-input-err');
      wrap.addEventListener('animationend', function() { wrap.classList.remove('lp-input-err'); }, { once: true });
    }
    showLoginErr('Please enter your username first, then click "Forgot password?".');
    document.getElementById('lu').focus();
    return;
  }

  var link = document.getElementById('lp-forgot-link');
  if (link) { link.style.pointerEvents = 'none'; link.style.opacity = '.6'; }

  await silentApi('POST', '/auth/forgot-password', { username: u });

  if (link) { link.style.pointerEvents = ''; link.style.opacity = ''; }

  showForgotPasswordPopup();
}

function showForgotPasswordPopup() {
  var m = document.getElementById('fp-popup');
  if (m) m.classList.add('vis');
}

function closeForgotPasswordPopup() {
  var m = document.getElementById('fp-popup');
  if (m) m.classList.remove('vis');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login').style.display !== 'none') doLogin();
});