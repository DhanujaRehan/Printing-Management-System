#!/usr/bin/env python3
"""
Run from project root:
  python fix_printer_popup.py

Moves the printer popup OUTSIDE page-eodlog so it covers
the full screen on mobile, same as the paper popup.
"""

with open('frontend/public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── STEP 1: Remove printer popup from inside page-eodlog ──
# The printer popup currently sits inside page-eodlog before the closing comment
old_inside = """      <!-- ── Printer popup modal ───────────────────────── -->
      <div class="eod3-pop-overlay" id="eod-pop-overlay"
           style="display:none" onclick="if(event.target===this) eodClosePop()">
        <div class="eod3-pop-box" id="eod-pop-box">

          <!-- Header -->
          <div class="eod3-pop-hdr">
            <div class="eod3-pop-hdr-left">
              <div class="eod3-pop-code" id="eod-pop-code"></div>
              <div class="eod3-pop-model" id="eod-pop-model"></div>
            </div>
            <div class="eod3-pop-hdr-right">
              <div class="eod3-pop-pct" id="eod-pop-pct"></div>
              <button class="eod3-pop-close" onclick="eodClosePop()">✕</button>
            </div>
          </div>

          <!-- Total prints input -->
          <div class="eod3-pop-section">
            <div class="eod3-pop-section-title">🖨️ Total Prints Today</div>
            <div class="eod3-pop-section-sub">Enter the total number shown on the printer counter</div>
            <input type="number" class="eod3-total-input" id="eod-pop-total"
              placeholder="e.g. 1250" inputmode="numeric" min="0"
              oninput="eodPopTotalChanged()">
            <div class="eod3-total-preview" id="eod-pop-total-preview"></div>
          </div>



          <!-- Save button -->
          <div class="eod3-pop-footer">
            <button class="eod3-pop-save-btn" id="eod-pop-save" onclick="eodPopSave()">
              ✓ Save This Printer
            </button>
          </div>

        </div>
      </div>
    </div><!-- /eod3-pop-overlay -->"""

# Replace with just the closing div (popup removed from inside)
new_inside = """    </div><!-- /page-eodlog -->"""

if old_inside in html:
    html = html.replace(old_inside, new_inside, 1)
    print("Step 1 ✅ Printer popup removed from inside page-eodlog")
else:
    print("Step 1 ❌ Pattern not found - trying alternate...")
    # Try without the extra blank line
    old_inside2 = """      <!-- ── Printer popup modal ───────────────────────── -->
      <div class="eod3-pop-overlay" id="eod-pop-overlay"
           style="display:none" onclick="if(event.target===this) eodClosePop()">
        <div class="eod3-pop-box" id="eod-pop-box">

          <!-- Header -->
          <div class="eod3-pop-hdr">
            <div class="eod3-pop-hdr-left">
              <div class="eod3-pop-code" id="eod-pop-code"></div>
              <div class="eod3-pop-model" id="eod-pop-model"></div>
            </div>
            <div class="eod3-pop-hdr-right">
              <div class="eod3-pop-pct" id="eod-pop-pct"></div>
              <button class="eod3-pop-close" onclick="eodClosePop()">✕</button>
            </div>
          </div>

          <!-- Total prints input -->
          <div class="eod3-pop-section">
            <div class="eod3-pop-section-title">🖨️ Total Prints Today</div>
            <div class="eod3-pop-section-sub">Enter the total number shown on the printer counter</div>
            <input type="number" class="eod3-total-input" id="eod-pop-total"
              placeholder="e.g. 1250" inputmode="numeric" min="0"
              oninput="eodPopTotalChanged()">
            <div class="eod3-total-preview" id="eod-pop-total-preview"></div>
          </div>

          <!-- Save button -->
          <div class="eod3-pop-footer">
            <button class="eod3-pop-save-btn" id="eod-pop-save" onclick="eodPopSave()">
              ✓ Save This Printer
            </button>
          </div>

        </div>
      </div>
    </div><!-- /eod3-pop-overlay -->"""
    if old_inside2 in html:
        html = html.replace(old_inside2, new_inside, 1)
        print("Step 1 ✅ (alternate) Printer popup removed")
    else:
        print("Step 1 ❌ Could not find printer popup - check manually")

# ── STEP 2: Add printer popup AFTER page-eodlog, before page-tonerlog ──
# Place it right after the eodlog closing div, same position as paper popup
printer_popup = """
    <!-- ── PRINTER POPUP (outside page for correct mobile overlay) ── -->
    <div class="eod3-pop-overlay" id="eod-pop-overlay"
         style="display:none" onclick="if(event.target===this) eodClosePop()">
      <div class="eod3-pop-box" id="eod-pop-box">

        <!-- Header -->
        <div class="eod3-pop-hdr">
          <div class="eod3-pop-hdr-left">
            <div class="eod3-pop-code" id="eod-pop-code"></div>
            <div class="eod3-pop-model" id="eod-pop-model"></div>
          </div>
          <div class="eod3-pop-hdr-right">
            <div class="eod3-pop-pct" id="eod-pop-pct"></div>
            <button class="eod3-pop-close" onclick="eodClosePop()">✕</button>
          </div>
        </div>

        <!-- Total prints input -->
        <div class="eod3-pop-section">
          <div class="eod3-pop-section-title">🖨️ Total Prints Today</div>
          <div class="eod3-pop-section-sub">Enter the total number shown on the printer counter</div>
          <input type="number" class="eod3-total-input" id="eod-pop-total"
            placeholder="e.g. 1250" inputmode="numeric" min="0"
            oninput="eodPopTotalChanged()">
          <div class="eod3-total-preview" id="eod-pop-total-preview"></div>
        </div>

        <!-- Save button -->
        <div class="eod3-pop-footer">
          <button class="eod3-pop-save-btn" id="eod-pop-save" onclick="eodPopSave()">
            ✓ Save This Printer
          </button>
        </div>

      </div>
    </div><!-- /eod-pop-overlay -->

"""

# Insert after the page-eodlog closing div
old_after = """    </div><!-- /page-eodlog -->

    <!-- ── PAPER POPUP"""

new_after = """    </div><!-- /page-eodlog -->
""" + printer_popup + """    <!-- ── PAPER POPUP"""

if old_after in html:
    html = html.replace(old_after, new_after, 1)
    print("Step 2 ✅ Printer popup placed outside page-eodlog")
else:
    # Try the original closing tag format
    old_after2 = """    </div><!-- /page-eodlog -->

    <!-- ── TONER REPLACEMENT LOG"""
    new_after2 = """    </div><!-- /page-eodlog -->
""" + printer_popup + """    <!-- ── TONER REPLACEMENT LOG"""
    if old_after2 in html:
        html = html.replace(old_after2, new_after2, 1)
        print("Step 2 ✅ (alternate) Printer popup placed outside page-eodlog")
    else:
        print("Step 2 ❌ Could not find insertion point")

with open('frontend/public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("\n✅ Done! Printer popup now outside page-eodlog — same as paper popup.")
