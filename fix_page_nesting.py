#!/usr/bin/env python3
"""Run from project root: python fix_page_nesting.py"""

with open('frontend/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# page-branchreport is missing its closing </div> before page-auditing
old = """      <tbody id="br-tbody"></tbody>
          </table>
        </div>
      </div>

    <!-- ── AUDITING HUB"""

new = """      <tbody id="br-tbody"></tbody>
          </table>
        </div>
      </div>
    </div><!-- /page-branchreport -->

    <!-- ── AUDITING HUB"""

if old in content:
    content = content.replace(old, new, 1)
    print("Fix ✅ page-branchreport closing div added")
else:
    print("NOT FOUND ❌")

with open('frontend/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done.")
