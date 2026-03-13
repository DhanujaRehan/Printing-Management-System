/* ============================================================
   TonerPro Ultra — Navigation & Layout Module
   File: js/nav.js
   ============================================================ */

const NAVS = {
  manager: [
    { s: 'Overview',   items: [
      { i: '📊', l: 'Dashboard',  p: 'dashboard' },
      { i: '🏢', l: 'Branches',   p: 'branches' },
      { i: '🖨️', l: 'Printers',   p: 'printers' },
    ]},
    { s: 'Inventory',  items: [
      { i: '📦', l: 'Stock',      p: 'stock' },
      { i: '📄', l: 'Paper',      p: 'paper' },
    ]},
  ],
  service: [
    { s: 'My Tasks',   items: [
      { i: '🔄', l: 'Toner Replacement', p: 'replace' },
      { i: '🏢', l: 'Branch Status',     p: 'branches' },
    ]},
  ],
  dba: [
    { s: 'Admin',      items: [
      { i: '🗄️', l: 'Administration', p: 'dba' },
      { i: '📊', l: 'Dashboard',       p: 'dashboard' },
      { i: '📦', l: 'Stock',           p: 'stock' },
      { i: '📄', l: 'Paper',           p: 'paper' },
      { i: '🖨️', l: 'Printers',        p: 'printers' },
    ]},
  ],
};


function buildNav() {
  const nav = document.getElementById('sbnav');
  nav.innerHTML = '';

  const sections = NAVS[APP.user.role] || [];
  sections.forEach(sec => {
    const label = document.createElement('div');
    label.className   = 'nbsec';
    label.textContent = sec.s;
    nav.appendChild(label);

    sec.items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'nb';
      btn.innerHTML = `<span class="ni">${item.i}</span>${item.l}`;
      btn.onclick   = () => showPage(item.p, btn);
      nav.appendChild(btn);
    });
  });

  // Activate first nav item
  const first = nav.querySelector('.nb');
  if (first) {
    first.classList.add('act');
    showPage(sections[0].items[0].p, first);
  }

  // Show Add Branch button for manager/dba
  const addBrBtn = document.getElementById('addbr-btn');
  if (addBrBtn && (APP.user.role === 'manager' || APP.user.role === 'dba')) {
    addBrBtn.style.display = '';
  }
}


function showPage(id, btn) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('act'));

  // Show target page
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('act');

  // Update nav highlight
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('act'));
  if (btn) btn.classList.add('act');

  // Load page data
  const loaders = {
    dashboard: loadDashboard,
    branches:  loadBranches,
    printers:  loadPrinters,
    stock:     loadStock,
    paper:     loadPaper,
    replace:   loadService,
    dba:       loadDBA,
  };
  if (loaders[id]) loaders[id]();
}


function updateClock() {
  const el = document.getElementById('lclk');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}


// ── Modal helpers ─────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('op'); }
function closeModal(id) { document.getElementById(id).classList.remove('op'); }

// Close on backdrop click
document.querySelectorAll('.mb').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('op'); })
);


// ── Toast notifications ──────────────────────────────────

let _toastTimer;
function toast(ico, tx, sb) {
  document.getElementById('t-ico').textContent = ico;
  document.getElementById('t-tx').textContent  = tx;
  document.getElementById('t-sb').textContent  = sb;
  const t = document.getElementById('toast');
  t.classList.add('sh');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('sh'), 3500);
}


// ── Utility helpers ──────────────────────────────────────

function pColor(pct) {
  return pct <= 10 ? 'var(--er)' : pct <= 25 ? 'var(--wr)' : 'var(--ok)';
}

function pfClass(pct) {
  return pct <= 10 ? 'pfr' : pct <= 25 ? 'pfw' : 'pfg';
}

function statusTag(pct, days) {
  if (pct <= 10 || days <= 3)  return '<span class="tag tr">🔴 Critical</span>';
  if (pct <= 25 || days <= 7)  return '<span class="tag ta">🟡 Low</span>';
  return '<span class="tag tg">🟢 Good</span>';
}

function filterTable(query, tbodyId) {
  document.querySelectorAll(`#${tbodyId} tr`).forEach(r => {
    r.style.display = query && !r.textContent.toLowerCase().includes(query.toLowerCase())
      ? 'none' : '';
  });
}