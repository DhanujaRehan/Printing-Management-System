from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/paper", tags=["Paper"])


class PaperTypeBody(BaseModel):
    name: str
    size: str = "A4"
    gsm: int = 80
    min_stock: int = 10


class ReceivePaperBody(BaseModel):
    paper_type_id: int
    quantity: int
    notes: Optional[str] = None


class DispatchPaperBody(BaseModel):
    paper_type_id: int
    branch_id: int
    printer_id: Optional[int] = None
    quantity: int
    notes: Optional[str] = None


class LoadPrinterPaperBody(BaseModel):
    paper_type_id: int
    printer_id: int
    quantity: int
    capacity: int = 5
    notes: Optional[str] = None


@router.get("/types")
def get_paper_types(current_user: dict = Depends(get_current_user)):
    return query("SELECT * FROM paper_types ORDER BY name")


@router.post("/types")
def create_paper_type(body: PaperTypeBody, current_user: dict = Depends(require_role("manager", "dba"))):
    existing = query("SELECT id FROM paper_types WHERE name=%s", (body.name,), fetch="one")
    if existing:
        raise HTTPException(status_code=400, detail="Paper type name already exists")
    pt = query(
        "INSERT INTO paper_types (name, size, gsm, min_stock) VALUES (%s, %s, %s, %s) RETURNING *",
        (body.name, body.size, body.gsm, body.min_stock),
        fetch="one"
    )
    query(
        "INSERT INTO paper_stock (paper_type_id, quantity) VALUES (%s, 0) ON CONFLICT (paper_type_id) DO NOTHING",
        (pt["id"],),
        fetch="none"
    )
    return pt


@router.get("/stock")
def get_paper_stock(current_user: dict = Depends(get_current_user)):
    return query(
        "SELECT pt.id, pt.name, pt.size, pt.gsm, pt.min_stock, COALESCE(ps.quantity, 0) AS quantity "
        "FROM paper_types pt LEFT JOIN paper_stock ps ON ps.paper_type_id = pt.id ORDER BY pt.name"
    )


@router.post("/stock/receive")
def receive_paper(body: ReceivePaperBody, current_user: dict = Depends(require_role("manager", "dba"))):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    stock = query(
        "INSERT INTO paper_stock (paper_type_id, quantity, updated_at) VALUES (%s, %s, NOW()) "
        "ON CONFLICT (paper_type_id) DO UPDATE SET quantity = paper_stock.quantity + EXCLUDED.quantity, updated_at = NOW() "
        "RETURNING quantity",
        (body.paper_type_id, body.quantity),
        fetch="one"
    )
    query(
        "INSERT INTO paper_movements (paper_type_id, movement_type, quantity, performed_by, notes) VALUES (%s, 'IN', %s, %s, %s)",
        (body.paper_type_id, body.quantity, int(current_user["sub"]), body.notes),
        fetch="none"
    )
    return {"message": "Paper stock received", "new_balance": stock["quantity"]}


@router.post("/dispatch")
def dispatch_paper(body: DispatchPaperBody, current_user: dict = Depends(require_role("manager", "dba", "service"))):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    stock = query("SELECT quantity FROM paper_stock WHERE paper_type_id=%s", (body.paper_type_id,), fetch="one")
    if not stock or stock["quantity"] < body.quantity:
        raise HTTPException(status_code=400, detail="Insufficient paper stock in warehouse")
    new_stock = query(
        "UPDATE paper_stock SET quantity = quantity - %s, updated_at = NOW() WHERE paper_type_id = %s RETURNING quantity",
        (body.quantity, body.paper_type_id),
        fetch="one"
    )
    query(
        "INSERT INTO paper_branch_stock (paper_type_id, branch_id, quantity, updated_at) VALUES (%s, %s, %s, NOW()) "
        "ON CONFLICT (paper_type_id, branch_id) DO UPDATE SET quantity = paper_branch_stock.quantity + EXCLUDED.quantity, updated_at = NOW()",
        (body.paper_type_id, body.branch_id, body.quantity),
        fetch="none"
    )
    query(
        "INSERT INTO paper_movements (paper_type_id, movement_type, quantity, branch_id, printer_id, performed_by, notes) "
        "VALUES (%s, 'OUT', %s, %s, %s, %s, %s)",
        (body.paper_type_id, body.quantity, body.branch_id, body.printer_id, int(current_user["sub"]), body.notes),
        fetch="none"
    )
    return {"message": "Paper dispatched", "warehouse_balance": new_stock["quantity"]}


@router.get("/branch-stock")
def get_branch_stock(current_user: dict = Depends(get_current_user)):
    return query(
        "SELECT pbs.id, pbs.paper_type_id, b.id AS branch_id, b.code AS branch_code, b.name AS branch_name, "
        "pt.name AS paper_name, pt.size, pt.gsm, pbs.quantity, pbs.updated_at "
        "FROM paper_branch_stock pbs "
        "JOIN branches b ON b.id = pbs.branch_id "
        "JOIN paper_types pt ON pt.id = pbs.paper_type_id "
        "ORDER BY b.code, pt.name"
    )


@router.get("/movements")
def get_paper_movements(limit: int = 50, current_user: dict = Depends(get_current_user)):
    return query(
        "SELECT pm.*, pt.name AS paper_name, pt.size, pt.gsm, "
        "b.code AS branch_code, b.name AS branch_name, p.printer_code, u.full_name AS performed_by_name "
        "FROM paper_movements pm "
        "LEFT JOIN paper_types pt ON pt.id = pm.paper_type_id "
        "LEFT JOIN branches b ON b.id = pm.branch_id "
        "LEFT JOIN printers p ON p.id = pm.printer_id "
        "LEFT JOIN users u ON u.id = pm.performed_by "
        "ORDER BY pm.created_at DESC LIMIT %s",
        (limit,)
    )


@router.get("/printer-levels")
def get_printer_paper_levels(current_user: dict = Depends(get_current_user)):
    return query(
        "SELECT p.id AS printer_id, p.printer_code, p.model AS printer_model, p.location_note, "
        "b.id AS branch_id, b.code AS branch_code, b.name AS branch_name, "
        "pt.id AS paper_type_id, pt.name AS paper_name, pt.size, pt.gsm, "
        "COALESCE(pps.quantity, 0) AS quantity, COALESCE(pps.capacity, 5) AS capacity, pps.updated_at "
        "FROM printers p "
        "JOIN branches b ON b.id = p.branch_id "
        "LEFT JOIN paper_printer_stock pps ON pps.printer_id = p.id "
        "LEFT JOIN paper_types pt ON pt.id = pps.paper_type_id "
        "WHERE p.is_active = TRUE AND b.is_active = TRUE "
        "ORDER BY b.code, p.printer_code"
    )


@router.post("/printer-levels/load")
def load_printer_paper(body: LoadPrinterPaperBody, current_user: dict = Depends(require_role("manager", "dba", "service"))):
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    printer = query("SELECT branch_id FROM printers WHERE id=%s AND is_active=TRUE", (body.printer_id,), fetch="one")
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    branch_stock = query(
        "SELECT quantity FROM paper_branch_stock WHERE paper_type_id=%s AND branch_id=%s",
        (body.paper_type_id, printer["branch_id"]),
        fetch="one"
    )
    available = branch_stock["quantity"] if branch_stock else 0
    if available < body.quantity:
        raise HTTPException(status_code=400, detail="Only " + str(available) + " reams available at this branch")
    query(
        "UPDATE paper_branch_stock SET quantity = quantity - %s, updated_at = NOW() WHERE paper_type_id=%s AND branch_id=%s",
        (body.quantity, body.paper_type_id, printer["branch_id"]),
        fetch="none"
    )
    new_stock = query(
        "INSERT INTO paper_printer_stock (paper_type_id, printer_id, quantity, capacity, updated_at) VALUES (%s, %s, %s, %s, NOW()) "
        "ON CONFLICT (paper_type_id, printer_id) DO UPDATE SET "
        "quantity = paper_printer_stock.quantity + EXCLUDED.quantity, capacity = EXCLUDED.capacity, updated_at = NOW() "
        "RETURNING quantity",
        (body.paper_type_id, body.printer_id, body.quantity, body.capacity),
        fetch="one"
    )
    query(
        "INSERT INTO paper_movements (paper_type_id, movement_type, quantity, branch_id, printer_id, performed_by, notes) "
        "VALUES (%s, 'OUT', %s, %s, %s, %s, %s)",
        (body.paper_type_id, body.quantity, printer["branch_id"], body.printer_id, int(current_user["sub"]), body.notes),
        fetch="none"
    )
    return {"message": "Paper loaded into printer", "printer_quantity": new_stock["quantity"]}