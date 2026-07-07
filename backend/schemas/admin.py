from datetime import datetime

from pydantic import BaseModel


class AdminUserOut(BaseModel):
    id: int
    email: str
    is_admin: bool
    created_at: datetime
    last_login_at: datetime | None
    note_count: int


class AdminStatsOut(BaseModel):
    total_users: int
    total_notes: int
    total_chat_sessions: int
    total_chat_turns: int
    signups_last_7_days: int


class AdminPasswordReset(BaseModel):
    password: str


class AdminAdminToggle(BaseModel):
    is_admin: bool
