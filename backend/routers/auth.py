from fastapi import APIRouter, Depends, HTTPException, status

import psycopg
from auth_deps import get_current_user
from db import get_db
from schemas.auth import LoginRequest, TokenOut, UserCreate, UserOut
from security import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def auth_register(body: UserCreate):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    password_hash = hash_password(body.password)
    for conn in get_db():
        try:
            row = conn.execute(
                """INSERT INTO users (email, password_hash)
                   VALUES (%s, %s)
                   RETURNING id, email, is_admin, created_at""",
                (email, password_hash),
            ).fetchone()
        except psycopg.errors.UniqueViolation:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Email already registered")
        conn.commit()
        return UserOut(**row)


@router.post("/api/auth/login", response_model=TokenOut)
def auth_login(body: LoginRequest):
    email = body.email.strip().lower()
    for conn in get_db():
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = %s", (email,)
        ).fetchone()
        if not row or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        conn.execute(
            "UPDATE users SET last_login_at = now() WHERE id = %s", (row["id"],)
        )
        conn.commit()
        return TokenOut(access_token=create_access_token(row["id"]))


@router.get("/api/auth/me", response_model=UserOut)
def auth_me(current_user: dict = Depends(get_current_user)):
    return UserOut(**current_user)
