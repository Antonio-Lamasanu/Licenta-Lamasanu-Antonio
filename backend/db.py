import psycopg
from psycopg.rows import dict_row

from config import ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL
from security import hash_password


def get_db():
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin      BOOLEAN NOT NULL DEFAULT false,
            last_login_at TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title      TEXT NOT NULL DEFAULT '',
            content    TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_searches (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query      TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scratchpad_words (
            id        SERIAL PRIMARY KEY,
            user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            word      TEXT NOT NULL,
            pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, word)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            note_id    INTEGER REFERENCES notes(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("ALTER TABLE chat_sessions DROP COLUMN IF EXISTS mode")
    conn.execute("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title TEXT")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_turns (
            id         SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content    TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            genres            TEXT[],
            experience_level  TEXT,
            goal              TEXT,
            hardest_part      TEXT,
            blocker           TEXT,
            frustration       TEXT,
            updated_at        TIMESTAMPTZ
        )
    """)
    conn.execute(
        """INSERT INTO users (email, password_hash, is_admin)
           VALUES (%s, %s, true)
           ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, is_admin = true""",
        (ADMIN_EMAIL.strip().lower(), hash_password(ADMIN_PASSWORD)),
    )
    conn.close()
