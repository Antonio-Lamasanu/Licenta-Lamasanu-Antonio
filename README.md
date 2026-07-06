# Rhymathic

A web app for writing lyrics and poetry with real-time per-line syllable counts, rhyme highlighting, and an AI songwriting assistant. Helps songwriters and poets keep track of rhythm and meter as they write.

## Features

- Create, edit, and delete multiple notes/lyrics, auto-titled from the first line until you rename them
- Per-line syllable count displayed live as you type (debounced 400 ms)
- Rhyme highlighting — matching vowel phonemes across lines are colored in real time, with slant-rhyme detection
- Rhyme dictionary (perfect/slant/synonyms/related/etc., via CMU Pronouncing Dictionary + Datamuse), pin words to a scratchpad
- Saved-search library
- AI chat assistant (Mistral) for brainstorming, writing, and refining lyrics — send a text selection or a full note into the chat, dictate messages by voice, and pick from category starter-prompts (Explore/Write/Refine/Sound/Feedback)
- Voice dictation (Web Speech API) both in the editor and in chat
- User accounts with JWT auth, a songwriting-preferences profile that personalizes the AI's replies, and an admin panel for user management
- Auto-save to the database after 1 second of inactivity
- Light/dark/auto theme

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS, `react-markdown` |
| Backend | Python 3, FastAPI, Uvicorn |
| Database | PostgreSQL, via `psycopg` v3 (raw SQL, no ORM) |
| Auth | JWT bearer tokens (`pyjwt`), bcrypt password hashing (`passlib`) |
| Syllables / rhymes | `cmudict` + `pyphen`, Datamuse API |
| AI chat | Mistral API (`mistral-small-latest`), plain `requests` call — no SDK |

## Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 16 (or use the Docker setup below, which provisions it for you)

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows
# source venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
```

Copy `.env.example` to `.env` in the repo root and fill in real values (Postgres credentials, `JWT_SECRET`, seeded admin login, and — optionally — `MISTRAL_API_KEY` for the AI chat feature). This single root `.env` is the source of truth for both Docker Compose and the backend running directly.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:8000
```

## Running (dev)

```bash
# Terminal 1 — backend
cd backend
source venv/Scripts/activate
uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). On first backend startup, the Postgres schema is created automatically and an admin account is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Running (Docker)

```bash
docker compose up --build
```

Three services: `db` (Postgres 16, healthcheck-gated), `backend` (FastAPI, waits on `db`), `frontend` (Vite dev server). Config comes from the root `.env` (see `.env.example`), which Docker Compose loads automatically for `${VAR}` substitution.

The frontend is served at [http://localhost:5173](http://localhost:5173) and the backend at [http://localhost:8000](http://localhost:8000).

> **Known gotcha:** on Windows/Docker Desktop, the frontend container's bind mount doesn't always propagate host file edits into Vite's watcher. If changes made while the stack is already running don't show up, run `docker compose restart frontend`.

## Project structure

```
rhymathic/
├── .env.example            # template for the root .env (Postgres, JWT, admin, Mistral)
├── docker-compose.yml
├── docs/
│   └── pgdb.md              # Postgres schema rationale
├── backend/
│   ├── main.py               # FastAPI app: all endpoints, Postgres init, auth, syllabification
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # All backend calls (one file per resource)
│   │   ├── components/        # LyricEditor, ChatPanel, RhymeDictionary, AdminPanel, etc.
│   │   ├── hooks/              # useAutoSave, useSpeechToText
│   │   ├── types/
│   │   └── utils/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .env                  # VITE_API_URL (not committed)
└── logo/
```

## API reference

See `CLAUDE.md` for the full endpoint table. Highlights:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/analyze` | public | Full rhyme/syllable analysis for the editor |
| POST | `/api/rhymes` | public | Rhyme dictionary lookup |
| POST | `/api/auth/register` / `/api/auth/login` | public | Account creation and JWT login |
| GET/POST/PUT/DELETE | `/api/notes` | user | Note CRUD |
| GET/POST/DELETE | `/api/chat-sessions` | user | AI chat sessions |
| POST | `/api/chat-sessions/{id}/turns` | user | Send a chat message, get a Mistral reply |
| GET/PUT | `/api/profile` | user | Songwriting-preferences profile used to personalize chat replies |
| GET/PUT/DELETE | `/api/admin/users` | admin | User management |

---

University thesis (licenta) demo project.
