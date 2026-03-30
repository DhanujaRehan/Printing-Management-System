/* ============================================================
   SoftWave — Print Activity Report (Manager / DBA)
   File: js/printreport.js
   ============================================================ */

var _prAllLogs    = [];
var _prBranches   = [];
var _prPaperLogs  = [];
var _prFilterDate   = '';
var _prFilterBranch = '';

async function loadPrintReport() {
  const container = document.getElementById('pr-report-container');

  container.innerHTML = '<div class="loading"><div class="spin"></div>Loading print activity...</div>';

  const [logs, branches, paperLogs] = await Promise.all([
    silentApi('GET', '/requests/print-logs').then(r => r || []),
    silentApi('GET', '/branches').then(r => r || []),
    silentApi('GET', '/nuwan/prints/paper-summary').then(r => r ? r.rows || [] : []),
  ]);

  _prAllLogs   = logs;
  _prBranches  = branches;
  _prPaperLogs = paperLogs;

  // Populate branch filter
  const brSel = document.getElementById('pr-filter-branch-sel');
  if (brSel.options.length <= 1) {
    branches.forEach(b => brSel.add(new Option(b.name, b.code)));
  }

  // Populate date filter with unique dates
  const dateSel = document.getElementById('pr-filter-date-sel');
  const dates   = [...new Set(logs.map(l => l.log_date ? l.log_date.split('T')[0] : null).filter(Boolean))].sort().reverse();
  dateSel.innerHTML = '<option value="">All Dates</option>';
  dates.forEach(d => {
    const label = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    dateSel.add(new Option(label, d));
  });

  // Set default filter to today if exists, else latest date
  const today = new Date().toISOString().split('T')[0];
  if (dates.includes(today)) {
    dateSel.value = today;
    _prFilterDate = today;
  } else if (dates.length) {
    dateSel.value = dates[0];
    _prFilterDate = dates[0];
  }

  renderPrintReport();
}


function renderPrintReport() {
  const container = document.getElementById('pr-report-container');

  // Apply filters to print logs
  let logs = _prAllLogs;
  if (_prFilterDate)   logs = logs.filter(l => l.log_date && l.log_date.startsWith(_prFilterDate));
  if (_prFilterBranch) logs = logs.filter(l => l.branch_code === _prFilterBranch);

  // Apply filters to paper logs
  let paperLogs = _prPaperLogs;
  if (_prFilterDate)   paperLogs = paperLogs.filter(l => l.log_date && l.log_date.toString().startsWith(_prFilterDate));
  if (_prFilterBranch) paperLogs = paperLogs.filter(l => l.branch_code === _prFilterBranch);

  // Build paper lookup: branch_code+date → {a4, b4, legal}
  const paperMap = {};
  paperLogs.forEach(l => {
    const key = l.branch_code + '|' + (l.log_date ? l.log_date.toString().slice(0,10) : '');
    if (!paperMap[key]) paperMap[key] = { a4: 0, b4: 0, legal: 0, logged_by: l.logged_by };
    const total = (parseInt(l.single_side) || 0) + (parseInt(l.double_side) || 0);
    if (l.paper_type === 'a4')    paperMap[key].a4    += total;
    if (l.paper_type === 'b4')    paperMap[key].b4    += total;
    if (l.paper_type === 'legal') paperMap[key].legal += total;
  });

  // KPIs
  const totalPrints    = logs.reduce((a, l) => a + (l.print_count || 0), 0);
  const activeBranches = new Set(logs.map(l => l.branch_code)).size;
  const activePrinters = new Set(logs.map(l => l.printer_code)).size;
  const avgPerPrinter  = activePrinters ? Math.round(totalPrints / activePrinters) : 0;

  document.getElementById('pr-kpi-total').textContent    = totalPrints.toLocaleString();
  document.getElementById('pr-kpi-branches').textContent = activeBranches;
  document.getElementById('pr-kpi-printers').textContent = activePrinters;
  document.getElementById('pr-kpi-avg').textContent      = avgPerPrinter.toLocaleString();

  if (!logs.length) {
    container.innerHTML = '<div class="svc-empty" style="padding:50px">'
      + '<div style="font-size:44px;margin-bottom:14px">📊</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--tx)">No print logs found</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-top:6px">Try a different date or branch filter</div>'
      + '</div>';
    return;
  }

  // Group by branch
  const byBranch = {};
  logs.forEach(l => {
    const key = l.branch_code;
    if (!byBranch[key]) byBranch[key] = { code: l.branch_code, name: l.branch_name, printers: [] };
    byBranch[key].printers.push(l);
  });

  // Sort branches by total prints descending
  const sorted = Object.values(byBranch).sort((a, b) => {
    const ta = a.printers.reduce((s, p) => s + (p.print_count || 0), 0);
    const tb = b.printers.reduce((s, p) => s + (p.print_count || 0), 0);
    return tb - ta;
  });

  const maxTotal = sorted.length ? sorted[0].printers.reduce((s, p) => s + (p.print_count || 0), 0) : 1;

  container.innerHTML = sorted.map((branch, bi) => {
    const branchTotal = branch.printers.reduce((s, p) => s + (p.print_count || 0), 0);
    const barWidth    = Math.round(branchTotal / maxTotal * 100);
    const colors      = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ec4899','#14b8a6','#8b5cf6','#22c55e','#f97316','#06b6d4'];
    const col         = colors[bi % colors.length];

    // Get paper data for this branch+date
    const dateKey  = _prFilterDate || (branch.printers[0] && branch.printers[0].log_date ? branch.printers[0].log_date.slice(0,10) : '');
    const paperKey = branch.code + '|' + dateKey;
    const paper    = paperMap[paperKey] || { a4: 0, b4: 0, legal: 0 };
    const hasPaper = paper.a4 > 0 || paper.b4 > 0 || paper.legal > 0;

    // Sort printers by print count desc
    const printers = [...branch.printers].sort((a, b) => (b.print_count || 0) - (a.print_count || 0));
    const maxP      = printers[0] ? (printers[0].print_count || 1) : 1;

    return '<div class="pr-branch-block">'

      // Branch header
      + '<div class="pr-branch-hdr">'
      + '<div class="pr-branch-badge" style="background:' + col + '18;color:' + col + '">' + branch.code + '</div>'
      + '<div class="pr-branch-title">' + branch.name + '</div>'
      + '<div class="pr-branch-total-wrap">'
      + '<div class="pr-branch-bar-track"><div class="pr-branch-bar-fill" style="width:' + barWidth + '%;background:' + col + '"></div></div>'
      + '<div class="pr-branch-total" style="color:' + col + '">' + branchTotal.toLocaleString() + '<span class="pr-branch-total-lbl"> prints</span></div>'
      + '</div>'
      + '</div>'

      // Paper summary row for this branch
      + (hasPaper
        ? '<div class="pr-paper-row">'
          + '<span class="pr-paper-label">📄 Daily Paper:</span>'
          + (paper.a4    > 0 ? '<span class="pr-paper-chip pr-paper-a4">A4: '    + paper.a4.toLocaleString()    + ' sheets</span>' : '')
          + (paper.b4    > 0 ? '<span class="pr-paper-chip pr-paper-b4">B4: '    + paper.b4.toLocaleString()    + ' sheets</span>' : '')
          + (paper.legal > 0 ? '<span class="pr-paper-chip pr-paper-legal">Legal: ' + paper.legal.toLocaleString() + ' sheets</span>' : '')
          + '</div>'
        : '')

      // Printer rows
      + '<div class="pr-printer-rows">'
      + printers.map(p => {
          const pBar = Math.round((p.print_count || 0) / maxP * 100);
          const dt   = p.log_date ? new Date(p.log_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short' }) : '—';
          const time = p.created_at ? new Date(p.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '';
          const meter = p.meter_reading ? ' · Meter: ' + parseInt(p.meter_reading).toLocaleString() : '';
          return '<div class="pr-printer-row">'
            + '<div class="pr-printer-left">'
            + '<div class="pr-printer-code">' + p.printer_code + '</div>'
            + '<div class="pr-printer-meta">'
            + '<span class="pr-logged-by">👤 ' + (p.logged_by_name || '—') + '</span>'
            + '<span class="pr-log-date">🗓 ' + dt + (time ? ' · ' + time : '') + '</span>'
            + (meter ? '<span class="pr-log-note">🖨️' + meter + '</span>' : '')
            + (p.notes ? '<span class="pr-log-note">📝 ' + p.notes + '</span>' : '')
            + '</div>'
            + '</div>'
            + '<div class="pr-printer-right">'
            + '<div class="pr-mini-bar-track"><div class="pr-mini-bar-fill" style="width:' + pBar + '%;background:' + col + '44"></div></div>'
            + '<div class="pr-print-count" style="color:' + col + '">' + (p.print_count || 0).toLocaleString() + '</div>'
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>'
      + '</div>';
  }).join('');
}


function prFilterDate(val) {
  _prFilterDate = val;
  renderPrintReport();
}

function prFilterBranch(val) {
  _prFilterBranch = val;
  renderPrintReport();
}