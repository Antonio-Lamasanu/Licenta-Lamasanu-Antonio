# LyricPad — Claude Context

## Project summary
LyricPad is a web app for writing lyrics and poetry with real-time per-line syllable counts. Built as a university thesis (licenta) demo.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, Uvicorn, SQLite, `pronouncing` (CMU dict) |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS |
| Ports | Backend: 8000 · Frontend dev server: 5173 |

## Architecture rules — follow these strictly

- **Frontend never calls external APIs directly.** All logic lives in `backend/`.
- **Frontend talks to backend only through `frontend/src/api/`.** Add new API calls there.
- **Backend URL** is read from the `VITE_API_URL` env var — never hardcode it.
- **TypeScript strict mode** is on. Do not disable it.
- New backend logic → new endpoint in `backend/main.py` → new function in `frontend/src/api/`.

## Key files

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, all endpoints, SQLite init |
| `frontend/src/api/notes.ts` | CRUD operations for notes |
| `frontend/src/api/syllables.ts` | POST /api/syllables call |
| `frontend/src/components/LyricEditor.tsx` | Main editor with syllable column |
| `frontend/src/components/NotesSidebar.tsx` | Note list + new/delete |
| `frontend/src/hooks/useAutoSave.ts` | 1-second debounce auto-save |
| `frontend/src/types/note.ts` | `Note` TypeScript interface |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/syllables` | `{ lines: string[] }` → `{ counts: number[] }` |
| GET | `/api/notes` | List all notes (ordered by updated_at DESC) |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/{id}` | Update note title + content |
| DELETE | `/api/notes/{id}` | Delete note |

## How to run

```bash
# Terminal 1 — backend
cd backend
source venv/Scripts/activate   # Windows: venv\Scripts\activate
uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

## Not yet built
- Rhyme highlighting / rhyme dictionary
- AI-assisted features
- Authentication
- Any additional database tables beyond `notes`
