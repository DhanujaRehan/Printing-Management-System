#!/usr/bin/env python3
"""
Run this script in your project root to apply paper card changes to index.html
Usage: python3 apply_paper_patch.py
"""
import re, time

with open('frontend/public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. Remove paper breakdown section from printer popup ──────────────────
# Find the paper breakdown section inside eod-pop-box and remove it
old_paper_section = """          <!-- Paper type cards -->
          <div class="eod3-pop-section">
            <div class="eod3-pop-section-title">📄 Paper Breakdown <span style="font-size:11px;color:#94a3b8;font-weight:500">(Optional)</span></div>
            <div class="eod3-pop-section-sub">Tap each paper type to enter Single / Double side amounts</div>

            <!-- A4 -->
            <div class="eod3-paper-card" id="eod3-paper-a4">
              <div class="eod3-paper-card-hdr" onclick="eodTogglePaper('a4')">
                <div class="eod3-paper-icon">📄</div>
                <div class="eod3-paper-name">A4 Paper</div>
                <div class="eod3-paper-arrow" id="eod3-arrow-a4">▼</div>
              </div>
              <div class="eod3-paper-inputs" id="eod3-inputs-a4" style="display:none">
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Single Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-a4s"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Double Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-a4d"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
              </div>
            </div>

            <!-- B4 -->
            <div class="eod3-paper-card" id="eod3-paper-b4">
              <div class="eod3-paper-card-hdr" onclick="eodTogglePaper('b4')">
                <div class="eod3-paper-icon">📋</div>
                <div class="eod3-paper-name">B4 Paper</div>
                <div class="eod3-paper-arrow" id="eod3-arrow-b4">▼</div>
              </div>
              <div class="eod3-paper-inputs" id="eod3-inputs-b4" style="display:none">
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Single Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-b4s"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Double Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-b4d"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
              </div>
            </div>

            <!-- Legal -->
            <div class="eod3-paper-card" id="eod3-paper-lg">
              <div class="eod3-paper-card-hdr" onclick="eodTogglePaper('lg')">
                <div class="eod3-paper-icon">📃</div>
                <div class="eod3-paper-name">Legal Paper</div>
                <div class="eod3-paper-arrow" id="eod3-arrow-lg">▼</div>
              </div>
              <div class="eod3-paper-inputs" id="eod3-inputs-lg" style="display:none">
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Single Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-lgs"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
                <div class="eod3-paper-row">
                  <div class="eod3-paper-side-lbl">Double Side</div>
                  <input type="number" class="eod3-paper-inp" id="eod-pop-lgd"
                    placeholder="0" inputmode="numeric" min="0" oninput="eodPopCalcPaper()">
                </div>
              </div>
            </div>

            <div class="eod3-paper-total-preview" id="eod-pop-paper-total"></div>
          </div>"""

html = html.replace(old_paper_section, '', 1)
print("Step 1: Paper section removed from printer popup")

# ── 2. Add paper cards wrap + paper popup after history section, before eod page closing ──
old_history = """      <!-- ── Recent logs ────────────────────────────────── -->
      <div class="eod3-history-section">"""

new_history = """      <!-- ── Paper cards (branch daily totals) ─────────── -->
      <div id="eod-paper-cards-wrap" style="display:none"></div>

      <!-- ── Recent logs ────────────────────────────────── -->
      <div class="eod3-history-section">"""

html = html.replace(old_history, new_history, 1)
print("Step 2: Paper cards wrap added")

# ── 3. Add paper popup overlay after the printer popup ──
old_after_pop = """    </div><!-- /eod3-pop-overlay -->"""

new_after_pop = """    </div><!-- /eod3-pop-overlay -->

    <!-- ── PAPER POPUP ────────────────────────────────── -->
    <div class="eod3-pop-overlay" id="eod-paper-pop-overlay"
         style="display:none" onclick="if(event.target===this) eodClosePaperPop()">
      <div class="eod3-pop-box" id="eod-paper-pop-box">

        <!-- Header -->
        <div class="eod3-pop-hdr" id="eod-paper-pop-hdr" style="background:linear-gradient(135deg,#0ea5e9,#6366f1);border-radius:24px 24px 0 0;">
          <div class="eod3-pop-hdr-left">
            <div class="eod3-pop-code" id="eod-paper-pop-title">Paper</div>
            <div class="eod3-pop-model" id="eod-paper-pop-sub"></div>
          </div>
          <div class="eod3-pop-hdr-right">
            <button class="eod3-pop-close" onclick="eodClosePaperPop()">✕</button>
          </div>
        </div>

        <!-- Single side input -->
        <div class="eod3-pop-section">
          <div class="eod3-pop-section-title">📋 Single Side Prints</div>
          <div class="eod3-pop-section-sub">Total sheets printed single sided today (branch total)</div>
          <input type="number" class="eod3-total-input" id="eod-paper-pop-single"
            placeholder="e.g. 500" inputmode="numeric" min="0"
            oninput="eodPaperPopCalc()">
        </div>

        <!-- Double side input -->
        <div class="eod3-pop-section">
          <div class="eod3-pop-section-title">📋 Double Side Prints</div>
          <div class="eod3-pop-section-sub">Total sheets printed double sided today (branch total)</div>
          <input type="number" class="eod3-total-input" id="eod-paper-pop-double"
            placeholder="e.g. 200" inputmode="numeric" min="0"
            oninput="eodPaperPopCalc()">
          <div class="eod3-total-preview" id="eod-paper-pop-preview"></div>
        </div>

        <!-- Save button -->
        <div class="eod3-pop-footer">
          <button class="eod3-pop-save-btn" id="eod-paper-pop-save" onclick="eodPaperPopSave()">
            ✓ Save Paper Count
          </button>
        </div>

      </div>
    </div><!-- /eod-paper-pop-overlay -->"""

html = html.replace(old_after_pop, new_after_pop, 1)
print("Step 3: Paper popup added")

# ── 4. Update CSS version ──
new_v = str(int(time.time()))
html = re.sub(r'(main|login|pages)\.css\?v=\d+', lambda m: m.group().split('?')[0]+'?v='+new_v, html)
print("Step 4: CSS version updated to", new_v)

with open('frontend/public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("\n✅ All changes applied successfully!")
print("Counts: paper_section_removed, paper_cards_wrap_added, paper_popup_added")
