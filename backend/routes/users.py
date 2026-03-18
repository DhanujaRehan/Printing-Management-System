"""
Users routes — user management and audit log (DBA only).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from db.database import query
from middleware.auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserBody(BaseModel):
    full_name:     str
    username:      str
    password:      str
    role:          str
    branch_access: Optional[str] = "ALL"


class ResetPasswordBody(BaseModel):
    new_password: str


# ── IMPORTANT: static paths MUST come before /{user_id} dynamic routes ──────


@router.get("")
def get_users(
    search: Optional[str] = Query(None, description="Search by name or username"),
    current_user: dict = Depends(require_role("manager", "dba"))
):
    """List all users, with optional server-side search filter."""
    if search:
        pattern = f"%{search}%"
        return query("""
            SELECT id, full_name, username, role, branch_access, is_active, last_login, created_at
            FROM users
            WHERE full_name ILIKE %s OR username ILIKE %s
            ORDER BY created_at DESC
        """, (pattern, pattern))
    return query("""
        SELECT id, full_name, username, role, branch_access, is_active, last_login, created_at
        FROM users ORDER BY created_at DESC
    """)


@router.get("/audit-log")
def get_audit_log(limit: int = 50, current_user: dict = Depends(require_role("manager", "dba"))):
    """Return recent audit log entries. Must be registered before /{user_id}."""
    return query("""
        SELECT al.*, u.username, u.full_name
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT %s
    """, (limit,))


# ── Dynamic /{user_id} routes below ─────────────────────────────────────────


@router.post("")
def create_user(body: UserBody, current_user: dict = Depends(require_role("dba"))):
    if body.role not in ("manager", "service", "dba", "store"):
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = query("SELECT id FROM users WHERE username=%s", (body.username,), fetch="one")
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = hash_password(body.password)
    user = query("""
        INSERT INTO users (full_name, username, password, role, branch_access)
        VALUES (%s,%s,%s,%s,%s)
        RETURNING id, full_name, username, role, branch_access, is_active
    """, (body.full_name, body.username, hashed, body.role, body.branch_access), fetch="one")

    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'CREATE_USER',%s)
    """, (int(current_user["sub"]), f"Created user: {body.username}"), fetch="none")

    return user


@router.put("/{user_id}")
def update_user(user_id: int, body: UserBody, current_user: dict = Depends(require_role("dba"))):
    hashed = hash_password(body.password)
    user = query("""
        UPDATE users SET full_name=%s, username=%s, password=%s, role=%s, branch_access=%s
        WHERE id=%s RETURNING id, full_name, username, role
    """, (body.full_name, body.username, hashed, body.role, body.branch_access, user_id), fetch="one")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}")
def deactivate_user(user_id: int, current_user: dict = Depends(require_role("dba"))):
    if user_id == int(current_user["sub"]):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    result = query(
        "UPDATE users SET is_active=FALSE WHERE id=%s RETURNING id, username",
        (user_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'DEACTIVATE_USER',%s)
    """, (int(current_user["sub"]), f"Deactivated user: {result['username']}"), fetch="none")
    return {"message": "User deactivated"}


@router.patch("/{user_id}/activate")
def activate_user(user_id: int, current_user: dict = Depends(require_role("dba"))):
    """Re-activate a previously deactivated user account."""
    result = query(
        "UPDATE users SET is_active=TRUE WHERE id=%s RETURNING id, username",
        (user_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'ACTIVATE_USER',%s)
    """, (int(current_user["sub"]), f"Activated user: {result['username']}"), fetch="none")
    return {"message": "User activated", "username": result["username"]}


@router.patch("/{user_id}/reset-password")
def reset_password(user_id: int, body: ResetPasswordBody, current_user: dict = Depends(require_role("dba"))):
    """DBA resets the password for any user account."""
    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    hashed = hash_password(body.new_password)
    result = query(
        "UPDATE users SET password=%s WHERE id=%s RETURNING id, username",
        (hashed, user_id), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'RESET_PASSWORD',%s)
    """, (int(current_user["sub"]), f"Reset password for user: {result['username']}"), fetch="none")
    return {"message": "Password reset successfully", "username": result["username"]}