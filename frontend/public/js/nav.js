/* ============================================================
   SoftWave — Navigation & Layout
   File: js/nav.js
   ============================================================ */

var NAVS = {
  manager: [
    { s: 'Overview', items: [
      { i: '📊', l: 'Dashboard',        p: 'dashboard'    },
      { i: '🏢', l: 'Branches',         p: 'branches'     },
      { i: '🖨️', l: 'Printers',         p: 'printers'     },
    ]},
    { s: 'Inventory', items: [
      { i: '📦', l: 'Toner Stock',      p: 'stock'        },
      { i: '📄', l: 'Paper Stock',      p: 'paper'        },
    ]},
    { s: 'Management', items: [
      { i: '✅', l: 'Approvals',        p: 'approvals',    badge: 'approvals-badge' },
      { i: '📥', l: 'Import Approvals', p: 'importapprove',badge: 'import-badge'    },
      { i: '📊', l: 'Print Report',     p: 'printreport'  },
      { i: '📋', l: 'Rental Printers',  p: 'rentals'      },
    ]},
  ],

  /* ── SERVICE PERSON ── */
  service: [
    { s: 'My Work', items: [
      { i: '📊', l: 'End of Day Log',   p: 'eodlog'       },
      { i: '🔄', l: 'Toner Replaced',   p: 'tonerlog'     },
    ]},
  ],

  store: [
    { s: 'Warehouse', items: [
      { i: '📦', l: 'Dispatch Queue',   p: 'store-dispatch', badge: 'store-dispatch-badge' },
      { i: '📊', l: 'Overview',         p: 'store'        },
      { i: '🖨️', l: 'Toner Stock',      p: 'store-toner'  },
      { i: '📄', l: 'Paper Stock',      p: 'store-paper'  },
      { i: '📋', l: 'Movement History', p: 'store-history' },
    ]},
  ],

  dba: [
    { s: 'Admin', items: [
      { i: '🗄️', l: 'Administration',   p: 'dba'          },
      { i: '📥', l: 'Excel Import',     p: 'import',       badge: 'import-badge' },
      { i: '📊', l: 'Dashboard',        p: 'dashboard'    },
      { i: '📦', l: 'Toner Stock',      p: 'stock'        },
      { i: '📄', l: 'Paper Stock',      p: 'paper'        },
      { i: '🖨️', l: 'Printers',         p: 'printers'     },
      { i: '✅', l: 'Approvals',        p: 'approvals',    badge: 'approvals-badge' },
      { i: '📊', l: 'Print Report',     p: 'printreport'  },
      { i: '📋', l: 'Rental Printers',  p: 'rentals'      },
    ]},
  ],
};


/* ── Build sidebar nav ───────────────────────────────────── */
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

  /* Activate first item automatically */
  var first = nav.querySelector('.nb');
  if (first) {
    first.classList.add('act');
    showPage(sections[0].items[0].p, first);
  }

  /* Add Branch button — manager & dba only */
  var addBrBtn = document.getElementById('addbr-btn');
  if (addBrBtn) {
    addBrBtn.style.display =
      (APP.user.role === 'manager' || APP.user.role === 'dba') ? '' : 'none';
  }

  /* Badge polling — manager & dba only */
  if (APP.user.role === 'manager' || APP.user.role === 'dba') {
    setTimeout(function() {
      if (typeof refreshPendingBadge === 'function') {
        refreshPendingBadge();
        setInterval(refreshPendingBadge, 60000);
      }
      if (typeof refreshImportBadge === 'function') {
        refreshImportBadge();
        setInterval(refreshImportBadge, 60000);
      }
    }, 800);
  }
}


/* ── Show page ───────────────────────────────────────────── */
function showPage(id, btn) {
  /* Hide all pages + deactivate all nav buttons */
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('act'); });
  document.querySelectorAll('.nb').forEach(function(b)   { b.classList.remove('act'); });
  if (btn) btn.classList.add('act');

  /* ── Store sub-tabs ── */
  if (id === 'store' || id === 'store-dispatch' || id === 'store-toner' || id === 'store-paper' || id === 'store-history') {
    var tab = id === 'store' ? 'overview' : id.replace('store-', '');
    var pg  = document.getElementById('page-store');
    if (pg) pg.classList.add('act');
    if (typeof loadStore === 'function') loadStore();
    setTimeout(function() {
      if (typeof switchStoreTab === 'function') switchStoreTab(tab);
    }, 150);
    startAutoRefresh(id);
    return;
  }

  /* ── Manager import approvals ── */
  if (id === 'importapprove') {
    var pg = document.getElementById('page-import');
    if (pg) pg.classList.add('act');
    if (typeof loadImport === 'function') loadImport();
    setTimeout(function() {
      if (typeof switchImportTab === 'function') switchImportTab('pending');
    }, 150);
    return;
  }

  /* ── Normal page + loader map ── */
  var pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('act');

  var loaders = {
    dashboard:   loadDashboard,
    branches:    loadBranches,
    printers:    loadPrinters,
    stock:       loadStock,
    paper:       loadPaper,
    approvals:   loadApprovals,
    printreport: loadPrintReport,
    /* store handled by sub-tab routing above */
    import:      loadImport,
    dba:         loadDBA,
    eodlog:      loadEOD,
    tonerlog:    loadTonerLog,
    rentals:     loadRentals,
  };

  /* Call loader — use double rAF to ensure page is painted before data loads */
  if (loaders[id]) {
    var _fn = loaders[id];
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        _fn();
      });
    });
  }
  startAutoRefresh(id);
}


/* ── Auto-refresh ───────────────────────────────────────────── */
var _autoRefreshInterval = null;
var _currentPage         = null;

var AUTO_REFRESH = {
  dashboard:   60,
  approvals:   30,
  eodlog:      60,
  tonerlog:    60,
  store:       45,
  printreport: 120,
  paper:       120,
  stock:       120,
  branches:    120,
};

function startAutoRefresh(pageId) {
  _currentPage = pageId;
  if (_autoRefreshInterval) { clearInterval(_autoRefreshInterval); _autoRefreshInterval = null; }

  var key = pageId;
  if (pageId === 'store-dispatch' || pageId === 'store-toner' ||
      pageId === 'store-paper'    || pageId === 'store-history') { key = 'store'; }

  var seconds = AUTO_REFRESH[key];
  if (!seconds) return;

  _autoRefreshInterval = setInterval(function() {
    if (document.hidden) return;
    var loaders = {
      dashboard:   typeof loadDashboard   === 'function' ? loadDashboard   : null,
      approvals:   typeof loadApprovals   === 'function' ? loadApprovals   : null,
      eodlog:      typeof loadEOD         === 'function' ? loadEOD         : null,
      tonerlog:    typeof loadTonerLog    === 'function' ? loadTonerLog    : null,
      store:       typeof loadDispatchQueue === 'function' ? loadDispatchQueue : (typeof loadStore === 'function' ? loadStore : null),
      printreport: typeof loadPrintReport === 'function' ? loadPrintReport : null,
      paper:       typeof loadPaper       === 'function' ? loadPaper       : null,
      stock:       typeof loadStock       === 'function' ? loadStock       : null,
      branches:    typeof loadBranches    === 'function' ? loadBranches    : null,
    };
    var fn = loaders[key];
    if (fn) fn();
  }, seconds * 1000);
}

/* ── Clock ───────────────────────────────────────────────── */
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