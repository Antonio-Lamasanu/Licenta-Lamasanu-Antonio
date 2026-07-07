from fastapi import APIRouter, Depends, HTTPException, status

from auth_deps import require_admin
from db import get_db
from schemas.admin import AdminAdminToggle, AdminPasswordReset, AdminStatsOut, AdminUserOut
from security import hash_password

router = APIRouter()


@router.get("/api/admin/users", response_model=list[AdminUserOut])
def admin_list_users(admin: dict = Depends(require_admin)):
    for conn in get_db():
        rows = conn.execute("""
            SELECT u.id, u.email, u.is_admin, u.created_at, u.last_login_at,
                   COUNT(n.id) AS note_count
            FROM users u
            LEFT JOIN notes n ON n.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """).fetchall()
        return [AdminUserOut(**row) for row in rows]


@router.get("/api/admin/stats", response_model=AdminStatsOut)
def admin_stats(admin: dict = Depends(require_admin)):
    for conn in get_db():
        total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        total_notes = conn.execute("SELECT COUNT(*) AS c FROM notes").fetchone()["c"]
        total_chat_sessions = conn.execute("SELECT COUNT(*) AS c FROM chat_sessions").fetchone()["c"]
        total_chat_turns = conn.execute("SELECT COUNT(*) AS c FROM chat_turns").fetchone()["c"]
        signups_last_7_days = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE created_at >= now() - interval '7 days'"
        ).fetchone()["c"]
        return AdminStatsOut(
            total_users=total_users,
            total_notes=total_notes,
            total_chat_sessions=total_chat_sessions,
            total_chat_turns=total_chat_turns,
            signups_last_7_days=signups_last_7_days,
        )


@router.put("/api/admin/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def admin_reset_password(user_id: int, body: AdminPasswordReset, admin: dict = Depends(require_admin)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    for conn in get_db():
        result = conn.execute(
            "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s",
            (hash_password(body.password), user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()


@router.put("/api/admin/users/{user_id}/admin", status_code=status.HTTP_204_NO_CONTENT)
def admin_toggle_admin(user_id: int, body: AdminAdminToggle, admin: dict = Depends(require_admin)):
    if user_id == admin["id"] and not body.is_admin:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
    for conn in get_db():
        result = conn.execute(
            "UPDATE users SET is_admin = %s, updated_at = now() WHERE id = %s",
            (body.is_admin, user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()


@router.delete("/api/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(user_id: int, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    for conn in get_db():
        result = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
