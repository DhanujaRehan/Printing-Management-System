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
var _eodPaperActive = null;
var _eodScrollY    = 0;   // remember scroll before popup

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

/* ── Popup scroll lock helpers ───────────────────────────── */
function eodLockScroll() {
  _eodScrollY = window.scrollY || window.pageYOffset;
  document.body.style.position   = 'fixed';
  document.body.style.top        = '-' + _eodScrollY + 'px';
  document.body.style.left       = '0';
  document.body.style.right      = '0';
  document.body.style.overflow   = 'hidden';
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
function eodSelectDate(which) {
  _eodLogDate = (which==='today') ? eodToday() : eodYesterday();
  eodSetDateUI();
  if (_eodBranchId) eodLoadPrinters(_eodBranchId);
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
            ?'<div class="eod3-logged-total">'+(log.print_count||0).toLocaleString()+' prints</div>'
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
   PRINTER POPUP — total prints only
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
  if(prev){ prev.textContent=''; }

  var btn=document.getElementById('eod-pop-save');
  btn.textContent='✓ Save This Printer'; btn.disabled=false; btn.style.background='';

  /* Lock scroll so popup appears at top of viewport */
  eodLockScroll();

  var overlay=document.getElementById('eod-pop-overlay');
  overlay.style.display='flex';
  /* Reset popup scroll to top */
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
  if(preview){ preview.textContent=val>0?val.toLocaleString()+' prints':''; preview.style.color=val>0?'#0ea5e9':'#94a3b8'; }
}

async function eodPopSave() {
  var pid=_eodActivePid, total=parseInt(document.getElementById('eod-pop-total').value)||0;
  if(total<=0){ toast('⚠️','Enter total prints','Please enter the total print count'); return; }
  var btn=document.getElementById('eod-pop-save');
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
      if(hint){ hint.textContent=total.toLocaleString()+' prints'; hint.className='eod3-logged-total'; }
      if(!card.querySelector('.eod3-done-badge')){
        var b=document.createElement('div'); b.className='eod3-done-badge'; b.textContent='✅ Logged';
        card.insertBefore(b, card.firstChild.nextSibling);
      }
    }
    toast('✅','Saved!',total.toLocaleString()+' prints logged');
    eodClosePop(); eodUpdateSummaryBar(); eodLoadHistory();
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
  rows.forEach(function(r){ if(_eodPaperData.hasOwnProperty(r.paper_type)) _eodPaperData[r.paper_type]=r; });
  eodRenderPaperCards(true);
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

/* ── Paper popup ─────────────────────────────────────────── */
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

  /* Lock scroll so popup appears at top of viewport */
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
    toast('✅',m.label+' saved!',(single+dbl).toLocaleString()+' sheets logged');
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
  wrap.innerHTML=logs.slice(0,15).map(function(l){
    var dt=l.log_date?new Date(l.log_date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short'}):'—';
    return '<div class="eod3-hist-row">'
      +'<div class="eod3-hist-date">'+dt+'</div>'
      +'<div class="eod3-hist-code">'+(l.printer_code||'—')+'</div>'
      +'<div class="eod3-hist-total">'+(l.print_count||0).toLocaleString()+'</div>'
      +'<div class="eod3-hist-papers">—</div>'
      +'</div>';
  }).join('');
}