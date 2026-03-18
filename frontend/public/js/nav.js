/* ============================================================
   TonerPro Ultra — Navigation & Layout Module
   File: js/nav.js
   ============================================================ */

var NAVS = {
  manager: [
    { s: 'Overview', items: [
      { i: '📊', l: 'Dashboard',   p: 'dashboard' },
      { i: '🏢', l: 'Branches',    p: 'branches'  },
      { i: '🖨️', l: 'Printers',    p: 'printers'  },
    ]},
    { s: 'Inventory', items: [
      { i: '📦', l: 'Toner Stock', p: 'stock' },
      { i: '📄', l: 'Paper Stock', p: 'paper' },
    ]},
    { s: 'Management', items: [
      { i: '✅', l: 'Approvals',      p: 'approvals',    badge: 'approvals-badge' },
      { i: '📊', l: 'Print Report',   p: 'printreport' },
    ]},
  ],

  service: [
    { s: 'My Work', items: [
      { i: '📋', l: 'My Dashboard',   p: 'service'     },
      { i: '➕', l: 'New Request',     p: 'service-new' },
      { i: '📊', l: 'End of Day Log', p: 'service-log' },
    ]},
    { s: 'View', items: [
      { i: '🏢', l: 'Branch Status',  p: 'branches' },
    ]},
  ],

  dba: [
    { s: 'Admin', items: [
      { i: '🗄️', l: 'Administration', p: 'dba'       },
      { i: '📊', l: 'Dashboard',       p: 'dashboard' },
      { i: '📦', l: 'Toner Stock',     p: 'stock'     },
      { i: '📄', l: 'Paper Stock',     p: 'paper'     },
      { i: '🖨️', l: 'Printers',        p: 'printers'  },
      { i: '✅', l: 'Approvals',        p: 'approvals', badge: 'approvals-badge' },
      { i: '📊', l: 'Print Report',     p: 'printreport' },
    ]},
  ],
};


function buildNav() {
  var nav = document.getElementById('sbnav');
  nav.innerHTML = '';

  var sections = NAVS[APP.user.role] || [];
  sections.forEach(function(sec) {
    var label = document.createElement('div');
    label.className   = 'nbsec';
    label.textContent = sec.s;
    nav.appendChild(label);

    sec.items.forEach(function(item) {
      var btn = document.createElement('button');
      btn.className = 'nb';
      var badgeHtml = item.badge
        ? '<span class="nav-badge" id="' + item.badge + '" style="display:none">0</span>'
        : '';
      btn.innerHTML = '<span class="ni">' + item.i + '</span>' + item.l + badgeHtml;
      btn.onclick = (function(i) {
        return function() { showPage(i.p, btn); };
      })(item);
      nav.appendChild(btn);
    });
  });

  /* Activate first item */
  var first = nav.querySelector('.nb');
  if (first) {
    first.classList.add('act');
    showPage(sections[0].items[0].p, first);
  }

  /* Add Branch button */
  var addBrBtn = document.getElementById('addbr-btn');
  if (addBrBtn && (APP.user.role === 'manager' || APP.user.role === 'dba')) {
    addBrBtn.style.display = '';
  }

  /* Poll pending badge after short delay */
  if (APP.user.role === 'manager' || APP.user.role === 'dba') {
    setTimeout(function() {
      if (typeof refreshPendingBadge === 'function') {
        refreshPendingBadge();
        setInterval(refreshPendingBadge, 60000);
      }
    }, 800);
  }
}


function showPage(id, btn) {
  /* Hide all pages */
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('act'); });
  document.querySelectorAll('.nb').forEach(function(b)   { b.classList.remove('act'); });
  if (btn) btn.classList.add('act');

  /* Service sub-pages */
  if (id === 'service-new') {
    var pg = document.getElementById('page-service');
    if (pg) pg.classList.add('act');
    if (typeof loadService === 'function') loadService();
    setTimeout(function() {
      if (typeof switchSvcTab === 'function') switchSvcTab('new');
    }, 150);
    return;
  }
  if (id === 'service-log') {
    var pg = document.getElementById('page-service');
    if (pg) pg.classList.add('act');
    if (typeof loadService === 'function') loadService();
    setTimeout(function() {
      if (typeof switchSvcTab === 'function') switchSvcTab('log');
    }, 150);
    return;
  }

  /* For 'service' main page — always reset to requests tab */
  if (id === 'service') {
    var pg = document.getElementById('page-service');
    if (pg) pg.classList.add('act');
    /* Reset all panels to correct state */
    ['requests','new','log'].forEach(function(t) {
      var tab = document.getElementById('svc-tab-' + t);
      var panel = document.getElementById('svc-panel-' + t);
      if (tab)   tab.className   = 'svc-tab' + (t === 'requests' ? ' svc-tab-act' : '');
      if (panel) panel.style.display = t === 'requests' ? '' : 'none';
    });
    if (typeof loadService === 'function') loadService();
    return;
  }

  /* Normal page */
  var pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('act');

  var loaders = {
    dashboard: loadDashboard,
    branches:  loadBranches,
    printers:  loadPrinters,
    stock:     loadStock,
    paper:     loadPaper,
    replace:   loadService,
    printlog:  loadService,
    approvals:    loadApprovals,
    printreport:  loadPrintReport,
    dba:          loadDBA,
  };
  if (loaders[id]) loaders[id]();
}


function updateClock() {
  var el = document.getElementById('lclk');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/* ── Modals ──────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('op');    }
function closeModal(id) { document.getElementById(id).classList.remove('op'); }

document.querySelectorAll('.mb').forEach(function(m) {
  m.addEventListener('click', function(e) {
    if (e.target === m) m.classList.remove('op');
  });
});

/* ── Toast ───────────────────────────────────────────────── */
var _toastTimer;
function toast(ico, tx, sb) {
  document.getElementById('t-ico').textContent = ico;
  document.getElementById('t-tx').textContent  = tx;
  document.getElementById('t-sb').textContent  = sb || '';
  var t = document.getElementById('toast');
  t.classList.add('sh');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { t.classList.remove('sh'); }, 3500);
}

/* ── Utilities ───────────────────────────────────────────── */
function pColor(pct) {
  return pct <= 10 ? 'var(--er)' : pct <= 25 ? 'var(--wr)' : 'var(--ok)';
}
function pfClass(pct) {
  return pct <= 10 ? 'pfr' : pct <= 25 ? 'pfw' : 'pfg';
}
function statusTag(pct, days) {
  if (pct <= 10 || days <= 3) return '<span class="tag tr">🔴 Critical</span>';
  if (pct <= 25 || days <= 7) return '<span class="tag ta">🟡 Low</span>';
  return '<span class="tag tg">🟢 Good</span>';
}
function filterTable(q, tbodyId) {
  document.querySelectorAll('#' + tbodyId + ' tr').forEach(function(r) {
    r.style.display = (q && !r.textContent.toLowerCase().includes(q.toLowerCase())) ? 'none' : '';
  });
}