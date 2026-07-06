# PostgreSQL migration — schema plan

Status: design agreed, not yet implemented. Replaces SQLite (`notes.db`) per `CLAUDE.md` pending-implementation item #5.

## ER diagram

```mermaid
erDiagram
    notes {
        int id PK
        text title
        text content
        timestamptz created_at
        timestamptz updated_at
    }

    chat_sessions {
        int id PK
        int note_id FK "nullable, ON DELETE SET NULL"
        timestamptz created_at
    }

    chat_turns {
        int id PK
        int session_id FK "ON DELETE CASCADE"
        text role "user | assistant | system"
        text content
        timestamptz created_at
    }

    saved_searches {
        int id PK
        text query
        timestamptz created_at
    }

    scratchpad_words {
        int id PK
        text word UNIQUE
        timestamptz pinned_at
    }

    notes ||--o{ chat_sessions : "optionally tagged"
    chat_sessions ||--o{ chat_turns : "has"
```

`saved_searches` and `scratchpad_words` are standalone — no FK to `notes`, matching current app behavior (global search history, global pinned-word list).

## Key decisions (why they're not the "obvious" schema)

- **`chat_sessions.note_id` is nullable, `ON DELETE SET NULL`** — chat is independent of notes by design. A session isn't required to belong to a note, and deleting a note must not delete its chat history. `note_id` is just an optional tag for "the chat I had while working on this note."
- **No automatic note→chat injection.** The LLM never receives note content unless the user explicitly triggers it (planned "Send to Chat" / "Insert full note" buttons paste text into the chat input — the user reviews/edits before submitting). This will be implemented as a user-visible prompt-injection system: the user sees exactly what's being added to their message before it's sent, nothing happens silently server-side.
- **`chat_turns.session_id` is `ON DELETE CASCADE`** (unlike `note_id` above) — turns have no meaning without their session, so cascading here is safe, unlike the notes relationship.
- **`role` as `text` + `CHECK (role IN ('user','assistant','system'))`** rather than a Postgres enum — easier to alter later without an `ALTER TYPE` migration; low value in a strict enum for a 3-value field at this scale.

## Still open (decide before/while implementing)

- Do we ever list "all chat sessions for a note" in the UI, or is the `note_id` tag write-only metadata for now? Affects whether `GET /api/chat-sessions?note_id=` is needed at v1 or can wait.
- Retention: do old sessions/turns ever get pruned, or kept forever? (Probably fine to ignore for thesis scope.)
- Index needs: `chat_turns(session_id, created_at)` for ordered fetch is the only one likely to matter at this data size; `notes(updated_at)` already implied by existing `ORDER BY updated_at DESC` query.
