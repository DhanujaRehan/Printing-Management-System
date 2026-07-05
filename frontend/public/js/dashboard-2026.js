/* ============================================================
   SoftWave — Dashboard 2026 UI enhancements
   File: js/dashboard-2026.js
   Purely additive: greeting header, live clock, refresh spin.
   Include AFTER dashboard.js and nav.js in index.html.
   ============================================================ */

function dashGreetingText() {
  var h = new Date().getHours();
  if (h < 5)  return 'Working late?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Working late?';
}

function renderDashGreeting() {
  var el = document.getElementById('dhero-greeting');
  if (!el) return;
  var name = (window.APP && APP.user && (APP.user.full_name || APP.user.name || APP.user.username)) || '';
  var first = name ? (' ' + name.split(' ')[0]) : '';
  el.textContent = dashGreetingText() + first;
}

function tickDashClock() {
  var el = document.getElementById('dhero-clock');
  if (!el) return;
  el.textContent = new Date().toLocaleString('en-GB', {
    weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
  });
}

/* Wraps the existing loadDashboard() so the refresh button gets a
   satisfying spin + disables itself briefly — no change to the
   original data-loading logic in dashboard.js. */
function refreshDashboardUI() {
  var btn = document.getElementById('dhero-refresh-btn');
  if (btn) {
    btn.classList.add('spinning');
    btn.disabled = true;
  }
  Promise.resolve(typeof loadDashboard === 'function' ? loadDashboard() : null)
    .then(function() { renderDashGreeting(); })
    .finally(function() {
      setTimeout(function() {
        if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
      }, 500);
    });
}

/* Init once the dashboard page exists in the DOM. */
(function initDash2026() {
  function ready() {
    if (!document.getElementById('page-dashboard')) return;
    renderDashGreeting();
    tickDashClock();
    setInterval(tickDashClock, 30000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
