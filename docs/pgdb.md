# Rhymathic — PostgreSQL Database Schema

Migration target from SQLite. Schema is functionally a superset of the SQLite version — same `notes` and `saved_searches` tables, plus three new ones.

---

## Tables

### `notes`
Core writing content. Unchanged from SQLite except type names.

```sql
CREATE TABLE notes (
    id         SERIAL PRIMARY KEY,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `saved_searches`
Intentionally saved rhyme queries, shown in the Library panel under "Saved Searches". User-curated — not an auto-log.

```sql
CREATE TABLE saved_searches (
    id         SERIAL PRIMARY KEY,
    query      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `scratchpad_words`
Persisted pinned words from the Rhyme Dictionary. Global (not per-note) — matches current UI behaviour where the scratchpad survives note switches.

```sql
CREATE TABLE scratchpad_words (
    id        SERIAL PRIMARY KEY,
    word      TEXT NOT NULL UNIQUE,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `chat_sessions`
Groups chat turns into discrete conversations. Each note can have multiple sessions (e.g. one session per writing session, or one per section of the song). Planned — not yet implemented.

```sql
CREATE TABLE chat_sessions (
    id         SERIAL PRIMARY KEY,
    note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `chat_turns`
Individual messages within a chat session. `role` is `'user'` or `'assistant'`, matching the Mistral API message format. Planned — not yet implemented.

```sql
CREATE TABLE chat_turns (
    id         SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Entity relationships

```
notes 1──* chat_sessions 1──* chat_turns
notes (no direct link to scratchpad — scratchpad is global)
saved_searches (standalone)
scratchpad_words (standalone)
```

---

## Migration notes

- SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` → PostgreSQL `SERIAL PRIMARY KEY`
- SQLite `TEXT` timestamps → PostgreSQL `TIMESTAMPTZ`
- `ON DELETE CASCADE` on `chat_sessions.note_id` and `chat_turns.session_id` — deleting a note cleans up its chat history automatically
- `scratchpad_words.word` has a `UNIQUE` constraint matching the current UI behaviour that prevents duplicate pins
