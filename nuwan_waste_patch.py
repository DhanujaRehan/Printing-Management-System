#!/usr/bin/env python3
"""
Run from project root:
  python nuwan_waste_patch.py

Updates /nuwan/prints/paper-summary to include waste totals.
"""

with open('backend/routes/nuwan.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_query = """    rows = query(f\"\"\"
        SELECT
            dpl.log_date,
            b.id   AS branch_id,
            b.code AS branch_code,
            b.name AS branch_name,
            dpl.paper_type,
            dpl.single_side,
            dpl.double_side,
            dpl.single_side + dpl.double_side AS total_sheets,
            u.full_name AS logged_by,
            dpl.created_at
        FROM daily_paper_logs dpl
        JOIN branches b ON b.id = dpl.branch_id
        LEFT JOIN users u ON u.id = dpl.logged_by
        WHERE {where}
        ORDER BY dpl.log_date DESC, b.code, dpl.paper_type
    \"\"\", tuple(params)) or []

    a4_total    = sum(r["total_sheets"] for r in rows if r["paper_type"] == "a4")
    b4_total    = sum(r["total_sheets"] for r in rows if r["paper_type"] == "b4")
    legal_total = sum(r["total_sheets"] for r in rows if r["paper_type"] == "legal")

    return {
        "rows":        rows,
        "a4_total":    a4_total,
        "b4_total":    b4_total,
        "legal_total": legal_total,
        "grand_total": a4_total + b4_total + legal_total,
    }"""

new_query = """    rows = query(f\"\"\"
        SELECT
            dpl.log_date,
            b.id   AS branch_id,
            b.code AS branch_code,
            b.name AS branch_name,
            dpl.paper_type,
            dpl.single_side,
            dpl.double_side,
            dpl.single_side + dpl.double_side AS total_sheets,
            COALESCE(dpl.waste_a4,    0) AS waste_a4,
            COALESCE(dpl.waste_b4,    0) AS waste_b4,
            COALESCE(dpl.waste_legal, 0) AS waste_legal,
            u.full_name AS logged_by,
            dpl.created_at
        FROM daily_paper_logs dpl
        JOIN branches b ON b.id = dpl.branch_id
        LEFT JOIN users u ON u.id = dpl.logged_by
        WHERE {where}
        ORDER BY dpl.log_date DESC, b.code, dpl.paper_type
    \"\"\", tuple(params)) or []

    a4_total       = sum(r["total_sheets"] for r in rows if r["paper_type"] == "a4")
    b4_total       = sum(r["total_sheets"] for r in rows if r["paper_type"] == "b4")
    legal_total    = sum(r["total_sheets"] for r in rows if r["paper_type"] == "legal")
    waste_a4_total = sum(r["waste_a4"]     for r in rows)
    waste_b4_total = sum(r["waste_b4"]     for r in rows)
    waste_lg_total = sum(r["waste_legal"]  for r in rows)

    return {
        "rows":           rows,
        "a4_total":       a4_total,
        "b4_total":       b4_total,
        "legal_total":    legal_total,
        "grand_total":    a4_total + b4_total + legal_total,
        "waste_a4_total": waste_a4_total,
        "waste_b4_total": waste_b4_total,
        "waste_lg_total": waste_lg_total,
        "waste_total":    waste_a4_total + waste_b4_total + waste_lg_total,
    }"""

if old_query in content:
    content = content.replace(old_query, new_query, 1)
    print("nuwan.py updated ✅")
else:
    print("NOT FOUND ❌")

with open('backend/routes/nuwan.py', 'w', encoding='utf-8') as f:
    f.write(content)
