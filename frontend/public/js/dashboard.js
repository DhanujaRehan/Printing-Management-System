/* ============================================================
   TonerPro Ultra — Dashboard Module
   File: js/dashboard.js
   ============================================================ */

async function loadDashboard() {
  try {
    var s = function(url) { return silentApi('GET', url).then(function(r){ return r || []; }); };

    var results = await Promise.all([
      s('/printers'),
      s('/toner/stock'),
      s('/toner/alerts'),
      s('/toner/movements?limit=8'),
    ]);
    var printers  = results[0];
    var stock     = results[1];
    var alerts    = results[2];
    var movements = results[3];

    var total_stock     = stock.reduce(function(a,s){ return a + s.quantity; }, 0);
    var low             = printers.filter(function(p){ return p.current_pct <= 25; }).length;
    var crit            = printers.filter(function(p){ return p.days_remaining <= 3 || p.current_pct <= 10; }).length;
    var branches_active = [...new Set(printers.map(function(p){ return p.branch_code; }))].length;

    document.getElementById('k-branches').textContent   = branches_active;
    document.getElementById('k-branches-s').textContent = printers.length + ' total printers';
    document.getElementById('k-stock').textContent      = total_stock;
    document.getElementById('k-stock-s').textContent    = 'Across ' + stock.length + ' toner models';
    document.getElementById('k-low').textContent        = low;
    document.getElementById('k-low-s').textContent      = low > 0 ? low + ' printers need attention' : 'All levels OK ✓';
    document.getElementById('k-crit').textContent       = crit;
    document.getElementById('k-crit-s').textContent     = crit > 0 ? 'Immediate action required' : 'No critical alerts ✓';

    var crits = alerts.filter(function(p){ return p.current_pct <= 10 || p.days_remaining <= 3; }).slice(0, 2);
    var warns = alerts.filter(function(p){ return p.current_pct > 10 && p.current_pct <= 25 && p.days_remaining > 3; }).slice(0, 2);

    document.getElementById('dash-alerts').innerHTML = crits.map(function(p) {
      return '<div class="ac cr">'
        + '<div class="acico">🚨</div>'
        + '<div>'
        + '<div class="actit">Printer ' + p.printer_code + ' — Critical (' + p.current_pct + '% / ' + p.days_remaining + ' days left)</div>'
        + '<div class="acsub">Branch ' + p.branch_code + ' · ' + p.toner_model + ' · ' + (p.current_copies || 0).toLocaleString() + ' copies remaining</div>'
        + '</div>'
        + '<button class="acbtn" onclick="toast(\'🚀\',\'Dispatch logged\',\'Printer ' + p.printer_code + '\')">Dispatch</button>'
        + '</div>';
    }).concat(warns.map(function(p) {
      return '<div class="ac wn">'
        + '<div class="acico">⚠️</div>'
        + '<div>'
        + '<div class="actit">Printer ' + p.printer_code + ' — Low Toner (' + p.current_pct + '%)</div>'
        + '<div class="acsub">Branch ' + p.branch_code + ' · ' + p.days_remaining + ' days remaining</div>'
        + '</div>'
        + '<button class="acbtn" onclick="toast(\'📅\',\'Scheduled\',\'Printer ' + p.printer_code + '\')">Schedule</button>'
        + '</div>';
    })).join('');

    document.getElementById('pr-tbody').innerHTML = printers.map(function(p) {
      return '<tr>'
        + '<td><span style="font-family:var(--m);font-weight:700;color:var(--c1)">' + p.printer_code + '</span></td>'
        + '<td><span style="font-size:11px;padding:3px 8px;border-radius:6px;background:#f1f5f9;font-weight:600;color:var(--t2)">Branch ' + p.branch_code + '</span></td>'
        + '<td style="min-width:130px"><div style="display:flex;align-items:center;gap:8px">'
        + '<div class="pb" style="min-width:65px"><div class="pf ' + pfClass(p.current_pct) + '" style="width:' + (p.current_pct || 0) + '%"></div></div>'
        + '<span style="font-family:var(--m);font-size:11px;font-weight:700;color:' + pColor(p.current_pct) + '">' + (p.current_pct || 0) + '%</span>'
        + '</div></td>'
        + '<td style="font-size:11px;color:var(--t2)">' + (p.toner_model || '—') + '</td>'
        + '<td style="font-family:var(--m);font-size:12px;font-weight:700;color:' + ((p.days_remaining != null && p.days_remaining <= 3) ? 'var(--er)' : (p.days_remaining != null && p.days_remaining <= 7) ? 'var(--wr)' : 'var(--tx)') + '">' + (p.days_remaining != null ? p.days_remaining : '—') + 'd</td>'
        + '<td style="font-family:var(--m);font-size:12px">' + (p.current_copies || 0).toLocaleString() + '</td>'
        + '<td style="font-size:11px;color:var(--t2)">' + (p.next_toner_date ? new Date(p.next_toner_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—') + '</td>'
        + '<td>' + statusTag(p.current_pct, p.days_remaining) + '</td>'
        + '</tr>';
    }).join('');

    document.getElementById('dash-activity').innerHTML = movements.slice(0, 6).map(function(m, i) {
      return '<div class="afi">'
        + '<div class="afdc">'
        + '<div class="afd" style="background:' + (m.movement_type === 'IN' ? 'var(--c1)' : 'var(--c3)') + '"></div>'
        + (i < 5 ? '<div class="afl"></div>' : '')
        + '</div>'
        + '<div style="flex:1">'
        + '<div class="aft">' + (m.movement_type === 'IN' ? 'Stock received — ' + m.model_code + ' ×' + m.quantity : 'Toner installed — ' + (m.printer_code || '—') + ' (' + m.model_code + ')') + '</div>'
        + '<div class="afm">' + new Date(m.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) + ' · ' + (m.performed_by_name || '—') + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

  } catch(e) { console.error('Dashboard load error:', e); }
}

function filterPrTable(q) {
  filterTable(q, 'pr-tbody');
}