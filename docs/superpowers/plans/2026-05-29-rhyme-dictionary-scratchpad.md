# RhymeDictionary + Scratchpad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the rhyme results scroll bug, add save-button feedback, and build a draggable floating Scratchpad component.

**Architecture:** Three independent changes share a single CSS file (`index.css`) for styling. `RhymeDictionary.tsx` gets a CSS fix and save-button state. `Scratchpad.tsx` is a new self-contained component that accepts all data and callbacks as props — App wires it up but is not modified in this plan.

**Tech Stack:** React 18, TypeScript strict, Tailwind-free (hand-written CSS in `frontend/src/index.css`), no test runner.

---

### Task 1: Fix `.rhyme-results` scroll (CSS)

**Files:**
- Modify: `frontend/src/index.css` (`.rhyme-results` rule, around line 787)

The `.rhyme-results` div has `flex: 1; overflow-y: auto` but no `min-height: 0`. In a flex column, flex children default to `min-height: auto`, which prevents the container from shrinking below its content height and breaks scroll.

- [ ] **Step 1: Add `min-height: 0` to `.rhyme-results`**

Open `frontend/src/index.css`. Find the `.rhyme-results` rule (currently lines 787–792):

```css
.rhyme-results {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

Change it to:

```css
.rhyme-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: Verify manually**

Start the dev server (`npm run dev` from `frontend/`). Open the rhyme panel with enough results to overflow. Confirm the list scrolls instead of pushing other elements out of view.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix: add min-height: 0 to .rhyme-results to restore scroll"
```

---

### Task 2: Save button feedback in RhymeDictionary

**Files:**
- Modify: `frontend/src/components/RhymeDictionary.tsx`

The current save handler swallows errors silently:
```tsx
} catch {
  // silently ignore — user will see no feedback; Wave 3 adds toast
}
```

Replace with a `saved` state (`null | "saved" | "error"`) that shows "✓ Saved" or "Failed" for 2 seconds then resets.

- [ ] **Step 1: Add `saved` state and update the save handler**

In `RhymeDictionary.tsx`, inside the `RhymeDictionary` component (after line 139 where other state is declared), add:

```tsx
const [saved, setSaved] = useState<null | "saved" | "error">(null);
const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Replace the save button's `onClick` (currently lines 219–229):

```tsx
onClick={async () => {
  try {
    await createSavedSearch(query.trim());
    setSaved("saved");
  } catch {
    setSaved("error");
  } finally {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(null), 2000);
  }
}}
```

- [ ] **Step 2: Update save button label**

Replace the button's text content (currently `♡ Save`) so it reflects state:

```tsx
{saved === "saved" ? "✓ Saved" : saved === "error" ? "Failed" : "♡ Save"}
```

The full button becomes:

```tsx
{query.trim() && (
  <button
    className="rhyme-save-btn"
    onClick={async () => {
      try {
        await createSavedSearch(query.trim());
        setSaved("saved");
      } catch {
        setSaved("error");
      } finally {
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaved(null), 2000);
      }
    }}
    title="Save this search to Library"
  >
    {saved === "saved" ? "✓ Saved" : saved === "error" ? "Failed" : "♡ Save"}
  </button>
)}
```

- [ ] **Step 3: Clean up timer on unmount**

Add a `useEffect` cleanup alongside the other effects in the component:

```tsx
useEffect(() => {
  return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
}, []);
```

- [ ] **Step 4: Add CSS for the error state**

In `frontend/src/index.css`, find `.rhyme-save-btn` (around line 949) and add a modifier after it:

```css
.rhyme-save-btn--error {
  color: var(--accent);
  border-color: var(--accent);
}
```

Then apply it conditionally on the button in `RhymeDictionary.tsx`:

```tsx
className={`rhyme-save-btn${saved === "error" ? " rhyme-save-btn--error" : ""}`}
```

- [ ] **Step 5: Verify manually**

In the dev server, type a query, click "♡ Save". Confirm the button shows "✓ Saved" for ~2 s then reverts. To test the error path, temporarily make `createSavedSearch` throw (e.g. comment out the call and `throw new Error("test")`), confirm "Failed" appears in the button for 2 s.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RhymeDictionary.tsx frontend/src/index.css
git commit -m "feat: show save button feedback (Saved / Failed) for 2 s"
```

---

### Task 3: Scratchpad component

**Files:**
- Create: `frontend/src/components/Scratchpad.tsx`
- Modify: `frontend/src/index.css` (add `.scratchpad-*` rules)

The Scratchpad is a floating draggable panel. Drag is implemented with `mousedown` on the header, then `mousemove`/`mouseup` on `window`. Position is stored in component state as `{ x, y }`, initialized to a reasonable default (e.g. 80px from right, 120px from top). The component receives:

```tsx
interface ScratchpadProps {
  words: string[];
  onInsert: (word: string) => void;
  onClose: () => void;
  onRemove: (word: string) => void;
}
```

`onInsert` is called when the user clicks a chip — **what happens next is App's responsibility**, not Scratchpad's.

- [ ] **Step 1: Create `Scratchpad.tsx`**

Create `frontend/src/components/Scratchpad.tsx`:

```tsx
import { useState, useEffect, useRef } from "react";

interface ScratchpadProps {
  words: string[];
  onInsert: (word: string) => void;
  onClose: () => void;
  onRemove: (word: string) => void;
}

export default function Scratchpad({ words, onInsert, onClose, onRemove }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - 280, y: 120 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy });
    }
    function onMouseUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleHeaderMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
  }

  return (
    <div
      className="scratchpad-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="scratchpad-header"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="scratchpad-title">Scratchpad</span>
        <button className="scratchpad-close" onClick={onClose} aria-label="Close scratchpad">×</button>
      </div>
      <div className="scratchpad-body">
        {words.length === 0 && (
          <div className="scratchpad-empty">Pin words from the rhyme panel</div>
        )}
        {words.map((word) => (
          <span key={word} className="scratchpad-chip-wrap">
            <button
              className="scratchpad-chip"
              onClick={() => onInsert(word)}
              title="Insert into editor"
            >
              {word}
            </button>
            <button
              className="scratchpad-chip-remove"
              onClick={() => onRemove(word)}
              aria-label={`Remove ${word}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `.scratchpad-*` CSS**

In `frontend/src/index.css`, append after the last `.rhyme-*` rule (around line 1006 or the end of the rhyme block):

```css
/* ── Scratchpad ─────────────────────────────── */

.scratchpad-panel {
  position: fixed;
  z-index: 200;
  width: 240px;
  background: var(--bg-soft);
  border: 1px solid var(--rule-2);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.scratchpad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid var(--rule-2);
}

.scratchpad-header:active { cursor: grabbing; }

.scratchpad-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.scratchpad-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-4);
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.scratchpad-close:hover { color: var(--ink-2); }

.scratchpad-body {
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 48px;
}

.scratchpad-empty {
  font-size: 11px;
  color: var(--ink-4);
  width: 100%;
  text-align: center;
  padding: 8px 0;
}

.scratchpad-chip-wrap {
  display: inline-flex;
  align-items: center;
  background: var(--bg-deep);
  border-radius: 4px;
  overflow: hidden;
}

.scratchpad-chip {
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px 6px;
  font-size: 12px;
  color: var(--ink-2);
  font-family: var(--mono);
}

.scratchpad-chip:hover { background: var(--bg-soft); }

.scratchpad-chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 3px 5px 3px 2px;
  font-size: 13px;
  color: var(--ink-4);
  line-height: 1;
}

.scratchpad-chip-remove:hover { color: var(--accent); }
```

- [ ] **Step 3: Verify the component renders**

In `App.tsx` (temporarily, for manual testing only — revert afterward), import and render `<Scratchpad>` with hardcoded props:

```tsx
import Scratchpad from "./components/Scratchpad";
// inside JSX, anywhere visible:
<Scratchpad
  words={["flight", "night", "delight"]}
  onInsert={(w) => console.log("insert", w)}
  onClose={() => console.log("close")}
  onRemove={(w) => console.log("remove", w)}
/>
```

Check: panel appears at top-right, header drag moves the panel, chip click logs "insert word", × on chip logs "remove word", close button logs "close". Then revert the temporary import.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Scratchpad.tsx frontend/src/index.css
git commit -m "feat: add draggable floating Scratchpad component"
```
