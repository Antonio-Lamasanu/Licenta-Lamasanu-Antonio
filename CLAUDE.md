# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project summary
Rhymathic is a web app for writing lyrics and poetry with real-time per-line syllable counts and rhyme highlighting.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, Uvicorn, SQLite, `cmudict` + `pyphen` (syllabification) |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS |
| Ports | Backend: 8000 · Frontend dev server: 5173 |

## Dev commands

**Backend** (from `backend/`):
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev      # dev server on :5173
npm run build    # production build
npm run preview  # serve production build
```

**Docker** (from project root):
```bash
docker compose up --build
```
Frontend served at `:5173` via Nginx, which proxies `/api/` to the backend container. `VITE_API_URL` is set to `""` so the frontend uses relative paths; Nginx handles routing.

There are no automated tests. The app has no test runner configured.

## Architecture rules — follow these strictly

- **Frontend never calls external APIs directly.** All logic lives in `backend/`.
- **Frontend talks to backend only through `frontend/src/api/`.** Add new API calls there.
- **Backend URL** is read from the `VITE_API_URL` env var (set in `frontend/.env`) — never hardcode it.
- **TypeScript strict mode** is on. Do not disable it.
- New backend logic → new endpoint in `backend/main.py` → new function in `frontend/src/api/`.

## Environment files

- `frontend/.env` — sets `VITE_API_URL=http://localhost:8000` and optional `VITE_DEBUG_LYRICS` / `VITE_DEBUG_LYRICS_TEXT` for preloading sample lyrics
- `backend/.env` — sets `FRONTEND_ORIGIN` (default `http://localhost:5173`) and optionally `DB_PATH` (default `notes.db`)

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/syllables` | `{ lines: string[] }` → `{ counts: number[] }` — simple count only |
| POST | `/api/analyze` | `{ lines: string[] }` → `{ line_counts, syllable_data, syllable_groups }` — full analysis with rhyme grouping |
| GET | `/api/notes` | List all notes (ordered by updated_at DESC) |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/{id}` | Update note title + content |
| DELETE | `/api/notes/{id}` | Delete note |

## Syllabification pipeline (backend)

`syllabify_word` → strips punctuation → handles hyphenated words recursively → CMU dict lookup (with contraction fallbacks via `_cmu_lookup`) → `pyphen` for orthographic splits → aligns splits to CMU vowel phonemes → returns `list[SyllableInfo(text, key)]`.

`/api/analyze` groups syllables sharing the same vowel phoneme key across lines into `SyllableGroup`s (each assigned a `color_index`). Only groups with ≥ 2 occurrences are returned.

## LyricEditor rendering architecture (frontend)

`LyricEditor` uses a **mirror div + transparent textarea** overlay pattern:
- The `<textarea>` captures all input but has `color: transparent` and `caretColor: white`.
- A sibling `<div>` (mirror) is positioned absolutely behind it, rendering highlighted HTML.
- Both share identical `EDITOR_STYLE` constants (font, size, line-height) so they stay pixel-aligned.
- Scroll sync: `onScroll` on the textarea copies `scrollTop`/`scrollLeft` to the mirror div.
- Analysis is debounced 400 ms via `useEffect` → calls `/api/analyze` → builds a `Map<"line:wordIdx:sylIdx", colorIndex>` → renders `<span>` per syllable with background color from `RHYME_COLORS`.

## Auto-save

`useAutoSave` (1-second debounce) skips the PUT request if title+content match `lastSaved.current`. `App.tsx` calls `setLastSaved` when switching notes to prevent a spurious save on note selection.

## Key files

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, all endpoints, SQLite init, syllabification logic |
| `backend/Dockerfile` | Python 3.11-slim image, runs Uvicorn |
| `frontend/src/api/notes.ts` | CRUD operations for notes |
| `frontend/src/api/syllables.ts` | `/api/analyze` and `/api/syllables` calls + shared TS types |
| `frontend/src/components/LyricEditor.tsx` | Mirror-div editor, rhyme highlight rendering |
| `frontend/src/components/NotesSidebar.tsx` | Note list + new/delete |
| `frontend/src/hooks/useAutoSave.ts` | 1-second debounce auto-save |
| `frontend/src/types/note.ts` | `Note` TypeScript interface |
| `frontend/Dockerfile` | Multi-stage: Node 20 build → Nginx serve |
| `frontend/nginx.conf` | Serves SPA, proxies `/api/` to backend container |
| `docker-compose.yml` | Wires backend + frontend; mounts `notes.db` as volume |
