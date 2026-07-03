/* ============================================================
   SoftWave — Post-Login Loading Screen
   File: js/loading.js
   Shows an animated "connecting / verifying / loading data"
   screen for ~3.5s after a successful login, then invokes
   the supplied callback (used to reveal the app shell).
   ============================================================ */

function runLoadingScreen(onComplete) {
  var screen  = document.getElementById('loading-screen');
  var bar     = document.getElementById('ls-bar-fill');
  var pct     = document.getElementById('ls-bar-pct');
  var subTxt  = document.getElementById('ls-sub');
  var steps   = ['ls-s1', 'ls-s2', 'ls-s3', 'ls-s4'];
  var tholds  = [10, 35, 65, 88];
  var msgs    = ['Connecting to server…', 'Verifying credentials…', 'Loading your data…', 'Almost there…'];

  var prog = 0, timer = null;

  steps.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active', 'done');
  });

  bar.style.transition = 'none';
  bar.style.width = '0%';
  pct.textContent = '0%';
  subTxt.textContent = 'Preparing your workspace…';

  screen.style.display = 'flex';

  setTimeout(function() {
    bar.style.transition = 'width 0.12s linear';

    /* Tuned so the bar completes in roughly 3.5s */
    timer = setInterval(function() {
      prog = Math.min(prog + Math.random() * 2.5 + 1.2, 100);
      var p = Math.round(prog);
      bar.style.width = p + '%';
      pct.textContent = p + '%';

      tholds.forEach(function(t, i) {
        var el = document.getElementById(steps[i]);
        if (!el) return;
        if (prog >= t && !el.classList.contains('active') && !el.classList.contains('done')) {
          el.classList.add('active');
          subTxt.textContent = msgs[i];
        }
        if (prog >= (tholds[i + 1] || 101)) {
          el.classList.remove('active');
          el.classList.add('done');
        }
      });

      if (prog >= 100) {
        clearInterval(timer);
        pct.textContent = '100%';
        subTxt.textContent = 'Ready! Redirecting…';

        setTimeout(function() {
          screen.style.display = 'none';
          if (typeof onComplete === 'function') onComplete();
        }, 400);
      }
    }, 80);
  }, 50);
}
