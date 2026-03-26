/* ============================================================
   SoftWave — Toner Audit Trail + Branch Performance Report
   ============================================================ */

/* ── TONER AUDIT TRAIL ───────────────────────────────────── */
var _taData = [];

async function loadTonerAudit() {
  var sel = document.getElementById('ta-branch-sel');
  var tbody = document.getElementById('ta-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px"><div class="spin" style="margin:0 auto"></div></td></tr>';

  // Load branches into dropdown once
  if (sel && sel.options.length <= 1) {
    var branches = (await silentApi('GET', '/branches')) || [];
    branches.filter(function(b){ return b.is_active; }).forEach(function(b) {
      sel.add(new Option(b.code + ' — ' + b.name, b.id));
    });
  }

  var branchId = sel ? sel.value : '';
  var qs = branchId ? '?branch_id=' + branchId : '';
  var data = (await silentApi('GET', '/nuwan/toner/audit' + qs)) || [];
  _taData = data;

  // KPIs
  var totalInstalls = data.length;
  var totalCopies   = data.reduce(function(s,r){ return s + (parseInt(r.copies_made)||0); }, 0);
  var totalCost     = data.reduce(function(s,r){ return s + (parseFloat(r.price_lkr)||0); }, 0);
  var weightedCpc   = totalCopies > 0 ? (totalCost / totalCopies) : 0;

  function setEl(id, v) { var e = document.getElementById(id); if(e) e.textContent = v; }
  setEl('ta-kpi-installs', totalInstalls.toLocaleString());
  setEl('ta-kpi-copies',   totalCopies.toLocaleString());
  setEl('ta-kpi-cost',     'Rs ' + Math.round(totalCost).toLocaleString());
  setEl('ta-kpi-cpc',      totalCopies > 0 ? 'Rs ' + weightedCpc.toFixed(2) : '—');
  var kpis = document.getElementById('ta-kpis');
  if (kpis) kpis.style.display = '';

  if (!data.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="emptys">No toner installations found.</td></tr>';
    return;
  }

  if (tbody) {
    tbody.innerHTML = data.map(function(r) {
      var installed = r.installed_at
        ? new Date(r.installed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
        : '—';
      var replaced  = r.replaced_at
        ? new Date(r.replaced_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
        : r.is_current ? '<span style="color:#10b981;font-weight:700">Active</span>' : '—';

      // Duration in days
      var duration = '—';
      if (r.installed_at) {
        var end = r.replaced_at ? new Date(r.replaced_at) : new Date();
        var days = Math.round((end - new Date(r.installed_at)) / 86400000);
        duration = days + ' days';
      }

      var copies = parseInt(r.copies_made) || 0;
      var pctUsed = parseFloat(r.pct_used) || 0;
      var pctBar  = Math.min(100, pctUsed);
      var pctCol  = pctUsed >= 90 ? '#10b981' : pctUsed >= 50 ? '#f59e0b' : '#0ea5e9';

      var cpc = r.cost_per_copy
        ? '<span style="font-weight:700;color:#0f172a">Rs ' + r.cost_per_copy + '</span>'
        : '—';

      var status = r.is_current
        ? '<span class="tag tg">● Active</span>'
        : '<span class="tag" style="background:#f1f5f9;color:#64748b">Completed</span>';

      return '<tr>'
        + '<td style="font-family:var(--m);font-weight:700;color:#0ea5e9">' + r.printer_code + '</td>'
        + '<td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">' + r.branch_code + '</span></td>'
        + '<td style="font-size:12px">' + (r.toner_model||'—') + '</td>'
        + '<td style="font-size:11px;color:#64748b">' + installed + '</td>'
        + '<td style="font-size:11px">' + replaced + '</td>'
        + '<td style="font-size:11px;color:#64748b">' + duration + '</td>'
        + '<td style="font-family:var(--m);font-weight:700">' + copies.toLocaleString() + '</td>'
        + '<td><div style="display:flex;align-items:center;gap:6px">'
        +   '<div style="height:6px;width:60px;background:#f1f5f9;border-radius:3px;overflow:hidden">'
        +     '<div style="height:100%;width:' + pctBar + '%;background:' + pctCol + ';border-radius:3px"></div>'
        +   '</div>'
        +   '<span style="font-size:11px;color:' + pctCol + ';font-weight:700">' + pctUsed + '%</span>'
        + '</div></td>'
        + '<td style="font-size:12px">Rs ' + Math.round(parseFloat(r.price_lkr)||0).toLocaleString() + '</td>'
        + '<td>' + cpc + '</td>'
        + '<td>' + status + '</td>'
        + '</tr>';
    }).join('');
  }
}


/* ── BRANCH PERFORMANCE REPORT ───────────────────────────── */
var _brData = null;

async function loadBranchReport() {
  var mSel = document.getElementById('br-month-sel');
  var ySel = document.getElementById('br-year-sel');

  // Set defaults
  if (mSel && !mSel.value) mSel.value = new Date().getMonth() + 1;
  if (ySel && !ySel.value) ySel.value = new Date().getFullYear();

  var month = mSel ? mSel.value : new Date().getMonth() + 1;
  var year  = ySel ? ySel.value : new Date().getFullYear();

  var cards = document.getElementById('br-cards');
  if (cards) cards.innerHTML = '<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto"></div></div>';

  var d = await silentApi('GET', '/nuwan/reports/branch-performance?year=' + year + '&month=' + month);
  if (!d) { if (cards) cards.innerHTML = '<div class="emptys">Failed to load</div>'; return; }
  _brData = d;

  // Grand KPIs
  function setEl(id, v) { var e = document.getElementById(id); if(e) e.textContent = v; }
  setEl('br-kpi-prints', (d.grand_total_prints||0).toLocaleString());
  setEl('br-kpi-cost',   'Rs ' + Math.round(d.grand_toner_cost||0).toLocaleString());
  setEl('br-kpi-cpc',    d.grand_cost_per_copy ? 'Rs ' + d.grand_cost_per_copy : '—');
  var gkpi = document.getElementById('br-grand-kpis');
  if (gkpi) gkpi.style.display = '';

  // Branch cards
  var maxPrints = Math.max.apply(null, d.branches.map(function(b){ return b.total_prints||0; })) || 1;

  if (cards) {
    if (!d.branches.length) {
      cards.innerHTML = '<div class="emptys">No data for this month.</div>';
    } else {
      cards.innerHTML = '<div class="br-grid">' + d.branches.map(function(b) {
        var barW = Math.round((b.total_prints / maxPrints) * 100);
        var cpcBadge = b.cost_per_copy
          ? '<span class="br-cpc-badge">Rs ' + b.cost_per_copy + ' / copy</span>'
          : '';
        return '<div class="br-card">'
          + '<div class="br-card-top">'
          +   '<div>'
          +     '<span class="br-code">' + b.branch_code + '</span>'
          +     '<span class="br-name">' + b.branch_name + '</span>'
          +   '</div>'
          +   '<div class="br-prints">' + (b.total_prints||0).toLocaleString() + '</div>'
          + '</div>'
          + '<div class="br-bar-wrap"><div class="br-bar" style="width:' + barW + '%"></div></div>'
          + '<div class="br-stats">'
          +   '<span class="br-stat">📅 ' + (b.days_logged||0) + ' days</span>'
          +   '<span class="br-stat">📈 ' + Math.round(b.avg_daily_prints||0).toLocaleString() + '/day</span>'
          +   '<span class="br-stat">🔄 ' + (b.toner_replacements||0) + ' replacements</span>'
          +   (b.toner_cost_lkr > 0 ? '<span class="br-stat">💰 Rs ' + Math.round(b.toner_cost_lkr).toLocaleString() + '</span>' : '')
          +   cpcBadge
          + '</div>'
          + '</div>';
      }).join('') + '</div>';
    }
  }

  // Detail table
  var tbody = document.getElementById('br-tbody');
  var twrap = document.getElementById('br-table-wrap');
  if (tbody && d.branches.length) {
    tbody.innerHTML = d.branches.map(function(b) {
      return '<tr>'
        + '<td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;margin-right:6px">' + b.branch_code + '</span>' + b.branch_name + '</td>'
        + '<td style="font-family:var(--m);font-weight:800">' + (b.total_prints||0).toLocaleString() + '</td>'
        + '<td>' + (b.days_logged||0) + '</td>'
        + '<td>' + Math.round(b.avg_daily_prints||0).toLocaleString() + '</td>'
        + '<td>' + (b.toner_replacements||0) + '</td>'
        + '<td>' + (b.toner_cost_lkr > 0 ? 'Rs ' + Math.round(b.toner_cost_lkr).toLocaleString() : '—') + '</td>'
        + '<td>' + (b.cost_per_copy ? '<strong>Rs ' + b.cost_per_copy + '</strong>' : '—') + '</td>'
        + '<td>' + (b.printer_count||0) + '</td>'
        + '</tr>';
    }).join('');
    if (twrap) twrap.style.display = '';
  }
}

async function exportBranchReport() {
  var mSel = document.getElementById('br-month-sel');
  var ySel = document.getElementById('br-year-sel');
  var month = mSel ? mSel.value : new Date().getMonth() + 1;
  var year  = ySel ? ySel.value : new Date().getFullYear();
  var btn = document.querySelector('#page-branchreport .btn-g');

  // Use nuwan export endpoint
  try {
    var res = await fetch('/api/nuwan/reports/branch-performance/export?year=' + year + '&month=' + month, {
      headers: { 'Authorization': 'Bearer ' + APP.token }
    });
    if (!res.ok) { toast('❌','Export failed',''); return; }
    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'BranchReport_' + year + '_' + String(month).padStart(2,'0') + '.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    toast('✅','Downloaded!','Branch Performance Report saved');
  } catch(e) {
    toast('❌','Export failed', e.message||'');
  }
}