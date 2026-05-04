/* ============================================================
   SoftWave — Manager Approvals Module
   File: js/approvals.js
   ============================================================ */

var _allRequests = [];

async function downloadTonerAudit() {
  var btn = event.currentTarget;
  var orig = btn.textContent;
  btn.textContent = '⏳ Generating...';
  btn.disabled = true;
  try {
    var res = await fetch('/api/export/toner-audit', {
      headers: { 'Authorization': 'Bearer ' + APP.token }
    });
    if (!res.ok) { toast('❌', 'Export failed', 'Server error'); return; }
    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    var cd   = res.headers.get('Content-Disposition') || '';
    var fn   = (cd.match(/filename=([^;]+)/) || [])[1] || 'toner_audit.xlsx';
    a.href = url; a.download = fn.replace(/"/g,''); a.click();
    URL.revokeObjectURL(url);
    toast('✅', 'Downloaded!', 'Toner Audit Excel saved to your device');
  } catch(e) {
    toast('❌', 'Download failed', e.message || '');
  } finally {
    btn.textContent = orig;
    btn.disabled    = false;
  }
}

async function loadApprovals() {
  var container = document.getElementById('approvals-container');
  container.innerHTML = '<div class="loading"><div class="spin"></div>Loading requests...</div>';
  try {
    var results = await Promise.all([
      silentApi('GET', '/requests/all'),
      silentApi('GET', '/hardware/requests'),
    ]);
    var tonerRequests    = (results[0] || []).map(function(r){ r._type = 'toner'; return r; });
    var hardwareRequests = (results[1] || [])
      .filter(function(r){ return r.status === 'pending' || r.status === 'approved'; })
      .map(function(r){ r._type = 'hardware'; return r; });

    _allRequests = tonerRequests.concat(hardwareRequests)
      .sort(function(a, b){ return new Date(b.requested_at) - new Date(a.requested_at); });

    renderApprovals(_allRequests);
    updatePendingBadge(_allRequests.filter(function(r){ return r.status === 'pending'; }).length);
  } catch(e) {
    container.innerHTML = '<div class="svc-empty">Error loading requests.</div>';
  }
}

function updatePendingBadge(count) {
  var badge = document.getElementById('approvals-badge');
  if (!badge) return;
  badge.textContent   = count;
  badge.style.display = count > 0 ? '' : 'none';
}

function filterApprovals(status) {
  document.querySelectorAll('.appr-filter-btn').forEach(function(b){ b.classList.remove('af-act'); });
  event.target.classList.add('af-act');
  var filtered;
  if (status === 'all')                              filtered = _allRequests;
  else if (status === 'toner' || status === 'paper') filtered = _allRequests.filter(function(r){ return r.request_type === status; });
  else                                               filtered = _allRequests.filter(function(r){ return r.status === status; });
  renderApprovals(filtered);
}

function renderApprovals(requests) {
  var container = document.getElementById('approvals-container');

  var pending    = _allRequests.filter(function(r){ return r.status === 'pending';    }).length;
  var approved   = _allRequests.filter(function(r){ return r.status === 'approved';   }).length;
  var rejected   = _allRequests.filter(function(r){ return r.status === 'rejected';   }).length;
  var dispatched = _allRequests.filter(function(r){ return r.status === 'dispatched'; }).length;

  document.getElementById('appr-kpi-pending').textContent  = pending;
  document.getElementById('appr-kpi-approved').textContent = approved + (dispatched ? ' (+' + dispatched + ' dispatched)' : '');
  document.getElementById('appr-kpi-rejected').textContent = rejected;

  if (!requests.length) {
    container.innerHTML = '<div class="svc-empty" style="padding:50px 20px">'
      + '<div style="font-size:44px;margin-bottom:14px">📭</div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--tx)">No requests found</div>'
      + '<div style="font-size:13px;color:var(--t3);margin-top:6px">Try a different filter or check back later</div>'
      + '</div>';
    return;
  }

  container.innerHTML = requests.map(function(r) {
    var isPending    = r.status === 'pending';
    var isApproved   = r.status === 'approved';
    var isDispatched = r.status === 'dispatched';

    var statusCfg = {
      pending:    { col:'#f59e0b', bg:'#fffbeb', label:'⏳ Pending Review',         accent:'#f59e0b' },
      approved:   { col:'#3b82f6', bg:'#eff6ff', label:'✅ Approved — Awaiting Store', accent:'#3b82f6' },
      rejected:   { col:'#ef4444', bg:'#fef2f2', label:'❌ Rejected',               accent:'#ef4444' },
      dispatched: { col:'#10b981', bg:'#f0fdf4', label:'📦 Dispatched & Stock Updated', accent:'#10b981' },
    }[r.status] || { col:'#94a3b8', bg:'#f8fafc', label:r.status, accent:'#94a3b8' };

    var priCfg = {
      critical: { col:'#ef4444', bg:'#fef2f2', label:'🔴 Critical' },
      urgent:   { col:'#f59e0b', bg:'#fffbeb', label:'🟡 Urgent'   },
      normal:   { col:'#10b981', bg:'#f0fdf4', label:'🟢 Normal'   },
    }[r.priority] || { col:'#94a3b8', bg:'#f8fafc', label:r.priority };

    var what = r.request_type === 'toner'
      ? '🖨 ' + (r.toner_model_code || 'Toner')
      : '📄 ' + ((r.paper_name || 'Paper') + (r.size ? ' ' + r.size + ' ' + r.gsm + 'gsm' : ''));

    var dt         = new Date(r.requested_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var dtReviewed = r.reviewed_at   ? new Date(r.reviewed_at).toLocaleString('en-GB',   { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;
    var dtDispatch = r.dispatched_at ? new Date(r.dispatched_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;

    // Right-side action/info panel
    var rightPanel = '';
    if (isPending) {
      rightPanel = '<div class="appr-actions">'
        + '<input class="appr-note-input" id="rn-' + r.id + '" placeholder="Review note (optional)...">'
        + '<button class="appr-approve-btn" onclick="reviewRequest(' + r.id + ',\'approved\')">✅ Approve Request</button>'
        + '<button class="appr-reject-btn"  onclick="reviewRequest(' + r.id + ',\'rejected\')">❌ Reject Request</button>'
        + '</div>';
    } else if (isApproved) {
      rightPanel = '<div style="width:100%;display:flex;flex-direction:column;gap:8px">'
        + '<div style="padding:12px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe;text-align:center">'
        +   '<div style="font-size:20px;margin-bottom:4px">📋</div>'
        +   '<div style="font-size:12px;font-weight:700;color:#1d4ed8">Awaiting Store Dispatch</div>'
        +   '<div style="font-size:11px;color:#3b82f6;margin-top:3px">Stock will be deducted when store dispatches</div>'
        + '</div>'
        + (dtReviewed ? '<div style="font-size:11px;color:var(--t3)">Approved by <strong>' + (r.reviewed_by_name||'—') + '</strong> · ' + dtReviewed + '</div>' : '')
        + '</div>';
    } else if (isDispatched) {
      rightPanel = '<div style="width:100%;display:flex;flex-direction:column;gap:8px">'
        + '<div style="padding:12px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;text-align:center">'
        +   '<div style="font-size:20px;margin-bottom:4px">✅</div>'
        +   '<div style="font-size:12px;font-weight:700;color:#15803d">Stock Deducted &amp; Updated</div>'
        +   (r.dispatch_note ? '<div style="font-size:11px;color:#166534;margin-top:3px">' + r.dispatch_note + '</div>' : '')
        + '</div>'
        + (dtDispatch ? '<div style="font-size:11px;color:var(--t3)">Dispatched by <strong>' + (r.dispatched_by_name||'—') + '</strong> · ' + dtDispatch + '</div>' : '')
        + '</div>';
    } else {
      rightPanel = '<div style="width:100%">'
        + (r.review_note ? '<div class="appr-review-note">💬 ' + r.review_note + '</div>' : '')
        + (dtReviewed ? '<div class="appr-reviewer" style="margin-top:5px">Reviewed by <strong>' + (r.reviewed_by_name||'—') + '</strong> · ' + dtReviewed + '</div>' : '')
        + '</div>';
    }

    return '<div class="appr-card">'
      + '<div class="appr-card-accent" style="background:' + statusCfg.accent + '"></div>'
      + '<div class="appr-card-content">'
      +   '<div class="appr-card-left">'
      +     '<div class="appr-type-row">'
      +       '<div class="req-type-badge ' + (r.request_type==='toner' ? 'badge-toner' : 'badge-paper') + '">' + (r.request_type==='toner' ? 'Toner' : 'Paper') + '</div>'
      +       '<span class="appr-pri-pill" style="background:' + priCfg.bg + ';color:' + priCfg.col + ';border:1px solid ' + priCfg.col + '33">' + priCfg.label + '</span>'
      +     '</div>'
      +     '<div class="appr-what">' + what + '</div>'
      +     '<div class="appr-meta">'
      +       '<span class="appr-printer">🖨 ' + r.printer_code + '</span>'
      +       '<span class="appr-branch">🏢 ' + r.branch_name + ' (' + r.branch_code + ')</span>'
      +       '<span class="appr-qty">× ' + r.quantity + (r.request_type==='paper' ? ' reams' : ' unit') + '</span>'
      +     '</div>'
      +     (r.notes ? '<div class="appr-notes">💬 ' + r.notes + '</div>' : '')
      +     '<div class="appr-by">By <strong>' + (r.requested_by_name||'—') + '</strong> · ' + dt + '</div>'
      +   '</div>'
      +   '<div class="appr-card-right">'
      +     '<div class="appr-status-pill" style="background:' + statusCfg.bg + ';color:' + statusCfg.col + ';border:1px solid ' + statusCfg.col + '33">' + statusCfg.label + '</div>'
      +     rightPanel
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

async function reviewRequest(id, status) {
  var noteEl = document.getElementById('rn-' + id);
  var note   = noteEl ? noteEl.value.trim() : '';
  var btn    = document.querySelector('[onclick="reviewRequest(' + id + ',\'' + status + '\')"]');
  if (btn) { btn.disabled = true; btn.textContent = status === 'approved' ? 'Approving...' : 'Rejecting...'; }

  try {
    await api('PATCH', '/requests/' + id + '/review', { status: status, review_note: note || null });
    toast(
      status === 'approved' ? '✅' : '❌',
      'Request ' + status + '!',
      status === 'approved' ? 'Store keeper will be notified to dispatch.' : ''
    );
    loadApprovals();
    refreshPendingBadge();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = status === 'approved' ? '✅ Approve Request' : '❌ Reject Request'; }
  }
}

async function refreshPendingBadge() {
  var r = await silentApi('GET', '/requests/pending-count');
  if (r && r.count !== undefined) updatePendingBadge(r.count);
}