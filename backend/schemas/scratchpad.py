from datetime import datetime

from pydantic import BaseModel


class ScratchpadWordCreate(BaseModel):
    word: str


class ScratchpadWordOut(BaseModel):
    id: int
    word: str
    pinned_at: datetime
