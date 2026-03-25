/* ============================================================
   SoftWave — Printers Register (Rental + Purchased)
   File: js/rentals.js
   Visible to Manager, DBA and Nuwan
   ============================================================ */

var _rentalsData   = [];
var _purchasedData = [];
var _currentPrTab  = 'rental';

/* ── Tab switcher ─────────────────────────────────────────── */
function prSwitchTab(tab) {
  _currentPrTab = tab;
  ['rental','purchased'].forEach(function(t) {
    var btn   = document.getElementById('pr-tab-'       + t);
    var panel = document.getElementById('pr-panel-'     + t);
    if (btn)   btn.classList.toggle('act', t === tab);
    if (panel) panel.style.display = (t === tab) ? '' : 'none';
  });
  if (tab === 'purchased' && !_purchasedData.length) {
    loadPurchased();
  }
}

/* ── Load both on initial page load ──────────────────────── */
async function loadRentals() {
  await Promise.all([loadRentalData(), loadPurchased()]);
}

/* ── Rental Printers ─────────────────────────────────────── */
async function loadRentalData() {
  var [summary, rentals] = await Promise.all([
    silentApi('GET', '/rentals/summary').then(function(r){ return r || {}; }),
    silentApi('GET', '/rentals').then(function(r){ return r || []; })
  ]);

  // KPI
  function setEl(id, v) { var e=document.getElementById(id); if(e) e.textContent=v||0; }
  setEl('rnt-total',   summary.total);
  setEl('rnt-ok',      summary.ok);
  setEl('rnt-warn',    summary.warning);
  setEl('rnt-soon',    summary.expiring_soon);
  setEl('rnt-expired', summary.expired);

  // Tab count badge
  var badge = document.getElementById('pr-tab-rental-count');
  if (badge) badge.textContent = rentals.length ? rentals.length : '';

  _rentalsData = rentals;
  renderRentals(rentals);
}

function renderRentals(data) {
  var tbody = document.getElementById('rental-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptys">No rental printers found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(r) {
    var days = parseInt(r.days_remaining);
    var daysStr = isNaN(days) ? '—'
      : days < 0 ? '<span style="color:#ef4444;font-weight:700">Expired ' + Math.abs(days) + ' days ago</span>'
      : days + ' days';

    var statusBadge = {
      expired:       '<span class="tag" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca">❌ Expired</span>',
      expiring_soon: '<span class="tag" style="background:#fff7ed;color:#f97316;border:1px solid #fed7aa">🔴 &lt;90 Days</span>',
      warning:       '<span class="tag" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a">⚠️ &lt;6 Months</span>',
      ok:            '<span class="tag" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">✅ Active</span>',
    }[r.status] || '—';

    var agDate = r.agreement_date
      ? new Date(r.agreement_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var endDate = r.end_date
      ? new Date(r.end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var rowBg = r.status==='expired' ? 'background:#fef2f2'
              : r.status==='expiring_soon' ? 'background:#fff7ed' : '';

    return '<tr style="' + rowBg + '">'
      + '<td style="font-family:var(--m);font-weight:700;color:var(--c1)">' + r.serial_number + '</td>'
      + '<td style="font-weight:600">' + r.branch_name + '</td>'
      + '<td style="font-size:12px;color:var(--t2)">' + agDate + '</td>'
      + '<td style="font-size:12px;font-weight:600">' + endDate + '</td>'
      + '<td style="font-family:var(--m);font-size:13px">' + daysStr + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '</tr>';
  }).join('');
}

function filterRentals(q) {
  if (!q.trim()) { renderRentals(_rentalsData); return; }
  var lower = q.toLowerCase();
  renderRentals(_rentalsData.filter(function(r) {
    return r.serial_number.toLowerCase().includes(lower)
        || r.branch_name.toLowerCase().includes(lower);
  }));
}

/* ── Purchased Printers ──────────────────────────────────── */
async function loadPurchased() {
  var [summary, printers] = await Promise.all([
    silentApi('GET', '/rentals/purchased/summary').then(function(r){ return r || {}; }),
    silentApi('GET', '/rentals/purchased').then(function(r){ return r || []; })
  ]);

  // KPI
  function setEl(id, v) { var e=document.getElementById(id); if(e) e.textContent=v||0; }
  setEl('pur-total',    summary.total);
  setEl('pur-branches', summary.branches);
  setEl('pur-recent',   summary.recent);
  setEl('pur-older',    summary.older);

  // Tab count badge
  var badge = document.getElementById('pr-tab-purchased-count');
  if (badge) badge.textContent = printers.length ? printers.length : '';

  _purchasedData = printers;
  renderPurchased(printers);
}

function renderPurchased(data) {
  var tbody = document.getElementById('purchased-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="emptys">No purchased printers found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(p) {
    var purDate = p.purchased_date
      ? new Date(p.purchased_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var yrs = p.years_in_use;
    var yrsBadge = yrs >= 7
      ? '<span class="tag" style="background:#fef2f2;color:#ef4444">⚠️ ' + yrs + ' yrs</span>'
      : yrs >= 5
      ? '<span class="tag" style="background:#fffbeb;color:#d97706">' + yrs + ' yrs</span>'
      : '<span class="tag" style="background:#f0fdf4;color:#16a34a">✅ ' + yrs + ' yrs</span>';

    return '<tr>'
      + '<td style="font-family:var(--m);font-weight:700;color:var(--c1)">' + p.serial_number + '</td>'
      + '<td style="font-weight:600">' + p.branch_name + '</td>'
      + '<td style="font-size:12px;color:var(--t2)">' + (p.model||'—') + '</td>'
      + '<td style="font-size:12px">' + purDate + '</td>'
      + '<td>' + yrsBadge + '</td>'
      + '</tr>';
  }).join('');
}

function filterPurchased(q) {
  if (!q.trim()) { renderPurchased(_purchasedData); return; }
  var lower = q.toLowerCase();
  renderPurchased(_purchasedData.filter(function(p) {
    return p.serial_number.toLowerCase().includes(lower)
        || p.branch_name.toLowerCase().includes(lower)
        || (p.model||'').toLowerCase().includes(lower);
  }));
}