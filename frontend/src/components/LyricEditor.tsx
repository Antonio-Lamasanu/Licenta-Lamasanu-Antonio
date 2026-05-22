import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAnalysis, type SyllableInfo } from "../api/syllables";

const DEBOUNCE_MS = 400;

const RHYME_COLORS: { bg: string; ink: string }[] = [
  { bg: "#FFE7B0", ink: "#6B4A05" }, // a butter
  { bg: "#FFD0C2", ink: "#7A2A12" }, // b peach
  { bg: "#D9E8FF", ink: "#1E3A78" }, // c sky
  { bg: "#E5DCFF", ink: "#3B2877" }, // d lilac
  { bg: "#C9EBD2", ink: "#1E5E36" }, // e mint
  { bg: "#FFD9EC", ink: "#7A1F4F" }, // f rose
  { bg: "#F1E1B8", ink: "#5C4314" }, // g sand
  { bg: "#CDE7E6", ink: "#1F4E4D" }, // h teal
  { bg: "#FBE2A8", ink: "#6B4A05" }, // i amber
  { bg: "#D8E4C2", ink: "#3F4F1F" }, // j olive
  { bg: "#E8D9CC", ink: "#5A3A22" }, // k clay
];

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

// Shared style values — must be identical on mirror div and textarea
const EDITOR_STYLE = {
  fontFamily: "var(--serif)",
  fontSize: "21px",
  lineHeight: "50px", // 2.4 × 21px — absolute so ruler + meter rail rows stay in sync
  whiteSpace: "pre" as const,
  letterSpacing: "-0.005em",
  wordSpacing: "normal",
  tabSize: 4,
};

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
  const [counts, setCounts] = useState<number[]>([]);
  const [syllableData, setSyllableData] = useState<SyllableInfo[][][]>([]);
  const [syllableColorMap, setSyllableColorMap] = useState<Map<string, number>>(new Map());
  const [slantColorMap, setSlantColorMap] = useState<Map<number, number>>(new Map());
  // key = line index, value = color_index from slant_groups

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick color palettes based on theme
  const colors = isDarkTheme ? RHYME_COLORS_DARK : RHYME_COLORS;
  const slantColors = isDarkTheme ? RHYME_COLORS_SLANT_DARK : RHYME_COLORS_SLANT;

  // Internal toolbar state (props take precedence when explicitly passed)
  const [viewMode, setViewMode] = useState<"lyric" | "phonemes" | "stress">("lyric");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);

  // Derived effective modes: prop takes precedence over internal state
  const effectiveShowPhonemes = showPhonemes || viewMode === "phonemes";
  const effectiveShowStress = showStress || viewMode === "stress";
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;

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

  useEffect(() => {
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runAnalysis(content), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, [content, runAnalysis]);

  // Auto-resize: grow the textarea to fit all content so the outer page scrollbar
  // is the only one — no internal textarea scrollbar.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [content]);

  const lines = content.split("\n");

  function handleSelectionChange() {
    if (!onSelectionChange && !onCursorChange) return;
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;

    if (selectionStart === selectionEnd) {
      onSelectionChange?.("");
      if (onCursorChange) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const textBefore = value.slice(lineStart, selectionStart);
        let beforeWords: string[] = textBefore.match(/\S+/g) ?? [];
        // Drop last token only if cursor is mid-word: word chars on both sides
        if (
          selectionStart > 0 &&
          selectionStart < value.length &&
          /\w/.test(value[selectionStart - 1]) &&
          /\w/.test(value[selectionStart])
        ) {
          beforeWords = beforeWords.slice(0, -1);
        }
        beforeWords = beforeWords.slice(-3);
        onCursorChange(beforeWords.length > 0 ? beforeWords.join(" ") : "");
      }
      return;
    }

    const selected = value.slice(selectionStart, selectionEnd);

    // Multi-line selection → ignore
    if (selected.includes("\n")) return;

    let words: string[] = selected.match(/\S+/g) ?? [];
    if (words.length === 0) return;

    // If the char before the selection is a word char AND the selection itself
    // starts with a non-space, the first token is a partial word fragment → drop it
    if (
      selectionStart > 0 &&
      /\w/.test(value[selectionStart - 1]) &&
      /\S/.test(selected[0])
    ) {
      words = words.slice(1);
    }

    // If the char after the selection is a word char AND the selection ends
    // with a non-space, the last token is a partial word fragment → drop it
    if (
      selectionEnd < value.length &&
      /\w/.test(value[selectionEnd]) &&
      /\S/.test(selected[selected.length - 1])
    ) {
      words = words.slice(0, -1);
    }

    if (words.length === 0) return;

    const query = words.join(" ");
    if (query.length < 2) return;
    if (words.length > 5) return;

    onSelectionChange?.(query);
  }

  function renderLine(line: string, lineIdx: number): React.ReactNode {
    // Slant color for this entire line (applied to last syllable of last word)
    const slantColorIdx = slantColorMap.get(lineIdx);

    if (effectiveShowPhonemes) {
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

        if (effectiveShowStress) {
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
          if (effectiveRhymeMode === "underline") {
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
          if (effectiveRhymeMode === "underline") {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

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

      {/* ── Lyric frame: ruler | body | meter rail ── */}
      <div className="lyric-frame">

        {/* Ruler: line numbers + syllable counts */}
        <div className="lyric-ruler">
          {lines.map((_, i) => (
            <div key={i} className="ruler-row" style={{ height: EDITOR_STYLE.lineHeight }}>
              <span className="ruler-line-num">{i + 1}</span>
              <span className="ruler-syl-count">{counts[i] ?? ""}</span>
            </div>
          ))}
        </div>

        {/* Body: mirror div + textarea */}
        <div className="lyric-body">
          <div
            ref={mirrorRef}
            className="lyric-mirror"
            style={EDITOR_STYLE}
            aria-hidden="true"
          >
            {lines.map((line, lineIdx) => (
              <div key={lineIdx} style={{ height: EDITOR_STYLE.lineHeight }}>
                {renderLine(line, lineIdx)}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="lyric-textarea"
            style={{
              ...EDITOR_STYLE,
              color: "transparent",
              caretColor: "var(--ink)",
              overflow: "hidden",
              minHeight: "60vh",
              height: "auto",
            }}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyUp={handleSelectionChange}
            onMouseUp={handleSelectionChange}
            onScroll={() => {
              if (mirrorRef.current && textareaRef.current) {
                mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
                mirrorRef.current.scrollLeft = textareaRef.current.scrollLeft;
              }
            }}
            wrap="off"
            placeholder="Start writing…"
            spellCheck={false}
          />
        </div>

        {/* Meter rail (stub) */}
        {/* TODO: Meter rail — visualizes syllable count vs. target; no backend target logic */}
        <div className="meter-rail">
          {lines.map((_, i) => (
            <div key={i} className="meter-row" style={{ height: EDITOR_STYLE.lineHeight }}>
              <div className="meter-bar-track" />
            </div>
          ))}
        </div>

      </div>

      {/* ── Editor footer ── */}
      <div className="editor-footer">
        {/* TODO: Caret phonetic readout — requires IPA lookup from cursor position */}
        <div className="footer-caret">
          <span className="caret-label">Cursor</span>
          <span className="caret-word">—</span>
        </div>
        {/* TODO: Scheme pill — requires rhyme scheme analysis (ABAB etc.) */}
        <div className="scheme-pill">
          <span className="scheme-dot" />
          <span className="scheme-text">scheme</span>
        </div>
      </div>

    </div>
  );
}
