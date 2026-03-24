/* ============================================================
   SoftWave — Rental Printers (Gestetner)
   File: js/rentals.js
   Visible to Manager and Nuwan only
   ============================================================ */

var _rentalsData = [];

async function loadRentals() {
  document.getElementById('rental-tbody').innerHTML =
    '<tr><td colspan="6" style="text-align:center;padding:30px"><div class="spin" style="margin:0 auto"></div></td></tr>';

  var [summary, rentals] = await Promise.all([
    silentApi('GET', '/rentals/summary').then(function(r){ return r || {}; }),
    silentApi('GET', '/rentals').then(function(r){ return r || []; })
  ]);

  // Update KPI cards
  document.getElementById('rnt-total').textContent   = summary.total   || 0;
  document.getElementById('rnt-ok').textContent      = summary.ok      || 0;
  document.getElementById('rnt-warn').textContent    = summary.warning  || 0;
  document.getElementById('rnt-soon').textContent    = summary.expiring_soon || 0;
  document.getElementById('rnt-expired').textContent = summary.expired  || 0;

  _rentalsData = rentals;
  renderRentals(rentals);
}

function renderRentals(data) {
  var tbody = document.getElementById('rental-tbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="emptys">No rental printers found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(function(r) {
    var days = parseInt(r.days_remaining);
    var daysStr = isNaN(days) ? '—'
      : days < 0   ? '<span style="color:#ef4444;font-weight:700">Expired ' + Math.abs(days) + ' days ago</span>'
      : days + ' days';

    var statusBadge = {
      expired:       '<span class="tag" style="background:#fef2f2;color:#ef4444;border:1px solid #fecaca">❌ Expired</span>',
      expiring_soon: '<span class="tag" style="background:#fff7ed;color:#f97316;border:1px solid #fed7aa">🔴 &lt;90 Days</span>',
      warning:       '<span class="tag" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a">⚠️ &lt;6 Months</span>',
      ok:            '<span class="tag" style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0">✅ Active</span>',
    }[r.status] || '—';

    var agDate = r.agreement_date ? new Date(r.agreement_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    var endDate = r.end_date ? new Date(r.end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    var rowBg = r.status === 'expired' ? 'background:#fef2f2'
              : r.status === 'expiring_soon' ? 'background:#fff7ed'
              : '';

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