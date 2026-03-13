"""
Toner routes — models, stock, installations, alerts, movements.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/toner", tags=["Toner"])


# ── Request models ────────────────────────────────────────────────────────────

class TonerModelBody(BaseModel):
    model_code:   str
    brand:        Optional[str] = "HP"
    yield_copies: int = 3000
    min_stock:    int = 5
    color:        Optional[str] = "Black"


class StockReceiveBody(BaseModel):
    toner_model_id: int
    quantity:       int
    notes:          Optional[str] = None


class InstallBody(BaseModel):
    printer_id:      int
    toner_model_id:  int
    yield_copies:    int = 3000
    avg_daily_copies: int = 150
    notes:           Optional[str] = None


class UpdateLevelBody(BaseModel):
    printer_id:  int
    current_pct: float


# ── Toner Models ──────────────────────────────────────────────────────────────

@router.get("/models")
def get_models(current_user: dict = Depends(get_current_user)):
    return query("SELECT * FROM toner_models ORDER BY model_code")


@router.post("/models")
def create_model(body: TonerModelBody, current_user: dict = Depends(require_role("manager", "dba"))):
    existing = query("SELECT id FROM toner_models WHERE model_code=%s", (body.model_code,), fetch="one")
    if existing:
        raise HTTPException(status_code=400, detail="Toner model code already exists")
    model = query("""
        INSERT INTO toner_models (model_code, brand, yield_copies, min_stock, color)
        VALUES (%s,%s,%s,%s,%s) RETURNING *
    """, (body.model_code, body.brand, body.yield_copies, body.min_stock, body.color), fetch="one")
    # Create stock entry
    query("""
        INSERT INTO toner_stock (toner_model_id, quantity)
        VALUES (%s, 0) ON CONFLICT (toner_model_id) DO NOTHING
    """, (model["id"],), fetch="none")
    return model


@router.put("/models/{model_id}")
def update_model(model_id: int, body: TonerModelBody, current_user: dict = Depends(require_role("manager", "dba"))):
    model = query("""
        UPDATE toner_models SET model_code=%s, brand=%s, yield_copies=%s, min_stock=%s, color=%s
        WHERE id=%s RETURNING *
    """, (body.model_code, body.brand, body.yield_copies, body.min_stock, body.color, model_id), fetch="one")
    if not model:
        raise HTTPException(status_code=404, detail="Toner model not found")
    return model


# ── Stock ─────────────────────────────────────────────────────────────────────

@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    return query("SELECT * FROM v_stock_summary ORDER BY model_code")


@router.post("/stock/receive")
def receive_stock(body: StockReceiveBody, current_user: dict = Depends(require_role("manager", "dba"))):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    # Update or create stock
    stock = query("""
        INSERT INTO toner_stock (toner_model_id, quantity, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (toner_model_id)
        DO UPDATE SET quantity = toner_stock.quantity + EXCLUDED.quantity, updated_at = NOW()
        RETURNING quantity
    """, (body.toner_model_id, body.quantity), fetch="one")

    # Log movement
    query("""
        INSERT INTO stock_movements (toner_model_id, movement_type, quantity, performed_by, notes)
        VALUES (%s, 'IN', %s, %s, %s)
    """, (body.toner_model_id, body.quantity, int(current_user["sub"]), body.notes), fetch="none")

    return {"message": "Stock received", "new_balance": stock["quantity"]}


# ── Installations ─────────────────────────────────────────────────────────────

@router.post("/install")
def install_toner(body: InstallBody, current_user: dict = Depends(get_current_user)):
    # Check stock
    stock = query(
        "SELECT * FROM toner_stock WHERE toner_model_id=%s",
        (body.toner_model_id,), fetch="one"
    )
    if not stock or stock["quantity"] < 1:
        raise HTTPException(status_code=400, detail="Insufficient stock for this toner model")

    # Get printer branch
    printer = query("SELECT * FROM printers WHERE id=%s AND is_active=TRUE", (body.printer_id,), fetch="one")
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")

    # Mark old installation inactive
    query(
        "UPDATE toner_installations SET is_current=FALSE WHERE printer_id=%s AND is_current=TRUE",
        (body.printer_id,), fetch="none"
    )

    copies_left = body.yield_copies  # starts at 100%
    # New installation
    install = query("""
        INSERT INTO toner_installations
            (printer_id, toner_model_id, installed_by, yield_copies, avg_daily_copies, current_pct, current_copies, is_current)
        VALUES (%s,%s,%s,%s,%s,100,%s,TRUE) RETURNING id
    """, (body.printer_id, body.toner_model_id, int(current_user["sub"]),
          body.yield_copies, body.avg_daily_copies, copies_left), fetch="one")

    # Deduct stock
    new_stock = query("""
        UPDATE toner_stock SET quantity = quantity - 1, updated_at=NOW()
        WHERE toner_model_id=%s RETURNING quantity
    """, (body.toner_model_id,), fetch="one")

    # Log movement
    query("""
        INSERT INTO stock_movements
            (toner_model_id, movement_type, quantity, branch_id, printer_id, installation_id, performed_by, notes)
        VALUES (%s,'OUT',-1,%s,%s,%s,%s,%s)
    """, (body.toner_model_id, printer["branch_id"], body.printer_id,
          install["id"], int(current_user["sub"]), body.notes), fetch="none")

    return {"message": "Toner installed successfully", "new_stock_balance": new_stock["quantity"]}


@router.patch("/update-level")
def update_level(body: UpdateLevelBody, current_user: dict = Depends(get_current_user)):
    if not (0 <= body.current_pct <= 100):
        raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")

    install = query("""
        SELECT ti.*, ti.yield_copies
        FROM toner_installations ti
        WHERE ti.printer_id=%s AND ti.is_current=TRUE
    """, (body.printer_id,), fetch="one")
    if not install:
        raise HTTPException(status_code=404, detail="No active toner installation found")

    copies_left = int(install["yield_copies"] * body.current_pct / 100)
    query("""
        UPDATE toner_installations
        SET current_pct=%s, current_copies=%s
        WHERE id=%s
    """, (body.current_pct, copies_left, install["id"]), fetch="none")

    return {"message": "Toner level updated"}


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts")
def get_alerts(current_user: dict = Depends(get_current_user)):
    return query("""
        SELECT * FROM v_printer_status
        WHERE current_pct <= 30 OR days_remaining <= 7
        ORDER BY current_pct ASC, days_remaining ASC
    """)


# ── Movements ─────────────────────────────────────────────────────────────────

@router.get("/movements")
def get_movements(limit: int = 50, current_user: dict = Depends(get_current_user)):
    return query("""
        SELECT
            sm.*,
            tm.model_code,
            b.code  AS branch_code,
            p.printer_code,
            u.full_name AS performed_by_name
        FROM stock_movements sm
        LEFT JOIN toner_models tm ON tm.id = sm.toner_model_id
        LEFT JOIN branches b      ON b.id  = sm.branch_id
        LEFT JOIN printers p      ON p.id  = sm.printer_id
        LEFT JOIN users u         ON u.id  = sm.performed_by
        ORDER BY sm.created_at DESC
        LIMIT %s
    """, (limit,))
