# Wave 3 Revised – App.tsx + NotesSidebar + New Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `onGroupsChange` from LyricEditor into dynamic sidebar chips; implement 3-state auto theme; enable Library and Voice tabs; add responsive collapse; wire right-panel collapse with topbar reopen; connect Scratchpad via `editorRef.current.insertAtCursor`.

**Architecture:** `App.tsx` orchestrates all state. Color palettes are extracted to a shared `phonemeColors.ts` so both `LyricEditor` and `NotesSidebar` import the same values. `LyricEditor` gains a `forwardRef`/`useImperativeHandle` handle for cursor insertion and an `onGroupsChange` callback emitted after every analysis. New panels (`LibraryPanel`, `VoicePanel`, `Scratchpad`) are isolated components mounted conditionally by `App`.

**Tech Stack:** React 18, TypeScript strict, Web Speech API (browser-native), no new npm packages.

> **Supersedes:** `2026-05-22-wave3-app-features.md` — use this file instead.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/phonemeColors.ts` | **Create** — shared color palette arrays |
| `frontend/src/api/syllables.ts` | **Modify** — add `ActiveGroup` export |
| `frontend/src/components/LyricEditor.tsx` | **Modify** — import palettes, add `LyricEditorHandle`, `onGroupsChange` |
| `frontend/src/components/NotesSidebar.tsx` | **Modify** — dynamic legend chips from `activeGroups` |
| `frontend/src/components/LibraryPanel.tsx` | **Create** |
| `frontend/src/components/VoicePanel.tsx` | **Create** |
| `frontend/src/components/Scratchpad.tsx` | **Create** |
| `frontend/src/App.tsx` | **Modify** — all orchestration changes |
| `frontend/src/index.css` | **Modify** — remove min-width, add responsive + new component styles |

---

### Task 1: Create `frontend/src/phonemeColors.ts`

Extract the four color-palette arrays from `LyricEditor.tsx` into a shared module so `NotesSidebar` can import the same values.

**Files:**
- Create: `frontend/src/phonemeColors.ts`
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Create `frontend/src/phonemeColors.ts`**

```ts
export const RHYME_COLORS: { bg: string; ink: string }[] = [
  { bg: "#FFE7B0", ink: "#6B4A05" },
  { bg: "#FFD0C2", ink: "#7A2A12" },
  { bg: "#D9E8FF", ink: "#1E3A78" },
  { bg: "#E5DCFF", ink: "#3B2877" },
  { bg: "#C9EBD2", ink: "#1E5E36" },
  { bg: "#FFD9EC", ink: "#7A1F4F" },
  { bg: "#F1E1B8", ink: "#5C4314" },
  { bg: "#CDE7E6", ink: "#1F4E4D" },
  { bg: "#FBE2A8", ink: "#6B4A05" },
  { bg: "#D8E4C2", ink: "#3F4F1F" },
  { bg: "#E8D9CC", ink: "#5A3A22" },
];

export const RHYME_COLORS_DARK: { bg: string; ink: string }[] = [
  { bg: "#5C4200", ink: "#FFD87A" },
  { bg: "#5C1F0E", ink: "#FFAA8A" },
  { bg: "#0D2550", ink: "#8FB8FF" },
  { bg: "#22144F", ink: "#C4AAFF" },
  { bg: "#0D3A1E", ink: "#7DD8A0" },
  { bg: "#4A0D2C", ink: "#FFB3D6" },
  { bg: "#3A2800", ink: "#D4B87A" },
  { bg: "#0D3030", ink: "#7DCFCE" },
  { bg: "#3D2800", ink: "#F5CC70" },
  { bg: "#1F2E0A", ink: "#B8D46E" },
  { bg: "#2D1A0A", ink: "#C49878" },
];

export const RHYME_COLORS_SLANT: { bg: string; ink: string }[] = [
  { bg: "#FFE7B066", ink: "#6B4A05" },
  { bg: "#FFD0C266", ink: "#7A2A12" },
  { bg: "#D9E8FF66", ink: "#1E3A78" },
  { bg: "#E5DCFF66", ink: "#3B2877" },
  { bg: "#C9EBD266", ink: "#1E5E36" },
  { bg: "#FFD9EC66", ink: "#7A1F4F" },
  { bg: "#F1E1B866", ink: "#5C4314" },
  { bg: "#CDE7E666", ink: "#1F4E4D" },
  { bg: "#FBE2A866", ink: "#6B4A05" },
  { bg: "#D8E4C266", ink: "#3F4F1F" },
  { bg: "#E8D9CC66", ink: "#5A3A22" },
];

export const RHYME_COLORS_SLANT_DARK: { bg: string; ink: string }[] = [
  { bg: "#5C420066", ink: "#FFD87A" },
  { bg: "#5C1F0E66", ink: "#FFAA8A" },
  { bg: "#0D255066", ink: "#8FB8FF" },
  { bg: "#22144F66", ink: "#C4AAFF" },
  { bg: "#0D3A1E66", ink: "#7DD8A0" },
  { bg: "#4A0D2C66", ink: "#FFB3D6" },
  { bg: "#3A280066", ink: "#D4B87A" },
  { bg: "#0D303066", ink: "#7DCFCE" },
  { bg: "#3D280066", ink: "#F5CC70" },
  { bg: "#1F2E0A66", ink: "#B8D46E" },
  { bg: "#2D1A0A66", ink: "#C49878" },
];
```

- [ ] **Step 2: Update imports at the top of `LyricEditor.tsx`**

Remove the four inline array definitions (lines 6–62 in current file) and add this import instead:

```ts
import {
  RHYME_COLORS,
  RHYME_COLORS_DARK,
  RHYME_COLORS_SLANT,
  RHYME_COLORS_SLANT_DARK,
} from "../phonemeColors";
```

- [ ] **Step 3: Verify**

Run `npm run build` from `frontend/` — should compile with no errors. No visual change in the app.

```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/phonemeColors.ts frontend/src/components/LyricEditor.tsx
git commit -m "refactor: extract color palettes to phonemeColors.ts"
```

---

### Task 2: Add `ActiveGroup` type to `syllables.ts`

**Files:**
- Modify: `frontend/src/api/syllables.ts`

- [ ] **Step 1: Add `ActiveGroup` to `syllables.ts`**

Append after the existing `AnalyzeResponse` interface:

```ts
export interface ActiveGroup {
  phonemeKey: string;
  isSlant: boolean;
  colorIndex: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/syllables.ts
git commit -m "feat: add ActiveGroup type to syllables.ts"
```

---

### Task 3: Add `LyricEditorHandle`, `onGroupsChange` to `LyricEditor.tsx`

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Add `forwardRef` import and `LyricEditorHandle` export**

In `LyricEditor.tsx`, change the React import:

```ts
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
```

Add `ActiveGroup` import:

```ts
import { fetchAnalysis, type SyllableInfo, type ActiveGroup } from "../api/syllables";
```

- [ ] **Step 2: Export `LyricEditorHandle` interface** — add before the `LyricEditorProps` interface:

```ts
export interface LyricEditorHandle {
  insertAtCursor: (text: string) => void;
}
```

- [ ] **Step 3: Add `onGroupsChange` to `LyricEditorProps`**

```ts
interface LyricEditorProps {
  content: string;
  onContentChange: (value: string) => void;
  onSelectionChange?: (text: string) => void;
  onCursorChange?: (query: string) => void;
  isDarkTheme?: boolean;
  rhymeMode?: "highlight" | "underline";
  showPhonemes?: boolean;
  showStress?: boolean;
  activeColorGroups?: Set<number> | null;
  onGroupsChange?: (groups: ActiveGroup[]) => void;
}
```

- [ ] **Step 4: Wrap the component with `forwardRef`**

Change the function signature from:

```ts
export default function LyricEditor({
  content,
  onContentChange,
  onSelectionChange,
  onCursorChange,
  isDarkTheme = false,
  rhymeMode = "highlight",
  showPhonemes = false,
  showStress = false,
  activeColorGroups = null,
}: LyricEditorProps) {
```

To:

```ts
const LyricEditor = forwardRef<LyricEditorHandle, LyricEditorProps>(
  function LyricEditor(
    {
      content,
      onContentChange,
      onSelectionChange,
      onCursorChange,
      isDarkTheme = false,
      rhymeMode = "highlight",
      showPhonemes = false,
      showStress = false,
      activeColorGroups = null,
      onGroupsChange,
    }: LyricEditorProps,
    ref
  ) {
```

And add a closing `}` + `)` + `; export default LyricEditor;` at the end of the file (after the final `}`):

```ts
);

export default LyricEditor;
```

- [ ] **Step 5: Add `useImperativeHandle` inside the component body** — place immediately after the `textareaRef` declaration:

```ts
useImperativeHandle(ref, () => ({
  insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    onContentChange(newValue);
    requestAnimationFrame(() => {
      el.setSelectionRange(selectionStart + text.length, selectionStart + text.length);
      el.focus();
    });
  },
}));
```

- [ ] **Step 6: Emit `onGroupsChange` after analysis completes**

Inside `runAnalysis`, after `setSlantColorMap(slantMap);`, add:

```ts
if (onGroupsChange) {
  const groups: ActiveGroup[] = [
    ...syllable_groups.map((g) => ({
      phonemeKey: g.phoneme_key,
      isSlant: false,
      colorIndex: g.color_index,
    })),
    ...( slant_groups ?? []).map((g) => ({
      phonemeKey: g.vowel_key,
      isSlant: true,
      colorIndex: g.color_index,
    })),
  ];
  onGroupsChange(groups);
}
```

Note: `onGroupsChange` must be added to the `useCallback` dependency array of `runAnalysis`:

```ts
const runAnalysis = useCallback((value: string) => {
  // ...
}, [onGroupsChange]);
```

- [ ] **Step 7: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds. No type errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: add LyricEditorHandle (insertAtCursor) and onGroupsChange to LyricEditor"
```

---

### Task 4: Update `NotesSidebar.tsx` — dynamic legend chips

**Files:**
- Modify: `frontend/src/components/NotesSidebar.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Update imports and interface in `NotesSidebar.tsx`**

Replace the top of the file through the interface:

```ts
import type { Note } from "../types/note";
import type { ActiveGroup } from "../api/syllables";
import { RHYME_COLORS, RHYME_COLORS_SLANT } from "../phonemeColors";

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
  activeColorGroups: Set<number> | null;
  onColorGroupToggle: (index: number) => void;
  activeGroups: ActiveGroup[];
}
```

Remove the `LEGEND_CHIPS` array — it's replaced by the dynamic `activeGroups` prop.

Keep `NOTE_TAB_COLORS` — it's still used for the note strip colors.

- [ ] **Step 2: Update the legend section in `NotesSidebar` JSX**

Replace the entire `{/* ── Legend chips ── */}` section:

```tsx
{activeGroups.length > 0 && (
  <div className="sidebar-legend">
    {activeGroups.map((group) => {
      const palette = group.isSlant
        ? RHYME_COLORS_SLANT[group.colorIndex % RHYME_COLORS_SLANT.length]
        : RHYME_COLORS[group.colorIndex % RHYME_COLORS.length];
      const isActive =
        activeColorGroups === null || activeColorGroups.has(group.colorIndex);
      return (
        <div
          key={`${group.colorIndex}-${group.isSlant}`}
          className={`legend-chip${isActive ? "" : " legend-chip--dim"}`}
          style={{ background: palette.bg, cursor: "pointer" }}
          title={`${group.isSlant ? "Slant rhyme" : "Rhyme"}: ${group.phonemeKey}`}
          onClick={() => onColorGroupToggle(group.colorIndex)}
        >
          <span className="legend-chip-label">{group.phonemeKey}</span>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Add `.legend-chip-label` CSS** to `index.css` (append to the existing `/* ─── Wave 2: legend chip dim state ─── */` block):

```css
.legend-chip {
  width: 28px;
  height: 18px;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-chip-label {
  font-family: var(--mono);
  font-size: 8px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
```

Note: this overrides the existing `.legend-chip { width: 14px; height: 14px; }` — make sure the new rule appears after or replace the old one. Find the existing `.legend-chip` rule in `index.css` and replace it:

Old:
```css
.legend-chip {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}
```

New:
```css
.legend-chip {
  width: 28px;
  height: 18px;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-chip-label {
  font-family: var(--mono);
  font-size: 8px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds. (App.tsx will have a type error until Task 8 adds the `activeGroups` prop — fix that now by temporarily adding `activeGroups={[]}` on `<NotesSidebar>` in App.tsx if the build errors.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NotesSidebar.tsx frontend/src/index.css
git commit -m "feat: dynamic legend chips in NotesSidebar from activeGroups with phoneme labels"
```

---

### Task 5: Create `LibraryPanel.tsx` + CSS

**Files:**
- Create: `frontend/src/components/LibraryPanel.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/LibraryPanel.tsx`**

```tsx
import { useState, useEffect } from "react";
import { fetchSavedSearches, deleteSavedSearch, type SavedSearch } from "../api/savedSearches";

const RHYME_SCHEMES = [
  {
    name: "AABB",
    title: "Couplets",
    description: "Each pair of lines rhymes together. Common in nursery rhymes, rap.",
    example: ["Roses are red,", "Violets are blue,", "Sugar is sweet,", "And so are you."],
    labels: ["A", "A", "B", "B"],
  },
  {
    name: "ABAB",
    title: "Alternating",
    description: "Lines 1&3 rhyme, lines 2&4 rhyme. Classic ballad and pop song structure.",
    example: [
      "Shall I compare thee to a summer's day?",
      "Thou art more lovely and more temperate.",
      "Rough winds do shake the darling buds of May,",
      "And summer's lease hath all too short a date.",
    ],
    labels: ["A", "B", "A", "B"],
  },
  {
    name: "ABBA",
    title: "Enclosed / Italian",
    description: "Outer lines rhyme around an inner rhyming pair. Used in sonnets.",
    example: [
      "I hold it true, whate'er befall;",
      "I feel it, when I sorrow most;",
      "'Tis better to have loved and lost",
      "Than never to have loved at all.",
    ],
    labels: ["A", "B", "B", "A"],
  },
  {
    name: "AABA",
    title: "Rubaiyat",
    description: "Three rhyming lines wrap a non-rhyming middle. Persian poetry, some folk.",
    example: [
      "A Book of Verses underneath the Bough,",
      "A Jug of Wine, a Loaf of Bread—and Thou",
      "Beside me singing in the Wilderness—",
      "Oh, Wilderness were Paradise enow!",
    ],
    labels: ["A", "A", "B", "A"],
  },
  {
    name: "ABBA (Sestet)",
    title: "Sestet",
    description: "Six-line stanza where each rhyme recurs once.",
    example: [
      "Amazing grace! How sweet the sound",
      "That saved a wretch like me!",
      "I once was lost, but now am found;",
      "Was blind, but now I see.",
      "Through many dangers, toils and snares,",
      "I have already come.",
    ],
    labels: ["A", "B", "C", "A", "B", "C"],
  },
  {
    name: "Free verse",
    title: "Free Verse",
    description: "No fixed rhyme scheme. Rhythm comes from line breaks, repetition, cadence.",
    example: [
      "I am large, I contain multitudes.",
      "Do I contradict myself?",
      "Very well then I contradict myself.",
      "(I am large, I contain multitudes.)",
    ],
    labels: ["-", "-", "-", "-"],
  },
];

const SCHEME_COLORS: Record<string, string> = {
  A: "#FFE7B0", B: "#D9E8FF", C: "#C9EBD2",
  D: "#E5DCFF", E: "#FFD9EC", "-": "transparent",
};

interface LibraryPanelProps {
  onSearchSelect?: (query: string) => void;
}

export default function LibraryPanel({ onSearchSelect }: LibraryPanelProps) {
  const [tab, setTab] = useState<"reference" | "saved">("reference");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingSearches, setLoadingSearches] = useState(false);

  useEffect(() => {
    if (tab !== "saved") return;
    setLoadingSearches(true);
    fetchSavedSearches()
      .then(setSavedSearches)
      .catch(console.error)
      .finally(() => setLoadingSearches(false));
  }, [tab]);

  async function handleDelete(id: number) {
    await deleteSavedSearch(id).catch(console.error);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <main className="library-pane">
      <div className="library-header">
        <h2 className="library-title">Library</h2>
        <div className="library-tabs">
          <button
            className={`library-tab${tab === "reference" ? " library-tab--active" : ""}`}
            onClick={() => setTab("reference")}
          >Reference</button>
          <button
            className={`library-tab${tab === "saved" ? " library-tab--active" : ""}`}
            onClick={() => setTab("saved")}
          >Saved searches</button>
        </div>
      </div>

      {tab === "reference" && (
        <div className="library-schemes">
          {RHYME_SCHEMES.map((scheme) => (
            <div key={scheme.name} className="scheme-card">
              <div className="scheme-card-head">
                <span className="scheme-badge">{scheme.name}</span>
                <span className="scheme-card-title">{scheme.title}</span>
              </div>
              <p className="scheme-card-desc">{scheme.description}</p>
              <div className="scheme-example">
                {scheme.example.map((line, i) => (
                  <div key={i} className="scheme-example-line">
                    <span
                      className="scheme-example-label"
                      style={{ background: SCHEME_COLORS[scheme.labels[i]] ?? "transparent" }}
                    >
                      {scheme.labels[i]}
                    </span>
                    <span className="scheme-example-text">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "saved" && (
        <div className="library-saved">
          {loadingSearches && <div className="library-empty">Loading…</div>}
          {!loadingSearches && savedSearches.length === 0 && (
            <div className="library-empty">
              No saved searches yet. Use the ♡ Save button in the Rhyme Dictionary.
            </div>
          )}
          {!loadingSearches && savedSearches.map((s) => (
            <div key={s.id} className="saved-search-item">
              <button
                className="saved-search-query"
                onClick={() => onSearchSelect?.(s.query)}
                title="Search this in the Rhyme Dictionary"
              >
                {s.query}
              </button>
              <span className="saved-search-date">
                {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button
                className="saved-search-delete"
                onClick={() => handleDelete(s.id)}
                aria-label="Delete saved search"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add Library CSS** — append to `frontend/src/index.css`:

```css
/* ─── Library panel ─── */
.library-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  height: 100%;
}

.library-header {
  padding: 24px 36px 0;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}

.library-title {
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 16px;
}

.library-tabs {
  display: flex;
  gap: 4px;
}

.library-tab {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ink-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: -1px;
}
.library-tab:hover { color: var(--ink-2); }
.library-tab--active { color: var(--ink); border-bottom-color: var(--ink); font-weight: 500; }

.library-schemes {
  flex: 1;
  overflow-y: auto;
  padding: 20px 36px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scheme-card {
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 14px 16px;
}

.scheme-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.scheme-badge {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-deep);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: 2px 7px;
  color: var(--ink-2);
  letter-spacing: 0.05em;
}

.scheme-card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}

.scheme-card-desc {
  font-size: 12.5px;
  color: var(--ink-3);
  margin: 0 0 10px;
  line-height: 1.5;
}

.scheme-example {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.scheme-example-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.scheme-example-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--ink-2);
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
}

.scheme-example-text {
  font-family: var(--serif);
  font-style: italic;
  font-size: 13.5px;
  color: var(--ink-3);
}

.library-saved {
  flex: 1;
  overflow-y: auto;
  padding: 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.library-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-4);
}

.saved-search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
}

.saved-search-query {
  flex: 1;
  background: none;
  border: none;
  font-family: var(--serif);
  font-size: 15px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  padding: 0;
}
.saved-search-query:hover { color: var(--accent); }

.saved-search-date {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-4);
  flex-shrink: 0;
}

.saved-search-delete {
  background: none;
  border: none;
  color: var(--ink-4);
  font-size: 15px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.saved-search-delete:hover { color: var(--accent); }
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LibraryPanel.tsx frontend/src/index.css
git commit -m "feat: LibraryPanel with Reference rhyme schemes and Saved searches"
```

---

### Task 6: Create `VoicePanel.tsx` + CSS

**Files:**
- Create: `frontend/src/components/VoicePanel.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/VoicePanel.tsx`**

```tsx
import { useState, useEffect, useRef } from "react";

interface VoicePanelProps {
  onTextReady: (text: string) => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }
}

const SpeechRecognitionClass =
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export default function VoicePanel({ onTextReady }: VoicePanelProps) {
  const [supported] = useState(() => SpeechRecognitionClass !== null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function startListening() {
    if (!SpeechRecognitionClass) return;
    setError(null);
    setFinalLines([]);
    setInterimText("");

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setFinalLines((prev) => [...prev, result[0].transcript.trim()]);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setError("Microphone error. Check browser permissions.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function handleInsert() {
    const text = [...finalLines, interimText].filter(Boolean).join("\n");
    if (text.trim()) onTextReady(text.trim());
  }

  if (!supported) {
    return (
      <main className="voice-pane">
        <div className="voice-unsupported">
          <p>Voice input is not supported in this browser.</p>
          <p>Use <strong>Chrome</strong> or <strong>Edge</strong> for Web Speech API support.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="voice-pane">
      <div className="voice-header">
        <h2 className="library-title">Voice Input</h2>
        <p className="voice-subtitle">Speak your lyrics — transcribed below. Chrome/Edge only.</p>
      </div>

      <div className="voice-controls">
        {!listening ? (
          <button className="voice-record-btn" onClick={startListening}>
            ● Start recording
          </button>
        ) : (
          <button className="voice-record-btn voice-record-btn--active" onClick={stopListening}>
            ■ Stop recording
          </button>
        )}
        {(finalLines.length > 0 || interimText) && (
          <button className="voice-insert-btn" onClick={handleInsert}>
            ↩ Insert into note
          </button>
        )}
      </div>

      {error && <p className="voice-error">{error}</p>}

      <div className="voice-transcript">
        {finalLines.map((line, i) => (
          <div key={i} className="voice-line voice-line--final">{line}</div>
        ))}
        {interimText && (
          <div className="voice-line voice-line--interim">{interimText}</div>
        )}
        {!listening && finalLines.length === 0 && !interimText && (
          <div className="voice-placeholder">Transcription will appear here…</div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add Voice CSS** — append to `index.css`:

```css
/* ─── Voice panel ─── */
.voice-pane {
  display: flex;
  flex-direction: column;
  padding: 24px 36px;
  overflow: hidden;
  background: var(--bg);
  height: 100%;
  gap: 20px;
}

.voice-header { flex-shrink: 0; }

.voice-subtitle {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0;
}

.voice-controls {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.voice-record-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid var(--ink);
  border-radius: var(--r-md);
  background: none;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.15s;
}
.voice-record-btn:hover { background: var(--bg-soft); }
.voice-record-btn--active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.voice-insert-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid var(--accent-2);
  border-radius: var(--r-md);
  background: none;
  color: var(--accent-2);
  cursor: pointer;
  transition: all 0.15s;
}
.voice-insert-btn:hover { background: var(--bg-soft); }

.voice-error {
  color: var(--accent);
  font-size: 13px;
  margin: 0;
}

.voice-transcript {
  flex: 1;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 200px;
}

.voice-line {
  font-family: var(--serif);
  font-size: 19px;
  line-height: 1.6;
  color: var(--ink);
}
.voice-line--interim { color: var(--ink-4); font-style: italic; }

.voice-placeholder {
  font-size: 13px;
  color: var(--ink-4);
  font-style: italic;
  align-self: center;
  margin: auto;
}

.voice-unsupported {
  padding: 40px;
  text-align: center;
  color: var(--ink-3);
  font-size: 14px;
  line-height: 1.8;
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/VoicePanel.tsx frontend/src/index.css
git commit -m "feat: VoicePanel with Web Speech API (Chrome/Edge) transcription"
```

---

### Task 7: Create `Scratchpad.tsx` + CSS

**Files:**
- Create: `frontend/src/components/Scratchpad.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/Scratchpad.tsx`**

```tsx
import { useState, useRef, useCallback } from "react";

interface ScratchpadProps {
  words: string[];
  onRemove: (word: string) => void;
  onClose: () => void;
  onInsert: (word: string) => void;
}

export default function Scratchpad({ words, onRemove, onClose, onInsert }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - 320, y: 120 });
  const [minimized, setMinimized] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

      function onMove(ev: MouseEvent) {
        if (!dragStart.current) return;
        setPos({
          x: dragStart.current.px + (ev.clientX - dragStart.current.mx),
          y: dragStart.current.py + (ev.clientY - dragStart.current.my),
        });
      }

      function onUp() {
        dragStart.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pos]
  );

  return (
    <div
      className="scratchpad"
      style={{ left: pos.x, top: pos.y, height: minimized ? "auto" : 300 }}
    >
      <div className="scratchpad-header" onMouseDown={onMouseDown}>
        <span className="scratchpad-title">Scratchpad ({words.length})</span>
        <div className="scratchpad-controls">
          <button onClick={() => setMinimized((m) => !m)} aria-label="Minimize">
            {minimized ? "□" : "—"}
          </button>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      {!minimized && (
        <div className="scratchpad-body">
          {words.length === 0 && (
            <div className="scratchpad-empty">
              Pin words from the Rhyme Dictionary to collect them here.
            </div>
          )}
          {words.map((word) => (
            <div key={word} className="scratchpad-item">
              <span
                className="scratchpad-word"
                onClick={() => onInsert(word)}
                title="Click to insert at cursor"
              >
                {word}
              </span>
              <button
                className="scratchpad-remove"
                onClick={() => onRemove(word)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Scratchpad CSS** — append to `index.css`:

```css
/* ─── Scratchpad floating window ─── */
.scratchpad {
  position: fixed;
  z-index: 100;
  width: 260px;
  background: var(--panel);
  border: 1px solid var(--rule-2);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scratchpad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--rule);
  cursor: grab;
  user-select: none;
}
.scratchpad-header:active { cursor: grabbing; }

.scratchpad-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.scratchpad-controls {
  display: flex;
  gap: 4px;
}

.scratchpad-controls button {
  background: none;
  border: none;
  color: var(--ink-4);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 3px;
}
.scratchpad-controls button:hover { color: var(--ink-2); background: var(--bg-soft); }

.scratchpad-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
}

.scratchpad-empty {
  width: 100%;
  padding: 20px 8px;
  text-align: center;
  font-size: 11.5px;
  color: var(--ink-4);
  line-height: 1.5;
}

.scratchpad-item {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-soft);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: 3px 6px 3px 8px;
}

.scratchpad-word {
  font-family: var(--serif);
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}
.scratchpad-word:hover { color: var(--accent); }

.scratchpad-remove {
  background: none;
  border: none;
  color: var(--ink-4);
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.scratchpad-remove:hover { color: var(--accent); }
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Scratchpad.tsx frontend/src/index.css
git commit -m "feat: draggable floating Scratchpad component"
```

---

### Task 8: Update `index.css` — responsive styles

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Remove `min-width: 1200px` from `.app`**

Find in `index.css`:
```css
.app {
  display: grid;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  min-width: 1200px;
  overflow: hidden;
}
```

Replace with:
```css
.app {
  display: grid;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  overflow: hidden;
}
```

- [ ] **Step 2: Add responsive media query breakpoint** — append to end of `index.css`:

```css
/* ─── Responsive: narrow viewport ─── */
@media (max-width: 899px) {
  .app { overflow-x: hidden; }
  .layout { overflow-x: hidden; }
}

/* ─── Rhyme panel collapsed state ─── */
.rhyme-panel-collapsed {
  background: var(--panel);
  border-left: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: remove min-width from .app, add responsive breakpoint"
```

---

### Task 9: Rewrite `App.tsx` — all Wave 3 wiring

This task replaces the full content of `App.tsx`. Read the current file first, then apply all changes in one pass to avoid conflicts between sub-steps.

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with the fully-wired version**

```tsx
import { useState, useEffect, useRef } from "react";
import LyricEditor, { type LyricEditorHandle } from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import RhymeDictionary from "./components/RhymeDictionary";
import LibraryPanel from "./components/LibraryPanel";
import VoicePanel from "./components/VoicePanel";
import Scratchpad from "./components/Scratchpad";
import { useAutoSave } from "./hooks/useAutoSave";
import { fetchNotes, createNote, deleteNote, searchNotes } from "./api/notes";
import type { Note } from "./types/note";
import type { ActiveGroup } from "./api/syllables";

export default function App() {
  // ── Notes state ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const { saveStatus, setLastSaved } = useAutoSave(activeNoteId, activeTitle, activeContent);

  // ── Theme: 3-state light / dark / auto ──
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("auto");
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const isDark = themeMode === "dark" || (themeMode === "auto" && systemDark);

  // ── Layout state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rhymePanelOpen, setRhymePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"write" | "library" | "voice">("write");

  // ── Rhyme query + auto mode ──
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // ── Active rhyme groups (emitted by LyricEditor after each analysis) ──
  const [activeGroups, setActiveGroups] = useState<ActiveGroup[]>([]);
  const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);

  // ── Scratchpad ──
  const [scratchpadWords, setScratchpadWords] = useState<string[]>([]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  // ── Editor ref (for insertAtCursor from Scratchpad) ──
  const editorRef = useRef<LyricEditorHandle>(null);

  // ── Layout ref (for responsive ResizeObserver) ──
  const layoutRef = useRef<HTMLDivElement>(null);

  // ── Effects ──

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const el = layoutRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width < 900) {
        setSidebarOpen(false);
        setRhymePanelOpen(false);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetchNotes()
      .then((loaded) => {
        setNotes(loaded);
        if (loaded.length > 0) {
          const first = loaded[0];
          setActiveNoteId(first.id);
          setActiveTitle(first.title);
          setActiveContent(first.content);
          setLastSaved(first.title, first.content);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sidebarSearch.trim()) {
        searchNotes(sidebarSearch).then(setNotes).catch(console.error);
      } else {
        fetchNotes().then(setNotes).catch(console.error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearch]);

  // ── Handlers ──

  function handleSelectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
  }

  async function handleNewNote() {
    try {
      const note = await createNote("", "");
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setActiveTitle(note.title);
      setActiveContent(note.content);
      setLastSaved(note.title, note.content);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteNote(id: number) {
    try {
      await deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id) {
        if (remaining.length > 0) {
          handleSelectNote(remaining[0].id);
        } else {
          setActiveNoteId(null);
          setActiveTitle("");
          setActiveContent("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleTitleChange(title: string) {
    setActiveTitle(title);
    if (activeNoteId !== null) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title } : n))
      );
    }
  }

  function handleColorGroupToggle(index: number) {
    setActiveColorGroups((prev) => {
      if (prev === null) return new Set([index]);
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        return next.size === 0 ? null : next;
      }
      next.add(index);
      return next;
    });
  }

  function addToScratchpad(word: string) {
    setScratchpadWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setScratchpadOpen(true);
  }

  const lineCount = activeContent
    ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
    : 0;

  const themeIcon =
    themeMode === "dark" ? "☀" : themeMode === "light" ? "🖥" : "◑";

  // Grid columns: sidebar | editor | rhyme panel (only in write tab)
  const col3 =
    activeTab === "write" && rhymePanelOpen
      ? "360px"
      : activeTab === "write"
      ? "0"
      : "0";
  const gridCols = `${sidebarOpen ? "280px" : "48px"} 1fr ${col3}`;

  return (
    <div className={`app${isDark ? " theme-dark" : ""}`}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="wordmark">Rhymathic</span>
        </div>

        <nav className="topbar-nav">
          <button
            className={`topbar-tab${activeTab === "write" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("write")}
          >Write</button>
          <button
            className={`topbar-tab${activeTab === "library" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("library")}
          >Library</button>
          <button
            className={`topbar-tab${activeTab === "voice" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >Voice</button>
        </nav>

        <div className="topbar-controls">
          {activeTab === "write" && !rhymePanelOpen && (
            <button
              className="theme-toggle"
              style={{ width: "auto", borderRadius: "var(--r-sm)", padding: "0 8px", fontSize: 11 }}
              onClick={() => setRhymePanelOpen(true)}
              aria-label="Open rhyme panel"
            >
              ⊞ Rhymes
            </button>
          )}
          <div className="save-pill">
            {saveStatus === "saving" && (
              <><span className="save-dot saving" />Saving…</>
            )}
            {saveStatus === "saved" && (
              <><span className="save-dot saved" />Saved</>
            )}
            {saveStatus === "error" && (
              <><span className="save-dot error" />Save failed</>
            )}
          </div>
          <button
            className="theme-toggle"
            onClick={() =>
              setThemeMode((m) =>
                m === "light" ? "dark" : m === "dark" ? "auto" : "light"
              )
            }
            title={`Theme: ${themeMode} — click to cycle`}
            aria-label="Cycle theme"
          >
            {themeIcon}
          </button>
        </div>
      </header>

      {/* ── Three-column layout ── */}
      <div
        className="layout"
        ref={layoutRef}
        style={{ gridTemplateColumns: gridCols }}
      >
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
          activeColorGroups={activeColorGroups}
          onColorGroupToggle={handleColorGroupToggle}
          activeGroups={activeGroups}
        />

        <main className="editor-pane">
          {activeTab === "write" && (
            <>
              {activeNoteId === null ? (
                <div className="editor-empty">Select a note or create a new one</div>
              ) : (
                <>
                  <div className="editor-header">
                    <input
                      className="lyric-title"
                      placeholder="Untitled"
                      value={activeTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                    />
                    <div className="editor-meta">
                      draft · {lineCount} {lineCount === 1 ? "line" : "lines"}
                    </div>
                  </div>
                  <LyricEditor
                    ref={editorRef}
                    content={activeContent}
                    onContentChange={setActiveContent}
                    onSelectionChange={(q) => { if (!autoMode) setRhymeQuery(q); }}
                    onCursorChange={(q) => { if (autoMode) setRhymeQuery(q); }}
                    isDarkTheme={isDark}
                    activeColorGroups={activeColorGroups}
                    onGroupsChange={setActiveGroups}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "library" && (
            <LibraryPanel
              onSearchSelect={(q) => {
                setRhymeQuery(q);
                setActiveTab("write");
                setRhymePanelOpen(true);
              }}
            />
          )}

          {activeTab === "voice" && (
            <VoicePanel
              onTextReady={(text) => {
                setActiveContent((c) =>
                  c + (c.endsWith("\n") || c === "" ? "" : "\n") + text
                );
                setActiveTab("write");
              }}
            />
          )}
        </main>

        {activeTab === "write" && rhymePanelOpen && (
          <RhymeDictionary
            query={rhymeQuery}
            onQueryChange={setRhymeQuery}
            autoMode={autoMode}
            onAutoModeToggle={() => setAutoMode((o) => !o)}
            onCollapse={() => setRhymePanelOpen(false)}
            onPin={(word) => addToScratchpad(word)}
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <footer className="status-bar">
        <span>en-US · CMU + pyphen · Auto-save 1s</span>
        <span>build 2026.05</span>
      </footer>

      {/* ── Scratchpad overlay ── */}
      {scratchpadOpen && (
        <Scratchpad
          words={scratchpadWords}
          onRemove={(word) =>
            setScratchpadWords((prev) => prev.filter((w) => w !== word))
          }
          onClose={() => setScratchpadOpen(false)}
          onInsert={(word) => {
            editorRef.current?.insertAtCursor(word);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

```bash
cd frontend && npm run build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire Wave 3 — activeGroups, 3-way theme, Library/Voice tabs, responsive collapse, Scratchpad"
```

---

### Task 10: Manual verification

**Files:** None — this is a verification-only task.

- [ ] **Step 1: Start the dev stack**

```bash
cd frontend && npm run dev
# In a separate terminal:
cd backend && uvicorn main:app --reload
```

Navigate to `http://localhost:5173`.

- [ ] **Step 2: Verify 3-way theme**

1. App loads — if OS is dark-mode, app should already be dark (auto mode, ◑ icon).
2. Click ◑ → switches to light mode (🖥 icon).
3. Click 🖥 → switches to dark mode (☀ icon).
4. Click ☀ → back to auto (◑ icon).

- [ ] **Step 3: Verify dynamic legend chips**

1. Type lyrics with rhymes (e.g., "cat / bat / hat").
2. After ~400ms, colored chips appear in the sidebar legend with phoneme key labels (e.g., "AE").
3. Clicking a chip dims unrelated highlights. Clicking again restores.
4. Clear the editor — chips disappear.

- [ ] **Step 4: Verify Library tab**

1. Click Library in the topbar — editor pane replaces with the Library panel.
2. Reference sub-tab shows 6 rhyme scheme cards with color-coded example stanzas.
3. Click "Saved searches" sub-tab — shows saved searches or "No saved searches yet".
4. Save a search from the Rhyme Dictionary, re-open Library → it appears.
5. Click a saved search → navigates back to Write tab with the query filled in.

- [ ] **Step 5: Verify Voice tab**

1. Click Voice in the topbar → Voice panel appears.
2. In Chrome/Edge: click "Start recording", speak, text appears.
3. Click "Insert into note" → text appended to current note, view returns to Write tab.
4. In Firefox: unsupported warning shown.

- [ ] **Step 6: Verify right panel collapse**

1. Click → (collapse) in the rhyme panel header — panel disappears, grid column becomes 0.
2. "⊞ Rhymes" button appears in topbar controls.
3. Click "⊞ Rhymes" → panel reopens.

- [ ] **Step 7: Verify Scratchpad**

1. Search for a word in the rhyme dictionary.
2. Hover over a result chip — pin (+) button appears.
3. Click pin → Scratchpad floating window opens.
4. Pin several words — all appear in the scratchpad (no duplicates).
5. Place cursor in the editor, click a word in the scratchpad → it inserts at the cursor.
6. Drag the scratchpad header — window moves freely.
7. Click "—" → minimizes. Click again → expands.
8. Click "×" on a word → removes it. Click header "×" → closes scratchpad.

- [ ] **Step 8: Verify responsive behavior**

1. Narrow the browser window to under 900px (DevTools responsive mode).
2. Both sidebars auto-close.
3. No horizontal scrollbar.

- [ ] **Step 9: Final commit (if any stray fixes)**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: wave 3 manual verification fixes"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| `onGroupsChange` from LyricEditor → `activeGroups` in App | Task 3 (LyricEditor), Task 9 (App) |
| Dynamic chips in NotesSidebar per active group, phoneme key label, phonemeColors.ts | Tasks 1, 2, 4 |
| Auto theme 3-state light/dark/auto with matchMedia listener | Task 9 |
| Theme button icons ☀/◑/🖥 | Task 9 |
| Library tab: Reference schemes + Saved searches | Tasks 5, 9 |
| Voice tab: SpeechRecognition, mic button, transcription, insert, browser warning | Tasks 6, 9 |
| Responsive: remove min-width, ResizeObserver < 900px closes both sidebars | Tasks 8, 9 |
| Media query CSS backup | Task 8 |
| Right panel collapse with 0-width grid + reopen in topbar | Task 9 |
| Scratchpad: `scratchpadWords: string[]`, `scratchpadOpen`, `onPin`, `onInsert` via `editorRef.current.insertAtCursor` | Tasks 7, 3 (LyricEditorHandle), 9 |

### Placeholder scan

No TBD/TODO/placeholder values. Every step has full code.

### Type consistency

- `LyricEditorHandle.insertAtCursor` defined in Task 3, used in Task 9 (`editorRef.current?.insertAtCursor(word)`) ✓
- `ActiveGroup` defined in Task 2 (`syllables.ts`), imported in Tasks 3 and 9 ✓
- `onGroupsChange: (groups: ActiveGroup[]) => void` added to `LyricEditorProps` in Task 3, wired in Task 9 ✓
- `activeGroups: ActiveGroup[]` added to `NotesSidebarProps` in Task 4, passed in Task 9 ✓
- `RHYME_COLORS`, `RHYME_COLORS_SLANT` from `phonemeColors.ts` imported in Tasks 1 and 4 ✓
- `Scratchpad` receives `words: string[]` (not `ScratchpadItem[]`) defined in Task 7, consumed in Task 9 ✓
- `VoicePanel` (not `VoiceInput`) — named consistently in Tasks 6 and 9 ✓
