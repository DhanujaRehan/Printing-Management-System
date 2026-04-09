"""
Hardware Parts routes — request, approve, dispatch, install.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/hardware", tags=["Hardware"])

HARDWARE_PARTS = [
    "Drum Unit (OPC Drum)",
    "Developer Unit",
    "Cleaning Blade",
    "Charge Roller",
    "Fuser Unit",
    "Fuser Heat Roller",
    "Fuser Pressure Roller",
    "Thermistor",
    "Separation Claws",
    "Pickup Rollers",
    "Feed Rollers",
    "Separation Pads",
    "Registration Rollers",
]

class HardwareRequestBody(BaseModel):
    branch_id:  int
    printer_id: int
    part_name:  str
    priority:   str = "normal"
    notes:      Optional[str] = None

class ReviewBody(BaseModel):
    status:      str
    review_note: Optional[str] = None

class DispatchBody(BaseModel):
    dispatch_note: Optional[str] = None


@router.get("/parts")
def get_parts():
    return {"parts": HARDWARE_PARTS}


@router.get("/requests")
def get_all_requests(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    if role not in ("nuwan", "manager", "dba", "store", "service"):
        raise HTTPException(status_code=403, detail="Access denied")
    return query("""
        SELECT
            hr.*,
            b.code  AS branch_code,  b.name AS branch_name,
            p.printer_code,
            u_req.full_name AS requested_by_name,
            u_rev.full_name AS reviewed_by_name,
            u_dis.full_name AS dispatched_by_name,
            u_ins.full_name AS installed_by_name
        FROM hardware_requests hr
        JOIN branches b ON b.id = hr.branch_id
        JOIN printers p ON p.id = hr.printer_id
        LEFT JOIN users u_req ON u_req.id = hr.requested_by
        LEFT JOIN users u_rev ON u_rev.id = hr.reviewed_by
        LEFT JOIN users u_dis ON u_dis.id = hr.dispatched_by
        LEFT JOIN users u_ins ON u_ins.id = hr.installed_by
        ORDER BY
            CASE hr.status
                WHEN 'pending'    THEN 0
                WHEN 'approved'   THEN 1
                WHEN 'dispatched' THEN 2
                ELSE 3
            END,
            hr.requested_at DESC
        LIMIT 200
    """) or []


@router.post("/requests")
def create_request(body: HardwareRequestBody, current_user: dict = Depends(get_current_user)):
    if body.part_name not in HARDWARE_PARTS:
        raise HTTPException(status_code=400, detail="Invalid part name")
    if body.priority not in ("normal", "low", "critical"):
        raise HTTPException(status_code=400, detail="Invalid priority")
    result = query("""
        INSERT INTO hardware_requests
        (branch_id, printer_id, part_name, priority, notes, requested_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (body.branch_id, body.printer_id, body.part_name,
          body.priority, body.notes, int(current_user["sub"])),
        fetch="one")
    return {"message": "Hardware request submitted", "id": result["id"]}


@router.patch("/{request_id}/review")
def review_request(
    request_id: int,
    body: ReviewBody,
    current_user: dict = Depends(require_role("manager", "dba"))
):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")
    req = query("SELECT * FROM hardware_requests WHERE id=%s", (request_id,), fetch="one")
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Already reviewed")
    query("""
        UPDATE hardware_requests
        SET status=%s, reviewed_by=%s, review_note=%s, reviewed_at=NOW()
        WHERE id=%s
    """, (body.status, int(current_user["sub"]), body.review_note, request_id), fetch="none")
    return {"message": "Request " + body.status}


@router.patch("/{request_id}/dispatch")
def dispatch_request(
    request_id: int,
    body: DispatchBody,
    current_user: dict = Depends(require_role("store", "manager", "dba"))
):
    req = query("SELECT * FROM hardware_requests WHERE id=%s", (request_id,), fetch="one")
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved requests can be dispatched")
    query("""
        UPDATE hardware_requests
        SET status='dispatched', dispatched_by=%s, dispatched_at=NOW()
        WHERE id=%s
    """, (int(current_user["sub"]), request_id), fetch="none")
    return {"message": "Hardware part dispatched"}


@router.patch("/{request_id}/install")
def install_part(request_id: int, current_user: dict = Depends(get_current_user)):
    req = query("SELECT * FROM hardware_requests WHERE id=%s", (request_id,), fetch="one")
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "dispatched":
        raise HTTPException(status_code=400, detail="Part must be dispatched first")
    query("""
        UPDATE hardware_requests
        SET status='installed', installed_by=%s, installed_at=NOW()
        WHERE id=%s
    """, (int(current_user["sub"]), request_id), fetch="none")
    return {"message": "Hardware part installed"}


# ── Branch permissions (service users only) ──────────────────────────────────

@router.get("/service-users")
def get_service_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("nuwan", "manager", "dba"):
        raise HTTPException(status_code=403, detail="Access denied")
    users = query("""
        SELECT u.id, u.full_name, u.username, u.branch_access,
               u.last_login, u.is_active,
               b.name AS branch_name, b.code AS branch_code
        FROM users u
        LEFT JOIN branches b ON b.code = u.branch_access AND b.is_active = TRUE
        WHERE u.role = 'service' AND u.is_active = TRUE
        ORDER BY u.full_name
    """) or []
    return users


class BranchAssignBody(BaseModel):
    branch_access: str   # branch code e.g. "GAM" or "ALL"

@router.patch("/service-users/{user_id}/branch")
def assign_branch(
    user_id: int,
    body: BranchAssignBody,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") not in ("nuwan", "manager", "dba"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate branch exists if not ALL
    if body.branch_access != "ALL":
        branch = query(
            "SELECT id FROM branches WHERE code = %s AND is_active = TRUE",
            (body.branch_access,), fetch="one"
        )
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")

    user = query("SELECT id, full_name FROM users WHERE id=%s AND role='service'",
                 (user_id,), fetch="one")
    if not user:
        raise HTTPException(status_code=404, detail="Service user not found")

    query(
        "UPDATE users SET branch_access = %s WHERE id = %s",
        (body.branch_access, user_id), fetch="none"
    )

    # Audit log
    query("""
        INSERT INTO audit_log (user_id, action, detail, ip_address)
        VALUES (%s, %s, %s, %s)
    """, (int(current_user["sub"]),
          "BRANCH_ASSIGN",
          f"{user['full_name']} assigned to branch {body.branch_access}",
          "system"), fetch="none")

    return {"message": f"Branch access updated to {body.branch_access}"}