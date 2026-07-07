from fastapi import APIRouter, Depends

from auth_deps import get_current_user
from db import get_db
from schemas.profile import UserProfileIn, UserProfileOut

router = APIRouter()


@router.get("/api/profile", response_model=UserProfileOut)
def get_profile(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """SELECT genres, experience_level, goal, hardest_part, blocker, frustration, updated_at
               FROM user_profiles WHERE user_id = %s""",
            (current_user["id"],),
        ).fetchone()
        if not row:
            return UserProfileOut(
                genres=None, experience_level=None, goal=None,
                hardest_part=None, blocker=None, frustration=None, updated_at=None,
            )
        return UserProfileOut(**row)


@router.put("/api/profile", response_model=UserProfileOut)
def upsert_profile(body: UserProfileIn, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO user_profiles
                   (user_id, genres, experience_level, goal, hardest_part, blocker, frustration, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, now())
               ON CONFLICT (user_id) DO UPDATE SET
                   genres = EXCLUDED.genres,
                   experience_level = EXCLUDED.experience_level,
                   goal = EXCLUDED.goal,
                   hardest_part = EXCLUDED.hardest_part,
                   blocker = EXCLUDED.blocker,
                   frustration = EXCLUDED.frustration,
                   updated_at = now()
               RETURNING genres, experience_level, goal, hardest_part, blocker, frustration, updated_at""",
            (
                current_user["id"], body.genres, body.experience_level, body.goal,
                body.hardest_part, body.blocker, body.frustration,
            ),
        ).fetchone()
        conn.commit()
        return UserProfileOut(**row)
