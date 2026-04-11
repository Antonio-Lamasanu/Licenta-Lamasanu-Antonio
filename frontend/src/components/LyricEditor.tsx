import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAnalysis, type SyllableInfo, type SyllableGroup } from "../api/syllables";

const DEBOUNCE_MS = 400;

const RHYME_COLORS = [
  "rgba(239,68,68,0.35)",    // red
  "rgba(59,130,246,0.35)",   // blue
  "rgba(34,197,94,0.35)",    // green
  "rgba(234,179,8,0.35)",    // yellow
  "rgba(168,85,247,0.35)",   // purple
  "rgba(249,115,22,0.35)",   // orange
  "rgba(20,184,166,0.35)",   // teal
  "rgba(236,72,153,0.35)",   // pink
  "rgba(14,165,233,0.35)",   // sky
  "rgba(132,204,22,0.35)",   // lime
  "rgba(245,158,11,0.35)",   // amber
  "rgba(244,63,94,0.35)",    // rose
  "rgba(139,92,246,0.35)",   // violet
  "rgba(16,185,129,0.35)",   // emerald
  "rgba(217,70,239,0.35)",   // fuchsia
  "rgba(6,182,212,0.35)",    // cyan
  "rgba(99,102,241,0.35)",   // indigo
  "rgba(251,113,133,0.35)",  // coral
  "rgba(163,230,53,0.35)",   // yellow-green
  "rgba(251,146,60,0.35)",   // deep orange
];

// Shared style values — must be identical on mirror div and textarea
const EDITOR_STYLE = {
  fontFamily: "ui-monospace, monospace",
  fontSize: "0.875rem",
  lineHeight: "2.5rem",
  whiteSpace: "pre" as const,
  wordSpacing: "normal",
  letterSpacing: "normal",
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
            style={{
              backgroundColor:
                ci !== undefined
                  ? RHYME_COLORS[ci % RHYME_COLORS.length]
                  : undefined,
              borderRadius: "2px",
            }}
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
    <div className="flex gap-4 w-full">
      {/* Per-line syllable counts */}
      <div className="flex flex-col text-right select-none min-w-[3rem]" style={{ paddingTop: "14px" }}>
        {lines.map((_: string, i: number) => (
          <div
            key={i}
            className="text-zinc-400 font-mono"
            style={{ ...EDITOR_STYLE, height: "2.5rem" }}
          >
            {counts[i] !== undefined && counts[i] > 0 ? counts[i] : ""}
          </div>
        ))}
      </div>

      {/* Editor area: mirror div + transparent textarea overlay */}
      <div className="relative flex-1">
        {/* Mirror div — shows rhyme highlights and per-word syllable annotations */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none overflow-hidden text-zinc-200"
          style={{ ...EDITOR_STYLE, paddingTop: "14px" }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ height: "2.5rem" }}>
              {renderLine(line, i)}
            </div>
          ))}
        </div>

        {/* Transparent textarea — captures all user input */}
        <textarea
          ref={textareaRef}
          className="relative w-full bg-transparent resize-none outline-none placeholder-zinc-600"
          style={{
            ...EDITOR_STYLE,
            color: "transparent",
            caretColor: "white",
            paddingTop: "14px",
            overflow: "hidden",
            minHeight: "70vh",
          }}
          placeholder="Start writing your lyrics..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          spellCheck={false}
          wrap="off"
        />
      </div>
    </div>
  );
}
