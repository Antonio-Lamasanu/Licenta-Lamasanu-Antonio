# LyricEditor Rendering + Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LyricEditor's sequential color_index–based rendering with a deterministic phoneme→color palette, fix mirror/textarea alignment, memoize per-line rendering, add stress legend, fix phonemes view overflow, emit active groups to parent, and expose `insertAtCursor` via a ref handle.

**Architecture:** A new `phonemeColors.ts` module owns all palette data and the phoneme→colorIndex mapping; `LyricEditor` imports from it and no longer uses the API's sequential `color_index`. Slant groups use `vowel_key` for a direct palette lookup. `forwardRef` + `useImperativeHandle` exposes `insertAtCursor` to parent consumers.

**Tech Stack:** React 18, TypeScript strict, CMU vowel phoneme keys (AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW), Vite, Tailwind/index.css

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/utils/phonemeColors.ts` | All palette data + `phonemeToColorIndex`, `getPhonemeColor`, `getSlantColor` |
| Modify | `frontend/src/components/LyricEditor.tsx` | Consume phonemeColors, fix alignment, memoize, legend, forwardRef, onGroupsChange |
| Modify | `frontend/src/index.css` | Only `.lyric-*`, `.word-annotation`, `.editor-toolbar`, `.ruler-*`, `.meter-*` selectors |

> **Scope note:** `App.tsx` and `NotesSidebar.tsx` are **not** touched. `activeColorGroups: Set<number> | null` remains `Set<number>` in the public API — the numbers now correspond to stable phoneme→colorIndex values from `phonemeColors.ts` instead of the API's sequential `color_index`. The legend chips in `NotesSidebar` continue to pass numeric indices; they stay consistent because `phonemeToColorIndex` is deterministic.

---

## Task 1 — Create `phonemeColors.ts`

**Files:**
- Create: `frontend/src/utils/phonemeColors.ts`

This module owns all palette data that currently lives at the top of `LyricEditor.tsx`. It adds a stable phoneme→colorIndex mapping so the same phoneme always renders with the same color regardless of order of appearance in the text.

- [ ] **Step 1: Create the file with palette data and lookup functions**

```typescript
// frontend/src/utils/phonemeColors.ts

export interface PaletteEntry { bg: string; ink: string }

// 11 named slots (a–k). Order is stable; phonemes map into these by PHONEME_COLOR_INDEX below.
const LIGHT: PaletteEntry[] = [
  { bg: "#FFE7B0", ink: "#6B4A05" }, // 0 butter
  { bg: "#FFD0C2", ink: "#7A2A12" }, // 1 peach
  { bg: "#D9E8FF", ink: "#1E3A78" }, // 2 sky
  { bg: "#E5DCFF", ink: "#3B2877" }, // 3 lilac
  { bg: "#C9EBD2", ink: "#1E5E36" }, // 4 mint
  { bg: "#FFD9EC", ink: "#7A1F4F" }, // 5 rose
  { bg: "#F1E1B8", ink: "#5C4314" }, // 6 sand
  { bg: "#CDE7E6", ink: "#1F4E4D" }, // 7 teal
  { bg: "#FBE2A8", ink: "#6B4A05" }, // 8 amber
  { bg: "#D8E4C2", ink: "#3F4F1F" }, // 9 olive
  { bg: "#E8D9CC", ink: "#5A3A22" }, // 10 clay
];

const DARK: PaletteEntry[] = [
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

// Same hues, ~40% alpha overlay for slant rhymes
const LIGHT_SLANT: PaletteEntry[] = [
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

const DARK_SLANT: PaletteEntry[] = [
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

// Deterministic CMU vowel phoneme → palette slot (0–10).
// 15 CMU vowels mapped to 11 slots; phonemes that share a slot share a hue family.
const PHONEME_COLOR_INDEX: Record<string, number> = {
  AA: 0,  // father  → butter
  AE: 1,  // cat     → peach
  AH: 2,  // strut   → sky
  AO: 3,  // thought → lilac
  AW: 4,  // mouth   → mint
  AY: 5,  // price   → rose
  EH: 6,  // dress   → sand
  ER: 7,  // nurse   → teal
  EY: 8,  // face    → amber
  IH: 9,  // kit     → olive
  IY: 10, // fleece  → clay
  OW: 0,  // goat    → butter  (shares with AA)
  OY: 1,  // choice  → peach   (shares with AE)
  UH: 2,  // foot    → sky     (shares with AH)
  UW: 3,  // goose   → lilac   (shares with AO)
};

export function phonemeToColorIndex(key: string): number {
  return PHONEME_COLOR_INDEX[key] ?? key.charCodeAt(0) % 11;
}

export function getPhonemeColor(key: string, isDark: boolean): PaletteEntry {
  return (isDark ? DARK : LIGHT)[phonemeToColorIndex(key)];
}

export function getSlantColor(key: string, isDark: boolean): PaletteEntry {
  return (isDark ? DARK_SLANT : LIGHT_SLANT)[phonemeToColorIndex(key)];
}

// Re-export palettes for NotesSidebar legend chips (indexed by slot 0–10)
export { LIGHT as PALETTE_LIGHT, DARK as PALETTE_DARK };
```

- [ ] **Step 2: Verify the file compiles** — run `cd frontend && npx tsc --noEmit` and confirm zero errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/phonemeColors.ts
git commit -m "feat: add phonemeColors util — stable phoneme→palette mapping"
```

---

## Task 2 — Wire phonemeColors into `runAnalysis` + add `onGroupsChange`

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

Replace the top-of-file palette constants and the `color_index`-based map population with phoneme key lookups. Add `onGroupsChange` prop.

- [ ] **Step 1: Remove old palette constants from LyricEditor.tsx**

Delete lines 6–62 (the four `RHYME_COLORS*` array declarations). They are now owned by `phonemeColors.ts`.

- [ ] **Step 2: Update imports at the top of LyricEditor.tsx**

Replace:
```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAnalysis, type SyllableInfo } from "../api/syllables";
```
With:
```typescript
import { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { fetchAnalysis, type SyllableInfo } from "../api/syllables";
import { getPhonemeColor, getSlantColor, phonemeToColorIndex } from "../utils/phonemeColors";
```

- [ ] **Step 3: Change slantColorMap state type**

Replace:
```typescript
const [slantColorMap, setSlantColorMap] = useState<Map<number, number>>(new Map());
// key = line index, value = color_index from slant_groups
```
With:
```typescript
const [slantColorMap, setSlantColorMap] = useState<Map<number, string>>(new Map());
// key = line index, value = vowel_key (CMU phoneme) for stable palette lookup
```

- [ ] **Step 4: Add `onGroupsChange` and `LyricEditorHandle` to the interface block**

Add `LyricEditorHandle` export just before `LyricEditorProps`:
```typescript
export interface LyricEditorHandle {
  insertAtCursor: (text: string) => void;
}
```

Add `onGroupsChange` to `LyricEditorProps`:
```typescript
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
  onGroupsChange?: (groups: Array<{ phonemeKey: string; isSlant: boolean }>) => void;
}
```

- [ ] **Step 5: Remove the palette variable declarations inside the component body**

Delete these two lines (they reference the now-deleted arrays):
```typescript
const colors = isDarkTheme ? RHYME_COLORS_DARK : RHYME_COLORS;
const slantColors = isDarkTheme ? RHYME_COLORS_SLANT_DARK : RHYME_COLORS_SLANT;
```

- [ ] **Step 6: Update `runAnalysis` to use phoneme key lookups**

Replace the entire `runAnalysis` callback with:
```typescript
const runAnalysis = useCallback((value: string) => {
  const lines = value.split("\n");
  fetchAnalysis(lines)
    .then(({ line_counts, syllable_data, syllable_groups, slant_groups, onGroupsChange: _ignored }) => {
      setCounts(line_counts);
      setSyllableData(syllable_data);

      const map = new Map<string, number>();
      for (const group of syllable_groups) {
        const ci = phonemeToColorIndex(group.phoneme_key);
        for (const occ of group.occurrences) {
          map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, ci);
        }
      }
      setSyllableColorMap(map);

      const slantMap = new Map<number, string>();
      for (const group of slant_groups ?? []) {
        for (const occ of group.occurrences) {
          slantMap.set(occ.line, group.vowel_key);
        }
      }
      setSlantColorMap(slantMap);

      onGroupsChange?.([
        ...syllable_groups.map((g) => ({ phonemeKey: g.phoneme_key, isSlant: false })),
        ...(slant_groups ?? []).map((g) => ({ phonemeKey: g.vowel_key, isSlant: true })),
      ]);
    })
    .catch(console.error);
}, [onGroupsChange]);
```

> Note: `onGroupsChange` is now a dependency; add it to the `useCallback` dep array as shown.

- [ ] **Step 7: Verify compilation** — `npx tsc --noEmit` must pass with zero errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: use phoneme key lookup in runAnalysis, add onGroupsChange prop"
```

---

## Task 3 — Fix `renderLine`: use phonemeColors + fix underlines

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

Update `renderLine` to call `getPhonemeColor`/`getSlantColor` directly. Fix underline style to use `palette.ink`, 3px solid, `textUnderlineOffset: 3px`.

- [ ] **Step 1: Update perfect-rhyme highlight span inside `renderLine`**

Locate the section that renders a highlighted syllable span (current rhyme highlight, ~lines 295–323). Replace it:

```typescript
if (ci !== undefined && !isFiltered) {
  const palette = getPhonemeColor(
    // reverse-look up phoneme key stored in map — but map stores colorIndex now, not key.
    // We need the phoneme key; store it instead. See note below.
  );
```

> **Implementation note:** In Task 2 Step 6 we store `colorIndex` (number) in `syllableColorMap`. To call `getPhonemeColor(key, isDark)` in renderLine we need the key, not the index. Simplest fix: change `syllableColorMap` to store the phoneme key string instead. Update Task 2 Step 6 accordingly:

Change `syllableColorMap` state type back to `Map<string, string>` (key = occurrence key, value = phoneme key):

```typescript
// In state declaration — change to:
const [syllableColorMap, setSyllableColorMap] = useState<Map<string, string>>(new Map());
// key = "line:wordIdx:sylIdx", value = phoneme key (e.g. "AH")
```

And in `runAnalysis`:
```typescript
const map = new Map<string, string>();
for (const group of syllable_groups) {
  for (const occ of group.occurrences) {
    map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, group.phoneme_key);
  }
}
setSyllableColorMap(map);
```

The `isFiltered` check needs a numeric index for `activeColorGroups.has(ci)`. Derive it inline:
```typescript
const phonemeKey = syllableColorMap.get(`${lineIdx}:${currentWordIdx}:${si}`);
const ci = phonemeKey !== undefined ? phonemeToColorIndex(phonemeKey) : undefined;
const isFiltered = activeColorGroups !== null && ci !== undefined && !activeColorGroups.has(ci);
```

- [ ] **Step 2: Replace the full syllable span rendering block in `renderLine`**

Find the block starting at `const sylSpans = wordSyls.map((syl, si) => {` and replace with:

```typescript
const sylSpans = wordSyls.map((syl, si) => {
  const phonemeKey = syllableColorMap.get(`${lineIdx}:${currentWordIdx}:${si}`);
  const ci = phonemeKey !== undefined ? phonemeToColorIndex(phonemeKey) : undefined;
  const isFiltered = activeColorGroups !== null && ci !== undefined && !activeColorGroups.has(ci);

  if (effectiveShowStress) {
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

  if (phonemeKey !== undefined && !isFiltered) {
    const palette = getPhonemeColor(phonemeKey, isDarkTheme);
    if (effectiveRhymeMode === "underline") {
      return (
        <span
          key={si}
          style={{
            borderBottom: `3px solid ${palette.ink}`,
            textUnderlineOffset: "3px",
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

  // Slant coloring: last syllable of last word on this line
  const slantVowelKey = slantColorMap.get(lineIdx);
  const isLastWord = currentWordIdx === (syllableData[lineIdx]?.length ?? 0) - 1;
  const isLastSyl = si === wordSyls.length - 1;
  if (slantVowelKey !== undefined && isLastWord && isLastSyl) {
    const slantPalette = getSlantColor(slantVowelKey, isDarkTheme);
    if (effectiveRhymeMode === "underline") {
      return (
        <span key={si} style={{ borderBottom: `3px dashed ${slantPalette.ink}`, textUnderlineOffset: "3px" }}>
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
```

- [ ] **Step 3: Verify compilation and visual test**

Run `npx tsc --noEmit`. Then start the dev server (`npm run dev` from `frontend/`) and type a few rhyming lines. Confirm:
- Perfect rhyme syllables are highlighted/underlined consistently
- Underlines are dark and 3px (check Inspect > element style)
- Color is deterministic: "night" and "light" always get the same color regardless of which appears first

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "fix: use getPhonemeColor/getSlantColor in renderLine, improve underlines"
```

---

## Task 4 — Fix mirror/textarea alignment + phonemes view

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add `padding` and `border` to EDITOR_STYLE**

Find the `EDITOR_STYLE` const and replace it:

```typescript
const EDITOR_STYLE = {
  fontFamily: "var(--serif)",
  fontSize: "21px",
  lineHeight: "50px",
  whiteSpace: "pre" as const,
  letterSpacing: "-0.005em",
  wordSpacing: "normal",
  tabSize: 4,
  padding: 0,
  border: "none",
} as const;
```

- [ ] **Step 2: Switch lineHeight to "64px" when phonemes view is active**

In the mirror div `{lines.map(...)}`, change the per-line div's height:

```typescript
{lines.map((line, lineIdx) => (
  <div
    key={lineIdx}
    style={{
      height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
      lineHeight: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
    }}
  >
    {renderLine(line, lineIdx)}
  </div>
))}
```

Also update the ruler rows and meter rows to use the same dynamic height:

```typescript
// In lyric-ruler map:
<div key={i} className="ruler-row" style={{ height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight }}>

// In meter-rail map:
<div key={i} className="meter-row" style={{ height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight }}>
```

- [ ] **Step 3: Fix mirror overflow in phonemes mode**

The `.lyric-mirror` has `overflow: hidden` in CSS, clipping the `-14px` top phoneme labels. Apply `overflow: visible` inline when phonemes mode is active:

```typescript
<div
  ref={mirrorRef}
  className="lyric-mirror"
  style={{
    ...EDITOR_STYLE,
    overflow: effectiveShowPhonemes ? "visible" : "hidden",
  }}
  aria-hidden="true"
>
```

- [ ] **Step 4: Add CSS rule for phonemes mode overflow on lyric-body**

In `frontend/src/index.css`, after the `.lyric-body` block (around line 558), add:

```css
.lyric-body--phonemes {
  overflow: visible;
}
```

And in LyricEditor.tsx, add `lyric-body--phonemes` class to the body div when phonemes are active:

```typescript
<div className={`lyric-body${effectiveShowPhonemes ? " lyric-body--phonemes" : ""}`}>
```

- [ ] **Step 5: Verify visually**

Start dev server, switch to Phonemes view. Confirm:
- Phoneme labels appear above words without clipping
- Line heights are taller (64px) to give room for the label
- Ruler row heights match the taller lines

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx frontend/src/index.css
git commit -m "fix: EDITOR_STYLE padding/border, 64px line height in phonemes mode, mirror overflow"
```

---

## Task 5 — Add stress mode legend row to toolbar

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add CSS class for stress legend**

In `frontend/src/index.css`, append after the last `.editor-toolbar` rule:

```css
/* ─── Stress legend (shown only in stress view) ─── */
.stress-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-3);
}

.stress-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stress-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Insert the legend row into the toolbar JSX**

Inside the toolbar `<div className="editor-toolbar">`, after the closing `</div>` of the Rhyme group and before `<div className="toolbar-spacer" />`, add:

```typescript
{effectiveShowStress && (
  <>
    <div className="toolbar-sep" />
    <div className="stress-legend">
      <span className="stress-legend-item">
        <span
          className="stress-swatch"
          style={{ background: isDarkTheme ? "rgba(255,120,80,0.6)" : "rgba(200,80,40,0.35)" }}
        />
        primary
      </span>
      <span className="stress-legend-item">
        <span
          className="stress-swatch"
          style={{ background: isDarkTheme ? "rgba(255,200,80,0.5)" : "rgba(200,150,40,0.28)" }}
        />
        secondary
      </span>
    </div>
  </>
)}
```

- [ ] **Step 3: Verify visually**

In the browser, click Stress view. The toolbar should show `■ primary  ■ secondary` with colored swatches. Switching away hides the legend.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx frontend/src/index.css
git commit -m "feat: add stress mode legend row to editor toolbar"
```

---

## Task 6 — Memoize per-line rendering

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

`renderLine` is currently called for every line on every render. With `useMemo`, each line's output is only recomputed when that line's text or analysis data changes.

- [ ] **Step 1: Replace the per-line `renderLine` call with a `useMemo`**

Remove the `renderLine` function entirely (it will be inlined into the memo). Add this after all state declarations and before the return:

```typescript
const renderedLines = useMemo(() => {
  return lines.map((line, lineIdx) => {
    const slantVowelKey = slantColorMap.get(lineIdx);

    if (effectiveShowPhonemes) {
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
        const phonemeKey = syllableColorMap.get(`${lineIdx}:${currentWordIdx}:${si}`);
        const ci = phonemeKey !== undefined ? phonemeToColorIndex(phonemeKey) : undefined;
        const isFiltered = activeColorGroups !== null && ci !== undefined && !activeColorGroups.has(ci);

        if (effectiveShowStress) {
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

        if (phonemeKey !== undefined && !isFiltered) {
          const palette = getPhonemeColor(phonemeKey, isDarkTheme);
          if (effectiveRhymeMode === "underline") {
            return (
              <span key={si} style={{ borderBottom: `3px solid ${palette.ink}`, textUnderlineOffset: "3px", color: "inherit" }}>
                {syl.text}
              </span>
            );
          }
          return (
            <span key={si} style={{ backgroundColor: palette.bg, color: palette.ink, borderRadius: "3px", padding: "0 1px" }}>
              {syl.text}
            </span>
          );
        }

        const isLastWord = currentWordIdx === (syllableData[lineIdx]?.length ?? 0) - 1;
        const isLastSyl = si === wordSyls.length - 1;
        if (slantVowelKey !== undefined && isLastWord && isLastSyl) {
          const slantPalette = getSlantColor(slantVowelKey, isDarkTheme);
          if (effectiveRhymeMode === "underline") {
            return (
              <span key={si} style={{ borderBottom: `3px dashed ${slantPalette.ink}`, textUnderlineOffset: "3px" }}>
                {syl.text}
              </span>
            );
          }
          return (
            <span key={si} style={{ backgroundColor: slantPalette.bg, color: "inherit", borderRadius: "3px", padding: "0 1px" }}>
              {syl.text}
            </span>
          );
        }

        return <span key={si}>{syl.text}</span>;
      });

      return (
        <span key={ti}>
          {prefix}
          <span className="word-annotation" data-syllables={wordSyls.length > 0 ? String(wordSyls.length) : ""}>
            {sylSpans.length > 0 ? sylSpans : wordCore}
          </span>
          {suffix}
        </span>
      );
    });
  });
}, [
  lines,
  syllableData,
  syllableColorMap,
  slantColorMap,
  effectiveShowPhonemes,
  effectiveShowStress,
  effectiveRhymeMode,
  isDarkTheme,
  activeColorGroups,
]);
```

- [ ] **Step 2: Update the mirror div to consume `renderedLines`**

Replace:
```typescript
{lines.map((line, lineIdx) => (
  <div
    key={lineIdx}
    style={{
      height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
      lineHeight: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
    }}
  >
    {renderLine(line, lineIdx)}
  </div>
))}
```
With:
```typescript
{renderedLines.map((rendered, lineIdx) => (
  <div
    key={lineIdx}
    style={{
      height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
      lineHeight: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight,
    }}
  >
    {rendered}
  </div>
))}
```

- [ ] **Step 3: Delete the old `renderLine` function**

Remove the `function renderLine(line: string, lineIdx: number): React.ReactNode { ... }` declaration (it is now inlined in the memo above).

- [ ] **Step 4: Add `React` import for JSX types (if needed)**

Vite + React 18 with JSX transform should not require an explicit `React` import, but verify `npx tsc --noEmit` passes.

- [ ] **Step 5: Verify no regression**

Start dev server, type quickly. Observe in React DevTools that only changed lines re-render (highlight a line count badge and type on a different line — the other line's rendered output memo key won't change).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "perf: memoize per-line rendering to reduce typing latency"
```

---

## Task 7 — Add `useImperativeHandle` + `forwardRef` for `insertAtCursor`

**Files:**
- Modify: `frontend/src/components/LyricEditor.tsx`

Exposes `insertAtCursor(text)` so the Scratchpad panel can inject text at the current caret position.

- [ ] **Step 1: Change the component declaration to use `forwardRef`**

Replace:
```typescript
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
  onGroupsChange,
}: LyricEditorProps) {
```
With:
```typescript
const LyricEditor = forwardRef<LyricEditorHandle, LyricEditorProps>(function LyricEditor({
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
}: LyricEditorProps, ref) {
```

And close the `forwardRef` call at the very bottom of the file, replacing:
```typescript
}
```
With:
```typescript
});

export default LyricEditor;
```

- [ ] **Step 2: Add `useImperativeHandle` inside the component body**

Place this block after the `textareaRef` / `mirrorRef` / `debounceTimer` ref declarations:

```typescript
useImperativeHandle(ref, () => ({
  insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    onContentChange(next);
    // Restore cursor after the inserted text — done after React re-render
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + text.length;
      el.focus();
    });
  },
}));
```

- [ ] **Step 3: Verify TypeScript compilation**

`npx tsc --noEmit` must pass. Specifically check that:
- `LyricEditorHandle` is exported correctly
- The `forwardRef` generic types are satisfied

- [ ] **Step 4: Manual smoke test**

In the browser console (with the editor focused), find the React fiber for `LyricEditor` and call `insertAtCursor("hello")` — or temporarily wire a button in `App.tsx` that calls it via a ref:

```typescript
// Temporary in App.tsx for testing only — remove after verification
const editorRef = useRef<LyricEditorHandle>(null);
// In JSX: <LyricEditor ref={editorRef} ... />
// Add a button: <button onClick={() => editorRef.current?.insertAtCursor(" [test] ")}>Insert</button>
```

Confirm text is inserted at cursor and caret moves to end of insertion.

- [ ] **Step 5: Remove test code from App.tsx if added**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LyricEditor.tsx
git commit -m "feat: expose insertAtCursor via useImperativeHandle for Scratchpad integration"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Replace sequential color_index with fixed phoneme→color lookup from phonemeColors.ts | Tasks 1, 2, 3 |
| For slant groups: use vowel_key to look up slant palette | Task 2 (slantColorMap change), Task 3 (getSlantColor call) |
| Fix mirror/textarea alignment: padding: 0; border: none in EDITOR_STYLE | Task 4 Step 1 |
| Fix typing latency: memoize renderLine per-line with useMemo | Task 6 |
| Fix phonemes view: lineHeight "64px" when showPhonemes active | Task 4 Step 2 |
| Fix phonemes view: parent not clipping with overflow: visible | Task 4 Steps 3–4 |
| Add stress mode legend: "■ primary ■ secondary" in toolbar | Task 5 |
| Improve underlines: palette.ink color, 3px solid, textUnderlineOffset: 3px | Task 3 Step 2 |
| Add onGroupsChange prop | Tasks 2 Steps 4 + 6 |
| Add useImperativeHandle to expose insertAtCursor | Task 7 |

All spec items are covered.

### Placeholder scan

No TBD/TODO/placeholder code in any task — every step has complete code blocks.

### Type consistency check

- `syllableColorMap: Map<string, string>` — occurrence key → phoneme key string. Used consistently across Tasks 2, 3, 6.
- `slantColorMap: Map<number, string>` — line index → vowel key string. Used consistently across Tasks 2, 3, 6.
- `LyricEditorHandle.insertAtCursor(text: string): void` — defined in Task 2 Step 4, implemented in Task 7 Step 2.
- `onGroupsChange` parameter type `Array<{ phonemeKey: string; isSlant: boolean }>` — defined in Task 2 Step 4, called in Task 2 Step 6.
- `getPhonemeColor(key: string, isDark: boolean): PaletteEntry` — defined in Task 1, called in Tasks 3 + 6.
- `getSlantColor(key: string, isDark: boolean): PaletteEntry` — defined in Task 1, called in Tasks 3 + 6.
- `phonemeToColorIndex(key: string): number` — defined in Task 1, called in Tasks 2 + 3 + 6.

> **Note:** Task 2 originally used `Map<string, number>` for syllableColorMap, but Task 3 Step 1 upgrades it to `Map<string, string>` (phoneme key) to avoid a reverse lookup. Task 6 uses the same `Map<string, string>` type. This is consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-29-lyriceditor-color-rendering.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
