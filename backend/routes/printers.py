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


# ── Toner Replaced — Service Person marks physical replacement ───────────────
from pydantic import BaseModel as _BM
from typing import Optional as _Opt

class TonerReplacedBody(_BM):
    printer_id:     int
    toner_model_id: _Opt[int] = None   # optional — uses current model if omitted
    notes:          _Opt[str] = None

@router.post("/toner-replaced")
def mark_toner_replaced(body: TonerReplacedBody, current_user: dict = Depends(get_current_user)):
    """Service person physically replaced toner — log it with timestamp."""
    from db.database import query as _q

    # Get printer + current toner model
    pr = _q(
        "SELECT p.id, p.branch_id, p.printer_code, ti.toner_model_id "
        "FROM printers p "
        "LEFT JOIN toner_installations ti ON ti.printer_id=p.id AND ti.is_current=TRUE "
        "WHERE p.id=%s AND p.is_active=TRUE",
        (body.printer_id,), fetch="one"
    )
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")

    toner_model_id = body.toner_model_id or pr["toner_model_id"]
    if not toner_model_id:
        raise HTTPException(status_code=400, detail="No toner model assigned to this printer")

    # Get yield from model
    tm = _q("SELECT yield_copies FROM toner_models WHERE id=%s", (toner_model_id,), fetch="one")
    yield_copies = tm["yield_copies"] if tm else 3000

    # Mark old installation as not current
    _q("UPDATE toner_installations SET is_current=FALSE WHERE printer_id=%s AND is_current=TRUE",
       (body.printer_id,), fetch="none")

    # Create new installation — 100%
    inst = _q(
        "INSERT INTO toner_installations "
        "(printer_id, toner_model_id, installed_by, yield_copies, avg_daily_copies, current_pct, current_copies, is_current) "
        "VALUES (%s,%s,%s,%s,150,100,%s,TRUE) RETURNING id, installed_at",
        (body.printer_id, toner_model_id, int(current_user["sub"]), yield_copies, yield_copies),
        fetch="one"
    )

    # Log stock movement OUT
    _q(
        "INSERT INTO stock_movements "
        "(toner_model_id,movement_type,quantity,branch_id,printer_id,installation_id,performed_by,notes) "
        "VALUES (%s,'OUT',-1,%s,%s,%s,%s,%s)",
        (toner_model_id, pr["branch_id"], body.printer_id,
         inst["id"], int(current_user["sub"]),
         body.notes or "Physical toner replacement by service person"),
        fetch="none"
    )

    return {
        "message": "Toner replacement logged",
        "installation_id": inst["id"],
        "installed_at": str(inst["installed_at"])
    }


@router.get("/toner-replacements")
def get_toner_replacements(current_user: dict = Depends(get_current_user)):
    """Full workflow chain per toner replacement — for Nuwan's dashboard."""
    from db.database import query as _q
    return _q("""
        SELECT
            ti.id,
            ti.installed_at,
            ti.current_pct,
            p.printer_code,
            p.id        AS printer_id,
            b.code      AS branch_code,
            b.name      AS branch_name,
            tm.model_code AS toner_model,

            -- Who replaced (service person)
            u_inst.full_name AS installed_by_name,
            u_inst.username  AS installed_by_username,

            -- Linked request (manager approval + store dispatch)
            rr.id            AS request_id,
            rr.status        AS request_status,
            rr.requested_at,
            rr.reviewed_at,
            rr.dispatched_at,

            -- Who requested
            u_req.full_name  AS requested_by_name,

            -- Manager who approved
            u_mgr.full_name  AS approved_by_name,

            -- Store person who dispatched
            u_sto.full_name  AS dispatched_by_name

        FROM toner_installations ti
        JOIN printers p  ON p.id  = ti.printer_id
        JOIN branches b  ON b.id  = p.branch_id
        LEFT JOIN toner_models tm ON tm.id = ti.toner_model_id
        LEFT JOIN users u_inst    ON u_inst.id = ti.installed_by

        -- Link via stock_movements to find the originating request
        LEFT JOIN stock_movements sm
               ON sm.installation_id = ti.id AND sm.movement_type = 'OUT'
        LEFT JOIN replacement_requests rr
               ON rr.id = (
                   SELECT rr2.id FROM replacement_requests rr2
                   WHERE rr2.printer_id = ti.printer_id
                     AND rr2.toner_model_id = ti.toner_model_id
                     AND rr2.status IN ('approved','dispatched')
                     AND rr2.reviewed_at <= ti.installed_at + INTERVAL '1 day'
                     AND rr2.reviewed_at >= ti.installed_at - INTERVAL '7 days'
                   ORDER BY ABS(EXTRACT(EPOCH FROM (rr2.reviewed_at - ti.installed_at)))
                   LIMIT 1
               )
        LEFT JOIN users u_req ON u_req.id = rr.requested_by
        LEFT JOIN users u_mgr ON u_mgr.id = rr.reviewed_by
        LEFT JOIN users u_sto ON u_sto.id = rr.dispatched_by

        WHERE ti.installed_by IS NOT NULL
        ORDER BY ti.installed_at DESC
        LIMIT 200
    """) or []


@router.get("/branch-printers-with-toner")
def get_branch_printers_with_toner(branch_id: int, current_user: dict = Depends(get_current_user)):
    """Printers for a branch with current toner + last replacement info — for service dashboard."""
    from db.database import query as _q
    return _q("""
        SELECT
            vps.printer_id,
            vps.printer_code,
            vps.printer_model,
            vps.location_note,
            vps.branch_code,
            vps.branch_name,
            vps.toner_model_id,
            vps.toner_model,
            vps.pct_remaining   AS current_pct,
            vps.copies_remaining,
            vps.installed_at    AS last_replaced_at,
            u.full_name         AS last_replaced_by
        FROM v_printer_status vps
        LEFT JOIN toner_installations ti
               ON ti.printer_id = vps.printer_id AND ti.is_current = TRUE
        LEFT JOIN users u ON u.id = ti.installed_by
        WHERE vps.branch_id = %s
        ORDER BY vps.printer_code
    """, (branch_id,)) or []