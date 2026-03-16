/* ============================================================
   TonerPro Ultra — Manager Approvals Module
   File: js/approvals.js
   ============================================================ */

var _allRequests = [];

async function loadApprovals() {
  var container = document.getElementById('approvals-container');
  container.innerHTML = '<div class="loading"><div class="spin"></div>Loading requests...</div>';
  try {
    var requests = await silentApi('GET', '/requests/all');
    requests = requests || [];
    _allRequests = requests;
    renderApprovals(requests);
    updatePendingBadge(requests.filter(function(r){ return r.status === 'pending'; }).length);
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

  var pending  = _allRequests.filter(function(r){ return r.status === 'pending';  }).length;
  var approved = _allRequests.filter(function(r){ return r.status === 'approved'; }).length;
  var rejected = _allRequests.filter(function(r){ return r.status === 'rejected'; }).length;

  document.getElementById('appr-kpi-pending').textContent  = pending;
  document.getElementById('appr-kpi-approved').textContent = approved;
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
    var isPending = r.status === 'pending';

    var statusCfg = {
      pending:  { col:'#f59e0b', bg:'#fffbeb', label:'⏳ Pending Review', accent:'#f59e0b' },
      approved: { col:'#10b981', bg:'#f0fdf4', label:'✅ Approved',        accent:'#10b981' },
      rejected: { col:'#ef4444', bg:'#fef2f2', label:'❌ Rejected',        accent:'#ef4444' },
    }[r.status] || { col:'#94a3b8', bg:'#f8fafc', label:r.status, accent:'#94a3b8' };

    var priCfg = {
      critical: { col:'#ef4444', bg:'#fef2f2', label:'🔴 Critical' },
      urgent:   { col:'#f59e0b', bg:'#fffbeb', label:'🟡 Urgent'   },
      normal:   { col:'#10b981', bg:'#f0fdf4', label:'🟢 Normal'   },
    }[r.priority] || { col:'#94a3b8', bg:'#f8fafc', label:r.priority };

    var what = r.request_type === 'toner'
      ? (r.toner_model_code || 'Toner')
      : ((r.paper_name || 'Paper') + (r.size ? ' ' + r.size + ' ' + r.gsm + 'gsm' : ''));

    var isToner = r.request_type === 'toner';
    var dt = new Date(r.requested_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    var dtReviewed = r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : null;

    return '<div class="appr-card">'
      + '<div class="appr-card-accent" style="background:' + statusCfg.accent + '"></div>'
      + '<div class="appr-card-content">'
      + '<div class="appr-card-left">'
      + '<div class="appr-type-row">'
      + '<div class="req-type-badge ' + (isToner ? 'badge-toner' : 'badge-paper') + '">' + (isToner ? '🖨 Toner' : '📄 Paper') + '</div>'
      + '<span class="appr-pri-pill" style="background:' + priCfg.bg + ';color:' + priCfg.col + ';border:1px solid ' + priCfg.col + '33">' + priCfg.label + '</span>'
      + '</div>'
      + '<div class="appr-what">' + what + '</div>'
      + '<div class="appr-meta">'
      + '<span class="appr-printer">🖨 ' + r.printer_code + '</span>'
      + '<span class="appr-branch">🏢 Branch ' + r.branch_code + '</span>'
      + '<span class="appr-qty">× ' + r.quantity + (r.request_type === 'paper' ? ' reams' : ' unit') + '</span>'
      + '</div>'
      + (r.notes ? '<div class="appr-notes">💬 "' + r.notes + '"</div>' : '')
      + '<div class="appr-by">Requested by <strong>' + (r.requested_by_name || '—') + '</strong> · ' + dt + '</div>'
      + '</div>'
      + '<div class="appr-card-right">'
      + '<div class="appr-status-pill" style="background:' + statusCfg.bg + ';color:' + statusCfg.col + ';border:1px solid ' + statusCfg.col + '33">' + statusCfg.label + '</div>'
      + (isPending
          ? '<div class="appr-actions">'
              + '<input class="appr-note-input" id="rn-' + r.id + '" placeholder="Review note (optional)...">'
              + '<button class="appr-approve-btn" onclick="reviewRequest(' + r.id + ',\'approved\')">✅ Approve &amp; Deduct Stock</button>'
              + '<button class="appr-reject-btn"  onclick="reviewRequest(' + r.id + ',\'rejected\')">❌ Reject Request</button>'
            + '</div>'
          : '<div style="width:100%">'
              + (r.review_note ? '<div class="appr-review-note">💬 ' + r.review_note + '</div>' : '')
              + '<div class="appr-reviewer" style="margin-top:5px">Reviewed by <strong>' + (r.reviewed_by_name || '—') + '</strong>' + (dtReviewed ? ' · ' + dtReviewed : '') + '</div>'
            + '</div>'
        )
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

async function reviewRequest(id, status) {
  var noteEl = document.getElementById('rn-' + id);
  var note   = noteEl ? noteEl.value : '';
  try {
    await api('PATCH', '/requests/' + id + '/review', { status: status, review_note: note || null });
    toast(status === 'approved' ? '✅' : '❌', 'Request ' + status + '!',
      status === 'approved' ? 'Stock auto-deducted and logged.' : '');
    loadApprovals();
    refreshPendingBadge();
  } catch(e) {}
}

async function refreshPendingBadge() {
  var r = await silentApi('GET', '/requests/pending-count');
  if (r && r.count !== undefined) updatePendingBadge(r.count);
}