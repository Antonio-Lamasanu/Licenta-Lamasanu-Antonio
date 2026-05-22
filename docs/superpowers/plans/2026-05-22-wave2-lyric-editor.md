# Wave 2 – LyricEditor: Fixes + Views + Slant + Legend Filter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the textarea/mirror offset bug; add dark-mode color palette; add highlight/underline toggle for rhyme display; remove dead toolbar buttons (Meter, Mood, Suggest line); add Phonemes and Stress view modes; add slant rhyme coloring; and add legend chip filtering.

**Architecture:** All changes are in `LyricEditor.tsx` (rendering logic, toolbar, color palettes) and `api/syllables.ts` (TS type additions). New props flow in from `App.tsx` (handled in the Wave 3 plan). This plan wires up all the new props with internal defaults so the component works standalone. `App.tsx` integration is left for Wave 3.

**Tech Stack:** React 18, TypeScript strict, inline styles + CSS custom properties

**Pre-requisite:** Wave 1 backend plan must be merged — the `stress` and `slant_groups` fields must exist in the `/api/analyze` response before this plan runs.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/api/syllables.ts` | Add `stress` to `SyllableInfo`; add `SlantGroup`/`SlantOccurrence` to `AnalyzeResponse` |
| `frontend/src/components/LyricEditor.tsx` | All rendering changes |
| `frontend/src/index.css` | Minor: word-annotation styles for phoneme/stress view |

---

### Task 1: Update TypeScript types in `api/syllables.ts`

**Files:**
- Modify: `frontend/src/api/syllables.ts`

- [ ] **Step 1: Read the current contents of `frontend/src/api/syllables.ts`**

The file currently exports `SyllableInfo`, `SyllableGroup`, `AnalyzeResponse`, and `fetchAnalysis`. We need to:
- Add `stress: number` to `SyllableInfo`
- Add `SlantOccurrence` and `SlantGroup` types
- Add `slant_groups` to `AnalyzeResponse`

- [ ] **Step 2: Update `frontend/src/api/syllables.ts`**

Read the file first, then replace its full contents with:

```ts
const API_URL = import.meta.env.VITE_API_URL as string;

export interface SyllableInfo {
  text: string;
  key: string;    // vowel phoneme e.g. "AH"
  stress: number; // 0=unstressed, 1=primary, 2=secondary
}

export interface SyllableOccurrence {
  line: number;
  word_index: number;
  syllable_index: number;
}

export interface SyllableGroup {
  color_index: number;
  phoneme_key: string;
  occurrences: SyllableOccurrence[];
}

export interface SlantOccurrence {
  line: number;
}

export interface SlantGroup {
  color_index: number;
  vowel_key: string;
  occurrences: SlantOccurrence[];
}

export interface AnalyzeResponse {
  line_counts: number[];
  syllable_data: SyllableInfo[][][];  // [line][word][syllable]
  syllable_groups: SyllableGroup[];
  slant_groups: SlantGroup[];
}

export async function fetchAnalysis(lines: string[]): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!response.ok) throw new Error(`Analyze error: ${response.status}`);
  return response.json() as Promise<AnalyzeResponse>;
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd frontend
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors related to `syllables.ts`. (Other errors from downstream files are OK for now — this plan will fix them.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/syllables.ts
git commit -m "types: add stress field and slant_groups to analyze API types"
```

---

### Task 2: Fix textarea/mirror offset bug

The mirror div uses `position: absolute; inset: 0` but the browser may apply default padding/margin to either the mirror `<div>` or the `<textarea>`. The fix is to explicitly zero out all box-model properties on both elements.

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Audit current CSS for `.lyric-mirror` and `.lyric-textarea`**

In `index.css` (around line 544–564):

```css
.lyric-mirror {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  color: var(--ink);
}

.lyric-textarea {
  position: relative;
  width: 100%;
  background: transparent;
  resize: none;
  outline: none;
  color: transparent;
  caret-color: var(--ink);
  border: none;
  padding: 0;
}
```

- [ ] **Step 2: Update `.lyric-mirror` CSS** to explicitly zero all box-model properties:

```css
.lyric-mirror {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  color: var(--ink);
  padding: 0;
  margin: 0;
  border: none;
  box-sizing: border-box;
}
```

- [ ] **Step 3: Update `.lyric-textarea` CSS** to match:

```css
.lyric-textarea {
  position: relative;
  width: 100%;
  background: transparent;
  resize: none;
  outline: none;
  color: transparent;
  caret-color: var(--ink);
  border: none;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  -webkit-text-fill-color: transparent;
}
```

Note: `-webkit-text-fill-color: transparent` is needed on Safari/Chrome to prevent the selection highlight from showing the text color. This is important for the overlay pattern.

- [ ] **Step 4: Ensure `EDITOR_STYLE` is applied as inline style to both elements**

In `LyricEditor.tsx`, check that the textarea's style uses the spread: `style={{ ...EDITOR_STYLE, color: "transparent", ... }}` — it already does. Verify the mirror div also uses: `style={EDITOR_STYLE}` — it already does.

The key: both must get the exact same `fontFamily`, `fontSize`, `lineHeight`, `letterSpacing`, `wordSpacing`, `tabSize`. The `EDITOR_STYLE` const ensures this.

- [ ] **Step 5: Add `word-spacing` reset to ensure browser defaults don't interfere**

In `EDITOR_STYLE` inside `LyricEditor.tsx`, verify `wordSpacing: "normal"` is present. If it reads:

```ts
const EDITOR_STYLE = {
  fontFamily: "var(--serif)",
  fontSize: "21px",
  lineHeight: "50px",
  whiteSpace: "pre" as const,
  letterSpacing: "-0.005em",
  wordSpacing: "normal",
  tabSize: 4,
};
```

That's correct. No change needed.

- [ ] **Step 6: Verify the fix**

1. Start dev server (`npm run dev`)
2. Open a note, type some text
3. Select a word by clicking and dragging
4. The selection highlight should land exactly on the visible word characters, not offset by any pixels

If still misaligned after this, check the browser DevTools → computed styles on `.lyric-mirror` and `.lyric-textarea`. Both should show identical font-size, line-height, letter-spacing. If any differ, trace which CSS rule is overriding.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix: zero box-model on mirror div to fix textarea/mirror offset"
```

---

### Task 3: Add dark-mode rhyme color palette

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Add `RHYME_COLORS_DARK` constant** right after `RHYME_COLORS` (around line 18):

```ts
// Darker, less saturated palette for dark theme — same hues, lower brightness
const RHYME_COLORS_DARK: { bg: string; ink: string }[] = [
  { bg: "#5C4200", ink: "#FFD87A" }, // a butter
  { bg: "#5C1F0E", ink: "#FFAA8A" }, // b peach
  { bg: "#0D2550", ink: "#8FB8FF" }, // c sky
  { bg: "#22144F", ink: "#C4AAFF" }, // d lilac
  { bg: "#0D3A1E", ink: "#7DD8A0" }, // e mint
  { bg: "#4A0D2C", ink: "#FFB3D6" }, // f rose
  { bg: "#3A2800", ink: "#D4B87A" }, // g sand
  { bg: "#0D3030", ink: "#7DCFCE" }, // h teal
  { bg: "#3D2800", ink: "#F5CC70" }, // i amber
  { bg: "#1F2E0A", ink: "#B8D46E" }, // j olive
  { bg: "#2D1A0A", ink: "#C49878" }, // k clay
];

// Slant rhyme palettes — same hue as above but ~50% opacity via alpha channel
const RHYME_COLORS_SLANT: { bg: string; ink: string }[] = [
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

const RHYME_COLORS_SLANT_DARK: { bg: string; ink: string }[] = [
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

- [ ] **Step 2: Update `LyricEditorProps` to include display mode props**

Find the interface (around line 31–36):

```ts
interface LyricEditorProps {
  content: string;
  onContentChange: (value: string) => void;
  onSelectionChange?: (text: string) => void;
  onCursorChange?: (query: string) => void;
}
```

Replace with:

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
  activeColorGroups?: Set<number> | null; // null = show all
}
```

- [ ] **Step 3: Destructure new props in the component function**

Find:
```ts
export default function LyricEditor({ content, onContentChange, onSelectionChange, onCursorChange }: LyricEditorProps) {
```

Replace with:

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

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: add dark/slant palette constants and new display props to LyricEditor"
```

---

### Task 4: Add `slant_groups` to editor state + update color map

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Add `slantColorMap` state** after the existing `syllableColorMap` state (around line 41):

```ts
const [slantColorMap, setSlantColorMap] = useState<Map<number, number>>(new Map());
// key = line index, value = color_index from slant_groups
```

- [ ] **Step 2: Update `runAnalysis` to populate `slantColorMap`**

Find `runAnalysis` (around line 47–62):

```ts
  const runAnalysis = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchAnalysis(lines)
      .then(({ line_counts, syllable_data, syllable_groups }) => {
        setCounts(line_counts);
        setSyllableData(syllable_data);
        const map = new Map<string, number>();
        for (const group of syllable_groups as SyllableGroup[]) {
          for (const occ of group.occurrences) {
            map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, group.color_index);
          }
        }
        setSyllableColorMap(map);
      })
      .catch(console.error);
  }, []);
```

Replace with:

```ts
  const runAnalysis = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchAnalysis(lines)
      .then(({ line_counts, syllable_data, syllable_groups, slant_groups }) => {
        setCounts(line_counts);
        setSyllableData(syllable_data);

        const map = new Map<string, number>();
        for (const group of syllable_groups) {
          for (const occ of group.occurrences) {
            map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, group.color_index);
          }
        }
        setSyllableColorMap(map);

        const slantMap = new Map<number, number>();
        for (const group of slant_groups ?? []) {
          for (const occ of group.occurrences) {
            slantMap.set(occ.line, group.color_index);
          }
        }
        setSlantColorMap(slantMap);
      })
      .catch(console.error);
  }, []);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: populate slantColorMap from /api/analyze slant_groups"
```

---

### Task 5: Update `renderLine` for all display modes

This is the core rendering change. The function must handle: highlight vs underline mode, phonemes view, stress view, color group filtering, slant rhyme coloring.

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Pick the right color palettes at render time**

Add these two derived constants inside the component body, after the state declarations and before `runAnalysis`:

```ts
  const colors = isDarkTheme ? RHYME_COLORS_DARK : RHYME_COLORS;
  const slantColors = isDarkTheme ? RHYME_COLORS_SLANT_DARK : RHYME_COLORS_SLANT;
```

- [ ] **Step 2: Replace `renderLine` with the full multi-mode version**

Find `renderLine` (around line 147) and replace the entire function with:

```ts
  function renderLine(line: string, lineIdx: number): React.ReactNode {
    // Slant color for this entire line (applied to last syllable of last word)
    const slantColorIdx = slantColorMap.get(lineIdx);

    if (showPhonemes) {
      // Phonemes view: show CMU vowel key tags above each word
      const wordSylsList = syllableData[lineIdx] ?? [];
      let phonemeWordIdx = 0;
      return line.split(/(\s+)/).map((token, ti) => {
        if (/^\s+$/.test(token)) return token;
        const currentPhonemeWordIdx = phonemeWordIdx++;
        const syls = wordSylsList[currentPhonemeWordIdx] ?? [];
        const phonemeLabel = syls.map((s) => s.key || "·").join("-");
        return (
          <span key={ti} className="word-annotation" style={{ position: "relative" }}>
            <span style={{
              position: "absolute",
              top: "-14px",
              left: 0,
              fontSize: "9px",
              fontFamily: "var(--mono)",
              color: "var(--ink-4)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}>
              {phonemeLabel}
            </span>
            {token}
          </span>
        );
      });
    }

    const tokens = line.split(/(\s+)/);
    let wordIdx = 0;

    return tokens.map((token, ti) => {
      if (/^\s+$/.test(token)) return token;

      const prefixMatch = token.match(/^([^\w']*)/);
      const suffixMatch = token.match(/([^\w']*$)/);
      const prefix = prefixMatch?.[1] ?? "";
      const suffix = suffixMatch?.[1] ?? "";
      const wordCore = token.slice(prefix.length, token.length - suffix.length) || token;
      const currentWordIdx = wordIdx++;

      const wordSyls = syllableData[lineIdx]?.[currentWordIdx] ?? [];

      const sylSpans = wordSyls.map((syl, si) => {
        const ci = syllableColorMap.get(`${lineIdx}:${currentWordIdx}:${si}`);
        const isFiltered = activeColorGroups !== null && ci !== undefined && !activeColorGroups.has(ci);

        if (showStress) {
          // Stress view: tint by stress level, ignore rhyme colors
          const stressBg =
            syl.stress === 1 ? (isDarkTheme ? "rgba(255,120,80,0.35)" : "rgba(200,80,40,0.18)") :
            syl.stress === 2 ? (isDarkTheme ? "rgba(255,200,80,0.25)" : "rgba(200,150,40,0.12)") :
            undefined;
          return (
            <span key={si} style={stressBg ? { backgroundColor: stressBg, borderRadius: "2px" } : undefined}>
              {syl.text}
            </span>
          );
        }

        if (ci !== undefined && !isFiltered) {
          const palette = colors[ci % colors.length];
          if (rhymeMode === "underline") {
            return (
              <span
                key={si}
                style={{
                  borderBottom: `2px solid ${palette.bg}`,
                  color: "inherit",
                }}
              >
                {syl.text}
              </span>
            );
          }
          return (
            <span
              key={si}
              style={{
                backgroundColor: palette.bg,
                color: palette.ink,
                borderRadius: "3px",
                padding: "0 1px",
              }}
            >
              {syl.text}
            </span>
          );
        }

        // Slant coloring: apply to last syllable of last word on this line
        const isLastWord = currentWordIdx === (syllableData[lineIdx]?.length ?? 0) - 1;
        const isLastSyl = si === wordSyls.length - 1;
        if (slantColorIdx !== undefined && isLastWord && isLastSyl) {
          const slantPalette = slantColors[slantColorIdx % slantColors.length];
          if (rhymeMode === "underline") {
            return (
              <span key={si} style={{ borderBottom: `2px dashed ${slantPalette.bg}` }}>
                {syl.text}
              </span>
            );
          }
          return (
            <span
              key={si}
              style={{
                backgroundColor: slantPalette.bg,
                color: "inherit",
                borderRadius: "3px",
                padding: "0 1px",
              }}
            >
              {syl.text}
            </span>
          );
        }

        return <span key={si}>{syl.text}</span>;
      });

      return (
        <span key={ti}>
          {prefix}
          <span
            className="word-annotation"
            data-syllables={wordSyls.length > 0 ? String(wordSyls.length) : ""}
          >
            {sylSpans.length > 0 ? sylSpans : wordCore}
          </span>
          {suffix}
        </span>
      );
    });
  }
```

- [ ] **Step 3: Verify phonemes view renders without crashing**

The phonemes view uses a simplified word-index calculation. It will work for a first pass. Start the dev server and toggle `showPhonemes` in the component directly (temporarily set `showPhonemes = true` as a default, verify, then revert):

```ts
  showPhonemes = false,  // temporarily change to true to test
```

Check that words show vowel phoneme tags above them. Revert to `false` when done.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: multi-mode renderLine — highlight/underline, stress, phonemes, slant colors"
```

---

### Task 6: Update toolbar — remove dead buttons, add view toggles

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

- [ ] **Step 1: Add internal toolbar state** (these will be overridden by props from App.tsx in Wave 3, but work standalone for now)

After the color palette constants and before `runAnalysis`, add:

```ts
  const [viewMode, setViewMode] = useState<"lyric" | "phonemes" | "stress">("lyric");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);
```

Then derive the effective modes (prop takes precedence over internal state when explicitly passed):

```ts
  const effectiveShowPhonemes = showPhonemes || viewMode === "phonemes";
  const effectiveShowStress = showStress || viewMode === "stress";
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;
```

Update the `renderLine` call sites to use these effective values (replace `showPhonemes` → `effectiveShowPhonemes`, `showStress` → `effectiveShowStress`, `rhymeMode` → `effectiveRhymeMode` in the renderLine body).

- [ ] **Step 2: Replace the toolbar JSX** in the return statement (around line 206–229):

Replace the entire `{/* ── Toolbar ── */}` div with:

```tsx
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">View</span>
          <button
            className={`toolbar-btn${viewMode === "lyric" ? " toolbar-btn--active" : ""}`}
            onClick={() => setViewMode("lyric")}
          >Lyric</button>
          <button
            className={`toolbar-btn${viewMode === "phonemes" ? " toolbar-btn--active" : ""}`}
            onClick={() => setViewMode("phonemes")}
          >Phonemes</button>
          <button
            className={`toolbar-btn${viewMode === "stress" ? " toolbar-btn--active" : ""}`}
            onClick={() => setViewMode("stress")}
          >Stress</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <span className="toolbar-label">Rhyme</span>
          <button
            className={`toolbar-btn${effectiveRhymeMode === "highlight" ? " toolbar-btn--active" : ""}`}
            onClick={() => setLocalRhymeMode("highlight")}
          >Highlight</button>
          <button
            className={`toolbar-btn${effectiveRhymeMode === "underline" ? " toolbar-btn--active" : ""}`}
            onClick={() => setLocalRhymeMode("underline")}
          >Underline</button>
        </div>
        <div className="toolbar-spacer" />
        <button
          className="toolbar-action toolbar-action--primary"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".txt";
            input.onchange = (ev) => {
              const file = (ev.target as HTMLInputElement).files?.[0];
              if (!file) return;
              file.text().then((text) => onContentChange(text));
            };
            input.click();
          }}
        >Import .txt</button>
      </div>
```

Note: The Import .txt button is placed here for convenience. Wave 3 may move it to the App level.

- [ ] **Step 3: Verify toolbar renders correctly**

Check that:
- "Lyric", "Phonemes", "Stress" buttons appear under "View"
- "Highlight", "Underline" buttons appear under "Rhyme"
- Clicking "Phonemes" toggles the phoneme annotations
- Clicking "Stress" shows stress shading
- Clicking "Underline" switches rhyme display to underlines
- Meter, Mood, Suggest line buttons are gone

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: replace toolbar with working view/rhyme toggles, remove dead buttons"
```

---

### Task 7: Update legend chip filtering

The legend chips in the sidebar show the 8 rhyme colors. When a chip is clicked, only rhymes of that color group should remain highlighted. This requires the `activeColorGroups` prop to be set from `NotesSidebar` via `App.tsx`. For now, we wire up the chips in `NotesSidebar` to emit click events and verify the filtering logic in `LyricEditor` works.

**Files:**
- Modify: `frontend/src/components/NotesSidebar.tsx`
- Modify: `frontend/src/components/LyricEditor.tsx` (verify activeColorGroups filtering)

- [ ] **Step 1: Update `NotesSidebarProps`** to add legend filter state:

```ts
interface NotesSidebarProps {
  // ... existing props ...
  activeColorGroups: Set<number> | null;
  onColorGroupToggle: (index: number) => void;
}
```

- [ ] **Step 2: Update the legend chips render** in `NotesSidebar.tsx` (around line 127):

Replace:
```tsx
      <div className="sidebar-legend">
        {LEGEND_CHIPS.map((color, i) => (
          <div
            key={i}
            className="legend-chip"
            style={{ background: color }}
            title={String.fromCharCode(97 + i)}
          />
        ))}
      </div>
```

With:
```tsx
      <div className="sidebar-legend">
        {LEGEND_CHIPS.map((color, i) => {
          const isActive = activeColorGroups === null || activeColorGroups.has(i);
          return (
            <div
              key={i}
              className={`legend-chip${isActive ? "" : " legend-chip--dim"}`}
              style={{ background: color, cursor: "pointer" }}
              title={`Filter rhyme group ${String.fromCharCode(97 + i)}`}
              onClick={() => onColorGroupToggle(i)}
            />
          );
        })}
      </div>
```

- [ ] **Step 3: Add `legend-chip--dim` CSS** in `index.css` after `.legend-chip`:

```css
.legend-chip--dim {
  opacity: 0.25;
}
```

- [ ] **Step 4: Pass stub props from `App.tsx` for now** (Wave 3 will wire this properly)

In `App.tsx`, add temporary state:
```ts
const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);

function handleColorGroupToggle(index: number) {
  setActiveColorGroups((prev) => {
    if (prev === null) {
      // First click: activate only this group
      return new Set([index]);
    }
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
      return next.size === 0 ? null : next;
    } else {
      next.add(index);
      return next;
    }
  });
}
```

Pass to both components:
```tsx
<NotesSidebar
  {/* ...existing props... */}
  activeColorGroups={activeColorGroups}
  onColorGroupToggle={handleColorGroupToggle}
/>
<LyricEditor
  {/* ...existing props... */}
  activeColorGroups={activeColorGroups}
/>
```

- [ ] **Step 5: Verify filtering works**

1. Type a note with several rhyming lines — multiple color groups appear
2. Click a legend chip → only that color group stays highlighted, others dim
3. Click again → that group deactivates (or returns to "all")
4. Click a second chip → both that chip and the first show; others dim

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/NotesSidebar.tsx frontend/src/components/LyricEditor.tsx frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: legend chips filter active rhyme color groups in editor"
```
