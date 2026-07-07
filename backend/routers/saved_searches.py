from fastapi import APIRouter, Depends, HTTPException, Response, status

from auth_deps import get_current_user
from db import get_db
from schemas.notes import SavedSearchCreate, SavedSearchOut

router = APIRouter()


@router.get("/api/saved-searches", response_model=list[SavedSearchOut])
def list_saved_searches(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, query, created_at FROM saved_searches WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [SavedSearchOut(**row) for row in rows]


@router.post("/api/saved-searches", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(body: SavedSearchCreate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO saved_searches (user_id, query)
               VALUES (%s, %s)
               RETURNING id, query, created_at""",
            (current_user["id"], body.query.strip()),
        ).fetchone()
        conn.commit()
        return SavedSearchOut(**row)


@router.delete("/api/saved-searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM saved_searches WHERE id = %s AND user_id = %s",
            (search_id, current_user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
