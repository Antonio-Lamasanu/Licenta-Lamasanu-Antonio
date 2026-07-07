from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import jwt
from config import JWT_ALGORITHM, JWT_SECRET
from db import get_db

_bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    for conn in get_db():
        row = conn.execute(
            "SELECT id, email, is_admin, created_at FROM users WHERE id = %s", (user_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        return row


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
