# Rhymathic

A web app for writing lyrics and poetry with real-time per-line syllable counts and rhyme highlighting. Helps songwriters and poets keep track of rhythm and meter as they write.

## Features

- Create, edit, and delete multiple notes/lyrics
- Per-line syllable count displayed live as you type (debounced 400 ms)
- Rhyme highlighting — matching vowel phonemes across lines are colored in real time
- Auto-save to database after 1 second of inactivity
- CMU Pronouncing Dictionary for accurate phoneme-based syllable counting
- Dark theme UI

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS |
| Backend | Python 3, FastAPI, Uvicorn |
| Database | SQLite |
| Syllables | `cmudict` + `pyphen` |

## Prerequisites

- Node.js 20+
- Python 3.11+

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows
# source venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```
FRONTEND_ORIGIN=http://localhost:5173
```

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

Open [http://localhost:5173](http://localhost:5173).

## Running (Docker)

```bash
docker compose up --build
```

The frontend is served at [http://localhost:5173](http://localhost:5173). Nginx proxies `/api/` requests to the backend container.

> **Note:** When running via Docker, `VITE_API_URL` is set to an empty string — Nginx handles routing, so the frontend calls `/api/` relative paths.

## Project structure

```
rhymathic/
├── backend/
│   ├── main.py            # FastAPI app, all endpoints, syllabification logic
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env               # FRONTEND_ORIGIN (not committed)
├── frontend/
│   ├── src/
│   │   ├── api/           # All backend calls
│   │   │   ├── notes.ts
│   │   │   └── syllables.ts
│   │   ├── components/
│   │   │   ├── LyricEditor.tsx
│   │   │   └── NotesSidebar.tsx
│   │   ├── hooks/
│   │   │   └── useAutoSave.ts
│   │   └── types/
│   │       └── note.ts
│   ├── nginx.conf
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env               # VITE_API_URL (not committed)
└── docker-compose.yml
```

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/syllables` | `{ lines }` → `{ counts }` — syllable count per line |
| POST | `/api/analyze` | `{ lines }` → `{ line_counts, syllable_data, syllable_groups }` — full rhyme analysis |
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/{id}` | Update note |
| DELETE | `/api/notes/{id}` | Delete note |

---

University thesis (licenta) demo project.
