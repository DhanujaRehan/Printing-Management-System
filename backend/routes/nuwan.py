"""
Nuwan Dashboard routes — Branch overview for management monitoring.
Role: 'nuwan' — read-only executive dashboard for branch print monitoring.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role
from datetime import date, timedelta

router = APIRouter(prefix="/api/nuwan", tags=["Nuwan Dashboard"])


def require_nuwan(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("nuwan", "manager", "dba"):
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user



# ── Branches list for Nuwan filters ─────────────────────────────────────────
@router.get("/branches")
def get_branches_for_nuwan(current_user: dict = Depends(require_nuwan)):
    """All active branches — for filter dropdowns."""
    return query("""
        SELECT id, code, name FROM branches
        WHERE is_active = TRUE ORDER BY name
    """) or []

# ── Toner levels per branch ──────────────────────────────────────────────────
@router.get("/toner")
def get_toner_levels(current_user: dict = Depends(require_nuwan)):
    """Toner levels for every active printer — remaining copies calculated from daily logs."""
    # Try new view columns first, fall back to legacy current_pct if view not updated yet
    rows = query("""
        SELECT
            b.id                    AS branch_id,
            b.code                  AS branch_code,
            b.name                  AS branch_name,
            p.id                    AS printer_id,
            p.printer_code,
            p.model,
            tm.model_code           AS toner_model_code,
            COALESCE(ti.yield_copies, 0) AS yield_copies,
            -- Remaining copies = yield minus total prints since install
            GREATEST(0,
                COALESCE(ti.yield_copies, 0) - COALESCE((
                    SELECT SUM(pl.print_count)
                    FROM print_logs pl
                    WHERE pl.printer_id = p.id
                      AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                ), 0)
            ) AS copies_remaining,
            -- Percentage remaining
            ROUND(GREATEST(0.0,
                100.0 * (
                    COALESCE(ti.yield_copies, 0) - COALESCE((
                        SELECT SUM(pl.print_count)
                        FROM print_logs pl
                        WHERE pl.printer_id = p.id
                          AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                    ), 0)
                ) / NULLIF(ti.yield_copies, 0)
            ), 1) AS current_pct,
            -- Total prints since install
            COALESCE((
                SELECT SUM(pl.print_count)
                FROM print_logs pl
                WHERE pl.printer_id = p.id
                  AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
            ), 0) AS total_prints_since_install,
            -- Days remaining
            CASE
                WHEN COALESCE(ti.avg_daily_copies, 0) > 0 THEN
                    ROUND(GREATEST(0,
                        COALESCE(ti.yield_copies, 0) - COALESCE((
                            SELECT SUM(pl.print_count)
                            FROM print_logs pl
                            WHERE pl.printer_id = p.id
                              AND pl.log_date >= COALESCE(ti.installed_at::date, '2000-01-01')
                        ), 0)
                    )::NUMERIC / ti.avg_daily_copies)
                ELSE NULL
            END AS days_remaining,
            -- Status label
            CASE
                WHEN ti.id IS NULL THEN 'unknown'
                WHEN ROUND(GREATEST(0.0, 100.0 * (COALESCE(ti.yield_copies,0) - COALESCE((SELECT SUM(pl2.print_count) FROM print_logs pl2 WHERE pl2.printer_id=p.id AND pl2.log_date >= COALESCE(ti.installed_at::date,'2000-01-01')),0)) / NULLIF(ti.yield_copies,0)),1) <= 10 THEN 'critical'
                WHEN ROUND(GREATEST(0.0, 100.0 * (COALESCE(ti.yield_copies,0) - COALESCE((SELECT SUM(pl2.print_count) FROM print_logs pl2 WHERE pl2.printer_id=p.id AND pl2.log_date >= COALESCE(ti.installed_at::date,'2000-01-01')),0)) / NULLIF(ti.yield_copies,0)),1) <= 25 THEN 'low'
                WHEN ROUND(GREATEST(0.0, 100.0 * (COALESCE(ti.yield_copies,0) - COALESCE((SELECT SUM(pl2.print_count) FROM print_logs pl2 WHERE pl2.printer_id=p.id AND pl2.log_date >= COALESCE(ti.installed_at::date,'2000-01-01')),0)) / NULLIF(ti.yield_copies,0)),1) <= 50 THEN 'medium'
                ELSE 'good'
            END AS status
        FROM printers p
        JOIN branches b ON b.id = p.branch_id AND b.is_active = TRUE
        LEFT JOIN toner_installations ti ON ti.printer_id = p.id AND ti.is_current = TRUE
        LEFT JOIN toner_models tm ON tm.id = ti.toner_model_id
        WHERE p.is_active = TRUE
        ORDER BY current_pct ASC NULLS LAST, b.code, p.printer_code
    """) or []
    return rows


# ── Yesterday's print totals per branch ─────────────────────────────────────
@router.get("/prints/yesterday")
def get_yesterday_prints(current_user: dict = Depends(require_nuwan)):
    """Total prints logged yesterday, per branch. Also shows which branches did NOT log."""
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    logged = query("""
        SELECT
            b.id            AS branch_id,
            b.code          AS branch_code,
            b.name          AS branch_name,
            COALESCE(SUM(pl.print_count), 0)    AS total_prints,
            COUNT(DISTINCT pl.printer_id)        AS printers_logged,
            COALESCE(SUM(pl.a4_single),0)
              + COALESCE(SUM(pl.a4_double),0)    AS a4_total,
            COALESCE(SUM(pl.b4_single),0)
              + COALESCE(SUM(pl.b4_double),0)    AS b4_total,
            COALESCE(SUM(pl.letter_single),0)
              + COALESCE(SUM(pl.letter_double),0) AS legal_total,
            TRUE                                 AS has_submitted
        FROM branches b
        JOIN printers p ON p.branch_id = b.id AND p.is_active = TRUE
        JOIN print_logs pl ON pl.printer_id = p.id AND pl.log_date = %s::date
        WHERE b.is_active = TRUE
        GROUP BY b.id, b.code, b.name
        ORDER BY b.code
    """, (yesterday,))

    all_branches = query("""
        SELECT
            b.id   AS branch_id,
            b.code AS branch_code,
            b.name AS branch_name
        FROM branches b
        WHERE b.is_active = TRUE
        ORDER BY b.code
    """)

    logged_ids = {r["branch_id"] for r in (logged or [])}
    logged_map = {r["branch_id"]: r for r in (logged or [])}

    result = []
    for b in (all_branches or []):
        if b["branch_id"] in logged_ids:
            result.append(logged_map[b["branch_id"]])
        else:
            result.append({
                "branch_id":       b["branch_id"],
                "branch_code":     b["branch_code"],
                "branch_name":     b["branch_name"],
                "total_prints":    0,
                "printers_logged": 0,
                "a4_total":        0,
                "b4_total":        0,
                "legal_total":     0,
                "has_submitted":   False,
            })

    return {
        "date":          yesterday,
        "grand_total":   sum(r["total_prints"] for r in result),
        "branches":      result,
        "missing_count": sum(1 for r in result if not r["has_submitted"]),
    }



# ── Branch detail for a specific date ────────────────────────────────────────
@router.get("/prints/branch-detail/{branch_id}")
def get_branch_print_detail(
    branch_id: int,
    log_date: str = None,
    current_user: dict = Depends(require_nuwan)
):
    """
    Detailed print log for a specific branch on a given date.
    Returns each printer log with: who logged it, when, print counts per paper type.
    """
    from datetime import date, timedelta
    if not log_date:
        log_date = (date.today() - timedelta(days=1)).isoformat()

    rows = query("""
        SELECT
            pl.id              AS log_id,
            p.printer_code,
            p.model            AS printer_model,
            pl.print_count,
            pl.a4_single,
            pl.a4_double,
            pl.b4_single,
            pl.b4_double,
            pl.letter_single,
            pl.letter_double,
            pl.log_date,
            pl.created_at,
            u.full_name        AS logged_by_name,
            u.username         AS logged_by_user,
            b.code             AS branch_code,
            b.name             AS branch_name
        FROM print_logs pl
        JOIN printers p  ON p.id  = pl.printer_id
        JOIN branches b  ON b.id  = p.branch_id
        JOIN users u     ON u.id  = pl.logged_by
        WHERE b.id = %s
          AND pl.log_date = %s::date
        ORDER BY pl.created_at ASC
    """, (branch_id, log_date)) or []

    return {
        "branch_id":  branch_id,
        "log_date":   log_date,
        "logs":       rows,
        "total":      sum(r["print_count"] for r in rows),
    }


# ── Print Summary — filtered logs for Nuwan ─────────────────────────────────
@router.get("/prints/summary")
def get_print_summary(
    branch_id: int = None,
    date_from: str = None,
    date_to:   str = None,
    month:     int = None,
    year:      int = None,
    current_user: dict = Depends(require_nuwan)
):
    """
    Filtered print log summary for Nuwan.
    Returns per-row logs + branch totals + grand total.
    Supports filter by branch, date range, or month/year.
    """
    filters = ["1=1"]
    params  = []

    if branch_id:
        filters.append("b.id = %s")
        params.append(branch_id)

    if date_from:
        filters.append("pl.log_date >= %s::date")
        params.append(date_from)

    if date_to:
        filters.append("pl.log_date <= %s::date")
        params.append(date_to)

    if month and year:
        filters.append("EXTRACT(MONTH FROM pl.log_date) = %s")
        filters.append("EXTRACT(YEAR  FROM pl.log_date) = %s")
        params.extend([month, year])
    elif year:
        filters.append("EXTRACT(YEAR FROM pl.log_date) = %s")
        params.append(year)

    where = " AND ".join(filters)

    logs = query(f"""
        SELECT
            pl.id,
            pl.log_date,
            pl.print_count,
            pl.a4_single,  pl.a4_double,
            pl.b4_single,  pl.b4_double,
            pl.letter_single, pl.letter_double,
            pl.created_at,
            p.printer_code,
            p.model        AS printer_model,
            b.id           AS branch_id,
            b.code         AS branch_code,
            b.name         AS branch_name,
            u.full_name    AS logged_by,
            u.username     AS logged_by_user
        FROM print_logs pl
        JOIN printers p ON p.id  = pl.printer_id
        JOIN branches b ON b.id  = p.branch_id
        JOIN users    u ON u.id  = pl.logged_by
        WHERE {where}
        ORDER BY pl.log_date DESC, b.code, p.printer_code
        LIMIT 1000
    """, tuple(params)) or []

    # Branch totals
    branch_totals = query(f"""
        SELECT
            b.id           AS branch_id,
            b.code         AS branch_code,
            b.name         AS branch_name,
            COUNT(DISTINCT pl.log_date)                               AS days_logged,
            COUNT(pl.id)                                              AS log_count,
            COALESCE(SUM(pl.print_count),0)                           AS total_prints,
            COALESCE(SUM(pl.a4_single)+SUM(pl.a4_double),0)          AS a4_total,
            COALESCE(SUM(pl.b4_single)+SUM(pl.b4_double),0)          AS b4_total,
            COALESCE(SUM(pl.letter_single)+SUM(pl.letter_double),0)  AS legal_total
        FROM print_logs pl
        JOIN printers p ON p.id = pl.printer_id
        JOIN branches b ON b.id = p.branch_id
        WHERE {where}
        GROUP BY b.id, b.code, b.name
        ORDER BY total_prints DESC
    """, tuple(params)) or []

    grand_total   = sum(r["total_prints"] for r in branch_totals)
    grand_a4      = sum(r["a4_total"]     for r in branch_totals)
    grand_b4      = sum(r["b4_total"]     for r in branch_totals)
    grand_legal   = sum(r["legal_total"]  for r in branch_totals)

    return {
        "logs":          logs,
        "branch_totals": branch_totals,
        "grand_total":   grand_total,
        "grand_a4":      grand_a4,
        "grand_b4":      grand_b4,
        "grand_legal":   grand_legal,
        "record_count":  len(logs),
    }


# ── Print Summary Excel Export ───────────────────────────────────────────────
@router.get("/prints/summary/export")
def export_print_summary(
    branch_id: int = None,
    date_from: str = None,
    date_to:   str = None,
    month:     int = None,
    year:      int = None,
    current_user: dict = Depends(require_nuwan)
):
    """Export filtered print summary as Excel — for audit purposes."""
    from fastapi.responses import StreamingResponse
    import io
    from datetime import datetime as dt

    try:
        from openpyxl import Workbook # type: ignore
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side # type: ignore
        from openpyxl.utils import get_column_letter # type: ignore
    except ImportError:
        return {"error": "openpyxl not installed"}

    # Reuse summary logic
    filters = ["1=1"]
    params  = []
    if branch_id:
        filters.append("b.id = %s"); params.append(branch_id)
    if date_from:
        filters.append("pl.log_date >= %s::date"); params.append(date_from)
    if date_to:
        filters.append("pl.log_date <= %s::date"); params.append(date_to)
    if month and year:
        filters.append("EXTRACT(MONTH FROM pl.log_date) = %s")
        filters.append("EXTRACT(YEAR  FROM pl.log_date) = %s")
        params.extend([month, year])
    elif year:
        filters.append("EXTRACT(YEAR FROM pl.log_date) = %s"); params.append(year)

    where = " AND ".join(filters)

    logs = query(f"""
        SELECT pl.log_date, b.code AS branch_code, b.name AS branch_name,
               p.printer_code, p.model AS printer_model,
               pl.print_count,
               pl.a4_single, pl.a4_double,
               pl.b4_single, pl.b4_double,
               pl.letter_single, pl.letter_double,
               u.full_name AS logged_by, pl.created_at
        FROM print_logs pl
        JOIN printers p ON p.id = pl.printer_id
        JOIN branches b ON b.id = p.branch_id
        JOIN users    u ON u.id = pl.logged_by
        WHERE {where}
        ORDER BY pl.log_date DESC, b.code, p.printer_code
        LIMIT 5000
    """, tuple(params)) or []

    branch_totals = query(f"""
        SELECT b.code AS branch_code, b.name AS branch_name,
               COUNT(DISTINCT pl.log_date) AS days_logged,
               COALESCE(SUM(pl.print_count),0) AS total_prints,
               COALESCE(SUM(pl.a4_single)+SUM(pl.a4_double),0) AS a4_total,
               COALESCE(SUM(pl.b4_single)+SUM(pl.b4_double),0) AS b4_total,
               COALESCE(SUM(pl.letter_single)+SUM(pl.letter_double),0) AS legal_total
        FROM print_logs pl
        JOIN printers p ON p.id = pl.printer_id
        JOIN branches b ON b.id = p.branch_id
        WHERE {where}
        GROUP BY b.code, b.name ORDER BY total_prints DESC
    """, tuple(params)) or []

    # Build Excel
    wb  = Workbook()

    NAVY   = "1E3A5F"
    BLUE   = "0EA5E9"
    GREEN  = "10B981"
    WHITE  = "FFFFFF"
    ALTROW = "F8FAFC"
    BORDER = "D1D5DB"

    def hfont(sz=10, bold=True, col=WHITE):
        return Font(name="Arial", size=sz, bold=bold, color=col)
    def cfont(sz=9, bold=False, col="0F172A"):
        return Font(name="Arial", size=sz, bold=bold, color=col)
    def fill(c):
        return PatternFill("solid", start_color=c, fgColor=c)
    def thin():
        s = Side(style="thin", color=BORDER)
        return Border(left=s, right=s, top=s, bottom=s)
    def ctr():
        return Alignment(horizontal="center", vertical="center", wrap_text=True)
    def lft():
        return Alignment(horizontal="left", vertical="center")

    def fmt_date(v):
        if not v: return "—"
        try:
            if hasattr(v, 'strftime'): return v.strftime("%d/%m/%Y")
            return str(v)[:10]
        except: return str(v)

    def fmt_time(v):
        if not v: return "—"
        try:
            if hasattr(v, 'strftime'): return v.strftime("%d/%m/%Y %H:%M")
            from datetime import datetime
            return datetime.fromisoformat(str(v).replace("Z","")).strftime("%d/%m/%Y %H:%M")
        except: return str(v)

    # ── Sheet 1: Detailed Logs ────────────────────────────────
    ws1 = wb.active
    ws1.title = "Detailed Logs"

    ws1.merge_cells("A1:N1")
    ws1["A1"] = "SoftWave Print Management — Print Summary Report"
    ws1["A1"].font      = Font(name="Arial", size=14, bold=True, color=WHITE)
    ws1["A1"].fill      = fill(NAVY)
    ws1["A1"].alignment = ctr()
    ws1.row_dimensions[1].height = 28

    ws1.merge_cells("A2:N2")
    ws1["A2"] = f"Generated: {dt.now().strftime('%d %B %Y at %H:%M')}   |   Records: {len(logs)}"
    ws1["A2"].font      = Font(name="Arial", size=9, italic=True, color="64748B")
    ws1["A2"].fill      = fill("F1F5F9")
    ws1["A2"].alignment = ctr()
    ws1.row_dimensions[2].height = 16

    headers = [
        ("A3","Date"),("B3","Branch Code"),("C3","Branch Name"),
        ("D3","Printer Serial"),("E3","Model"),
        ("F3","Total Prints"),
        ("G3","A4 Single"),("H3","A4 Double"),
        ("I3","B4 Single"),("J3","B4 Double"),
        ("K3","Legal Single"),("L3","Legal Double"),
        ("M3","Logged By"),("N3","Logged At"),
    ]
    for addr, label in headers:
        c = ws1[addr]
        c.value     = label
        c.font      = Font(name="Arial", size=9, bold=True, color=WHITE)
        c.fill      = fill(BLUE)
        c.alignment = ctr()
        c.border    = thin()
    ws1.row_dimensions[3].height = 24

    for i, r in enumerate(logs):
        row = 4 + i
        bg  = WHITE if i % 2 == 0 else ALTROW
        vals = [
            fmt_date(r.get("log_date")),
            r.get("branch_code",""),
            r.get("branch_name",""),
            r.get("printer_code",""),
            r.get("printer_model",""),
            r.get("print_count",0),
            r.get("a4_single",0),  r.get("a4_double",0),
            r.get("b4_single",0),  r.get("b4_double",0),
            r.get("letter_single",0), r.get("letter_double",0),
            r.get("logged_by",""),
            fmt_time(r.get("created_at")),
        ]
        cols = "ABCDEFGHIJKLMN"
        for j, v in enumerate(vals):
            c = ws1[f"{cols[j]}{row}"]
            c.value     = v
            c.font      = cfont(bold=(j==5))
            c.fill      = fill(bg)
            c.alignment = lft() if j in [2,4,12] else ctr()
            c.border    = thin()
        ws1.row_dimensions[row].height = 16

    ws1.column_dimensions["A"].width = 12
    ws1.column_dimensions["B"].width = 10
    ws1.column_dimensions["C"].width = 18
    ws1.column_dimensions["D"].width = 13
    ws1.column_dimensions["E"].width = 16
    ws1.column_dimensions["F"].width = 12
    for col in "GHIJKL":
        ws1.column_dimensions[col].width = 10
    ws1.column_dimensions["M"].width = 16
    ws1.column_dimensions["N"].width = 16
    ws1.freeze_panes = "A4"

    # ── Sheet 2: Branch Summary ───────────────────────────────
    ws2 = wb.create_sheet("Branch Summary")

    ws2.merge_cells("A1:G1")
    ws2["A1"] = "Branch Print Summary"
    ws2["A1"].font      = Font(name="Arial", size=13, bold=True, color=WHITE)
    ws2["A1"].fill      = fill(NAVY)
    ws2["A1"].alignment = ctr()
    ws2.row_dimensions[1].height = 26

    h2 = [("A2","Branch Code"),("B2","Branch Name"),("C2","Days Logged"),
          ("D2","Total Prints"),("E2","A4 Total"),("F2","B4 Total"),("G2","Legal Total")]
    for addr, label in h2:
        c = ws2[addr]
        c.value     = label
        c.font      = Font(name="Arial", size=9, bold=True, color=WHITE)
        c.fill      = fill(GREEN)
        c.alignment = ctr()
        c.border    = thin()
    ws2.row_dimensions[2].height = 22

    for i, r in enumerate(branch_totals):
        row = 3 + i
        bg  = WHITE if i % 2 == 0 else ALTROW
        vals = [r.get("branch_code",""), r.get("branch_name",""),
                r.get("days_logged",0),  r.get("total_prints",0),
                r.get("a4_total",0),     r.get("b4_total",0), r.get("legal_total",0)]
        for j, v in enumerate(vals):
            c = ws2[f"{'ABCDEFG'[j]}{row}"]
            c.value = v; c.font = cfont(bold=(j==3))
            c.fill = fill(bg); c.alignment = ctr() if j != 1 else lft()
            c.border = thin()
        ws2.row_dimensions[row].height = 16

    # Grand total row
    gr = 3 + len(branch_totals)
    grand = query(f"""
        SELECT COALESCE(SUM(pl.print_count),0) AS total,
               COALESCE(SUM(pl.a4_single)+SUM(pl.a4_double),0) AS a4,
               COALESCE(SUM(pl.b4_single)+SUM(pl.b4_double),0) AS b4,
               COALESCE(SUM(pl.letter_single)+SUM(pl.letter_double),0) AS legal
        FROM print_logs pl JOIN printers p ON p.id=pl.printer_id
        JOIN branches b ON b.id=p.branch_id WHERE {where}
    """, tuple(params), fetch="one") or {}

    ws2.merge_cells(f"A{gr}:C{gr}")
    ws2[f"A{gr}"] = "GRAND TOTAL"
    ws2[f"A{gr}"].font = Font(name="Arial", size=10, bold=True, color=WHITE)
    ws2[f"A{gr}"].fill = fill(NAVY)
    ws2[f"A{gr}"].alignment = ctr()
    for col, val in [("D", grand.get("total",0)), ("E", grand.get("a4",0)),
                     ("F", grand.get("b4",0)),     ("G", grand.get("legal",0))]:
        c = ws2[f"{col}{gr}"]
        c.value = val; c.font = Font(name="Arial", size=10, bold=True, color=WHITE)
        c.fill = fill(NAVY); c.alignment = ctr(); c.border = thin()

    ws2.column_dimensions["A"].width = 12
    ws2.column_dimensions["B"].width = 22
    for col in "CDEFG": ws2.column_dimensions[col].width = 14

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)

    fname = f"SoftWave_PrintSummary_{dt.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )

# ── Monthly print totals ─────────────────────────────────────────────────────
@router.get("/prints/monthly")
def get_monthly_prints(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    current_user: dict = Depends(require_nuwan)
):
    today = date.today()
    y = year  or today.year
    m = month or today.month

    rows = query("""
        SELECT
            b.id            AS branch_id,
            b.code          AS branch_code,
            b.name          AS branch_name,
            pl.log_date,
            COALESCE(SUM(pl.print_count), 0) AS daily_total
        FROM branches b
        JOIN printers p  ON p.branch_id = b.id AND p.is_active = TRUE
        JOIN print_logs pl ON pl.printer_id = p.id
            AND EXTRACT(YEAR  FROM pl.log_date) = %s
            AND EXTRACT(MONTH FROM pl.log_date) = %s
        WHERE b.is_active = TRUE
        GROUP BY b.id, b.code, b.name, pl.log_date
        ORDER BY b.code, pl.log_date
    """, (y, m))

    # Aggregate per branch
    branch_map = {}
    for r in (rows or []):
        bid = r["branch_id"]
        if bid not in branch_map:
            branch_map[bid] = {
                "branch_id":   bid,
                "branch_code": r["branch_code"],
                "branch_name": r["branch_name"],
                "total":       0,
                "days":        {},
            }
        day_str = r["log_date"].isoformat() if hasattr(r["log_date"], "isoformat") else str(r["log_date"])
        branch_map[bid]["days"][day_str] = int(r["daily_total"])
        branch_map[bid]["total"] += int(r["daily_total"])

    return {
        "year":        y,
        "month":       m,
        "grand_total": sum(v["total"] for v in branch_map.values()),
        "branches":    list(branch_map.values()),
    }


# ── Monthly Excel export data ────────────────────────────────────────────────
@router.get("/prints/export")
def get_export_data(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    current_user: dict = Depends(require_nuwan)
):
    today = date.today()
    y = year  or today.year
    m = month or today.month

    rows = query("""
        SELECT
            b.code          AS branch_code,
            b.name          AS branch_name,
            p.printer_code,
            p.model,
            pl.log_date,
            pl.print_count,
            u.full_name     AS logged_by
        FROM branches b
        JOIN printers p  ON p.branch_id = b.id AND p.is_active = TRUE
        JOIN print_logs pl ON pl.printer_id = p.id
            AND EXTRACT(YEAR  FROM pl.log_date) = %s
            AND EXTRACT(MONTH FROM pl.log_date) = %s
        LEFT JOIN users u ON u.id = pl.logged_by
        WHERE b.is_active = TRUE
        ORDER BY b.code, p.printer_code, pl.log_date
    """, (y, m))

    return {
        "year":   y,
        "month":  m,
        "rows":   rows or [],
    }


# ── Toner models (for request modal) ────────────────────────────────────────
@router.get("/toner-models")
def get_toner_models_for_request(current_user: dict = Depends(require_nuwan)):
    return query("SELECT id, model_code, brand, yield_copies FROM toner_models ORDER BY model_code") or []


# ── Submit toner request from Nuwan dashboard ────────────────────────────────
class NuwanTonerRequestBody(BaseModel):
    printer_id:     int
    toner_model_id: int
    priority:       str = "urgent"
    notes:          str = ""


@router.post("/request-toner")
def nuwan_request_toner(body: NuwanTonerRequestBody, current_user: dict = Depends(require_nuwan)):
    if body.priority not in ("normal", "urgent", "critical"):
        raise HTTPException(status_code=400, detail="Invalid priority")
    req = query(
        "INSERT INTO replacement_requests "
        "(request_type, printer_id, toner_model_id, quantity, priority, notes, requested_by) "
        "VALUES ('toner', %s, %s, 1, %s, %s, %s) RETURNING id",
        (body.printer_id, body.toner_model_id, body.priority, body.notes, int(current_user["sub"])),
        fetch="one"
    )
    return {"message": "Toner request submitted", "id": req["id"]}


# ── Nuwan's own requests ─────────────────────────────────────────────────────
@router.get("/my-requests")
def get_nuwan_requests(current_user: dict = Depends(require_nuwan)):
    return query(
        "SELECT rr.*, p.printer_code, b.code AS branch_code, b.name AS branch_name, "
        "tm.model_code AS toner_model_code, "
        "u.full_name AS requested_by_name, rv.full_name AS reviewed_by_name, "
        "ds.full_name AS dispatched_by_name "
        "FROM replacement_requests rr "
        "JOIN printers p  ON p.id  = rr.printer_id "
        "JOIN branches b  ON b.id  = p.branch_id "
        "LEFT JOIN toner_models tm ON tm.id  = rr.toner_model_id "
        "LEFT JOIN users u  ON u.id  = rr.requested_by "
        "LEFT JOIN users rv ON rv.id = rr.reviewed_by "
        "LEFT JOIN users ds ON ds.id = rr.dispatched_by "
        "WHERE rr.requested_by = %s AND rr.request_type = 'toner' "
        "ORDER BY rr.requested_at DESC LIMIT 50",
        (int(current_user["sub"]),)
    ) or []