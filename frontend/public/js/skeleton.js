/* ============================================================
   SoftWave — Loading Skeleton Helpers
   File: js/skeleton.js
   Small, reusable functions that generate shimmering placeholder
   markup. Call one of these instead of a spinner/blank string
   right before an async fetch, then overwrite it with the real
   content once data arrives — same pattern already used
   everywhere in the app (element.innerHTML = '...').
   ============================================================ */

/* Table-row skeleton — use inside a <tbody>.
   colspan: how many <td> columns the real table has.
   rows:    how many placeholder rows to show (default 6). */
function skTableRows(colspan, rows) {
  rows = rows || 6;
  var out = '';
  for (var i = 0; i < rows; i++) {
    out += '<tr class="sk-tr"><td colspan="' + colspan + '">'
      + '<div class="sk-row-inner">'
      + '<div class="sk-bar"></div>'
      + '<div class="sk-bar"></div>'
      + '<div class="sk-bar"></div>'
      + '<div class="sk-bar"></div>'
      + '<div class="sk-bar"></div>'
      + '</div></td></tr>';
  }
  return out;
}

/* Card-grid skeleton — for branch grids, printer selectors,
   stock visualisations, or any responsive card layout.
   count:    how many placeholder cards (default 6).
   minWidth: matches the real grid's minmax() card width, in px. */
function skCards(count, minWidth) {
  count = count || 6;
  var style = 'grid-template-columns:repeat(auto-fill,minmax(' + (minWidth || 240) + 'px,1fr));';
  var out = '<div class="sk-card-grid" style="' + style + '">';
  for (var i = 0; i < count; i++) {
    out += '<div class="sk-card"><div class="sk-bar"></div><div class="sk-bar"></div><div class="sk-bar"></div></div>';
  }
  return out + '</div>';
}

/* Stacked list-item skeleton — for card-style lists like
   approvals, pending imports, audit results, print reports.
   count: how many placeholder items (default 4). */
function skList(count) {
  count = count || 4;
  var out = '';
  for (var i = 0; i < count; i++) {
    out += '<div class="sk-listitem"><div class="sk-bar"></div><div class="sk-bar"></div><div class="sk-bar"></div></div>';
  }
  return out;
}

/* Tiny inline bar — for a single stat/number that's still
   loading (e.g. a dashboard KPI), used as innerHTML on the
   element; a later .textContent assignment overwrites it. */
function skInline() {
  return '<span class="sk-bar sk-inline"></span>';
}
