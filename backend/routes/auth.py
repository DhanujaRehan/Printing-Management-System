"""
Auth routes — login, current user, change password.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from db.database import query
from middleware.auth import verify_password, create_token, hash_password, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ── Request models ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    username: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginRequest, request: Request):
    user = query(
        "SELECT * FROM users WHERE username = %s AND is_active = TRUE",
        (body.username,), fetch="one"
    )
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Update last_login
    query(
        "UPDATE users SET last_login = NOW() WHERE id = %s",
        (user["id"],), fetch="none"
    )

    # Audit log
    query(
        "INSERT INTO audit_log (user_id, action, detail, ip_address) VALUES (%s, %s, %s, %s)",
        (user["id"], "LOGIN", f"User {user['username']} logged in", request.client.host),
        fetch="none"
    )

    token = create_token({
        "sub":       str(user["id"]),
        "username":  user["username"],
        "role":      user["role"],
        "full_name": user["full_name"],
    })

    return {
        "token": token,
        "user": {
            "id":            user["id"],
            "full_name":     user["full_name"],
            "username":      user["username"],
            "role":          user["role"],
            "branch_access": user["branch_access"],
        }
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    user = query(
        "SELECT id, full_name, username, role, branch_access, last_login FROM users WHERE id = %s",
        (int(current_user["sub"]),), fetch="one"
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user = query(
        "SELECT * FROM users WHERE id = %s",
        (int(current_user["sub"]),), fetch="one"
    )
    if not user or not verify_password(body.old_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = hash_password(body.new_password)
    query(
        "UPDATE users SET password = %s WHERE id = %s",
        (new_hash, user["id"]), fetch="none"
    )
    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, request: Request):
    """
    Called when someone clicks 'Forgot password?' on the login screen.
    Does NOT reset anything — just alerts the admins by email with the
    username that was entered, so they can follow up and reset it
    manually. Always returns a generic success message.
    """
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    try:
        from scheduler import send_forgot_password_alert
        send_forgot_password_alert(username, request.client.host)
    except Exception as e:
        # Never fail the request just because the email failed to send —
        # log it server-side and still tell the user we've handled it.
        import logging
        logging.getLogger("softwave.auth").error(f"Forgot-password email failed: {e}")

    return {"message": "Your administrator has been notified."}