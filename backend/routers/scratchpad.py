from fastapi import APIRouter, Depends, HTTPException, Response, status

from auth_deps import get_current_user
from db import get_db
from schemas.scratchpad import (
    ScratchpadTextIn,
    ScratchpadTextOut,
    ScratchpadWordCreate,
    ScratchpadWordOut,
)

router = APIRouter()


@router.get("/api/scratchpad", response_model=list[ScratchpadWordOut])
def list_scratchpad(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, word, pinned_at FROM scratchpad_words WHERE user_id = %s ORDER BY pinned_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [ScratchpadWordOut(**row) for row in rows]


@router.post("/api/scratchpad", response_model=ScratchpadWordOut, status_code=status.HTTP_201_CREATED)
def pin_scratchpad_word(body: ScratchpadWordCreate, current_user: dict = Depends(get_current_user)):
    word = body.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word must not be empty")
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO scratchpad_words (user_id, word)
               VALUES (%s, %s)
               ON CONFLICT (user_id, word) DO UPDATE SET word = EXCLUDED.word
               RETURNING id, word, pinned_at""",
            (current_user["id"], word),
        ).fetchone()
        conn.commit()
        return ScratchpadWordOut(**row)


@router.delete("/api/scratchpad/{word}", status_code=status.HTTP_204_NO_CONTENT)
def unpin_scratchpad_word(word: str, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM scratchpad_words WHERE user_id = %s AND word = %s",
            (current_user["id"], word),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Word not pinned")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/scratchpad-text", response_model=ScratchpadTextOut)
def get_scratchpad_text(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            "SELECT scratchpad_text FROM user_profiles WHERE user_id = %s",
            (current_user["id"],),
        ).fetchone()
        return ScratchpadTextOut(text=row["scratchpad_text"] if row else None)


@router.put("/api/scratchpad-text", response_model=ScratchpadTextOut)
def put_scratchpad_text(body: ScratchpadTextIn, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO user_profiles (user_id, scratchpad_text)
               VALUES (%s, %s)
               ON CONFLICT (user_id) DO UPDATE SET scratchpad_text = EXCLUDED.scratchpad_text
               RETURNING scratchpad_text""",
            (current_user["id"], body.text),
        ).fetchone()
        conn.commit()
        return ScratchpadTextOut(text=row["scratchpad_text"])
