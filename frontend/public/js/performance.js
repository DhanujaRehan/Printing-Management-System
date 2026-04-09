/* ============================================================
   SoftWave — Performance Summary (Cost per Copy)
   File: js/performance.js
   ============================================================ */

var _perfData     = null;
var _perfBranches = [];

async function loadPerformance() {
  // Set default month/year
  var now = new Date();
  var mSel = document.getElementById('perf-month-sel');
  var ySel = document.getElementById('perf-year-sel');
  if (mSel && !mSel.value) mSel.value = now.getMonth()+1;
  if (ySel && !ySel.value) ySel.value = now.getFullYear();

  // Load branches into filter once
  if (!_perfBranches.length) {
    _perfBranches = (await silentApi('GET', '/audit/branches')) || [];
    var bSel = document.getElementById('perf-branch-sel');
    if (bSel && bSel.options.length <= 1) {
      _perfBranches.forEach(function(b) {
        bSel.add(new Option(b.code+' — '+b.name, b.id));
      });
    }
  }

  var month  = (mSel || {}).value || now.getMonth()+1;
  var year   = (ySel || {}).value || now.getFullYear();
  var branch = (document.getElementById('perf-branch-sel') || {}).value || '';

  var params = ['month='+month,'year='+year];
  if (branch) params.push('branch_id='+branch);

  var container = document.getElementById('perf-container');
  container.innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';

  _perfData = await silentApi('GET', '/audit/performance?'+params.join('&'));
  if (!_perfData) { container.innerHTML = '<div class="svc-empty" style="padding:50px">Failed to load</div>'; return; }

  // KPIs
  var kpis = document.getElementById('perf-kpis');
  if (kpis) {
    kpis.style.display = '';
    document.getElementById('perf-kpi-prints').textContent = (_perfData.grand_prints||0).toLocaleString();
    document.getElementById('perf-kpi-toner').textContent  = 'Rs '+Math.round(_perfData.grand_toner_cost||0).toLocaleString();
    document.getElementById('perf-kpi-paper').textContent  = 'Rs '+Math.round(_perfData.grand_paper_cost||0).toLocaleString();
    document.getElementById('perf-kpi-hw').textContent     = 'Rs '+Math.round(_perfData.grand_hw_cost||0).toLocaleString();
    document.getElementById('perf-kpi-cpc').textContent    = _perfData.grand_cpc ? 'Rs '+_perfData.grand_cpc : '—';
  }

  renderPerformance(_perfData.branches);
}

function renderPerformance(branches) {
  var container = document.getElementById('perf-container');
  if (!branches || !branches.length) {
    container.innerHTML = '<div class="svc-empty" style="padding:50px"><div style="font-size:44px;margin-bottom:12px">📈</div><div style="font-size:15px;font-weight:700">No data for this period</div></div>';
    return;
  }

  var maxCost = Math.max.apply(null, branches.map(function(b){ return b.total_cost||0; })) || 1;
  var colors  = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ec4899','#14b8a6','#8b5cf6','#22c55e','#f97316','#06b6d4'];

  container.innerHTML = branches.map(function(b, bi) {
    var col    = colors[bi % colors.length];
    var barW   = Math.round((b.total_cost / maxCost) * 100);
    var cpc    = b.cost_per_copy ? 'Rs '+b.cost_per_copy : '—';
    var cpcCol = !b.cost_per_copy?'#94a3b8':b.cost_per_copy>2?'#ef4444':b.cost_per_copy>1?'#f59e0b':'#10b981';

    // Cost breakdown bar
    var total = (b.toner_cost||0)+(b.paper_cost||0)+(b.hardware_cost||0)||1;
    var tonerPct = Math.round((b.toner_cost||0)/total*100);
    var paperPct = Math.round((b.paper_cost||0)/total*100);
    var hwPct    = 100 - tonerPct - paperPct;

    // Printer rows
    var printerRows = (b.printers||[]).map(function(p) {
      var pcpc = p.cost_per_copy ? 'Rs '+p.cost_per_copy : '—';
      var pcpcCol = !p.cost_per_copy?'#94a3b8':p.cost_per_copy>2?'#ef4444':p.cost_per_copy>1?'#f59e0b':'#10b981';
      return '<tr>'
        +'<td style="font-family:var(--m);font-weight:700;color:#0ea5e9;padding-left:24px">'+p.printer_code+'</td>'
        +'<td style="font-size:11px;color:#64748b">'+(p.model||'—')+'</td>'
        +'<td style="font-family:var(--m);font-weight:700">'+(parseInt(p.prints)||0).toLocaleString()+'</td>'
        +'<td>Rs '+(parseInt(p.toner_cost)||0).toLocaleString()+'</td>'
        +'<td>Rs '+(parseInt(p.paper_cost)||0).toLocaleString()+'</td>'
        +'<td>Rs '+(parseInt(p.hardware_cost)||0).toLocaleString()+'</td>'
        +'<td style="font-weight:800;color:'+pcpcCol+'">'+pcpc+'</td>'
        +'</tr>';
    }).join('');

    return '<div class="perf-branch-block">'
      // Branch header
      +'<div class="perf-branch-hdr">'
      +  '<div class="perf-branch-left">'
      +    '<div class="perf-branch-badge" style="background:'+col+'18;color:'+col+'">'+b.branch_code+'</div>'
      +    '<div>'
      +      '<div class="perf-branch-name">'+b.branch_name+'</div>'
      +      '<div class="perf-branch-meta">'+
               (b.total_prints||0).toLocaleString()+' prints · '+
               (b.toner_replacements||0)+' toner replacements · '+
               (b.hardware_installs||0)+' hw installs'
      +      '</div>'
      +    '</div>'
      +  '</div>'
      +  '<div class="perf-branch-right">'
      +    '<div class="perf-total-cost">Rs '+(Math.round(b.total_cost||0)).toLocaleString()+'</div>'
      +    '<div class="perf-cpc" style="color:'+cpcCol+'">'+cpc+' / copy</div>'
      +  '</div>'
      +'</div>'
      // Cost breakdown bar
      +'<div class="perf-cost-bar-wrap">'
      +  '<div class="perf-cost-bar" style="width:'+tonerPct+'%;background:#0ea5e9" title="Toner: Rs '+Math.round(b.toner_cost||0).toLocaleString()+'"></div>'
      +  '<div class="perf-cost-bar" style="width:'+paperPct+'%;background:#10b981" title="Paper: Rs '+Math.round(b.paper_cost||0).toLocaleString()+'"></div>'
      +  '<div class="perf-cost-bar" style="width:'+hwPct+'%;background:#f59e0b" title="Hardware: Rs '+Math.round(b.hardware_cost||0).toLocaleString()+'"></div>'
      +'</div>'
      +'<div class="perf-legend">'
      +  '<span class="perf-leg-item"><span style="background:#0ea5e9"></span>Toner Rs '+Math.round(b.toner_cost||0).toLocaleString()+'</span>'
      +  '<span class="perf-leg-item"><span style="background:#10b981"></span>Paper Rs '+Math.round(b.paper_cost||0).toLocaleString()+'</span>'
      +  '<span class="perf-leg-item"><span style="background:#f59e0b"></span>Hardware Rs '+Math.round(b.hardware_cost||0).toLocaleString()+'</span>'
      +'</div>'
      // Printer detail table
      +(b.printers && b.printers.length
        ?'<div class="perf-printer-wrap">'
         +'<table class="tbl" style="margin-top:10px">'
         +'<thead><tr><th>Printer</th><th>Model</th><th>Prints</th><th>Toner Cost</th><th>Paper Cost</th><th>HW Cost</th><th>Cost/Copy</th></tr></thead>'
         +'<tbody>'+printerRows+'</tbody>'
         +'</table>'
         +'</div>'
        :'')
      +'</div>';
  }).join('');
}

async function exportPerformance() {
  if (!_perfData) { toast('⚠️','Load data first',''); return; }
  var month = (document.getElementById('perf-month-sel')||{}).value || new Date().getMonth()+1;
  var year  = (document.getElementById('perf-year-sel') ||{}).value || new Date().getFullYear();
  var branch= (document.getElementById('perf-branch-sel')||{}).value||'';
  var params=['month='+month,'year='+year];
  if(branch)params.push('branch_id='+branch);
  try {
    var res = await fetch('/api/audit/performance/export?'+params.join('&'), {
      headers: {'Authorization':'Bearer '+APP.token}
    });
    if (!res.ok) { toast('❌','Export failed',''); return; }
    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = 'SoftWave_Performance_'+year+'_'+String(month).padStart(2,'0')+'.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    toast('✅','Downloaded!','Performance Excel saved');
  } catch(e) { toast('❌','Download failed',''); }
}
