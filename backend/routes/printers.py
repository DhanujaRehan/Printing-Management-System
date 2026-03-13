"""
Printers routes — CRUD and per-branch lookup.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/printers", tags=["Printers"])


class PrinterBody(BaseModel):
    branch_id:     int
    printer_code:  str
    model:         Optional[str] = None
    location_note: Optional[str] = None


@router.get("")
def get_all_printers(current_user: dict = Depends(get_current_user)):
    return query("SELECT * FROM v_printer_status ORDER BY branch_code, printer_code")


@router.get("/branch/{branch_id}")
def get_printers_by_branch(branch_id: int, current_user: dict = Depends(get_current_user)):
    return query(
        "SELECT * FROM v_printer_status WHERE branch_id=%s ORDER BY printer_code",
        (branch_id,)
    )


@router.post("")
def create_printer(body: PrinterBody, current_user: dict = Depends(require_role("manager", "dba"))):
    existing = query("SELECT id FROM printers WHERE printer_code=%s", (body.printer_code.upper(),), fetch="one")
    if existing:
        raise HTTPException(status_code=400, detail=f"Printer code '{body.printer_code}' already exists")
    printer = query("""
        INSERT INTO printers (branch_id, printer_code, model, location_note)
        VALUES (%s, %s, %s, %s) RETURNING *
    """, (body.branch_id, body.printer_code.upper(), body.model, body.location_note), fetch="one")
    return printer


@router.put("/{printer_id}")
def update_printer(printer_id: int, body: PrinterBody, current_user: dict = Depends(require_role("manager", "dba"))):
    printer = query("""
        UPDATE printers SET branch_id=%s, printer_code=%s, model=%s, location_note=%s
        WHERE id=%s AND is_active=TRUE RETURNING *
    """, (body.branch_id, body.printer_code.upper(), body.model, body.location_note, printer_id), fetch="one")
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printer


@router.delete("/{printer_id}")
def delete_printer(printer_id: int, current_user: dict = Depends(require_role("manager", "dba"))):
    result = query(
        "UPDATE printers SET is_active=FALSE WHERE id=%s RETURNING id",
        (printer_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="Printer not found")
    return {"message": "Printer deactivated"}
