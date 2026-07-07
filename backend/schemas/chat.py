from datetime import datetime

from pydantic import BaseModel


class ChatSessionCreate(BaseModel):
    note_id: int | None = None


class ChatSessionOut(BaseModel):
    id: int
    note_id: int | None
    title: str | None
    created_at: datetime


class ChatSessionRename(BaseModel):
    title: str


class ChatTurnOut(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime


class ChatTurnCreate(BaseModel):
    content: str
