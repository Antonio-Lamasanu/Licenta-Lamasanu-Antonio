from datetime import datetime

from pydantic import BaseModel


class ScratchpadWordCreate(BaseModel):
    word: str


class ScratchpadWordOut(BaseModel):
    id: int
    word: str
    pinned_at: datetime


class ScratchpadTextIn(BaseModel):
    text: str | None = None


class ScratchpadTextOut(BaseModel):
    text: str | None
