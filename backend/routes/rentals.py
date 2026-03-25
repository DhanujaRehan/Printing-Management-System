"""
Rental Printers — Gestetner rental agreements
Visible to manager and nuwan only.
Agreement ends 3 years from start date.
"""

from fastapi import APIRouter, Depends
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/rentals", tags=["Rentals"])

_allowed = require_role("manager", "dba", "nuwan")


@router.get("")
def get_rental_printers(current_user: dict = Depends(_allowed)):
    """All rental printers with days remaining on agreement."""
    return query("""
        SELECT
            id,
            serial_number,
            branch_name,
            agreement_date,
            end_date,
            notes,
            is_active,
            (end_date - CURRENT_DATE)          AS days_remaining,
            CASE
                WHEN end_date < CURRENT_DATE        THEN 'expired'
                WHEN end_date - CURRENT_DATE <= 90  THEN 'expiring_soon'
                WHEN end_date - CURRENT_DATE <= 180 THEN 'warning'
                ELSE 'ok'
            END                                AS status
        FROM rental_printers
        WHERE is_active = TRUE
        ORDER BY end_date ASC, branch_name, serial_number
    """) or []


@router.get("/summary")
def get_rental_summary(current_user: dict = Depends(_allowed)):
    """Summary stats for dashboard cards."""
    return query("""
        SELECT
            COUNT(*)                                               AS total,
            COUNT(*) FILTER (WHERE end_date < CURRENT_DATE)       AS expired,
            COUNT(*) FILTER (WHERE end_date - CURRENT_DATE <= 90
                               AND end_date >= CURRENT_DATE)      AS expiring_soon,
            COUNT(*) FILTER (WHERE end_date - CURRENT_DATE <= 180
                               AND end_date - CURRENT_DATE > 90)  AS warning,
            COUNT(*) FILTER (WHERE end_date - CURRENT_DATE > 180) AS ok
        FROM rental_printers
        WHERE is_active = TRUE
    """, fetch="one")


# ── Purchased Printers ────────────────────────────────────────────────────────

@router.get("/purchased")
def get_purchased_printers(current_user: dict = Depends(_allowed)):
    """All purchased printers — no expiry."""
    return query("""
        SELECT
            id,
            serial_number,
            branch_name,
            model,
            purchased_date,
            notes,
            is_active,
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, purchased_date))::int AS years_in_use
        FROM purchased_printers
        WHERE is_active = TRUE
        ORDER BY branch_name, serial_number
    """) or []


@router.get("/purchased/summary")
def get_purchased_summary(current_user: dict = Depends(_allowed)):
    """Summary stats for purchased printers."""
    return query("""
        SELECT
            COUNT(*)                                                AS total,
            COUNT(*) FILTER (WHERE purchased_date >= '2024-01-01') AS recent,
            COUNT(*) FILTER (WHERE purchased_date < '2020-01-01')  AS older,
            COUNT(DISTINCT branch_name)                             AS branches
        FROM purchased_printers
        WHERE is_active = TRUE
    """, fetch="one")