#!/usr/bin/env python3
"""
Run from project root:
  python eodlog_waste_patch.py

Adds waste paper section to EOD log page.
"""

with open('frontend/public/js/eodlog.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ── PATCH 1: Add waste data to variables ─────────────────────
old_vars = """var _eodPaperData  = { a4: null, b4: null, legal: null };
var _eodPaperActive = null;"""

new_vars = """var _eodPaperData  = { a4: null, b4: null, legal: null };
var _eodWasteData  = { a4: null, b4: null, legal: null };
var _eodPaperActive = null;
var _eodWasteActive = null;"""

if old_vars in content:
    content = content.replace(old_vars, new_vars, 1)
    print("Patch 1 ✅ Variables added")
else:
    print("Patch 1 ❌ Not found")

# ── PATCH 2: Load waste data in eodLoadPaperCards ────────────
old_load = """async function eodLoadPaperCards(branchId) {
  var rows=(await silentApi('GET','/requests/daily-paper-log?branch_id='+branchId+'&log_date='+_eodLogDate))||[];
  _eodPaperData={a4:null,b4:null,legal:null};
  rows.forEach(function(r){ if(_eodPaperData.hasOwnProperty(r.paper_type)) _eodPaperData[r.paper_type]=r; });
  eodRenderPaperCards(true);
}"""

new_load = """async function eodLoadPaperCards(branchId) {
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
}"""

if old_load in content:
    content = content.replace(old_load, new_load, 1)
    print("Patch 2 ✅ eodLoadPaperCards updated")
else:
    print("Patch 2 ❌ Not found")

# ── PATCH 3: eodRenderPaperCards — also show waste section ───
old_render = """function eodRenderPaperCards(show) {
  var wrap=document.getElementById('eod-paper-cards-wrap');
  if(!wrap) return;
  if(!show){ wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML='<div class="eod-paper-section-title">📄 Daily Paper Count '
    +'<span style="font-size:11px;color:#94a3b8;font-weight:500">(Branch Total for Today)</span></div>'
    +'<div class="eod-paper-cards-grid">'
    +['b4','legal','a4'].map(function(type){"""

new_render = """function eodRenderWasteCards(show) {
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
    +['b4','legal','a4'].map(function(type){"""

if old_render in content:
    content = content.replace(old_render, new_render, 1)
    print("Patch 3 ✅ eodRenderWasteCards added")
else:
    print("Patch 3 ❌ Not found")

# ── PATCH 4: Add waste popup functions before eodOpenPaperPop ─
old_paper_pop = """/* ── Paper popup — uses scroll lock (lives outside .main) ── */
function eodOpenPaperPop(type) {"""

new_paper_pop = """/* ── Waste popup ─────────────────────────────────────────── */
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
    toast('✅',labels[type]+' saved!',count.toLocaleString()+' waste sheets logged');
    eodCloseWastePop();
  } catch(e) {
    btn.textContent='✓ Save'; btn.disabled=false;
    toast('❌','Save failed','Please try again');
  }
}

/* ── Paper popup — uses scroll lock (lives outside .main) ── */
function eodOpenPaperPop(type) {"""

if old_paper_pop in content:
    content = content.replace(old_paper_pop, new_paper_pop, 1)
    print("Patch 4 ✅ Waste popup functions added")
else:
    print("Patch 4 ❌ Not found")

with open('frontend/public/js/eodlog.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ eodlog.js updated.")
