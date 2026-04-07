# LyricPad

A web app for writing lyrics and poetry with real-time per-line syllable counts. Helps songwriters and poets keep track of rhythm and meter as they write.

## Features

- Create, edit, and delete multiple notes/lyrics
- Per-line syllable count displayed live as you type (debounced 400 ms)
- Auto-save to database after 1 second of inactivity
- CMU Pronouncing Dictionary for accurate phoneme-based syllable counting
- Dark theme UI

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite |
| Syllables | `pronouncing` library (CMU dict) |

## Prerequisites

- Node.js 18+
- Python 3.10+

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

## Running

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

## Project structure

```
licenta demo/
├── backend/
│   ├── main.py            # FastAPI app + all endpoints
│   ├── requirements.txt
│   └── .env               # FRONTEND_ORIGIN
└── frontend/
    ├── src/
    │   ├── api/           # All backend calls go here
    │   │   ├── notes.ts
    │   │   └── syllables.ts
    │   ├── components/
    │   │   ├── LyricEditor.tsx
    │   │   └── NotesSidebar.tsx
    │   ├── hooks/
    │   │   └── useAutoSave.ts
    │   └── types/
    │       └── note.ts
    └── .env               # VITE_API_URL
```

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/syllables` | Count syllables per line |
| GET | `/api/notes` | List all notes |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/{id}` | Update note |
| DELETE | `/api/notes/{id}` | Delete note |

---

University thesis (licenta) demo project.
