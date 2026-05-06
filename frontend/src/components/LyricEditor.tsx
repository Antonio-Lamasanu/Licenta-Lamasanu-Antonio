import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAnalysis, type SyllableInfo, type SyllableGroup } from "../api/syllables";

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
}

export default function LyricEditor({ content, onContentChange, onSelectionChange, onCursorChange }: LyricEditorProps) {
  const [counts, setCounts] = useState<number[]>([]);
  const [syllableData, setSyllableData] = useState<SyllableInfo[][][]>([]);
  const [syllableColorMap, setSyllableColorMap] = useState<Map<string, number>>(new Map());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const tokens = line.split(/(\s+)/);
    let wordIdx = 0;
    return tokens.map((token, ti) => {
      if (/^\s+$/.test(token)) {
        return token;
      }
      // Separate leading/trailing non-word characters so highlights don't cover punctuation.
      const prefixMatch = token.match(/^([^\w']*)/);
      const suffixMatch = token.match(/([^\w']*$)/);
      const prefix = prefixMatch?.[1] ?? "";
      const suffix = suffixMatch?.[1] ?? "";
      const wordCore =
        token.slice(prefix.length, token.length - suffix.length) || token;
      const currentWordIdx = wordIdx++;

      const wordSyls = syllableData[lineIdx]?.[currentWordIdx] ?? [];
      const totalCount = wordSyls.length > 0 ? wordSyls.length : undefined;

      const sylSpans = wordSyls.map((syl, si) => {
        const ci = syllableColorMap.get(`${lineIdx}:${currentWordIdx}:${si}`);
        return (
          <span
            key={si}
            style={
              ci !== undefined
                ? {
                    backgroundColor: RHYME_COLORS[ci % RHYME_COLORS.length].bg,
                    color: RHYME_COLORS[ci % RHYME_COLORS.length].ink,
                    borderRadius: "3px",
                    padding: "0 1px",
                  }
                : undefined
            }
          >
            {syl.text}
          </span>
        );
      });

      return (
        <span key={ti}>
          {prefix}
          <span
            className="word-annotation"
            data-syllables={totalCount !== undefined ? String(totalCount) : ""}
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
          <button className="toolbar-btn toolbar-btn--active">Lyric</button>
          {/* TODO: Phonemes view — requires backend IPA data */}
          <button className="toolbar-btn" disabled>Phonemes</button>
          {/* TODO: Stress view — requires backend stress data */}
          <button className="toolbar-btn" disabled>Stress</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <span className="toolbar-label">Highlight</span>
          <button className="toolbar-btn toolbar-btn--active">Rhyme</button>
          {/* TODO: Meter highlight — no backend meter target */}
          <button className="toolbar-btn" disabled>Meter</button>
          {/* TODO: Mood highlight — no backend */}
          <button className="toolbar-btn" disabled>Mood</button>
        </div>
        <div className="toolbar-spacer" />
        {/* TODO: Suggest line — no backend LLM integration */}
        <button className="toolbar-action toolbar-action--ghost">⌥+↩ Suggest line</button>
        <button className="toolbar-action toolbar-action--primary">Export</button>
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
