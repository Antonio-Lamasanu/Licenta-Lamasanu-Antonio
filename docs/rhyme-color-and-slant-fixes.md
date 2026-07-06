# Implementation prompt: slant rhyme visual rework + detection fixes

Items 1 (palette/color-index fix), 3 (line height), 4 (legend placement),
and 5 (status-bar cleanup) from the original planning session are already
implemented directly in this repo. What's left — and the reason this file
still exists — is the slant-rhyme work, deliberately scoped to its own
session. Implement the items below in the `licenta demo` repo (Rhymathic).
Test in a real browser (Docker Compose stack, or `npm run dev` +
`uvicorn`) before considering it done; this app has no automated test
suite.

## Slant rhymes: highlight/underline swap + detection fixes

**Visual behavior:** currently slant rhymes always render as a low-alpha
background fill (`getSlantColor`, ~40% alpha) regardless of rhyme-display
mode, which is why they're nearly invisible whenever perfect-rhyme
highlighting is also on. Change `LyricEditor.tsx`'s rendering (~lines
242-292) so the two rhyme classes always use complementary treatments:

- **Highlight mode** (`effectiveRhymeMode === "highlight"`): perfect rhymes
  get the background fill (as today); slant rhymes get a **solid** (not
  dashed) underline in the slant color. Remove the `3px dashed` styling at
  `LyricEditor.tsx:277` — use a solid border matching the perfect-rhyme
  underline treatment (`4px solid`), just fed the slant palette color.
- **Underline mode**: perfect rhymes get the underline (as today); slant
  rhymes get the background fill (full alpha slant color, not the diluted
  one — reuse `getPhonemeColor`-style full-strength rendering rather than
  `getSlantColor`'s alpha'd version, since underline mode has no competing
  background to fight for visibility).

**UX hint:** since the meaning of highlight vs. underline now flips
depending on mode, add a short inline hint near the mode toggle so it's
discoverable. Something like:

> Highlighting perfect rhymes? Underlines mark the slant ones.
> (and the mirror phrasing when in underline mode: "Underlining perfect
> rhymes? Highlights mark the slant ones.")

Feel free to adjust the copy to match the app's existing tone, but keep it
short (fits inline near the `Highlight`/`Underline` toggle button,
`LyricEditor.tsx:451-455`) and swap its text based on `effectiveRhymeMode`.

**Detection bug fix (soul/bowl-style false positives):** in
`backend/main.py`'s slant-grouping block (~lines 671-700), the code builds
`tail_buckets` (grouping lines by full rhyme tail) specifically to detect
which lines are *already* perfect rhymes with each other, but then
`slant_lines` is built by flattening **all** `tail_buckets.items()`
unconditionally — it never actually excludes the lines that share a tail.
So two lines that are genuine perfect rhymes (e.g. "soul" / "bowl", both
tail `("OW", "L")`) still get lumped into the slant group together, even
though `unique_tails` correctly detects there's a mix of tails present (from
a third line). Fix: when building `slant_lines`, only include lines whose
tail bucket has exactly one member (i.e., that line has no perfect-rhyme
partner in this vowel group):

```python
slant_lines = [
    line_idx
    for tail, idxs in tail_buckets.items()
    if len(idxs) == 1
    for line_idx in idxs
]
```

Lines excluded this way aren't losing their rhyme indication — they're
still separately caught by the normal per-syllable phoneme grouping
(`syllable_groups`), which already flags "soul"/"bowl" as sharing the `OW`
vowel; they just won't be double-flagged as slant on top of that.

**Dialect/pronunciation-variant inconsistency** (e.g. `chalk`/`talk`
resolving to different vowels): `_cmu_lookup()` always takes
`entries[0]` — the first pronunciation CMUdict lists for that word. This is
deterministic but not necessarily the "common" variant, and CMUdict
legitimately lists multiple valid pronunciations for some words. This is a
data/dictionary-variance issue, not really fixable in general — leave it
as-is; do not special-case individual words.

**Dedup ("shape shop" appearing twice):** `vowel_to_lines` is keyed by a
single vowel string in a dict, so true duplicate groups shouldn't occur
structurally. If this still reproduces after the above fix, it's most
likely the same phrase appearing twice in the source lyrics being
tested — verify against the actual input text before treating it as a code
bug.

**Explicitly out of scope for this pass:** the fuller phonetic
feature-distance scoring system (consonance detection, voicing-pair
near-rhymes, vowel-family fuzzy distance, perfect/consonance-leaning/
assonance-leaning/weak-slant buckets) discussed separately. Do not attempt
that rewrite here — this pass is limited to the visual swap and the
specific classification bugs above. Scope that as its own follow-up task.

## Notes on the already-implemented work (context, not to-do)

- Palette is now 15 distinct colors (one per CMU vowel) in
  `frontend/src/utils/phonemeColors.ts`; `phonemeToColorIndex()` is the
  single source of truth for color identity, used both by the legend
  (`NotesSidebar.tsx`) and the editor's highlight/filter logic
  (`LyricEditor.tsx`). The backend's `SyllableGroup.color_index` /
  `SlantGroup.color_index` fields are no longer trusted by the frontend
  for color derivation — don't reintroduce that dependency when touching
  slant rendering.
- The stress legend now lives in the sidebar bottom-left slot
  (`NotesSidebar.tsx`), swapping with the phoneme legend based on
  `editorMode`, which `App.tsx` tracks via `LyricEditor`'s `onModeChange`
  callback. If slant-mode UI needs its own legend entry, follow this same
  pattern rather than adding new toolbar UI.
