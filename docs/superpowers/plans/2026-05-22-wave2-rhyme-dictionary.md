# Wave 2 – RhymeDictionary: Datamuse Modes, Save, Collapse, Pin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the RhymeDictionary panel with Datamuse-powered search modes (slant, synonyms, antonyms, etc.), a save-to-library button, a right-panel collapse toggle, and a pin-to-scratchpad button on each rhyme result.

**Architecture:** All changes are in `RhymeDictionary.tsx`, `api/rhymes.ts`, and a new `api/savedSearches.ts`. The collapse toggle state lives in `App.tsx` (Wave 3 handles that wiring); this plan adds the `onCollapse` prop and renders the button. The scratchpad pin button emits an `onPin(word)` callback that `App.tsx` (Wave 3) will consume.

**Tech Stack:** React 18, TypeScript strict

**Pre-requisite:** Wave 1 backend plan must be merged — the `mode` parameter on `/api/rhymes` and the `/api/saved-searches` endpoints must exist.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/api/rhymes.ts` | Add `mode` parameter to `fetchRhymes` |
| `frontend/src/api/savedSearches.ts` | New file — CRUD for saved searches |
| `frontend/src/components/RhymeDictionary.tsx` | Mode tabs/dropdown, save button, collapse toggle, pin button |

---

### Task 1: Update `api/rhymes.ts` to support mode

**Files:**
- Modify: `frontend/src/api/rhymes.ts`

- [ ] **Step 1: Update `fetchRhymes` signature** to accept an optional mode:

Read the current `frontend/src/api/rhymes.ts` and replace the `fetchRhymes` function:

```ts
export async function fetchRhymes(query: string, mode = "perfect"): Promise<RhymeResponse> {
  const response = await fetch(`${API_URL}/api/rhymes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, mode }),
  });
  if (!response.ok) throw new Error(`Rhymes API error: ${response.status}`);
  return response.json() as Promise<RhymeResponse>;
}
```

- [ ] **Step 2: Add the mode constant list** at the top of the file (after the interface definitions):

```ts
export const RHYME_MODES = [
  { value: "perfect",     label: "Perfect rhymes" },
  { value: "slant",       label: "Near / slant rhymes" },
  { value: "synonyms",    label: "Synonyms" },
  { value: "antonyms",    label: "Antonyms" },
  { value: "descriptive", label: "Descriptive words" },
  { value: "related",     label: "Related words" },
  { value: "soundslike",  label: "Sounds like" },
  { value: "homophones",  label: "Homophones" },
  { value: "consonants",  label: "Consonant match" },
  { value: "phrases",     label: "Phrases / triggers" },
] as const;

export type RhymeMode = typeof RHYME_MODES[number]["value"];
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build 2>&1 | grep -i error | head -20
```

Expected: no errors in `rhymes.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/rhymes.ts
git commit -m "feat: add mode parameter and RHYME_MODES list to fetchRhymes"
```

---

### Task 2: Create `api/savedSearches.ts`

**Files:**
- Create: `frontend/src/api/savedSearches.ts`

- [ ] **Step 1: Create the file**

```ts
const API_URL = import.meta.env.VITE_API_URL as string;

export interface SavedSearch {
  id: number;
  query: string;
  created_at: string;
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const response = await fetch(`${API_URL}/api/saved-searches`);
  if (!response.ok) throw new Error(`Saved searches error: ${response.status}`);
  return response.json() as Promise<SavedSearch[]>;
}

export async function createSavedSearch(query: string): Promise<SavedSearch> {
  const response = await fetch(`${API_URL}/api/saved-searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Create saved search error: ${response.status}`);
  return response.json() as Promise<SavedSearch>;
}

export async function deleteSavedSearch(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/saved-searches/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete saved search error: ${response.status}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/savedSearches.ts
git commit -m "feat: add savedSearches API client"
```

---

### Task 3: Add rhyme mode selector to RhymeDictionary

**Files:**
- Modify: `frontend/src/components/RhymeDictionary.tsx`

- [ ] **Step 1: Add imports at the top of `RhymeDictionary.tsx`**

Add these to the existing import:

```ts
import { fetchRhymes, type RhymeSection, RHYME_MODES, type RhymeMode } from "../api/rhymes";
import { createSavedSearch } from "../api/savedSearches";
```

- [ ] **Step 2: Add `rhymeMode` state** inside the component, after the existing state declarations:

```ts
const [rhymeMode, setRhymeMode] = useState<RhymeMode>("perfect");
```

- [ ] **Step 3: Update the `useEffect` to pass `rhymeMode` to `fetchRhymes`**

Find the debounced fetch effect (around line 112–133) and update the `fetchRhymes` call:

```ts
        const result = await fetchRhymes(query, rhymeMode);
```

Add `rhymeMode` to the dependency array:

```ts
  }, [query, rhymeMode]);
```

- [ ] **Step 4: Replace the tabs section** in the JSX (around line 166–174):

Replace:
```tsx
      {/* ── Tabs ── */}
      <div className="rhyme-tabs">
        <button className="rhyme-tab rhyme-tab--active">
          Perfect{sections.length > 0 ? ` (${sections.length})` : ""}
        </button>
        {/* TODO: Slant rhymes tab — no backend slant matching */}
        <button className="rhyme-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Slant</button>
        {/* TODO: Multi-syllable rhymes tab — no backend multi matching */}
        <button className="rhyme-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Multi</button>
      </div>
```

With:

```tsx
      {/* ── Mode selector ── */}
      <div className="rhyme-mode-row">
        <select
          className="rhyme-mode-select"
          value={rhymeMode}
          onChange={(e) => setRhymeMode(e.target.value as RhymeMode)}
        >
          {RHYME_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {query.trim() && (
          <button
            className="rhyme-save-btn"
            onClick={async () => {
              try {
                await createSavedSearch(query.trim());
              } catch {
                // silently ignore — user will see no feedback; Wave 3 adds toast
              }
            }}
            title="Save this search to Library"
          >
            ♡ Save
          </button>
        )}
      </div>
```

- [ ] **Step 5: Add CSS for the new mode row** in `index.css` — place it after `.rhyme-tabs` styles. Search for `.rhyme-tabs` (around line 700+):

```css
.rhyme-mode-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}

.rhyme-mode-select {
  flex: 1;
  background: var(--bg-soft);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  color: var(--ink-2);
  font-family: var(--sans);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  outline: none;
}
.rhyme-mode-select:focus { border-color: var(--ink-4); }

.rhyme-save-btn {
  padding: 4px 10px;
  font-size: 11.5px;
  color: var(--ink-3);
  background: none;
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.rhyme-save-btn:hover { color: var(--accent); border-color: var(--accent); }
```

- [ ] **Step 6: Verify mode switching works**

1. Search for a word (e.g. "happy")
2. Change the dropdown to "Synonyms" — results should update to synonyms
3. Change to "Near / slant rhymes" — near-rhymes should appear
4. "Save" button appears when query is not empty; clicking it should silently succeed (check Network tab in DevTools: POST to `/api/saved-searches` returns 201)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RhymeDictionary.tsx frontend/src/index.css
git commit -m "feat: rhyme mode dropdown with Datamuse-backed modes and save button"
```

---

### Task 4: Add collapse toggle to RhymeDictionary

**Files:**
- Modify: `frontend/src/components/RhymeDictionary.tsx`

- [ ] **Step 1: Add `onCollapse` prop to `RhymeDictionaryProps`**

Find the interface at the top of the file:

```ts
interface RhymeDictionaryProps {
  query: string;
  onQueryChange: (q: string) => void;
  autoMode: boolean;
  onAutoModeToggle: () => void;
}
```

Replace with:

```ts
interface RhymeDictionaryProps {
  query: string;
  onQueryChange: (q: string) => void;
  autoMode: boolean;
  onAutoModeToggle: () => void;
  onCollapse?: () => void;
  onPin?: (word: string) => void;
}
```

- [ ] **Step 2: Destructure the new props**

Find:
```ts
export default function RhymeDictionary({
  query,
  onQueryChange,
  autoMode,
  onAutoModeToggle,
}: RhymeDictionaryProps) {
```

Replace with:
```ts
export default function RhymeDictionary({
  query,
  onQueryChange,
  autoMode,
  onAutoModeToggle,
  onCollapse,
  onPin,
}: RhymeDictionaryProps) {
```

- [ ] **Step 3: Add collapse button to the panel header**

Find the `rhyme-panel-head` div (around line 139) and add a collapse button inside `.rhyme-eyebrow`:

Replace:
```tsx
        <div className="rhyme-eyebrow">Rhyme</div>
```

With:
```tsx
        <div className="rhyme-eyebrow-row">
          <div className="rhyme-eyebrow">Rhyme Dictionary</div>
          {onCollapse && (
            <button
              className="rhyme-collapse-btn"
              onClick={onCollapse}
              aria-label="Collapse rhyme panel"
            >
              →
            </button>
          )}
        </div>
```

- [ ] **Step 4: Add CSS for the new header row and button** in `index.css`:

```css
.rhyme-eyebrow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.rhyme-collapse-btn {
  padding: 2px 6px;
  background: none;
  border: none;
  color: var(--ink-4);
  cursor: pointer;
  border-radius: var(--r-sm);
  font-size: 14px;
}
.rhyme-collapse-btn:hover { color: var(--ink-2); background: var(--bg-soft); }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RhymeDictionary.tsx frontend/src/index.css
git commit -m "feat: add collapse button and onPin prop to RhymeDictionary"
```

---

### Task 5: Add "Pin" button to individual rhyme chips

**Files:**
- Modify: `frontend/src/components/RhymeDictionary.tsx`

- [ ] **Step 1: Pass `onPin` into `RhymesSectionPanel`**

Find the `SectionProps` interface (around line 32):
```ts
interface SectionProps {
  section: RhymeSection;
  isOpen: boolean;
  onToggle: () => void;
}
```

Replace with:
```ts
interface SectionProps {
  section: RhymeSection;
  isOpen: boolean;
  onToggle: () => void;
  onPin?: (word: string) => void;
}
```

Update `RhymesSectionPanel` function signature and the `.rhyme-chip` render to show a pin button on hover:

Find the chip render (around line 71):
```tsx
                  <div className="rhyme-chip-grid">
                    {words.map((w) => (
                      <span key={w} className="rhyme-chip">{w}</span>
                    ))}
                  </div>
```

Replace with:
```tsx
                  <div className="rhyme-chip-grid">
                    {words.map((w) => (
                      <span key={w} className="rhyme-chip-wrap">
                        <span className="rhyme-chip">{w}</span>
                        {onPin && (
                          <button
                            className="rhyme-chip-pin"
                            onClick={() => onPin(w)}
                            title="Pin to scratchpad"
                          >
                            +
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
```

Do the same for the `other_rhymes_by_syllables` chip grid below it.

- [ ] **Step 2: Add CSS for chip-wrap and pin button** in `index.css`:

```css
.rhyme-chip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.rhyme-chip-pin {
  display: none;
  position: absolute;
  right: -8px;
  top: -6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--panel);
  font-size: 10px;
  line-height: 1;
  border: none;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.rhyme-chip-wrap:hover .rhyme-chip-pin {
  display: flex;
}
```

- [ ] **Step 3: Pass `onPin` through to `RhymesSectionPanel` call sites**

Find where `RhymesSectionPanel` is rendered (around line 202):
```tsx
        {!loading && sections.map((section, i) => (
          <RhymesSectionPanel
            key={i}
            section={section}
            isOpen={expanded.has(i)}
            onToggle={() => ...}
          />
        ))}
```

Add the `onPin` prop:
```tsx
          <RhymesSectionPanel
            key={i}
            section={section}
            isOpen={expanded.has(i)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
            onPin={onPin}
          />
```

- [ ] **Step 4: Update the panel footer** — replace the disabled "Pin to scratchpad" button:

Find:
```tsx
        <button className="rhyme-pin-btn" disabled>+ Pin to scratchpad</button>
```

Replace with:
```tsx
        <span className="rhyme-meta">Hover a word to pin → scratchpad</span>
```

- [ ] **Step 5: Verify pin button appears on hover**

Search for a word, hover over a result chip — a small "+" button should appear in the top-right corner of the chip. Clicking it should call `onPin` (no-op for now since `App.tsx` wiring is in Wave 3, but no error should appear).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RhymeDictionary.tsx frontend/src/index.css
git commit -m "feat: per-chip pin button wired to onPin callback"
```
