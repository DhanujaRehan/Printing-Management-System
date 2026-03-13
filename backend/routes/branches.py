"""
Branches routes — CRUD for branch management.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/branches", tags=["Branches"])


class BranchBody(BaseModel):
    code:     str
    name:     str
    location: Optional[str] = None
    contact:  Optional[str] = None


@router.get("")
def get_branches(current_user: dict = Depends(get_current_user)):
    return query("""
        SELECT b.*, COUNT(p.id) AS printer_count
        FROM branches b
        LEFT JOIN printers p ON p.branch_id = b.id AND p.is_active = TRUE
        WHERE b.is_active = TRUE
        GROUP BY b.id
        ORDER BY b.code
    """)


@router.post("")
def create_branch(body: BranchBody, current_user: dict = Depends(require_role("manager", "dba"))):
    existing = query("SELECT id FROM branches WHERE code = %s", (body.code.upper(),), fetch="one")
    if existing:
        raise HTTPException(status_code=400, detail=f"Branch code '{body.code}' already exists")
    branch = query("""
        INSERT INTO branches (code, name, location, contact)
        VALUES (%s, %s, %s, %s)
        RETURNING *
    """, (body.code.upper(), body.name, body.location, body.contact), fetch="one")
    return branch


@router.put("/{branch_id}")
def update_branch(branch_id: int, body: BranchBody, current_user: dict = Depends(require_role("manager", "dba"))):
    branch = query("""
        UPDATE branches SET code=%s, name=%s, location=%s, contact=%s
        WHERE id=%s AND is_active=TRUE RETURNING *
    """, (body.code.upper(), body.name, body.location, body.contact, branch_id), fetch="one")
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.delete("/{branch_id}")
def delete_branch(branch_id: int, current_user: dict = Depends(require_role("manager", "dba"))):
    result = query(
        "UPDATE branches SET is_active=FALSE WHERE id=%s RETURNING id",
        (branch_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deactivated"}
