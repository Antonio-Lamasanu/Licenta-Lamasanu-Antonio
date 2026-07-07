from fastapi import APIRouter, Depends, HTTPException, Response, status

from auth_deps import get_current_user
from db import get_db
from schemas.notes import NoteCreate, NoteOut, NoteUpdate

router = APIRouter()


@router.get("/api/notes", response_model=list[NoteOut])
def list_notes(q: str = "", current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        if q.strip():
            pattern = f"%{q.strip()}%"
            rows = conn.execute(
                """SELECT id, title, content, created_at, updated_at FROM notes
                   WHERE user_id = %s AND (title ILIKE %s OR content ILIKE %s)
                   ORDER BY updated_at DESC""",
                (current_user["id"], pattern, pattern),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = %s ORDER BY updated_at DESC",
                (current_user["id"],),
            ).fetchall()
        return [NoteOut(**row) for row in rows]


@router.post("/api/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(body: NoteCreate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO notes (user_id, title, content)
               VALUES (%s, %s, %s)
               RETURNING id, title, content, created_at, updated_at""",
            (current_user["id"], body.title, body.content),
        ).fetchone()
        conn.commit()
        return NoteOut(**row)


@router.put("/api/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, body: NoteUpdate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """UPDATE notes SET title = %s, content = %s, updated_at = now()
               WHERE id = %s AND user_id = %s
               RETURNING id, title, content, created_at, updated_at""",
            (body.title, body.content, note_id, current_user["id"]),
        ).fetchone()
        conn.commit()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return NoteOut(**row)


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, current_user["id"])
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
