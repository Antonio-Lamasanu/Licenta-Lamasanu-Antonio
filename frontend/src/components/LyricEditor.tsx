import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo, useLayoutEffect } from "react";
import { fetchAnalysis, type SyllableInfo, type ActiveGroup } from "../api/syllables";
import { phonemeToColorIndex, getPhonemeColor, getSlantColor } from "../utils/phonemeColors";

const DEBOUNCE_MS = 400;

const EDITOR_STYLE = {
  fontFamily: "var(--serif)",
  fontSize: "21px",
  lineHeight: "50px",
  whiteSpace: "pre-wrap" as const,
  letterSpacing: "0",
  wordSpacing: "normal",
  tabSize: 4,
  padding: 0,
  border: "none",
  overflowWrap: "break-word" as const,
} as const;

const PHONEME_LINE_HEIGHT = "64px";

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
  activeColorGroups?: Set<number> | null;
  onGroupsChange?: (groups: ActiveGroup[]) => void;
}

// ── SpeechRecognition types ────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }
}
const SpeechRecognitionClass =
  (typeof window !== "undefined" && (window.SpeechRecognition ?? window.webkitSpeechRecognition)) || null;
// ──────────────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);

  // ── Line height measurement for wrap tracking ─────────────────────────
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const prevHeightsRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    const heights = lineRefs.current.map(el => el ? el.getBoundingClientRect().height : parseFloat(EDITOR_STYLE.lineHeight));
    const changed =
      heights.length !== prevHeightsRef.current.length ||
      heights.some((h, i) => Math.abs(h - (prevHeightsRef.current[i] ?? 0)) > 0.5);
    if (changed) {
      prevHeightsRef.current = heights;
      setLineHeights([...heights]);
    }
  });
  // ──────────────────────────────────────────────────────────────────────

  // ── Voice / speech ────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechInsertPos = useRef(0);

  function startRecording() {
    if (!SpeechRecognitionClass) return;
    speechInsertPos.current = textareaRef.current?.selectionStart ?? contentRef.current.length;
    const r = new SpeechRecognitionClass();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (!text) continue;
          const pos = speechInsertPos.current;
          const cur = contentRef.current;
          const sep = pos > 0 && !cur.slice(0, pos).endsWith("\n") ? " " : "";
          const next = cur.slice(0, pos) + sep + text + cur.slice(pos);
          onContentChange(next);
          speechInsertPos.current = pos + sep.length + text.length;
        }
      }
    };
    r.onerror = () => setIsRecording(false);
    r.onend = () => setIsRecording(false);
    recognitionRef.current = r;
    r.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);
  // ──────────────────────────────────────────────────────────────────────

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

  const [viewMode, setViewMode] = useState<"lyric" | "phonemes" | "stress">("lyric");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);

  const effectiveShowPhonemes = showPhonemes || viewMode === "phonemes";
  const effectiveShowStress = showStress || viewMode === "stress";
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;
  const lineHeight = effectiveShowPhonemes ? PHONEME_LINE_HEIGHT : EDITOR_STYLE.lineHeight;

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

        // Only expose perfect rhyme groups to the legend — slant rhymes are ambient
        if (onGroupsChange) {
          const groups: ActiveGroup[] = syllable_groups.map((g) => ({
            phonemeKey: g.phoneme_key,
            isSlant: false,
            colorIndex: g.color_index,
          }));
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
            <span key={ti} className="word-annotation" data-phonemes={phonemeLabel || undefined}>
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

          // Stress background
          const stressBg =
            effectiveShowStress && syl.stress === 1
              ? (isDarkTheme ? "rgba(255,120,80,0.50)" : "rgba(200,80,40,0.22)")
              : effectiveShowStress && syl.stress === 2
              ? (isDarkTheme ? "rgba(255,200,80,0.40)" : "rgba(200,150,40,0.20)")
              : undefined;

          // In stress mode, suppress rhyme coloring entirely
          if (!effectiveShowStress && phonemeKey !== undefined && !isFiltered) {
            const palette = getPhonemeColor(phonemeKey, isDarkTheme);
            const underlineColor = isDarkTheme ? palette.bg : palette.ink;
            if (effectiveRhymeMode === "underline") {
              return (
                <span key={si} style={{
                  borderBottom: `4px solid ${underlineColor}`,
                  color: "inherit",
                }}>
                  {syl.text}
                </span>
              );
            }
            return (
              <span key={si} style={{
                backgroundColor: palette.bg,
                color: palette.ink,
                borderRadius: "3px",
                boxShadow: `0 0 0 1px ${palette.bg}`,
              }}>
                {syl.text}
              </span>
            );
          }

          // Slant rhyme — last syllable of last word in line (ambient, not filterable)
          const isLastWord = currentWordIdx === (syllableData[lineIdx]?.length ?? 0) - 1;
          const isLastSyl = si === wordSyls.length - 1;
          if (!effectiveShowStress && slantVowelKey !== undefined && isLastWord && isLastSyl) {
            const slantPalette = getSlantColor(slantVowelKey, isDarkTheme);
            const slantUnderlineColor = isDarkTheme ? slantPalette.bg : slantPalette.ink;
            if (effectiveRhymeMode === "underline") {
              return (
                <span key={si} style={{
                  borderBottom: `3px dashed ${slantUnderlineColor}`,
                }}>
                  {syl.text}
                </span>
              );
            }
            return (
              <span key={si} style={{
                backgroundColor: slantPalette.bg,
                borderRadius: "3px",
                boxShadow: `0 0 0 1px ${slantPalette.bg}`,
              }}>
                {syl.text}
              </span>
            );
          }

          if (stressBg) {
            if (effectiveRhymeMode === "underline") {
              return (
                <span key={si} style={{ borderBottom: `4px solid ${stressBg}`, color: "inherit" }}>
                  {syl.text}
                </span>
              );
            }
            return (
              <span key={si} style={{ backgroundColor: stressBg, borderRadius: "2px" }}>
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
    if (selected.includes("\n")) return;

    let words: string[] = selected.match(/\S+/g) ?? [];
    if (words.length === 0) return;

    if (
      selectionStart > 0 &&
      /\w/.test(value[selectionStart - 1]) &&
      /\S/.test(selected[0])
    ) {
      words = words.slice(1);
    }

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

  const baseLineH = parseFloat(lineHeight);

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
                  style={{ background: isDarkTheme ? "rgba(255,120,80,0.65)" : "rgba(200,80,40,0.38)" }}
                />
                primary
              </span>
              <span className="stress-legend-item">
                <span
                  className="stress-swatch"
                  style={{ background: isDarkTheme ? "rgba(255,200,80,0.55)" : "rgba(200,150,40,0.34)" }}
                />
                secondary
              </span>
            </div>
          </>
        )}
        <div className="toolbar-spacer" />
        {SpeechRecognitionClass && (
          <button
            className={`toolbar-btn mic-btn${isRecording ? " mic-btn--active" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Stop recording" : "Dictate into note"}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
          >
            <MicIcon />
            {isRecording ? " Stop" : " Dictate"}
          </button>
        )}
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

        {/* Ruler */}
        <div className="lyric-ruler">
          {lines.map((_, i) => {
            const h = lineHeights[i] ?? baseLineH;
            return (
              <div key={i} className="ruler-row" style={{ height: h, lineHeight: `${baseLineH}px` }}>
                <span className="ruler-line-num">{i + 1}</span>
                <span className="ruler-syl-count">{counts[i] ?? ""}</span>
              </div>
            );
          })}
        </div>

        {/* Body: mirror div + textarea */}
        <div className={`lyric-body${effectiveShowPhonemes ? " lyric-body--phonemes" : ""}`}>
          <div
            ref={mirrorRef}
            className="lyric-mirror"
            style={{
              ...EDITOR_STYLE,
              lineHeight,
              overflow: "visible",
            }}
            aria-hidden="true"
          >
            {renderedLines.map((rendered, lineIdx) => (
              <div
                key={lineIdx}
                ref={el => { lineRefs.current[lineIdx] = el; }}
                style={{ lineHeight, minHeight: lineHeight }}
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
              lineHeight,
              color: "transparent",
              caretColor: "var(--ink)",
              overflow: "hidden",
              overflowX: "hidden",
              minHeight: "60vh",
              height: "auto",
            }}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyUp={handleSelectionChange}
            onMouseUp={handleSelectionChange}
            wrap="soft"
            placeholder="Start writing…"
            spellCheck={false}
          />
        </div>

        {/* Meter rail */}
        <div className="meter-rail">
          {lines.map((_, i) => {
            const h = lineHeights[i] ?? baseLineH;
            const isWrapped = h > baseLineH + 2;
            return (
              <div key={i} className={`meter-row${isWrapped ? " meter-row--wrapped" : ""}`} style={{ height: h }}>
                <div className="meter-bar-track" />
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Editor footer ── */}
      <div className="editor-footer">
        <div className="footer-caret">
          <span className="caret-label">Cursor</span>
          <span className="caret-word">—</span>
        </div>
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
