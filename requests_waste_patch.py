#!/usr/bin/env python3
"""
Run from project root:
  python requests_waste_patch.py

Adds waste_a4, waste_b4, waste_legal to daily paper log endpoints.
"""

with open('backend/routes/requests.py', 'r', encoding='utf-8') as f:
    content = f.read()

# ── PATCH 1: Update DailyPaperLogBody model ──────────────────
old_body = """class DailyPaperLogBody(BaseModel):
    branch_id:   int
    log_date:    str
    paper_type:  str
    single_side: int = 0
    double_side: int = 0"""

new_body = """class DailyPaperLogBody(BaseModel):
    branch_id:   int
    log_date:    str
    paper_type:  str
    single_side: int = 0
    double_side: int = 0
    waste:       int = 0   # waste paper count for this type"""

if old_body in content:
    content = content.replace(old_body, new_body, 1)
    print("Patch 1 ✅ DailyPaperLogBody updated")
else:
    print("Patch 1 ❌ Not found")

# ── PATCH 2: Update POST /daily-paper-log ────────────────────
old_post = """@router.post("/daily-paper-log")
def save_daily_paper_log(body: DailyPaperLogBody, current_user: dict = Depends(get_current_user)):
    if body.paper_type not in ('a4', 'b4', 'legal'):
        raise HTTPException(status_code=400, detail="paper_type must be a4, b4 or legal")
    result = query(\"\"\"
        INSERT INTO daily_paper_logs
        (branch_id, logged_by, log_date, paper_type, single_side, double_side)
        VALUES (%s, %s, %s::date, %s, %s, %s)
        ON CONFLICT (branch_id, log_date, paper_type) DO UPDATE SET
            single_side=EXCLUDED.single_side, double_side=EXCLUDED.double_side,
            logged_by=EXCLUDED.logged_by, created_at=NOW()
        RETURNING id
    \"\"\", (body.branch_id, int(current_user["sub"]), body.log_date,
          body.paper_type, body.single_side, body.double_side), fetch="one")
    return {"message": "saved", "id": result["id"] if result else None}"""

new_post = """@router.post("/daily-paper-log")
def save_daily_paper_log(body: DailyPaperLogBody, current_user: dict = Depends(get_current_user)):
    if body.paper_type not in ('a4', 'b4', 'legal'):
        raise HTTPException(status_code=400, detail="paper_type must be a4, b4 or legal")
    result = query(\"\"\"
        INSERT INTO daily_paper_logs
        (branch_id, logged_by, log_date, paper_type, single_side, double_side, waste_a4, waste_b4, waste_legal)
        VALUES (%s, %s, %s::date, %s, %s, %s,
            CASE %s WHEN 'a4'    THEN %s ELSE 0 END,
            CASE %s WHEN 'b4'    THEN %s ELSE 0 END,
            CASE %s WHEN 'legal' THEN %s ELSE 0 END)
        ON CONFLICT (branch_id, log_date, paper_type) DO UPDATE SET
            single_side=EXCLUDED.single_side,
            double_side=EXCLUDED.double_side,
            waste_a4   =EXCLUDED.waste_a4,
            waste_b4   =EXCLUDED.waste_b4,
            waste_legal=EXCLUDED.waste_legal,
            logged_by  =EXCLUDED.logged_by,
            created_at =NOW()
        RETURNING id
    \"\"\", (body.branch_id, int(current_user["sub"]), body.log_date,
          body.paper_type, body.single_side, body.double_side,
          body.paper_type, body.waste,
          body.paper_type, body.waste,
          body.paper_type, body.waste), fetch="one")
    return {"message": "saved", "id": result["id"] if result else None}"""

if old_post in content:
    content = content.replace(old_post, new_post, 1)
    print("Patch 2 ✅ POST endpoint updated")
else:
    print("Patch 2 ❌ Not found")

# ── PATCH 3: Update GET /daily-paper-log ─────────────────────
old_get = """    rows = query(\"\"\"
        SELECT dpl.paper_type, dpl.single_side, dpl.double_side,
               u.full_name AS logged_by_name, dpl.created_at
        FROM daily_paper_logs dpl
        LEFT JOIN users u ON u.id = dpl.logged_by
        WHERE dpl.branch_id = %s AND dpl.log_date = %s::date
    \"\"\", (branch_id, log_date)) or []
    return rows"""

new_get = """    rows = query(\"\"\"
        SELECT dpl.paper_type, dpl.single_side, dpl.double_side,
               COALESCE(dpl.waste_a4,    0) AS waste_a4,
               COALESCE(dpl.waste_b4,    0) AS waste_b4,
               COALESCE(dpl.waste_legal, 0) AS waste_legal,
               u.full_name AS logged_by_name, dpl.created_at
        FROM daily_paper_logs dpl
        LEFT JOIN users u ON u.id = dpl.logged_by
        WHERE dpl.branch_id = %s AND dpl.log_date = %s::date
    \"\"\", (branch_id, log_date)) or []
    return rows"""

if old_get in content:
    content = content.replace(old_get, new_get, 1)
    print("Patch 3 ✅ GET endpoint updated")
else:
    print("Patch 3 ❌ Not found")

with open('backend/routes/requests.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ requests.py updated. Run waste_paper.sql in pgAdmin, then push.")
