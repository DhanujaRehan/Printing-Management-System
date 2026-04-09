#!/usr/bin/env python3
"""
Run from project root:
  python fix_nuwan.py

Fixes nuwan.html:
1. Adds permissions/hardware cases to nwTab()
2. Removes visible HTML comment markers
3. Fixes panel-summary missing closing div
"""

with open('frontend/public/nuwan.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── FIX 1: Add permissions/hardware to nwTab() ───────────────
old_tab = "  if(name==='summary')      nwInitSummary();"
new_tab = """  if(name==='summary')      nwInitSummary();
  if(name==='permissions')  nwLoadPermissions();
  if(name==='hardware')     nwLoadHardware();"""

if old_tab in html:
    html = html.replace(old_tab, new_tab, 1)
    print("Fix 1 ✅ nwTab() updated")
else:
    print("Fix 1 ❌ nwTab pattern not found")

# ── FIX 2: Remove visible HTML comment markers from modals ────
# The comment markers appear as visible text because they are
# inside the nw-app div but outside any panel

old_perm_comment = """  <!-- ============================================================
     PERMISSIONS POPUP MODAL — add before </div><!-- /nw-app -->
     ============================================================ -->
    <div class="nw-modal-bg" id="nw-perm-modal\""""

new_perm_comment = """  <div class="nw-modal-bg" id="nw-perm-modal\""""

if old_perm_comment in html:
    html = html.replace(old_perm_comment, new_perm_comment, 1)
    print("Fix 2a ✅ Permissions modal comment removed")
else:
    print("Fix 2a ❌ Not found")

old_hw_comment = """<!-- ============================================================
     HARDWARE REQUEST MODAL — add before </div><!-- /nw-app -->
     ============================================================ -->
    <div class="nw-modal-bg" id="nw-hw-modal\""""

new_hw_comment = """  <div class="nw-modal-bg" id="nw-hw-modal\""""

if old_hw_comment in html:
    html = html.replace(old_hw_comment, new_hw_comment, 1)
    print("Fix 2b ✅ Hardware modal comment removed")
else:
    print("Fix 2b ❌ Not found")

# ── FIX 3: Fix panel-summary — missing closing div ────────────
# panel-summary has opening div but closing comment is malformed
# Currently ends with:    </div><!-- /panel-summary -->
# But it's missing the actual closing </div> for the panel

old_summary_end = """        <div style="font-size:13px;color:#94a3b8">Choose a date range, month, year or branch then tap Search</div>
    </div><!-- /panel-summary -->"""

new_summary_end = """        <div style="font-size:13px;color:#94a3b8">Choose a date range, month, year or branch then tap Search</div>
      </div><!-- /nws-empty -->
    </div><!-- /panel-summary -->"""

if old_summary_end in html:
    html = html.replace(old_summary_end, new_summary_end, 1)
    print("Fix 3 ✅ panel-summary closing div fixed")
else:
    print("Fix 3 ❌ Not found — checking alternate...")
    # Try without the comment
    old2 = '        <div style="font-size:13px;color:#94a3b8">Choose a date range, month, year or branch then tap Search</div>\n    </div><!-- /panel-summary -->'
    if old2 in html:
        html = html.replace(old2, '        <div style="font-size:13px;color:#94a3b8">Choose a date range, month, year or branch then tap Search</div>\n      </div>\n    </div><!-- /panel-summary -->', 1)
        print("Fix 3 ✅ (alternate) panel-summary fixed")

with open('frontend/public/nuwan.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("\n✅ Done! Push and deploy.")
