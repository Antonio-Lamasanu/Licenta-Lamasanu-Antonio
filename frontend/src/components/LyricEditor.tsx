import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAnalysis, type SyllableInfo, type SyllableGroup } from "../api/syllables";

const DEBOUNCE_MS = 400;

const RHYME_COLORS = [
  "rgba(239,68,68,0.35)",
  "rgba(59,130,246,0.35)",
  "rgba(34,197,94,0.35)",
  "rgba(234,179,8,0.35)",
  "rgba(168,85,247,0.35)",
  "rgba(249,115,22,0.35)",
  "rgba(20,184,166,0.35)",
  "rgba(236,72,153,0.35)",
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
}

export default function LyricEditor({ content, onContentChange }: LyricEditorProps) {
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
          spellCheck={false}
          wrap="off"
        />
      </div>
    </div>
  );
}
