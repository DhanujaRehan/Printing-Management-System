/* ============================================================
   SoftWave — Auditing Hub + Toner / Paper / Hardware Audit
   File: js/auditing.js
   ============================================================ */

var _auditView     = null;   // 'toner' | 'paper' | 'hardware'
var _auditData     = [];
var _auditBranches = [];

/* ── Entry point ─────────────────────────────────────────── */
async function loadAuditing() {
  if (!_auditBranches.length) {
    _auditBranches = (await silentApi('GET', '/audit/branches')) || [];
  }
  if (!_auditView) {
    renderAuditHub();
  } else {
    renderAuditFilters();
    loadAuditData();
  }
}

/* ── Hub — 3 cards ───────────────────────────────────────── */
function renderAuditHub() {
  _auditView = null;
  var el = document.getElementById('auditing-container');
  el.innerHTML =
    '<div class="audit-hub-grid">'
    + auditHubCard('toner',    '🖨️', 'Toner Audit',
        'Full lifecycle of every toner cartridge — copies made, cost per copy, remaining',
        'linear-gradient(135deg,#0ea5e9,#6366f1)')
    + auditHubCard('paper',    '📄', 'Paper Audit',
        'Branch paper receipts, usage, waste and cost breakdown per type',
        'linear-gradient(135deg,#10b981,#0ea5e9)')
    + auditHubCard('hardware', '🔧', 'Hardware Audit',
        'Installed hardware parts, prices, estimated next replacement dates',
        'linear-gradient(135deg,#f59e0b,#ef4444)')
    + '</div>';
}

function auditHubCard(type, icon, title, desc, grad) {
  return '<div class="audit-hub-card" onclick="openAuditView(\'' + type + '\')">'
    + '<div class="audit-hub-icon" style="background:' + grad + '">' + icon + '</div>'
    + '<div class="audit-hub-body">'
    +   '<div class="audit-hub-title">' + title + '</div>'
    +   '<div class="audit-hub-desc">'  + desc  + '</div>'
    + '</div>'
    + '<div class="audit-hub-arrow">→</div>'
    + '</div>';
}

/* ── Open a specific audit view ──────────────────────────── */
function openAuditView(type) {
  _auditView = type;
  renderAuditFilters();
  loadAuditData();
}

/* ── Filter bar ──────────────────────────────────────────── */
function renderAuditFilters() {
  var titles   = { toner:'🖨️ Toner Audit', paper:'📄 Paper Audit', hardware:'🔧 Hardware Audit' };
  var subtitles = {
    toner:    'Toner lifecycle — branch · printer · model · copies · cost',
    paper:    'Paper dispatch & usage — branch · type · waste · cost',
    hardware: 'Hardware installations — branch · printer · part · price · next date',
  };

  var branchOpts = '<option value="">All Branches</option>'
    + _auditBranches.map(function(b) {
        return '<option value="' + b.id + '">' + b.code + ' — ' + b.name + '</option>';
      }).join('');

  var el = document.getElementById('auditing-container');
  el.innerHTML =
    '<div class="audit-back-bar">'
    +   '<button class="audit-back-btn" onclick="renderAuditHub()">← Back to Auditing</button>'
    +   '<div>'
    +     '<div class="audit-view-title">' + titles[_auditView] + '</div>'
    +     '<div class="audit-view-sub">'   + subtitles[_auditView] + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="audit-filter-bar">'
    +   '<div class="audit-filter-group">'
    +     '<label class="audit-filter-lbl">From Date</label>'
    +     '<input type="date" class="audit-filter-input" id="audit-from" onchange="loadAuditData()">'
    +   '</div>'
    +   '<div class="audit-filter-group">'
    +     '<label class="audit-filter-lbl">To Date</label>'
    +     '<input type="date" class="audit-filter-input" id="audit-to" onchange="loadAuditData()">'
    +   '</div>'
    +   '<div class="audit-filter-group">'
    +     '<label class="audit-filter-lbl">Branch</label>'
    +     '<select class="audit-filter-input" id="audit-branch" onchange="loadAuditData()">' + branchOpts + '</select>'
    +   '</div>'
    +   '<div class="audit-filter-actions">'
    +     '<button class="audit-btn-search" onclick="loadAuditData()">🔍 Search</button>'
    +     '<button class="audit-btn-clear"  onclick="clearAuditFilters()">✕ Clear</button>'
    +     '<button class="audit-btn-export" onclick="exportAudit()">📥 Excel</button>'
    +   '</div>'
    + '</div>'
    + '<div class="audit-search-bar">'
    +   '<input class="audit-search-input" id="audit-search" placeholder="🔍 Quick search..." oninput="filterAuditTable(this.value)">'
    + '</div>'
    + '<div id="audit-kpis"></div>'
    + '<div id="audit-table-wrap"><div class="loading"><div class="spin"></div>Loading...</div></div>';
}

function clearAuditFilters() {
  ['audit-from','audit-to'].forEach(function(id) {
    var el=document.getElementById(id); if(el) el.value='';
  });
  var b=document.getElementById('audit-branch'); if(b) b.value='';
  loadAuditData();
}

/* ── Load data ───────────────────────────────────────────── */
async function loadAuditData() {
  var wrap = document.getElementById('audit-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading"><div class="spin"></div>Loading...</div>';

  var from   = (document.getElementById('audit-from')   || {}).value || '';
  var to     = (document.getElementById('audit-to')     || {}).value || '';
  var branch = (document.getElementById('audit-branch') || {}).value || '';

  var qs = '';
  var params = [];
  if (from)   params.push('date_from=' + from);
  if (to)     params.push('date_to='   + to);
  if (branch) params.push('branch_id=' + branch);
  if (params.length) qs = '?' + params.join('&');

  _auditData = (await silentApi('GET', '/audit/' + _auditView + qs)) || [];
  renderAuditKPIs();
  renderAuditTable(_auditData);
}

/* ── KPIs ────────────────────────────────────────────────── */
function renderAuditKPIs() {
  var el = document.getElementById('audit-kpis'); if (!el) return;
  var kpis = [];

  if (_auditView === 'toner') {
    var totalCopies = _auditData.reduce(function(s,r){ return s+(parseInt(r.copies_made)||0); },0);
    var totalCost   = _auditData.reduce(function(s,r){ return s+(parseFloat(r.price_lkr)||0); },0);
    var avgCpc      = totalCopies>0 ? totalCost/totalCopies : 0;
    kpis = [
      { n: _auditData.length,           l: 'Installations'      },
      { n: totalCopies.toLocaleString(), l: 'Total Copies Made'  },
      { n: 'Rs '+Math.round(totalCost).toLocaleString(), l: 'Total Cost (LKR)' },
      { n: totalCopies>0?'Rs '+avgCpc.toFixed(2):'—', l: 'Avg Cost/Copy' },
    ];
  } else if (_auditView === 'paper') {
    var totalReams  = _auditData.reduce(function(s,r){ return s+(parseInt(r.reams_received)||0); },0);
    var totalCost2  = _auditData.reduce(function(s,r){ return s+(parseFloat(r.total_cost_lkr)||0); },0);
    var totalWaste  = _auditData.reduce(function(s,r){ return s+(parseInt(r.waste_sheets)||0); },0);
    kpis = [
      { n: _auditData.length,            l: 'Dispatch Events'    },
      { n: totalReams.toLocaleString(),  l: 'Reams Received'     },
      { n: totalWaste.toLocaleString()+' sheets', l: 'Total Waste' },
      { n: 'Rs '+Math.round(totalCost2).toLocaleString(), l: 'Total Cost (LKR)' },
    ];
  } else if (_auditView === 'hardware') {
    var overdue  = _auditData.filter(function(r){ return r.life_status==='overdue'; }).length;
    var dueSoon  = _auditData.filter(function(r){ return r.life_status==='due_soon'; }).length;
    var totalCost3 = _auditData.reduce(function(s,r){ return s+(parseFloat(r.price_lkr)||0); },0);
    kpis = [
      { n: _auditData.length,      l: 'Parts Installed'   },
      { n: overdue,                l: '🔴 Overdue'         },
      { n: dueSoon,                l: '🟡 Due in 30 days'  },
      { n: 'Rs '+Math.round(totalCost3).toLocaleString(), l: 'Total Cost (LKR)' },
    ];
  }

  el.innerHTML = '<div class="krow mb16">'
    + kpis.map(function(k) {
        return '<div class="kcard"><div class="knum">' + k.n + '</div><div class="klbl">' + k.l + '</div></div>';
      }).join('')
    + '</div>';
}

/* ── Table renderer ──────────────────────────────────────── */
function renderAuditTable(data) {
  var wrap = document.getElementById('audit-table-wrap'); if (!wrap) return;
  if (!data.length) {
    wrap.innerHTML = '<div class="svc-empty" style="padding:50px"><div style="font-size:44px;margin-bottom:12px">📋</div><div style="font-size:15px;font-weight:700">No records found</div><div style="font-size:13px;color:#94a3b8;margin-top:6px">Try adjusting the filters</div></div>';
    return;
  }

  var thead = '', rows = '';

  if (_auditView === 'toner') {
    thead = '<tr><th>Branch</th><th>Printer</th><th>Toner Model</th><th>Installed</th><th>Replaced</th><th>Copies Made</th><th>Used %</th><th>Remaining</th><th>Price (LKR)</th><th>Cost/Copy</th><th>Status</th></tr>';
    rows = data.map(function(r) {
      var inst = r.installed_at ? new Date(r.installed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      var repl = r.replaced_at  ? new Date(r.replaced_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})  : (r.is_current?'<span style="color:#10b981;font-weight:700">Active</span>':'—');
      var pct  = parseFloat(r.pct_used||0);
      var pCol = pct>=80?'#10b981':pct>=50?'#f59e0b':'#0ea5e9';
      var st   = r.is_current
        ? '<span class="tag tg">● Active</span>'
        : '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">Completed</span>';
      return '<tr>'
        +'<td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700">'+r.branch_code+'</span></td>'
        +'<td style="font-family:var(--m);font-weight:700;color:#0ea5e9">'+r.printer_code+'</td>'
        +'<td style="font-size:12px">'+(r.toner_model||'—')+'</td>'
        +'<td style="font-size:11px;color:#64748b">'+inst+'</td>'
        +'<td style="font-size:11px">'+repl+'</td>'
        +'<td style="font-family:var(--m);font-weight:700">'+(parseInt(r.copies_made)||0).toLocaleString()+'</td>'
        +'<td><div style="display:flex;align-items:center;gap:5px"><div style="height:5px;width:50px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+Math.min(100,pct)+'%;background:'+pCol+';border-radius:3px"></div></div><span style="font-size:11px;color:'+pCol+';font-weight:700">'+pct+'%</span></div></td>'
        +'<td style="font-family:var(--m);font-size:12px">'+(parseInt(r.copies_remaining)||0).toLocaleString()+'</td>'
        +'<td style="font-size:12px">Rs '+(parseInt(r.price_lkr)||0).toLocaleString()+'</td>'
        +'<td style="font-weight:700;color:#0f172a">'+(r.cost_per_copy?'Rs '+r.cost_per_copy:'—')+'</td>'
        +'<td>'+st+'</td>'
        +'</tr>';
    }).join('');
  }

  else if (_auditView === 'paper') {
    thead = '<tr><th>Branch</th><th>Paper Type</th><th>Received Date</th><th>Reams</th><th>Sheets</th><th>Single Used</th><th>Double Used</th><th>Waste</th><th>Remaining</th><th>Cost (LKR)</th><th>Waste Cost</th></tr>';
    rows = data.map(function(r) {
      var dt   = r.received_date ? new Date(r.received_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      var wcol = parseInt(r.waste_sheets||0)>0?'#ef4444':'#94a3b8';
      return '<tr>'
        +'<td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700">'+r.branch_code+'</span></td>'
        +'<td><span style="font-weight:700;font-size:12px">'+(r.paper_name||'—')+'</span><br><span style="font-size:10px;color:#94a3b8">'+r.size+' '+r.gsm+'gsm</span></td>'
        +'<td style="font-size:11px;color:#64748b">'+dt+'</td>'
        +'<td style="font-family:var(--m);font-weight:700">'+(parseInt(r.reams_received)||0)+'</td>'
        +'<td style="font-family:var(--m)">'+(parseInt(r.sheets_received)||0).toLocaleString()+'</td>'
        +'<td>'+(parseInt(r.total_single)||0).toLocaleString()+'</td>'
        +'<td>'+(parseInt(r.total_double)||0).toLocaleString()+'</td>'
        +'<td style="font-weight:700;color:'+wcol+'">'+(parseInt(r.waste_sheets)||0).toLocaleString()+'</td>'
        +'<td style="font-weight:700;color:#10b981">'+(parseInt(r.remaining)||0).toLocaleString()+'</td>'
        +'<td style="font-weight:700">Rs '+(parseInt(r.total_cost_lkr)||0).toLocaleString()+'</td>'
        +'<td style="color:#ef4444;font-weight:700">Rs '+(parseInt(r.waste_cost_lkr)||0).toLocaleString()+'</td>'
        +'</tr>';
    }).join('');
  }

  else if (_auditView === 'hardware') {
    thead = '<tr><th>Branch</th><th>Printer</th><th>Hardware Part</th><th>Installed</th><th>Price (LKR)</th><th>Life (months)</th><th>Next Date</th><th>Days Left</th><th>Status</th></tr>';
    rows = data.map(function(r) {
      var inst = r.installed_at ? new Date(r.installed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      var next = r.estimated_next_date ? new Date(r.estimated_next_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      var days = r.days_remaining;
      var statusMap = {
        overdue:  '<span class="tag tr">🔴 Overdue</span>',
        due_soon: '<span class="tag ta">🟡 Due Soon</span>',
        warning:  '<span style="background:#fff7ed;color:#c2410c;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700">🟠 Warning</span>',
        good:     '<span class="tag tg">🟢 Good</span>',
        unknown:  '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:5px;font-size:10px">—</span>',
      };
      var daysCol = days==null?'#94a3b8':days<=0?'#ef4444':days<=30?'#f59e0b':'#10b981';
      return '<tr>'
        +'<td><span style="background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700">'+r.branch_code+'</span></td>'
        +'<td style="font-family:var(--m);font-weight:700;color:#0ea5e9">'+r.printer_code+'</td>'
        +'<td style="font-weight:700;font-size:13px">'+r.part_name+'</td>'
        +'<td style="font-size:11px;color:#64748b">'+inst+'</td>'
        +'<td style="font-weight:700">Rs '+(parseInt(r.price_lkr)||0).toLocaleString()+'</td>'
        +'<td style="text-align:center">'+(r.estimated_life_months||12)+'</td>'
        +'<td style="font-size:11px">'+next+'</td>'
        +'<td style="font-weight:700;color:'+daysCol+'">'+(days!=null?days+'d':'—')+'</td>'
        +'<td>'+(statusMap[r.life_status]||'—')+'</td>'
        +'</tr>';
    }).join('');
  }

  wrap.innerHTML = '<div class="card"><div class="scx"><table class="tbl" id="audit-data-table"><thead>'+thead+'</thead><tbody id="audit-tbody">'+rows+'</tbody></table></div></div>';
}

/* ── Quick search filter ─────────────────────────────────── */
function filterAuditTable(q) {
  var rows = document.querySelectorAll('#audit-tbody tr');
  rows.forEach(function(r) {
    r.style.display = (!q || r.textContent.toLowerCase().includes(q.toLowerCase())) ? '' : 'none';
  });
}

/* ── Excel export ────────────────────────────────────────── */
async function exportAudit() {
  if (!_auditView) return;
  var from   = (document.getElementById('audit-from')   || {}).value || '';
  var to     = (document.getElementById('audit-to')     || {}).value || '';
  var branch = (document.getElementById('audit-branch') || {}).value || '';
  var params = [];
  if (from)   params.push('date_from='+from);
  if (to)     params.push('date_to='+to);
  if (branch) params.push('branch_id='+branch);
  var qs = params.length ? '?'+params.join('&') : '';

  // Build Excel from current data using SheetJS
  if (!_auditData.length) { toast('⚠️','No data to export',''); return; }

  var headers, rows;
  if (_auditView === 'toner') {
    headers = ['Branch','Printer','Toner Model','Installed','Replaced','Copies Made','Used %','Remaining','Price LKR','Cost/Copy','Status'];
    rows = _auditData.map(function(r) { return [
      r.branch_code, r.printer_code, r.toner_model,
      r.installed_at?r.installed_at.toString().slice(0,10):'',
      r.replaced_at ?r.replaced_at.toString().slice(0,10) :(r.is_current?'Active':''),
      r.copies_made, r.pct_used, r.copies_remaining,
      r.price_lkr, r.cost_per_copy||'', r.is_current?'Active':'Completed'
    ];});
  } else if (_auditView === 'paper') {
    headers = ['Branch','Paper','Received Date','Reams','Sheets','Single Used','Double Used','Waste','Remaining','Cost LKR','Waste Cost LKR'];
    rows = _auditData.map(function(r) { return [
      r.branch_code, r.paper_name,
      r.received_date?r.received_date.toString().slice(0,10):'',
      r.reams_received, r.sheets_received, r.total_single, r.total_double,
      r.waste_sheets, r.remaining, r.total_cost_lkr, r.waste_cost_lkr
    ];});
  } else {
    headers = ['Branch','Printer','Part','Installed','Price LKR','Life Months','Next Date','Days Left','Status'];
    rows = _auditData.map(function(r) { return [
      r.branch_code, r.printer_code, r.part_name,
      r.installed_at?r.installed_at.toString().slice(0,10):'',
      r.price_lkr, r.estimated_life_months,
      r.estimated_next_date?r.estimated_next_date.toString().slice(0,10):'',
      r.days_remaining, r.life_status
    ];});
  }

  var titles = { toner:'Toner_Audit', paper:'Paper_Audit', hardware:'Hardware_Audit' };
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
  XLSX.utils.book_append_sheet(wb, ws, titles[_auditView]);
  XLSX.writeFile(wb, 'SoftWave_'+titles[_auditView]+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('✅','Downloaded!','Audit Excel saved');
}
