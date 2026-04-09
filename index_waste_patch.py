#!/usr/bin/env python3
"""
Run from project root:
  python index_waste_patch.py

Adds waste paper cards div and waste popup to index.html
"""

with open('frontend/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── PATCH 1: Add waste cards div after paper cards wrap ───────
old_wrap = """      <!-- ── Paper cards (branch daily totals) ─────────── -->
      <div id="eod-paper-cards-wrap" style="display:none"></div>

      <!-- ── Recent logs"""

new_wrap = """      <!-- ── Paper cards (branch daily totals) ─────────── -->
      <div id="eod-paper-cards-wrap" style="display:none"></div>

      <!-- ── Waste paper cards ─────────────────────────── -->
      <div id="eod-waste-cards-wrap" style="display:none"></div>

      <!-- ── Recent logs"""

if old_wrap in content:
    content = content.replace(old_wrap, new_wrap, 1)
    print("Patch 1 ✅ Waste cards div added")
else:
    print("Patch 1 ❌ Not found")

# ── PATCH 2: Add waste popup after paper popup ────────────────
old_after_paper = """    </div><!-- /eod-paper-pop-overlay -->


    <!-- ── TONER REPLACEMENT LOG"""

new_after_paper = """    </div><!-- /eod-paper-pop-overlay -->

    <!-- ── WASTE PAPER POPUP ─────────────────────────────── -->
    <div class="eod3-pop-overlay" id="eod-waste-pop-overlay"
         style="display:none" onclick="if(event.target===this) eodCloseWastePop()">
      <div class="eod3-pop-box" id="eod-waste-pop-box">

        <!-- Header -->
        <div class="eod3-pop-hdr" id="eod-waste-pop-hdr" style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:24px 24px 0 0;">
          <div class="eod3-pop-hdr-left">
            <div class="eod3-pop-code" id="eod-waste-pop-title">Waste Paper</div>
            <div class="eod3-pop-model" id="eod-waste-pop-sub"></div>
          </div>
          <div class="eod3-pop-hdr-right">
            <button class="eod3-pop-close" onclick="eodCloseWastePop()">✕</button>
          </div>
        </div>

        <!-- Waste count input -->
        <div class="eod3-pop-section">
          <div class="eod3-pop-section-title">🗑️ Waste Sheet Count</div>
          <div class="eod3-pop-section-sub">Total sheets wasted today (branch total)</div>
          <input type="number" class="eod3-total-input" id="eod-waste-pop-count"
            placeholder="e.g. 50" inputmode="numeric" min="0">
        </div>

        <!-- Save button -->
        <div class="eod3-pop-footer">
          <button class="eod3-pop-save-btn" id="eod-waste-pop-save"
            onclick="eodWastePopSave()"
            style="background:linear-gradient(135deg,#ef4444,#dc2626)">
            ✓ Save Waste Count
          </button>
        </div>

      </div>
    </div><!-- /eod-waste-pop-overlay -->


    <!-- ── TONER REPLACEMENT LOG"""

if old_after_paper in content:
    content = content.replace(old_after_paper, new_after_paper, 1)
    print("Patch 2 ✅ Waste popup HTML added")
else:
    print("Patch 2 ❌ Not found")

with open('frontend/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ index.html updated.")
