/* ============================================================
   SoftWave — Nuwan Dashboard — 2026 UX Enhancement Layer
   File: js/nuwan-2026.js

   Purely ADDITIVE. Does not redeclare, wrap, or override any
   function from the existing inline <script> in nuwan.html
   (nwTab, nwLogin, nwApi, etc.), so none of the working business
   logic is touched. This file only:
     1. Ticks a live clock chip in the top bar.
     2. Fills the avatar initials once the username is rendered.
     3. Gives freshly-injected list rows a soft staggered
        entrance using a MutationObserver (safe, read-only —
        it never edits the content the existing app writes).
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Live clock ------------------------------------- */
  function tickClock() {
    var el = document.getElementById("nw-live-clock");
    if (!el) return;
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 || 12;
    function pad(n) { return n < 10 ? "0" + n : n; }
    el.textContent = h12 + ":" + pad(m) + ":" + pad(s) + " " + ampm;
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ---- 2. Avatar initials --------------------------------- */
  function initialsFrom(text) {
    if (!text) return "?";
    var parts = text.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function syncAvatar() {
    var nameEl = document.getElementById("nw-uname");
    var avatarEl = document.getElementById("nw-avatar");
    if (!nameEl || !avatarEl) return;
    var txt = nameEl.textContent || "";
    if (txt && txt !== "—") avatarEl.textContent = initialsFrom(txt);
  }
  var unameEl = document.getElementById("nw-uname");
  if (unameEl && window.MutationObserver) {
    new MutationObserver(syncAvatar).observe(unameEl, { childList: true, characterData: true, subtree: true });
  }
  syncAvatar();

  /* ---- 3. Soft staggered reveal for injected rows --------- */
  var REVEAL_SELECTOR = [
    ".nw-branch-row", ".nw-req-card", ".nw-repl-card", ".nws-branch-card",
    ".nw-printer-card", ".nw-monthly-branch-row", ".nw-perm-row",
    ".nw-hw-card", ".nw-rental-row"
  ].join(",");

  function revealChildren(container) {
    if (!container || !container.querySelectorAll) return;
    var items = container.querySelectorAll(REVEAL_SELECTOR);
    var n = 0;
    items.forEach(function (el) {
      if (el.dataset && el.dataset.nwRevealed) return;
      if (el.dataset) el.dataset.nwRevealed = "1";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      el.style.transition = "opacity .35s cubic-bezier(.16,1,.3,1), transform .35s cubic-bezier(.16,1,.3,1)";
      var delay = Math.min(n * 28, 420);
      setTimeout(function () {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, delay);
      n++;
    });
  }

  var watchTargets = [
    "yd-list", "tn-branches", "nw-req-list", "nw-repl-list",
    "nw-rental-list", "nw-purchased-list", "nws-branch-cards",
    "nw-perm-list", "nw-hw-list", "npr-container"
  ];

  if (window.MutationObserver) {
    watchTargets.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var obs = new MutationObserver(function () { revealChildren(el); });
      obs.observe(el, { childList: true, subtree: false });
    });
  }

  /* Respect reduced-motion preference: disable the JS-driven
     reveal transitions entirely if the user prefers less motion. */
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealChildren = function () {};
  }
})();
