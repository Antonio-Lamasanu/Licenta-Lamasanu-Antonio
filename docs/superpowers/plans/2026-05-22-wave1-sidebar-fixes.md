# Wave 1 – Sidebar Fixes + Line Count

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the left sidebar header layout (cutoff/clipped elements), fix note search to work against the backend, and change line count display to exclude empty lines.

**Architecture:** Pure frontend — `NotesSidebar.tsx`, `App.tsx`, `index.css`, and a new `api/notes.ts` search call. No backend changes (search endpoint is built in the Wave 1 backend plan).

**Tech Stack:** React 18, TypeScript, CSS custom properties

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/components/NotesSidebar.tsx` | Fix header layout, enable search, fix empty-line count |
| `frontend/src/api/notes.ts` | Add `searchNotes(q)` function |
| `frontend/src/App.tsx` | Pass search callback to sidebar; fix line count to skip empty lines |
| `frontend/src/index.css` | Fix `.sidebar-head` layout |

---

### Task 1: Fix sidebar header cutoff

The `.sidebar-head` row contains three items (search box, "+ New" button, collapse button) in 280px. The search box has `flex: 1` which should shrink it, but the "+ New" button text is getting clipped because the button is rendered at minimum width and the text doesn't fit. The fix is to shorten the button to an icon-style "+" and move the collapse button so it doesn't share the same row as the search/new controls.

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/NotesSidebar.tsx`

- [ ] **Step 1: Open the app and observe the header**

Run the dev server:
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Confirm the sidebar header looks cramped and the "+ New" button is cut off.

- [ ] **Step 2: Fix `.sidebar-head` CSS** in `frontend/src/index.css`

Find `.sidebar-head` (around line 205):

```css
.sidebar-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}
```

Replace with:

```css
.sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}

.sidebar-head-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 3: Update `NotesSidebar.tsx` header markup**

Find the `sidebar-head` div (around line 57 in `NotesSidebar.tsx`):

```tsx
      <div className="sidebar-head">
        {/* TODO: Note search — no backend search endpoint */}
        <div className="sidebar-search">
          <span className="sidebar-search-icon">⌕</span>
          <input
            className="sidebar-search-input"
            placeholder="Search…"
            readOnly
          />
          <span className="sidebar-search-hint">⌘K</span>
        </div>
        <button className="sidebar-btn-new" onClick={onNewNote}>
          + New
        </button>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggle}
          aria-label="Collapse sidebar"
        >
          ←
        </button>
      </div>
```

Replace with:

```tsx
      <div className="sidebar-head">
        <div className="sidebar-head-row">
          <div className="sidebar-search">
            <span className="sidebar-search-icon">⌕</span>
            <input
              className="sidebar-search-input"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                className="sidebar-search-clear"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            ←
          </button>
        </div>
        <button className="sidebar-btn-new" onClick={onNewNote}>
          + New note
        </button>
      </div>
```

- [ ] **Step 4: Add the search clear button style** in `index.css`, right after `.sidebar-search-hint`:

```css
.sidebar-search-clear {
  background: none;
  border: none;
  color: var(--ink-4);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  flex-shrink: 0;
}
.sidebar-search-clear:hover { color: var(--ink-2); }
```

- [ ] **Step 5: Update `sidebar-btn-new` CSS** to be full-width so it sits on its own row:

Find `.sidebar-btn-new` in `index.css` (around line 249):
```css
.sidebar-btn-new {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--ink);
  color: var(--panel);
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
```

Replace with:

```css
.sidebar-btn-new {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  width: 100%;
  background: var(--ink);
  color: var(--panel);
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}
```

- [ ] **Step 6: Verify layout looks correct**

Check `http://localhost:5173` — the sidebar header should now show:
- Row 1: search input (full width) + collapse button
- Row 2: full-width "+ New note" button

No text clipping.

- [ ] **Step 7: Commit the CSS/markup fixes**

```bash
git add frontend/src/index.css frontend/src/components/NotesSidebar.tsx
git commit -m "fix: sidebar header layout — two-row design eliminates clipping"
```

---

### Task 2: Wire up note search (search input → API)

**Files:**
- Modify: `frontend/src/api/notes.ts`
- Modify: `frontend/src/components/NotesSidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add `searchNotes` to `frontend/src/api/notes.ts`**

Open `frontend/src/api/notes.ts` and read the existing content, then add at the bottom:

```ts
export async function searchNotes(q: string): Promise<Note[]> {
  const response = await fetch(
    `${API_URL}/api/notes?q=${encodeURIComponent(q)}`
  );
  if (!response.ok) throw new Error(`Search error: ${response.status}`);
  return response.json() as Promise<Note[]>;
}
```

(Check that `API_URL` is already imported/defined in that file — it is, as `const API_URL = import.meta.env.VITE_API_URL as string`.)

- [ ] **Step 2: Update `NotesSidebarProps` interface** to accept search state and handler:

Find the interface at the top of `NotesSidebar.tsx`:

```ts
interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}
```

Replace with:

```ts
interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}
```

- [ ] **Step 3: Add `searchQuery` and `onSearchChange` to the destructured props** in `NotesSidebar.tsx` (the function signature around line 31):

```tsx
export default function NotesSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  isOpen,
  onToggle,
  searchQuery,
  onSearchChange,
}: NotesSidebarProps) {
```

- [ ] **Step 4: Update `App.tsx` to manage search state and debounce**

In `App.tsx`, add search state and a debounced effect. Find the existing state declarations (around line 11–21) and add:

```ts
const [sidebarSearch, setSidebarSearch] = useState("");
```

Then add a `useEffect` to trigger search (place it after the existing note-fetch effect):

```ts
useEffect(() => {
  const timer = setTimeout(() => {
    if (sidebarSearch.trim()) {
      searchNotes(sidebarSearch)
        .then(setNotes)
        .catch(console.error);
    } else {
      fetchNotes()
        .then((loaded) => setNotes(loaded))
        .catch(console.error);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [sidebarSearch]);
```

Add `searchNotes` to the import line in `App.tsx`:

```ts
import { fetchNotes, createNote, deleteNote, searchNotes } from "./api/notes";
```

- [ ] **Step 5: Pass search props to `NotesSidebar` in `App.tsx`**

Find the `<NotesSidebar` JSX (around line 131) and add the two new props:

```tsx
<NotesSidebar
  notes={notes}
  activeNoteId={activeNoteId}
  onSelectNote={handleSelectNote}
  onNewNote={handleNewNote}
  onDeleteNote={handleDeleteNote}
  isOpen={sidebarOpen}
  onToggle={() => setSidebarOpen((o) => !o)}
  searchQuery={sidebarSearch}
  onSearchChange={setSidebarSearch}
/>
```

- [ ] **Step 6: Test search**

1. Start both backend (`uvicorn main:app --reload`) and frontend (`npm run dev`).
2. Type "moon" in the sidebar search box.
3. After 300ms the list should filter to notes whose title or content contains "moon".
4. Clear the input — all notes should reappear.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/notes.ts frontend/src/components/NotesSidebar.tsx frontend/src/App.tsx
git commit -m "feat: wire sidebar search to backend /api/notes?q= endpoint"
```

---

### Task 3: Fix line count to exclude empty lines

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/NotesSidebar.tsx`

- [ ] **Step 1: Fix line count in `App.tsx`**

Find (around line 89):
```ts
const lineCount = activeContent ? activeContent.split("\n").length : 0;
```

Replace with:
```ts
const lineCount = activeContent
  ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
  : 0;
```

- [ ] **Step 2: Fix line count in the note preview in `NotesSidebar.tsx`**

Find (around line 109):
```tsx
{note.content ? note.content.split("\n").length : 0} lines ·{" "}
```

Replace with:
```tsx
{note.content ? note.content.split("\n").filter((l) => l.trim().length > 0).length : 0} lines ·{" "}
```

- [ ] **Step 3: Verify**

Open a note with a few blank lines between stanzas. The line count in the editor header and the sidebar preview should now show only non-empty lines.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/NotesSidebar.tsx
git commit -m "fix: line count now excludes empty lines"
```
