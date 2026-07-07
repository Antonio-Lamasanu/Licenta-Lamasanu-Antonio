import json
import logging

import requests
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from auth_deps import get_current_user
from config import MISTRAL_API_KEY
from db import get_db
from schemas.chat import (
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionRename,
    ChatTurnCreate,
    ChatTurnOut,
)
from services.mistral import auto_title, build_system_prompt, sse, stream_chat_completion

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/chat-sessions", response_model=list[ChatSessionOut])
def list_chat_sessions(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, note_id, title, created_at FROM chat_sessions WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [ChatSessionOut(**row) for row in rows]


@router.post("/api/chat-sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
def create_chat_session(body: ChatSessionCreate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        if body.note_id is not None:
            owned = conn.execute(
                "SELECT id FROM notes WHERE id = %s AND user_id = %s",
                (body.note_id, current_user["id"]),
            ).fetchone()
            if not owned:
                raise HTTPException(status_code=404, detail="Note not found")
        row = conn.execute(
            """INSERT INTO chat_sessions (user_id, note_id)
               VALUES (%s, %s)
               RETURNING id, note_id, title, created_at""",
            (current_user["id"], body.note_id),
        ).fetchone()
        conn.commit()
        return ChatSessionOut(**row)


@router.put("/api/chat-sessions/{session_id}", response_model=ChatSessionOut)
def rename_chat_session(session_id: int, body: ChatSessionRename, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """UPDATE chat_sessions SET title = %s
               WHERE id = %s AND user_id = %s
               RETURNING id, note_id, title, created_at""",
            (body.title.strip() or None, session_id, current_user["id"]),
        ).fetchone()
        conn.commit()
        if not row:
            raise HTTPException(status_code=404, detail="Chat session not found")
        return ChatSessionOut(**row)


@router.delete("/api/chat-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(session_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Chat session not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/chat-sessions/{session_id}/turns", response_model=list[ChatTurnOut])
def list_chat_turns(session_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        session = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        rows = conn.execute(
            """SELECT id, session_id, role, content, created_at FROM chat_turns
               WHERE session_id = %s ORDER BY created_at ASC""",
            (session_id,),
        ).fetchall()
        return [ChatTurnOut(**row) for row in rows]


@router.post("/api/chat-sessions/{session_id}/turns")
def create_chat_turn(session_id: int, body: ChatTurnCreate, current_user: dict = Depends(get_current_user)):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content must not be empty")

    for conn in get_db():
        session = conn.execute(
            "SELECT id, title FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        history = conn.execute(
            """SELECT role, content FROM chat_turns
               WHERE session_id = %s ORDER BY created_at ASC""",
            (session_id,),
        ).fetchall()

        profile = conn.execute(
            """SELECT genres, experience_level, goal, hardest_part, blocker, frustration
               FROM user_profiles WHERE user_id = %s""",
            (current_user["id"],),
        ).fetchone()

        system_prompt = build_system_prompt(profile)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend({"role": h["role"], "content": h["content"]} for h in history)
        messages.append({"role": "user", "content": content})

        user_row = conn.execute(
            """INSERT INTO chat_turns (session_id, role, content)
               VALUES (%s, 'user', %s)
               RETURNING id, session_id, role, content, created_at""",
            (session_id, content),
        ).fetchone()
        conn.commit()

        session_title = None
        if not history and not session["title"]:
            session_title = auto_title(content)
            conn.execute(
                "UPDATE chat_sessions SET title = %s WHERE id = %s",
                (session_title, session_id),
            )
            conn.commit()

        if not MISTRAL_API_KEY:
            raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

        try:
            mistral_resp = stream_chat_completion(messages)
        except requests.RequestException as exc:
            logger.warning("mistral call failed: %r", exc)
            raise HTTPException(status_code=502, detail="Failed to reach Mistral API") from exc

        def event_stream():
            yield sse("user_turn", dict(user_row))

            full_text_parts: list[str] = []
            try:
                for line in mistral_resp.iter_lines(decode_unicode=True):
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:"):].strip()
                    if payload == "[DONE]":
                        break
                    chunk = json.loads(payload)
                    delta = chunk["choices"][0]["delta"].get("content")
                    if delta:
                        full_text_parts.append(delta)
                        yield sse("delta", {"text": delta})
            except requests.RequestException as exc:
                logger.warning("mistral stream failed: %r", exc)
                yield sse("error", {"detail": "Failed to reach Mistral API"})
                return
            finally:
                mistral_resp.close()

            reply = "".join(full_text_parts)
            for save_conn in get_db():
                assistant_row = save_conn.execute(
                    """INSERT INTO chat_turns (session_id, role, content)
                       VALUES (%s, 'assistant', %s)
                       RETURNING id, session_id, role, content, created_at""",
                    (session_id, reply),
                ).fetchone()
                save_conn.commit()

            yield sse("done", {
                "assistant_turn": dict(assistant_row),
                "session_title": session_title,
            })

        return StreamingResponse(event_stream(), media_type="text/event-stream")
