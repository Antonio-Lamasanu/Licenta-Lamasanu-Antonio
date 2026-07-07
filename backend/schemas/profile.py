from datetime import datetime

from pydantic import BaseModel


class UserProfileIn(BaseModel):
    genres: list[str] | None = None
    experience_level: str | None = None
    goal: str | None = None
    hardest_part: str | None = None
    blocker: str | None = None
    frustration: str | None = None


class UserProfileOut(BaseModel):
    genres: list[str] | None
    experience_level: str | None
    goal: str | None
    hardest_part: str | None
    blocker: str | None
    frustration: str | None
    updated_at: datetime | None
