from datetime import datetime

from pydantic import BaseModel


class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""


class NoteUpdate(BaseModel):
    title: str
    content: str


class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class SavedSearchCreate(BaseModel):
    query: str

class SavedSearchOut(BaseModel):
    id: int
    query: str
    created_at: datetime
