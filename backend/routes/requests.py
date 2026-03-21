from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/requests", tags=["Requests"])


class CreateRequestBody(BaseModel):
    request_type: str
    printer_id: int
    toner_model_id: Optional[int] = None
    paper_type_id: Optional[int] = None
    quantity: int = 1
    priority: str = "normal"
    notes: Optional[str] = None


class ReviewRequestBody(BaseModel):
    status: str
    review_note: Optional[str] = None


class PrintLogBody(BaseModel):
    printer_id:     int
    print_count:    int
    log_date:       Optional[str] = None
    notes:          Optional[str] = None
    a4_single:      Optional[int] = 0
    a4_double:      Optional[int] = 0
    b4_single:      Optional[int] = 0
    b4_double:      Optional[int] = 0
    letter_single:  Optional[int] = 0
    letter_double:  Optional[int] = 0


@router.get("/pending-count")
def get_pending_count(current_user: dict = Depends(get_current_user)):
    try:
        result = query(
            "SELECT COUNT(*) AS cnt FROM replacement_requests WHERE status='pending'",
            fetch="one"
        )
        return {"count": result["cnt"] if result else 0}
    except Exception:
        return {"count": 0}


@router.get("/my")
def get_my_requests(current_user: dict = Depends(get_current_user)):
    try:
        return query(
            "SELECT rr.*, p.printer_code, b.code AS branch_code, b.name AS branch_name, "
            "tm.model_code AS toner_model_code, pt.name AS paper_name, pt.size, pt.gsm, "
            "u.full_name AS requested_by_name, rv.full_name AS reviewed_by_name "
            "FROM replacement_requests rr "
            "JOIN printers p ON p.id = rr.printer_id "
            "JOIN branches b ON b.id = p.branch_id "
            "LEFT JOIN toner_models tm ON tm.id = rr.toner_model_id "
            "LEFT JOIN paper_types pt ON pt.id = rr.paper_type_id "
            "LEFT JOIN users u ON u.id = rr.requested_by "
            "LEFT JOIN users rv ON rv.id = rr.reviewed_by "
            "WHERE rr.requested_by = %s "
            "ORDER BY rr.requested_at DESC LIMIT 50",
            (int(current_user["sub"]),)
        )
    except Exception:
        return []


@router.get("/all")
def get_all_requests(current_user: dict = Depends(require_role("manager", "dba"))):
    try:
        return query(
            "SELECT rr.*, p.printer_code, b.code AS branch_code, b.name AS branch_name, "
            "tm.model_code AS toner_model_code, pt.name AS paper_name, pt.size, pt.gsm, "
            "u.full_name AS requested_by_name, rv.full_name AS reviewed_by_name "
            "FROM replacement_requests rr "
            "JOIN printers p ON p.id = rr.printer_id "
            "JOIN branches b ON b.id = p.branch_id "
            "LEFT JOIN toner_models tm ON tm.id = rr.toner_model_id "
            "LEFT JOIN paper_types pt ON pt.id = rr.paper_type_id "
            "LEFT JOIN users u ON u.id = rr.requested_by "
            "LEFT JOIN users rv ON rv.id = rr.reviewed_by "
            "ORDER BY CASE rr.status WHEN 'pending' THEN 0 ELSE 1 END, rr.requested_at DESC "
            "LIMIT 100"
        )
    except Exception:
        return []


@router.post("/submit")
def create_request(body: CreateRequestBody, current_user: dict = Depends(get_current_user)):
    if body.request_type not in ("toner", "paper"):
        raise HTTPException(status_code=400, detail="request_type must be toner or paper")
    if body.priority not in ("normal", "urgent", "critical"):
        raise HTTPException(status_code=400, detail="Invalid priority")
    if body.request_type == "toner" and not body.toner_model_id:
        raise HTTPException(status_code=400, detail="toner_model_id required for toner requests")
    if body.request_type == "paper" and not body.paper_type_id:
        raise HTTPException(status_code=400, detail="paper_type_id required for paper requests")
    req = query(
        "INSERT INTO replacement_requests "
        "(request_type, printer_id, toner_model_id, paper_type_id, quantity, priority, notes, requested_by) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (body.request_type, body.printer_id, body.toner_model_id, body.paper_type_id,
         body.quantity, body.priority, body.notes, int(current_user["sub"])),
        fetch="one"
    )
    return {"message": "Request submitted", "id": req["id"]}


@router.patch("/{request_id}/review")
def review_request(
    request_id: int,
    body: ReviewRequestBody,
    current_user: dict = Depends(require_role("manager", "dba"))
):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")

    req = query(
        "SELECT rr.*, p.printer_code, p.branch_id, tm.model_code, tm.id AS tm_id, "
        "pt.id AS pt_id, pt.name AS paper_name "
        "FROM replacement_requests rr "
        "JOIN printers p ON p.id = rr.printer_id "
        "LEFT JOIN toner_models tm ON tm.id = rr.toner_model_id "
        "LEFT JOIN paper_types pt ON pt.id = rr.paper_type_id "
        "WHERE rr.id = %s",
        (request_id,), fetch="one"
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    query(
        "UPDATE replacement_requests SET status=%s, reviewed_by=%s, review_note=%s, reviewed_at=NOW() "
        "WHERE id=%s",
        (body.status, int(current_user["sub"]), body.review_note, request_id),
        fetch="none"
    )

    if body.status == "approved":
        # NOTE: Toner stock deduction happens at DISPATCH time (store keeper),
        # not at approval time. Approval just signals the store to prepare.
        if req["request_type"] == "paper" and req["pt_id"]:
            try:
                branch_stock = query(
                    "SELECT quantity FROM paper_branch_stock WHERE paper_type_id=%s AND branch_id=%s",
                    (req["pt_id"], req["branch_id"]), fetch="one"
                )
                available = branch_stock["quantity"] if branch_stock else 0
                load_qty = min(req["quantity"], available)
                if load_qty > 0:
                    query(
                        "UPDATE paper_branch_stock SET quantity = quantity - %s, updated_at=NOW() "
                        "WHERE paper_type_id=%s AND branch_id=%s",
                        (load_qty, req["pt_id"], req["branch_id"]), fetch="none"
                    )
                    query(
                        "INSERT INTO paper_printer_stock (paper_type_id, printer_id, quantity, capacity, updated_at) "
                        "VALUES (%s,%s,%s,5,NOW()) "
                        "ON CONFLICT (paper_type_id, printer_id) DO UPDATE SET "
                        "quantity = paper_printer_stock.quantity + EXCLUDED.quantity, updated_at=NOW()",
                        (req["pt_id"], req["printer_id"], load_qty), fetch="none"
                    )
                    query(
                        "INSERT INTO paper_movements "
                        "(paper_type_id, movement_type, quantity, branch_id, printer_id, performed_by, notes) "
                        "VALUES (%s,'OUT',%s,%s,%s,%s,%s)",
                        (req["pt_id"], load_qty, req["branch_id"], req["printer_id"],
                         int(current_user["sub"]), "Auto: approved request #" + str(request_id)),
                        fetch="none"
                    )
            except Exception:
                pass

    return {"message": "Request " + body.status}


@router.get("/print-logs")
def get_print_logs(current_user: dict = Depends(get_current_user)):
    try:
        return query(
            "SELECT pl.*, p.printer_code, b.code AS branch_code, b.name AS branch_name, "
            "u.full_name AS logged_by_name "
            "FROM print_logs pl "
            "JOIN printers p ON p.id = pl.printer_id "
            "JOIN branches b ON b.id = p.branch_id "
            "JOIN users u ON u.id = pl.logged_by "
            "ORDER BY pl.log_date DESC, b.code, p.printer_code "
            "LIMIT 100"
        )
    except Exception:
        return []


@router.get("/my-print-logs")
def get_my_print_logs(current_user: dict = Depends(get_current_user)):
    try:
        return query(
            "SELECT pl.*, p.printer_code, b.code AS branch_code, b.name AS branch_name "
            "FROM print_logs pl "
            "JOIN printers p ON p.id = pl.printer_id "
            "JOIN branches b ON b.id = p.branch_id "
            "WHERE pl.logged_by = %s "
            "ORDER BY pl.log_date DESC LIMIT 30",
            (int(current_user["sub"]),)
        )
    except Exception:
        return []


@router.post("/print-logs")
def log_print_count(body: PrintLogBody, current_user: dict = Depends(get_current_user)):
    if body.print_count < 0:
        raise HTTPException(status_code=400, detail="Print count must be 0 or more")

    if body.log_date:
        result = query(
            "INSERT INTO print_logs (printer_id, logged_by, print_count, log_date, notes, "
            "a4_single, a4_double, b4_single, b4_double, letter_single, letter_double) "
            "VALUES (%s, %s, %s, %s::date, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (printer_id, log_date) DO UPDATE SET "
            "print_count = EXCLUDED.print_count, logged_by = EXCLUDED.logged_by, "
            "notes = EXCLUDED.notes, a4_single = EXCLUDED.a4_single, a4_double = EXCLUDED.a4_double, "
            "b4_single = EXCLUDED.b4_single, b4_double = EXCLUDED.b4_double, "
            "letter_single = EXCLUDED.letter_single, letter_double = EXCLUDED.letter_double, "
            "created_at = NOW() RETURNING id",
            (body.printer_id, int(current_user['sub']), body.print_count, body.log_date, body.notes,
             body.a4_single or 0, body.a4_double or 0, body.b4_single or 0,
             body.b4_double or 0, body.letter_single or 0, body.letter_double or 0),
            fetch="one"
        )
    else:
        result = query(
            "INSERT INTO print_logs (printer_id, logged_by, print_count, notes, "
            "a4_single, a4_double, b4_single, b4_double, letter_single, letter_double) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (printer_id, log_date) DO UPDATE SET "
            "print_count = EXCLUDED.print_count, logged_by = EXCLUDED.logged_by, "
            "notes = EXCLUDED.notes, a4_single = EXCLUDED.a4_single, a4_double = EXCLUDED.a4_double, "
            "b4_single = EXCLUDED.b4_single, b4_double = EXCLUDED.b4_double, "
            "letter_single = EXCLUDED.letter_single, letter_double = EXCLUDED.letter_double, "
            "created_at = NOW() RETURNING id",
            (body.printer_id, int(current_user['sub']), body.print_count, body.notes,
             body.a4_single or 0, body.a4_double or 0, body.b4_single or 0,
             body.b4_double or 0, body.letter_single or 0, body.letter_double or 0),
            fetch="one"
        )

    query(
        "UPDATE toner_installations SET avg_daily_copies = %s "
        "WHERE printer_id = %s AND is_current = TRUE",
        (body.print_count, body.printer_id), fetch="none"
    )

    return {"message": "Print count logged", "id": result["id"]}


class DispatchBody(BaseModel):
    dispatch_note: Optional[str] = None


@router.patch("/{request_id}/dispatch")
def dispatch_request(
    request_id: int,
    body: DispatchBody,
    current_user: dict = Depends(require_role("store", "manager", "dba"))
):
    """Store keeper dispatches toner — deducts stock and updates printer installation."""
    req = query(
        "SELECT rr.*, p.branch_id "
        "FROM replacement_requests rr "
        "JOIN printers p ON p.id = rr.printer_id "
        "WHERE rr.id = %s",
        (request_id,), fetch="one"
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved requests can be dispatched")

    # ── Deduct toner stock ────────────────────────────────────
    if req["toner_model_id"]:
        stock = query(
            "SELECT quantity FROM toner_stock WHERE toner_model_id=%s",
            (req["toner_model_id"],), fetch="one"
        )
        if not stock or stock["quantity"] < req["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {stock['quantity'] if stock else 0}"
            )

        # Deduct from warehouse
        query(
            "UPDATE toner_stock SET quantity = quantity - %s, updated_at=NOW() "
            "WHERE toner_model_id=%s",
            (req["quantity"], req["toner_model_id"]), fetch="none"
        )

        # Update printer toner installation — mark old as not current
        query(
            "UPDATE toner_installations SET is_current=FALSE "
            "WHERE printer_id=%s AND is_current=TRUE",
            (req["printer_id"],), fetch="none"
        )

        # Create new installation record (full toner = 100%)
        install = query(
            "INSERT INTO toner_installations "
            "(printer_id, toner_model_id, installed_by, yield_copies, avg_daily_copies, current_pct, current_copies, is_current) "
            "VALUES (%s,%s,%s,3000,150,100,3000,TRUE) RETURNING id",
            (req["printer_id"], req["toner_model_id"], int(current_user["sub"])),
            fetch="one"
        )

        # Log stock movement
        query(
            "INSERT INTO stock_movements "
            "(toner_model_id, movement_type, quantity, branch_id, printer_id, installation_id, performed_by, notes) "
            "VALUES (%s,'OUT',-1,%s,%s,%s,%s,%s)",
            (req["toner_model_id"], req["branch_id"], req["printer_id"],
             install["id"], int(current_user["sub"]),
             f"Dispatched for request #{request_id}"),
            fetch="none"
        )

    # ── Mark as dispatched ────────────────────────────────────
    query(
        "UPDATE replacement_requests SET status='dispatched', dispatched_by=%s, "
        "dispatched_at=NOW(), dispatch_note=%s WHERE id=%s",
        (int(current_user["sub"]), body.dispatch_note, request_id),
        fetch="none"
    )
    return {"message": "Toner dispatched successfully — stock deducted and printer updated"}


@router.get("/approved-toner")
def get_approved_toner_requests(current_user: dict = Depends(require_role("store", "manager", "dba"))):
    """Returns approved toner requests awaiting dispatch — for store keeper."""
    return query(
        "SELECT rr.*, p.printer_code, b.code AS branch_code, b.name AS branch_name, "
        "tm.model_code AS toner_model_code, "
        "u.full_name AS requested_by_name, rv.full_name AS reviewed_by_name, "
        "ds.full_name AS dispatched_by_name "
        "FROM replacement_requests rr "
        "JOIN printers p ON p.id = rr.printer_id "
        "JOIN branches b ON b.id = p.branch_id "
        "LEFT JOIN toner_models tm ON tm.id = rr.toner_model_id "
        "LEFT JOIN users u  ON u.id  = rr.requested_by "
        "LEFT JOIN users rv ON rv.id = rr.reviewed_by "
        "LEFT JOIN users ds ON ds.id = rr.dispatched_by "
        "WHERE rr.request_type = 'toner' AND rr.status IN ('approved','dispatched') "
        "ORDER BY CASE rr.status WHEN 'approved' THEN 0 ELSE 1 END, rr.reviewed_at DESC "
        "LIMIT 100"
    ) or []