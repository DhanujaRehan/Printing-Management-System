"""
Nuwan Dashboard routes — Branch overview for management monitoring.
Role: 'nuwan' — read-only executive dashboard for branch print monitoring.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from db.database import query
from middleware.auth import get_current_user, require_role
from datetime import date, timedelta

router = APIRouter(prefix="/api/nuwan", tags=["Nuwan Dashboard"])


def require_nuwan(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("nuwan", "manager", "dba"):
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user


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
            COALESCE(SUM(pl.print_count), 0) AS total_prints,
            COUNT(DISTINCT pl.printer_id)    AS printers_logged,
            TRUE                             AS has_submitted
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
                "has_submitted":   False,
            })

    return {
        "date":          yesterday,
        "grand_total":   sum(r["total_prints"] for r in result),
        "branches":      result,
        "missing_count": sum(1 for r in result if not r["has_submitted"]),
    }


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