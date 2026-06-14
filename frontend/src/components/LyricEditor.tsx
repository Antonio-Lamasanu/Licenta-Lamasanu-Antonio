import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { fetchAnalysis, type SyllableInfo, type ActiveGroup } from "../api/syllables";
import { phonemeToColorIndex, getPhonemeColor, getSlantColor } from "../utils/phonemeColors";

const DEBOUNCE_MS = 400;

// Shared style values — must be identical on mirror div and textarea
const EDITOR_STYLE = {
  fontFamily: "var(--serif)",
  fontSize: "21px",
  lineHeight: "50px", // 2.4 × 21px — absolute so ruler + meter rail rows stay in sync
  whiteSpace: "pre" as const,
  letterSpacing: "-0.005em",
  wordSpacing: "normal",
  tabSize: 4,
  padding: 0,
  border: "none",
} as const;

export interface LyricEditorHandle {
  insertAtCursor: (text: string) => void;
}

export interface LyricEditorHandle {
  insertAtCursor: (text: string) => void;
}

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
  onGroupsChange?: (groups: ActiveGroup[]) => void;
}

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
  const [counts, setCounts] = useState<number[]>([]);
  const [syllableData, setSyllableData] = useState<SyllableInfo[][][]>([]);
  const [syllableColorMap, setSyllableColorMap] = useState<Map<string, string>>(new Map());
  const [slantColorMap, setSlantColorMap] = useState<Map<number, string>>(new Map());
  // key = line index, value = vowel_key; assumes at most one slant group per line (last write wins)

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const mirrorRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const el = textareaRef.current;
      if (!el) return;
      const { selectionStart, selectionEnd, value } = el;
      const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
      onContentChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + text.length;
        el.focus();
      });
    },
  }), [onContentChange]);

  // Internal toolbar state (props take precedence when explicitly passed)
  const [viewMode, setViewMode] = useState<"lyric" | "phonemes" | "stress">("lyric");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);

  // Derived effective modes: prop takes precedence over internal state
  const effectiveShowPhonemes = showPhonemes || viewMode === "phonemes";
  const effectiveShowStress = showStress || viewMode === "stress";
  // Prop overrides local state only when it's "underline"; "highlight" (the default) defers to local state
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;

  const runAnalysis = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchAnalysis(lines)
      .then(({ line_counts, syllable_data, syllable_groups, slant_groups }) => {
        setCounts(line_counts);
        setSyllableData(syllable_data);

        const map = new Map<string, string>();
        for (const group of syllable_groups) {
          for (const occ of group.occurrences) {
            map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, group.phoneme_key);
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

        if (onGroupsChange) {
          const groups: ActiveGroup[] = [
            ...syllable_groups.map((g) => ({
              phonemeKey: g.phoneme_key,
              isSlant: false,
              colorIndex: g.color_index,
            })),
            ...(slant_groups ?? []).map((g) => ({
              phonemeKey: g.vowel_key,
              isSlant: true,
              colorIndex: g.color_index,
            })),
          ];
          onGroupsChange(groups);
        }
      })
      .catch(console.error);
  }, [onGroupsChange]);

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

  const lines = useMemo(() => content.split("\n"), [content]);

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
            <div key={i} className="ruler-row" style={{ height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight }}>
              <span className="ruler-line-num">{i + 1}</span>
              <span className="ruler-syl-count">{counts[i] ?? ""}</span>
            </div>
          ))}
        </div>

        {/* Body: mirror div + textarea */}
        <div className={`lyric-body${effectiveShowPhonemes ? " lyric-body--phonemes" : ""}`}>
          <div
            ref={mirrorRef}
            className="lyric-mirror"
            style={{
              ...EDITOR_STYLE,
              overflow: effectiveShowPhonemes ? "visible" : "hidden",
            }}
            aria-hidden="true"
          >
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
            <div key={i} className="meter-row" style={{ height: effectiveShowPhonemes ? "64px" : EDITOR_STYLE.lineHeight }}>
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
);

export default LyricEditor;
