/* ============================================================
   SoftWave — End of Day Print Log v4
   - Printer cards: total prints only (no paper per printer)
   - 3 paper cards below: B4, Legal, A4 (branch daily totals)
   ============================================================ */

var _eodPrinters   = [];
var _eodBranchId   = null;
var _eodBranchCode = '';
var _eodLogDate    = null;
var _eodActivePid  = null;
var _eodPaperData  = { a4: null, b4: null, legal: null };
var _eodWasteData  = { a4: null, b4: null, legal: null };
var _eodPaperActive = null;
var _eodWasteActive = null;
var _eodScrollY    = 0;

var PAPER_META = {
  a4:    { icon: '📄', label: 'A4 Paper',    color: '#0ea5e9' },
  b4:    { icon: '📋', label: 'B4 Paper',    color: '#6366f1' },
  legal: { icon: '📃', label: 'Legal Paper', color: '#10b981' },
};

/* ── Helpers ─────────────────────────────────────────────── */
function eodToday() { return new Date().toISOString().slice(0,10); }
function eodYesterday() {
  var d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10);
}
function eodFmtDate(iso) {
  return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
function eodEmpty(icon, title, sub) {
  return '<div class="eod-empty"><div class="eod-empty-icon">'+icon+'</div>'
    +'<div class="eod-empty-title">'+title+'</div>'
    +(sub?'<div class="eod-empty-sub">'+sub+'</div>':'')+'</div>';
}

/* ── Paper popup scroll lock (only for paper popup) ─────── */
function eodLockScroll() {
  _eodScrollY = window.scrollY || window.pageYOffset;
  document.body.style.position = 'fixed';
  document.body.style.top      = '-' + _eodScrollY + 'px';
  document.body.style.left     = '0';
  document.body.style.right    = '0';
  document.body.style.overflow = 'hidden';
}
function eodUnlockScroll() {
  document.body.style.position = '';
  document.body.style.top      = '';
  document.body.style.left     = '';
  document.body.style.right    = '';
  document.body.style.overflow = '';
  window.scrollTo(0, _eodScrollY);
}

/* ── Entry point ─────────────────────────────────────────── */
async function loadEOD() {
  _eodLogDate = eodToday();
  eodSetDateUI();
  var access   = (APP.user.branch_access || '').trim().toUpperCase();
  var branches = (await silentApi('GET', '/branches')) || [];
  if (access && access !== 'ALL') {
    var branch = branches.find(function(b){
      return b.code.toUpperCase()===access || String(b.id)===access;
    });
    if (branch) {
      _eodBranchId   = branch.id;
      _eodBranchCode = branch.code;
      document.getElementById('eod-branch-row').style.display    = 'none';
      document.getElementById('eod-assigned-wrap').style.display = '';
      document.getElementById('eod-branch-badge').textContent    = '🏢  '+branch.code+' — '+branch.name;
      await eodLoadPrinters(branch.id);
    } else {
      document.getElementById('eod-printers').innerHTML = eodEmpty('⚠️','Branch not found','Ask your administrator.');
      eodRenderPaperCards(false);
    }
  } else {
    document.getElementById('eod-branch-row').style.display    = '';
    document.getElementById('eod-assigned-wrap').style.display = 'none';
    var sel = document.getElementById('eod-branch-sel');
    if (sel) {
      sel.innerHTML = '<option value="">— Select Branch —</option>';
      branches.filter(function(b){ return b.is_active; }).forEach(function(b){
        sel.add(new Option(b.code+' — '+b.name, b.id+'|'+b.code));
      });
    }
    document.getElementById('eod-printers').innerHTML = eodEmpty('🏢','Select a branch above','');
    eodRenderPaperCards(false);
  }
  eodLoadHistory();
}

/* ── Date selector ───────────────────────────────────────── */
function eodSetDateUI() {
  var today=eodToday(), yest=eodYesterday();
  var bt=document.getElementById('eod-btn-today'), by=document.getElementById('eod-btn-yest');
  if(bt) bt.classList.toggle('eod-date-active', _eodLogDate===today);
  if(by) by.classList.toggle('eod-date-active', _eodLogDate===yest);
  var lbl=document.getElementById('eod-date');
  if(lbl) lbl.textContent=eodFmtDate(_eodLogDate);
}
/* ── Calendar state ─────────────────────────────────────── */
var _eodCalViewYear  = new Date().getFullYear();
var _eodCalViewMonth = new Date().getMonth();     // 0-based
var _eodCalSelected  = null;                      // 'YYYY-MM-DD' string

/* ── Helpers ─────────────────────────────────────────────── */
function eodToday() { return new Date().toISOString().slice(0,10); }
function eodYesterday() {
  var d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10);
}
function eodFmtDate(iso) {
  return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
function eodFmtDateShort(iso) {
  return new Date(iso+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function eodEmpty(icon, title, sub) {
  return '<div class="eod-empty"><div class="eod-empty-icon">'+icon+'</div>'
    +'<div class="eod-empty-title">'+title+'</div>'
    +(sub?'<div class="eod-empty-sub">'+sub+'</div>':'')+'</div>';
}

/* ── Date bar UI ─────────────────────────────────────────── */
function eodSetDateUI() {
  var lbl = document.getElementById('eod-date');
  if (lbl) lbl.textContent = eodFmtDate(_eodLogDate);
  var btnLbl = document.getElementById('eod-cal-btn-lbl');
  if (btnLbl) {
    var today = eodToday();
    if (_eodLogDate === today) {
      btnLbl.textContent = 'Today';
    } else if (_eodLogDate === eodYesterday()) {
      btnLbl.textContent = 'Yesterday';
    } else {
      btnLbl.textContent = eodFmtDateShort(_eodLogDate);
    }
  }
}

/* ── Calendar open/close ─────────────────────────────────── */
function eodOpenCalendar() {
  var selDate = _eodLogDate || eodToday();
  var parts   = selDate.split('-');
  _eodCalViewYear  = parseInt(parts[0]);
  _eodCalViewMonth = parseInt(parts[1]) - 1;
  _eodCalSelected  = selDate;
  eodRenderCalendar();

  /* Teleport overlay to <body> so position:fixed is never broken
     by a parent with transform/backdrop-filter/will-change */
  var overlay = document.getElementById('eod-cal-overlay');
  if (overlay.parentNode !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.style.removeProperty('display'); /* clear any leftover inline style */
  overlay.classList.add('is-open');
}
function eodCloseCalendar() {
  var overlay = document.getElementById('eod-cal-overlay');
  overlay.classList.remove('is-open');
}

/* ── Calendar navigation ─────────────────────────────────── */
function eodCalPrevMonth() {
  if (_eodCalViewMonth === 0) { _eodCalViewMonth = 11; _eodCalViewYear--; }
  else { _eodCalViewMonth--; }
  eodRenderCalendar();
}
function eodCalNextMonth() {
  if (_eodCalViewMonth === 11) { _eodCalViewMonth = 0; _eodCalViewYear++; }
  else { _eodCalViewMonth++; }
  eodRenderCalendar();
}
function eodCalGoToday() {
  var t = new Date();
  _eodCalViewYear  = t.getFullYear();
  _eodCalViewMonth = t.getMonth();
  _eodCalSelected  = eodToday();
  eodRenderCalendar();
}

/* ── Render calendar grid ────────────────────────────────── */
function eodRenderCalendar() {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var lbl = document.getElementById('eod-cal-month-lbl');
  if (lbl) lbl.textContent = MONTHS[_eodCalViewMonth] + ' ' + _eodCalViewYear;

  var grid  = document.getElementById('eod-cal-grid');
  var today = eodToday();
  var todayD = new Date(today + 'T00:00:00');

  // getDay() 0=Sun..6=Sat; shift to Mon-first (Mon=0)
  var rawFirst = new Date(_eodCalViewYear, _eodCalViewMonth, 1).getDay();
  var firstDay = (rawFirst === 0) ? 6 : rawFirst - 1;
  var daysIn   = new Date(_eodCalViewYear, _eodCalViewMonth + 1, 0).getDate();

  var html = '';
  // Empty cells before first day
  for (var e = 0; e < firstDay; e++) {
    html += '<div class="eod3-cal-day eod-cal-empty"></div>';
  }
  for (var d = 1; d <= daysIn; d++) {
    var mm  = String(_eodCalViewMonth + 1).padStart(2, '0');
    var dd  = String(d).padStart(2, '0');
    var iso = _eodCalViewYear + '-' + mm + '-' + dd;
    var dayD= new Date(iso + 'T00:00:00');
    var dow  = new Date(iso + 'T00:00:00').getDay(); // 0=Sun, 6=Sat
    var cls = 'eod3-cal-day';
    if (dow === 6)              cls += ' eod-cal-sat';
    if (dow === 0)              cls += ' eod-cal-sun';
    if (iso === today)          cls += ' eod-cal-today';
    if (iso === _eodCalSelected)cls += ' eod-cal-selected';
    if (dayD > todayD)          cls += ' eod-cal-future';
    html += '<button class="' + cls + '" onclick="eodCalSelectDay(\'' + iso + '\')">' + d + '</button>';
  }
  if (grid) grid.innerHTML = html;
}

function eodCalSelectDay(iso) {
  _eodCalSelected = iso;
  eodRenderCalendar();
}

function eodCalConfirm() {
  if (!_eodCalSelected) return;
  _eodLogDate = _eodCalSelected;
  eodSetDateUI();
  eodCloseCalendar();
  if (_eodBranchId) eodLoadPrinters(_eodBranchId);
}

/* ── EOD Save Success Toast ──────────────────────────────── */
var _eodToastTimer = null;
function eodShowSaveToast(title, sub, prints) {
  var el    = document.getElementById('eod3-save-toast');
  var tDate = document.getElementById('eod3-toast-date');
  var tTitle= document.getElementById('eod3-toast-title');
  var tSub  = document.getElementById('eod3-toast-sub');
  var tBar  = document.getElementById('eod3-toast-bar');
  if (!el) return;

  tTitle.textContent = title || 'Saved!';
  tDate.textContent  = eodFmtDate(_eodLogDate);
  tSub.textContent   = sub  || '';

  // Reset bar then animate
  tBar.style.transition = 'none';
  tBar.style.width      = '100%';

  el.classList.add('show');

  // Start shrink after a tick
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      tBar.style.transition = 'width 3.5s linear';
      tBar.style.width      = '0%';
    });
  });

  clearTimeout(_eodToastTimer);
  _eodToastTimer = setTimeout(function() {
    el.classList.remove('show');
  }, 3700);
}
async function eodBranchChanged() {
  var sel = document.getElementById('eod-branch-sel');
  if (!sel || !sel.value) {
    document.getElementById('eod-printers').innerHTML = eodEmpty('🏢','Select a branch above','');
    eodRenderPaperCards(false);
    return;
  }
  var parts = sel.value.split('|');
  _eodBranchId   = parseInt(parts[0]);
  _eodBranchCode = parts[1] || '';
  await eodLoadPrinters(_eodBranchId);
}

/* ── Load printers ───────────────────────────────────────── */
async function eodLoadPrinters(branchId) {
  var wrap = document.getElementById('eod-printers');
  wrap.innerHTML = '<div class="eod-loading"><div class="spin"></div> Loading…</div>';
  var all = (await silentApi('GET', '/printers')) || [];
  _eodPrinters = all.filter(function(p){ return p.branch_id===branchId; });
  if (!_eodPrinters.length) {
    wrap.innerHTML = eodEmpty('🖨️','No printers in this branch','Contact your administrator');
    eodRenderPaperCards(false);
    return;
  }
  var existingLogs = (await silentApi('GET', '/requests/print-logs?branch_id='+branchId)) || [];
  var loggedMap = {};
  existingLogs.forEach(function(l){
    if (l.log_date && l.log_date.slice(0,10)===_eodLogDate) loggedMap[l.printer_id]=l;
  });
  wrap.innerHTML = '<div class="eod3-printer-grid" id="eod3-grid">'
    + _eodPrinters.map(function(p, idx){
        var pid=p.printer_id, pct=Math.round(p.current_pct||0);
        var tc=pct<=10?'#ef4444':pct<=25?'#f59e0b':'#10b981';
        var done=!!loggedMap[pid], log=loggedMap[pid]||{};
        return '<div class="eod3-printer-card '+(done?'eod3-done':'')+'" id="eod3-card-'+pid+'" onclick="eodOpenPrinter('+pid+')">'
          +'<div class="eod3-card-num">'+(idx+1)+'</div>'
          +(done?'<div class="eod3-done-badge">✅ Logged</div>':'')
          +'<div class="eod3-printer-icon">🖨️</div>'
          +'<div class="eod3-printer-code">'+p.printer_code+'</div>'
          +'<div class="eod3-printer-model">'+(p.printer_model||'')+'</div>'
          +'<div class="eod3-toner-bar-wrap"><div class="eod3-toner-bar" style="width:'+pct+'%;background:'+tc+'"></div></div>'
          +'<div class="eod3-toner-pct" style="color:'+tc+'">'+pct+'% Toner</div>'
          +(done
            ?'<div class="eod3-logged-meter">Meter: '+(log.meter_reading||0).toLocaleString()+'</div>'
             +'<div class="eod3-logged-total">'+(log.print_count||0).toLocaleString()+' prints today</div>'
            :'<div class="eod3-tap-hint">Tap to log prints</div>')
          +'</div>';
      }).join('') + '</div>';
  eodUpdateSummaryBar();
  await eodLoadPaperCards(branchId);
}

/* ── Summary bar ─────────────────────────────────────────── */
function eodUpdateSummaryBar() {
  var logged=document.querySelectorAll('.eod3-done').length, total=_eodPrinters.length;
  var fc=document.getElementById('eod-filled-count'), gt=document.getElementById('eod-grand-total');
  if(fc) fc.textContent=logged+' / '+total;
  var grand=0;
  document.querySelectorAll('.eod3-logged-total').forEach(function(el){
    grand+=parseInt((el.textContent||'0').replace(/,/g,''))||0;
  });
  if(gt) gt.textContent=grand.toLocaleString();
}

/* ══════════════════════════════════════════════════════════
   ANOMALY DIALOG — shown when meter reading looks suspicious
   ══════════════════════════════════════════════════════════ */
function eodShowAnomalyDialog(data, meterValue) {
  /* Build the warning list */
  var warningHtml = data.warnings.map(function(w) {
    var icon = w.severity === 'critical' ? '🚨' : '⚠️';
    return '<div class="eod-anomaly-warn">'
      + '<span class="eod-anomaly-icon">' + icon + '</span>'
      + '<span class="eod-anomaly-msg">' + w.message + '</span>'
      + '</div>';
  }).join('');

  var prevTxt = data.prev_meter != null
    ? 'Previous meter: <strong>' + data.prev_meter.toLocaleString() + '</strong><br>'
    : '';
  var avgTxt = data.avg_daily > 0
    ? 'Daily average: <strong>' + data.avg_daily.toLocaleString() + '</strong> prints'
    : '';

  var html = '<div id="eod-anomaly-overlay" class="eod-anomaly-overlay" onclick="if(event.target===this)eodCloseAnomalyDialog()">'
    + '<div class="eod-anomaly-box">'
    + '<div class="eod-anomaly-hdr">'
    + '<div class="eod-anomaly-hdr-title">⚠️ Unusual Reading Detected</div>'
    + '<button class="eod3-cal-close" onclick="eodCloseAnomalyDialog()">✕</button>'
    + '</div>'
    + '<div class="eod-anomaly-printer">Printer: <strong>' + data.printer_code + '</strong> &nbsp;·&nbsp; Meter entered: <strong>' + meterValue.toLocaleString() + '</strong></div>'
    + '<div class="eod-anomaly-stats">' + prevTxt + avgTxt + '</div>'
    + '<div class="eod-anomaly-warns">' + warningHtml + '</div>'
    + '<div class="eod-anomaly-q">Is this meter reading correct?</div>'
    + '<div class="eod-anomaly-actions">'
    + '<button class="eod-anomaly-fix" onclick="eodCloseAnomalyDialog()">✏️ Fix the number</button>'
    + '<button class="eod-anomaly-confirm" onclick="eodConfirmAnomalySave()">✓ Yes, save anyway</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  /* Teleport to body just like the calendar overlay */
  var existing = document.getElementById('eod-anomaly-overlay');
  if (existing) existing.remove();
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var el = tmp.firstChild;
  document.body.appendChild(el);
}

function eodCloseAnomalyDialog() {
  var el = document.getElementById('eod-anomaly-overlay');
  if (el) el.remove();
}

function eodConfirmAnomalySave() {
  eodCloseAnomalyDialog();
  eodPopSave(true); /* forceOverride = true, skip anomaly check */
}

/* ══════════════════════════════════════════════════════════
   PRINTER POPUP — scroll to top then show
   ══════════════════════════════════════════════════════════ */
function eodOpenPrinter(pid) {
  _eodActivePid = pid;
  var p=_eodPrinters.find(function(x){ return x.printer_id===pid; });
  var pct=Math.round((p&&p.current_pct)||0);
  var tc=pct<=10?'#ef4444':pct<=25?'#f59e0b':'#10b981';

  document.getElementById('eod-pop-code').textContent  = p?p.printer_code:'';
  document.getElementById('eod-pop-model').textContent = p?(p.printer_model||''):'';
  document.getElementById('eod-pop-pct').textContent   = pct+'% Toner';
  document.getElementById('eod-pop-pct').style.color   = tc;

  var ti=document.getElementById('eod-pop-total');
  if(ti) ti.value='';
  var prev=document.getElementById('eod-pop-total-preview');
  if(prev) prev.textContent='';

  var btn=document.getElementById('eod-pop-save');
  btn.textContent='✓ Save This Printer'; btn.disabled=false; btn.style.background='';

  /* Lock scroll and show popup — same as paper popup */
  eodLockScroll();

  var overlay=document.getElementById('eod-pop-overlay');
  overlay.style.display='flex';
  var box=document.getElementById('eod-pop-box');
  box.scrollTop=0;
  setTimeout(function(){ box.classList.add('open'); },10);
  setTimeout(function(){ if(ti) ti.focus(); },300);
}

function eodClosePop() {
  var box=document.getElementById('eod-pop-box');
  box.classList.remove('open');
  setTimeout(function(){
    document.getElementById('eod-pop-overlay').style.display='none';
    eodUnlockScroll();
  },300);
}

function eodPopTotalChanged() {
  var val=parseInt(document.getElementById('eod-pop-total').value)||0;
  var preview=document.getElementById('eod-pop-total-preview');
  if(preview){ preview.textContent=val>0?val.toLocaleString()+' (meter reading)':''; preview.style.color=val>0?'#0ea5e9':'#94a3b8'; }
}

async function eodPopSave(forceOverride) {
  var pid=_eodActivePid, total=parseInt(document.getElementById('eod-pop-total').value)||0;
  if(total<=0){ toast('⚠️','Enter total prints','Please enter the total print count'); return; }
  var btn=document.getElementById('eod-pop-save');
  btn.textContent='⏳ Checking…'; btn.disabled=true;

  /* ── Anomaly check (skip if user already confirmed override) ─────── */
  if (!forceOverride) {
    try {
      var chk = await silentApi('POST', '/requests/print-logs/check-anomaly', {
        printer_id: pid, print_count: total, log_date: _eodLogDate
      });
      if (chk && chk.anomaly) {
        btn.textContent='✓ Save This Printer'; btn.disabled=false;
        eodShowAnomalyDialog(chk, total);
        return;
      }
    } catch(e) { /* anomaly check failed — proceed with save anyway */ }
  }

  btn.textContent='⏳ Saving…'; btn.disabled=true;
  try {
    await api('POST','/requests/print-logs',{
      printer_id:pid, print_count:total, log_date:_eodLogDate,
      a4_single:0, a4_double:0, b4_single:0, b4_double:0, letter_single:0, letter_double:0
    });
    var card=document.getElementById('eod3-card-'+pid);
    if(card){
      card.classList.add('eod3-done');
      var hint=card.querySelector('.eod3-tap-hint');
      if(hint){ hint.textContent='Meter: '+total.toLocaleString(); hint.className='eod3-logged-total'; }
      if(!card.querySelector('.eod3-done-badge')){
        var b=document.createElement('div'); b.className='eod3-done-badge'; b.textContent='✅ Logged';
        card.insertBefore(b, card.firstChild.nextSibling);
      }
    }
    var p = _eodPrinters.find(function(x){ return x.printer_id === pid; });
    var pcode = p ? p.printer_code : 'Printer';
    eodShowSaveToast(
      pcode + ' — Logged ✓',
      total.toLocaleString() + ' meter reading saved',
      total
    );
    eodClosePop(); eodUpdateSummaryBar();
    await eodLoadPrinters(_eodBranchId);
    eodLoadHistory();
  } catch(e) {
    btn.textContent='✓ Save This Printer'; btn.disabled=false;
    toast('❌','Save failed','Please try again');
  }
}

/* ══════════════════════════════════════════════════════════
   PAPER CARDS — Branch daily totals (B4, Legal, A4)
   ══════════════════════════════════════════════════════════ */
async function eodLoadPaperCards(branchId) {
  var rows=(await silentApi('GET','/requests/daily-paper-log?branch_id='+branchId+'&log_date='+_eodLogDate))||[];
  _eodPaperData={a4:null,b4:null,legal:null};
  _eodWasteData={a4:null,b4:null,legal:null};
  rows.forEach(function(r){
    if(_eodPaperData.hasOwnProperty(r.paper_type)) _eodPaperData[r.paper_type]=r;
    // Extract waste for each type from the row
    var wasteKey = r.paper_type;
    var wasteVal = r['waste_'+wasteKey] || 0;
    if(wasteVal > 0) _eodWasteData[wasteKey] = { paper_type: wasteKey, waste: wasteVal };
  });
  eodRenderPaperCards(true);
  eodRenderWasteCards(true);
}

function eodRenderWasteCards(show) {
  var wrap=document.getElementById('eod-waste-cards-wrap');
  if(!wrap) return;
  if(!show){ wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML='<div class="eod-paper-section-title" style="color:#ef4444">🗑️ Waste Paper Count '
    +'<span style="font-size:11px;color:#94a3b8;font-weight:500">(Branch Total for Today)</span></div>'
    +'<div class="eod-paper-cards-grid">'
    +['b4','legal','a4'].map(function(type){
        var colors={a4:'#ef4444',b4:'#f97316',legal:'#dc2626'};
        var icons={a4:'🗑️',b4:'♻️',legal:'📛'};
        var labels={a4:'A4 Waste',b4:'B4 Waste',legal:'Legal Waste'};
        var col=colors[type], data=_eodWasteData[type], done=!!data;
        var total=done?(data.waste||0):0;
        return '<div class="eod-paper-card '+(done?'eod-paper-card-done eod-waste-done':'')+'" onclick="eodOpenWastePop(\''+type+'\')">'
          +'<div class="eod-paper-card-icon">'+icons[type]+'</div>'
          +'<div class="eod-paper-card-label">'+labels[type]+'</div>'
          +(done
            ?'<div class="eod-paper-card-total" style="color:'+col+'">'+total.toLocaleString()+' sheets</div>'
              +'<div class="eod-paper-card-badge" style="background:#fef2f2;color:#ef4444">✅ Logged</div>'
            :'<div class="eod-paper-card-hint">Tap to enter waste</div>')
          +'</div>';
      }).join('')
    +'</div>';
}

function eodRenderPaperCards(show) {
  var wrap=document.getElementById('eod-paper-cards-wrap');
  if(!wrap) return;
  if(!show){ wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML='<div class="eod-paper-section-title">📄 Daily Paper Count '
    +'<span style="font-size:11px;color:#94a3b8;font-weight:500">(Branch Total for Today)</span></div>'
    +'<div class="eod-paper-cards-grid">'
    +['b4','legal','a4'].map(function(type){
        var m=PAPER_META[type], data=_eodPaperData[type], done=!!data;
        var total=done?((data.single_side||0)+(data.double_side||0)):0;
        return '<div class="eod-paper-card '+(done?'eod-paper-card-done':'')+'" onclick="eodOpenPaperPop(\''+type+'\')">'
          +'<div class="eod-paper-card-icon">'+m.icon+'</div>'
          +'<div class="eod-paper-card-label">'+m.label+'</div>'
          +(done
            ?'<div class="eod-paper-card-total" style="color:'+m.color+'">'+total.toLocaleString()+' sheets</div>'
              +'<div class="eod-paper-card-sub">Single: '+(data.single_side||0)+' &nbsp;|&nbsp; Double: '+(data.double_side||0)+'</div>'
              +'<div class="eod-paper-card-badge">✅ Logged</div>'
            :'<div class="eod-paper-card-hint">Tap to enter count</div>')
          +'</div>';
      }).join('')
    +'</div>';
}

/* ── Waste popup ─────────────────────────────────────────── */
function eodOpenWastePop(type) {
  if(!_eodBranchId){ toast('⚠️','Select a branch first',''); return; }
  _eodWasteActive=type;
  var labels={a4:'A4 Waste',b4:'B4 Waste',legal:'Legal Waste'};
  var colors={a4:'#ef4444',b4:'#f97316',legal:'#dc2626'};
  var data=_eodWasteData[type];

  var hdr=document.getElementById('eod-waste-pop-hdr');
  if(hdr) hdr.style.background='linear-gradient(135deg,'+colors[type]+','+colors[type]+'bb)';
  var title=document.getElementById('eod-waste-pop-title');
  if(title) title.textContent='🗑️ '+labels[type];
  var sub=document.getElementById('eod-waste-pop-sub');
  if(sub) sub.textContent='Branch waste total — '+eodFmtDate(_eodLogDate);

  var wi=document.getElementById('eod-waste-pop-count');
  if(wi) wi.value=data?(data.waste||''):'';

  var btn=document.getElementById('eod-waste-pop-save');
  if(btn){ btn.textContent='✓ Save '+labels[type]; btn.disabled=false; btn.style.background=''; }

  eodLockScroll();
  var overlay=document.getElementById('eod-waste-pop-overlay');
  overlay.style.display='flex';
  var box=document.getElementById('eod-waste-pop-box');
  box.scrollTop=0;
  setTimeout(function(){ box.classList.add('open'); },10);
  setTimeout(function(){ if(wi) wi.focus(); },300);
}

function eodCloseWastePop() {
  var box=document.getElementById('eod-waste-pop-box');
  box.classList.remove('open');
  setTimeout(function(){
    document.getElementById('eod-waste-pop-overlay').style.display='none';
    eodUnlockScroll();
  },300);
}

async function eodWastePopSave() {
  var type=_eodWasteActive;
  var count=parseInt(document.getElementById('eod-waste-pop-count').value)||0;
  if(count<=0){ toast('⚠️','Enter waste count','Enter the number of wasted sheets'); return; }
  var btn=document.getElementById('eod-waste-pop-save');
  btn.textContent='⏳ Saving…'; btn.disabled=true;
  // We save waste alongside the existing paper log for this type
  // If no paper log exists yet for this type, we create one with 0 single/double
  var existing=_eodPaperData[type];
  try {
    await api('POST','/requests/daily-paper-log',{
      branch_id:_eodBranchId, log_date:_eodLogDate, paper_type:type,
      single_side: existing?(existing.single_side||0):0,
      double_side: existing?(existing.double_side||0):0,
      waste: count
    });
    _eodWasteData[type]={paper_type:type,waste:count};
    eodRenderWasteCards(true);
    var labels={a4:'A4 Waste',b4:'B4 Waste',legal:'Legal Waste'};
    eodShowSaveToast(
      labels[type] + ' Logged ✓',
      count.toLocaleString() + ' waste sheets recorded',
      count
    );
    eodCloseWastePop();
  } catch(e) {
    btn.textContent='✓ Save'; btn.disabled=false;
    toast('❌','Save failed','Please try again');
  }
}

/* ── Paper popup — uses scroll lock (lives outside .main) ── */
function eodOpenPaperPop(type) {
  if(!_eodBranchId){ toast('⚠️','Select a branch first',''); return; }
  _eodPaperActive=type;
  var m=PAPER_META[type], data=_eodPaperData[type];

  var hdr=document.getElementById('eod-paper-pop-hdr');
  if(hdr) hdr.style.background='linear-gradient(135deg,'+m.color+','+m.color+'bb)';
  var title=document.getElementById('eod-paper-pop-title');
  if(title) title.textContent=m.icon+' '+m.label;
  var sub=document.getElementById('eod-paper-pop-sub');
  if(sub) sub.textContent='Branch daily total — '+eodFmtDate(_eodLogDate);

  var ss=document.getElementById('eod-paper-pop-single');
  var ds=document.getElementById('eod-paper-pop-double');
  if(ss) ss.value=data?(data.single_side||''):'';
  if(ds) ds.value=data?(data.double_side||''):'';
  eodPaperPopCalc();

  var btn=document.getElementById('eod-paper-pop-save');
  if(btn){ btn.textContent='✓ Save '+m.label; btn.disabled=false; btn.style.background=''; }

  eodLockScroll();
  var overlay=document.getElementById('eod-paper-pop-overlay');
  overlay.style.display='flex';
  var box=document.getElementById('eod-paper-pop-box');
  box.scrollTop=0;
  setTimeout(function(){ box.classList.add('open'); },10);
  setTimeout(function(){ if(ss) ss.focus(); },300);
}

function eodClosePaperPop() {
  var box=document.getElementById('eod-paper-pop-box');
  box.classList.remove('open');
  setTimeout(function(){
    document.getElementById('eod-paper-pop-overlay').style.display='none';
    eodUnlockScroll();
  },300);
}

function eodPaperPopCalc() {
  var s=parseInt(document.getElementById('eod-paper-pop-single').value)||0;
  var d=parseInt(document.getElementById('eod-paper-pop-double').value)||0;
  var prev=document.getElementById('eod-paper-pop-preview');
  if(prev){ var t=s+d; prev.textContent=t>0?'Total: '+t.toLocaleString()+' sheets':''; prev.style.color=t>0?'#0ea5e9':'#94a3b8'; }
}

async function eodPaperPopSave() {
  var type=_eodPaperActive;
  var single=parseInt(document.getElementById('eod-paper-pop-single').value)||0;
  var dbl=parseInt(document.getElementById('eod-paper-pop-double').value)||0;
  if(single<=0&&dbl<=0){ toast('⚠️','Enter paper count','Enter single or double side count'); return; }
  var btn=document.getElementById('eod-paper-pop-save');
  btn.textContent='⏳ Saving…'; btn.disabled=true;
  try {
    await api('POST','/requests/daily-paper-log',{
      branch_id:_eodBranchId, log_date:_eodLogDate, paper_type:type,
      single_side:single, double_side:dbl
    });
    _eodPaperData[type]={paper_type:type,single_side:single,double_side:dbl};
    eodRenderPaperCards(true);
    var m=PAPER_META[type];
    eodShowSaveToast(
      m.label + ' Saved ✓',
      (single+dbl).toLocaleString() + ' sheets logged',
      single+dbl
    );
    eodClosePaperPop(); eodLoadHistory();
  } catch(e) {
    btn.textContent='✓ Save'; btn.disabled=false;
    toast('❌','Save failed','Please try again');
  }
}

/* ── History ─────────────────────────────────────────────── */
async function eodLoadHistory() {
  var wrap=document.getElementById('eod-history-wrap'); if(!wrap) return;
  var logs=(await silentApi('GET','/requests/my-print-logs'))||[];
  if(!logs.length){ wrap.innerHTML='<div class="eod3-no-history">No logs yet — start logging!</div>'; return; }

  // Build rich table header
  var html='<div class="eod3-hist-table">'
    +'<div class="eod3-hist-header">'
    +'<div class="eod3-hh">Date</div>'
    +'<div class="eod3-hh">Printer</div>'
    +'<div class="eod3-hh">Meter Reading</div>'
    +'<div class="eod3-hh" style="color:#0ea5e9">Daily Prints</div>'
    +'<div class="eod3-hh">Prev Day Meter</div>'
    +'</div>';

  html += logs.slice(0,20).map(function(l){
    var dt=l.log_date
      ?new Date(l.log_date+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      :'—';
    var prevDt=l.prev_log_date
      ?new Date(l.prev_log_date+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
      :'—';
    var prevMeter=l.prev_meter_reading?parseInt(l.prev_meter_reading).toLocaleString():'—';
    var meter=l.meter_reading?parseInt(l.meter_reading).toLocaleString():'—';
    var daily=parseInt(l.daily_prints||0);
    var dailyCol=daily>0?'#0ea5e9':'#94a3b8';

    return '<div class="eod3-hist-row2">'
      +'<div class="eod3-hd eod3-hd-date">'+dt+'</div>'
      +'<div class="eod3-hd eod3-hd-code">'+( l.printer_code||'—')+'</div>'
      +'<div class="eod3-hd eod3-hd-meter">'+meter+'</div>'
      +'<div class="eod3-hd eod3-hd-daily" style="color:'+dailyCol+';font-weight:800">'+daily.toLocaleString()+'</div>'
      +'<div class="eod3-hd eod3-hd-prev">'+(prevDt!=='—'?prevDt+' · ':'')+prevMeter+'</div>'
      +'</div>';
  }).join('');

  html+='</div>';
  wrap.innerHTML=html;
}