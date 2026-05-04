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


class CustomEmailBody(BaseModel):
    subject: str
    message: str


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


@router.get("/audit-log/full")
def get_full_audit_log(
    limit: int = 200,
    role: str = None,
    action: str = None,
    search: str = None,
    current_user: dict = Depends(require_role("dba"))
):
    """Extended audit log with filters — DBA only."""
    filters = ["1=1"]
    params  = []

    if role:
        filters.append("u.role = %s")
        params.append(role)
    if action:
        filters.append("al.action ILIKE %s")
        params.append(f"%{action}%")
    if search:
        filters.append("(u.username ILIKE %s OR u.full_name ILIKE %s OR al.detail ILIKE %s OR al.action ILIKE %s)")
        params.extend([f"%{search}%"] * 4)

    params.append(limit)
    return query(f"""
        SELECT
            al.id,
            al.action,
            al.detail,
            al.ip_address,
            al.created_at,
            u.username,
            u.full_name,
            u.role
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE {' AND '.join(filters)}
        ORDER BY al.created_at DESC
        LIMIT %s
    """, tuple(params)) or []


@router.get("/audit-log/stats")
def get_audit_stats(current_user: dict = Depends(require_role("dba"))):
    """Audit statistics for DBA health dashboard."""
    return query("""
        SELECT
            COUNT(*)                                                    AS total_actions,
            COUNT(*) FILTER (WHERE al.created_at >= NOW() - INTERVAL '24 hours') AS actions_24h,
            COUNT(*) FILTER (WHERE al.action = 'LOGIN')                AS total_logins,
            COUNT(DISTINCT al.user_id)                                 AS unique_users
        FROM audit_log al
    """, fetch="one")


@router.get("/system-health")
def get_system_health(current_user: dict = Depends(require_role("dba"))):
    """System health stats — DBA only."""
    stats = query("""
        SELECT
            (SELECT COUNT(*) FROM users WHERE is_active = TRUE)           AS active_users,
            (SELECT COUNT(*) FROM users)                                   AS total_users,
            (SELECT COUNT(*) FROM printers WHERE is_active = TRUE)         AS active_printers,
            (SELECT COUNT(*) FROM branches WHERE is_active = TRUE)         AS active_branches,
            (SELECT COUNT(*) FROM print_logs)                              AS total_logs,
            (SELECT COUNT(*) FROM print_logs
             WHERE log_date = CURRENT_DATE - 1)                            AS logs_yesterday,
            (SELECT COUNT(*) FROM replacement_requests
             WHERE status = 'pending')                                     AS pending_requests,
            (SELECT COUNT(*) FROM replacement_requests)                    AS total_requests,
            (SELECT COUNT(*) FROM toner_installations WHERE is_current=TRUE) AS active_installations,
            (SELECT COUNT(*) FROM audit_log)                               AS total_audit_entries,
            (SELECT COUNT(*) FROM rental_printers WHERE is_active=TRUE)    AS rental_printers
    """, fetch="one")

    recent_logins = query("""
        SELECT full_name, username, role,
               last_login
        FROM users
        WHERE last_login IS NOT NULL
          AND is_active = TRUE
        ORDER BY last_login DESC
        LIMIT 10
    """) or []

    db_tables = query("""
        SELECT
            'users'                  AS tbl, COUNT(*) AS cnt FROM users
        UNION ALL SELECT 'branches',       COUNT(*) FROM branches
        UNION ALL SELECT 'printers',       COUNT(*) FROM printers
        UNION ALL SELECT 'print_logs',     COUNT(*) FROM print_logs
        UNION ALL SELECT 'toner_models',   COUNT(*) FROM toner_models
        UNION ALL SELECT 'toner_installations', COUNT(*) FROM toner_installations
        UNION ALL SELECT 'replacement_requests', COUNT(*) FROM replacement_requests
        UNION ALL SELECT 'rental_printers', COUNT(*) FROM rental_printers
        UNION ALL SELECT 'audit_log',      COUNT(*) FROM audit_log
        ORDER BY tbl
    """) or []

    return {
        "stats":         stats,
        "recent_logins": recent_logins,
        "db_tables":     db_tables,
    }


# ── Send custom system email ─────────────────────────────────────────────────

@router.post("/send-system-email")
def send_system_email(
    body: CustomEmailBody,
    current_user: dict = Depends(require_role("dba"))
):
    """DBA sends a custom system message email to Nuwan."""
    if not body.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    try:
        from scheduler import send_custom_system_email
        send_custom_system_email(
            subject=body.subject.strip(),
            message=body.message.strip(),
            sent_by=current_user.get("username", "DBA")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {str(e)}")
    return {"message": "Email sent to Nuwan"}


# ── Dynamic /{user_id} routes below ─────────────────────────────────────────


@router.post("")
def create_user(body: UserBody, current_user: dict = Depends(require_role("dba"))):
    if body.role not in ("manager", "service", "dba", "store", "nuwan"):
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

    # Send email notification to Nuwan
    try:
        from scheduler import send_user_created_email
        send_user_created_email(
            full_name=body.full_name,
            username=body.username,
            password=body.password,
            role=body.role,
            branch=body.branch_access if body.branch_access and body.branch_access != "ALL" else "All Branches",
            created_by=current_user.get("username", "DBA")
        )
    except Exception:
        pass  # Never block user creation if email fails

    return user


@router.put("/{user_id}")
def update_user(user_id: int, body: UserBody, current_user: dict = Depends(require_role("dba"))):
    if body.password and body.password.strip():
        # Update with new password
        hashed = hash_password(body.password)
        user = query("""
            UPDATE users SET full_name=%s, username=%s, password=%s, role=%s, branch_access=%s
            WHERE id=%s RETURNING id, full_name, username, role, branch_access
        """, (body.full_name, body.username, hashed, body.role, body.branch_access, user_id), fetch="one")
    else:
        # Keep existing password unchanged
        user = query("""
            UPDATE users SET full_name=%s, username=%s, role=%s, branch_access=%s
            WHERE id=%s RETURNING id, full_name, username, role, branch_access
        """, (body.full_name, body.username, body.role, body.branch_access, user_id), fetch="one")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/{user_id}")
def deactivate_user(user_id: int, current_user: dict = Depends(require_role("dba"))):
    if user_id == int(current_user["sub"]):
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    result = query(
        "UPDATE users SET is_active=FALSE WHERE id=%s RETURNING id, username, full_name",
        (user_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'DEACTIVATE_USER',%s)
    """, (int(current_user["sub"]), f"Deactivated user: {result['username']}"), fetch="none")

    # Send email notification to Nuwan
    try:
        from scheduler import send_user_status_email
        send_user_status_email(
            full_name=result.get("full_name", result["username"]),
            username=result["username"],
            action="deactivated",
            changed_by=current_user.get("username", "DBA")
        )
    except Exception:
        pass

    return {"message": "User deactivated"}


@router.patch("/{user_id}/activate")
def activate_user(user_id: int, current_user: dict = Depends(require_role("dba"))):
    """Re-activate a previously deactivated user account."""
    result = query(
        "UPDATE users SET is_active=TRUE WHERE id=%s RETURNING id, username, full_name",
        (user_id,), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'ACTIVATE_USER',%s)
    """, (int(current_user["sub"]), f"Activated user: {result['username']}"), fetch="none")

    # Send email notification to Nuwan
    try:
        from scheduler import send_user_status_email
        send_user_status_email(
            full_name=result.get("full_name", result["username"]),
            username=result["username"],
            action="activated",
            changed_by=current_user.get("username", "DBA")
        )
    except Exception:
        pass

    return {"message": "User activated", "username": result["username"]}


@router.patch("/{user_id}/reset-password")
def reset_password(user_id: int, body: ResetPasswordBody, current_user: dict = Depends(require_role("dba"))):
    """DBA resets the password for any user account."""
    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    hashed = hash_password(body.new_password)
    result = query(
        "UPDATE users SET password=%s WHERE id=%s RETURNING id, username, full_name",
        (hashed, user_id), fetch="one"
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    query("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (%s,'RESET_PASSWORD',%s)
    """, (int(current_user["sub"]), f"Reset password for user: {result['username']}"), fetch="none")

    # Send email notification to Nuwan with the new password
    try:
        from scheduler import send_password_reset_email
        send_password_reset_email(
            full_name=result.get("full_name", result["username"]),
            username=result["username"],
            new_password=body.new_password,
            reset_by=current_user.get("username", "DBA")
        )
    except Exception:
        pass

    return {"message": "Password reset successfully", "username": result["username"]}