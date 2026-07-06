# Rhymathic — PostgreSQL Database Schema

Migration target from SQLite. Every table is now user-scoped via `users` (auth added alongside the migration).

---

## Tables

### `users`

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `notes`

```sql
CREATE TABLE notes (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `saved_searches`

```sql
CREATE TABLE saved_searches (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `scratchpad_words`

Uniqueness is now per-user, not global — two users can each pin the same word.

```sql
CREATE TABLE scratchpad_words (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word      TEXT NOT NULL,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, word)
);
```

---

### `chat_sessions`

Independent of notes by design (see project discussion): a session is not required to belong to a note, and the LLM never receives note content automatically — only via explicit user-triggered "Send to Chat" / "Insert full note" actions. `note_id` is an optional tag, `user_id` is the real owner.

```sql
CREATE TABLE chat_sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id    INTEGER REFERENCES notes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `chat_turns`

```sql
CREATE TABLE chat_turns (
    id         SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Entity relationships

```
users 1──* notes
users 1──* saved_searches
users 1──* scratchpad_words
users 1──* chat_sessions
notes 0..1──* chat_sessions   (optional tag, ON DELETE SET NULL)
chat_sessions 1──* chat_turns  (ON DELETE CASCADE)
```

---

## Migration notes

- SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` → PostgreSQL `SERIAL PRIMARY KEY`.
- SQLite `TEXT` timestamps → PostgreSQL `TIMESTAMPTZ`.
- `scratchpad_words.word` UNIQUE constraint moved from global to `UNIQUE(user_id, word)`.
- `chat_sessions.note_id` is nullable with `ON DELETE SET NULL` — deleting a note must not delete chat history, only unlink it. Contrast with `chat_turns.session_id`, which is `ON DELETE CASCADE` since a turn has no meaning without its session.
- All existing data-bearing tables (`notes`, `saved_searches`, `scratchpad_words`, `chat_sessions`) gained a `user_id NOT NULL REFERENCES users(id) ON DELETE CASCADE` column — deleting a user deletes everything they own.
- Auth: passwords hashed with bcrypt (via passlib), sessions authenticated with a JWT bearer token (`pyjwt`), not server-side sessions.
