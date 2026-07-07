import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo, useLayoutEffect } from "react";
import { fetchAnalysis, type SyllableInfo, type ActiveGroup } from "../api/syllables";
import { phonemeToColorIndex, getPhonemeColor, getSlantColor } from "../utils/phonemeColors";
import { editSelection } from "../api/chat";
import { diffWords } from "../utils/diffWords";
import type { SpeechRecognitionEvent, SpeechRecognitionInstance } from "../types/speechRecognition";
import { MicIcon } from "./icons";

const RHYME_WORD_CAP = 5;

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
  onModeChange?: (mode: "rhymes" | "stress") => void;
  onSendToChat?: (text: string) => void;
}

const SpeechRecognitionClass =
  (typeof window !== "undefined" && (window.SpeechRecognition ?? window.webkitSpeechRecognition)) || null;

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
      onModeChange,
      onSendToChat,
    }: LyricEditorProps,
    ref
  ) {
  const [counts, setCounts] = useState<number[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<{
    text: string;
    start: number;
    end: number;
    top: number;
    left: number;
  } | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{
    start: number;
    end: number;
    original: string;
    suggestion: string;
    top: number;
    left: number;
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [syllableData, setSyllableData] = useState<SyllableInfo[][][]>([]);
  const [syllableColorMap, setSyllableColorMap] = useState<Map<string, string>>(new Map());
  const [slantColorMap, setSlantColorMap] = useState<Map<number, string>>(new Map());

  const wrapperRef = useRef<HTMLDivElement>(null);
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

  const [mode, setMode] = useState<"rhymes" | "stress">("rhymes");
  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);
  const [annotation, setAnnotation] = useState<"syllables" | "phonemes">("syllables");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);

  const effectiveShowPhonemes = showPhonemes || annotation === "phonemes";
  const effectiveShowStress = showStress || mode === "stress";
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;
  const lineHeight = EDITOR_STYLE.lineHeight;

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
            colorIndex: phonemeToColorIndex(g.phoneme_key),
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

        const phonemeLabel = effectiveShowPhonemes
          ? wordSyls.map((s) => s.key || "·").join("-")
          : "";

        return (
          <span key={ti}>
            {prefix}
            <span
              className="word-annotation"
              data-syllables={!effectiveShowPhonemes && wordSyls.length > 0 ? String(wordSyls.length) : ""}
              data-phonemes={effectiveShowPhonemes ? phonemeLabel || undefined : undefined}
            >
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

  function locateOffset(container: HTMLElement, offset: number): { node: Node; offset: number } | null {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let last: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node as Text;
      const len = text.textContent?.length ?? 0;
      last = text;
      if (remaining <= len) return { node: text, offset: remaining };
      remaining -= len;
    }
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : null;
  }

  function getSelectionRect(lineIdx: number, startInLine: number, endInLine: number): DOMRect | null {
    const container = lineRefs.current[lineIdx];
    if (!container) return null;
    const startLoc = locateOffset(container, startInLine);
    const endLoc = locateOffset(container, endInLine);
    if (!startLoc || !endLoc) return null;
    const range = document.createRange();
    range.setStart(startLoc.node, startLoc.offset);
    range.setEnd(endLoc.node, endLoc.offset);
    const rects = range.getClientRects();
    return rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  }

  function computeMenuPosition(lineIdx: number, startInLine: number, endInLine: number) {
    const rect = getSelectionRect(lineIdx, startInLine, endInLine);
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || !wrapperRect) return { top: 0, left: 0 };
    return {
      top: rect.top - wrapperRect.top - 8,
      left: rect.left - wrapperRect.left + rect.width / 2,
    };
  }

  function handleSelectionChange() {
    if (!onSelectionChange && !onCursorChange && !onSendToChat) return;
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;

    if (selectionStart === selectionEnd) {
      setSelectionMenu(null);
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
    if (selected.includes("\n")) { setSelectionMenu(null); return; }

    let words: string[] = selected.match(/\S+/g) ?? [];
    if (words.length === 0) { setSelectionMenu(null); return; }

    let trimmedStart = selectionStart;
    let trimmedEnd = selectionEnd;

    if (
      selectionStart > 0 &&
      /\w/.test(value[selectionStart - 1]) &&
      /\S/.test(selected[0])
    ) {
      words = words.slice(1);
      trimmedStart = selectionStart + (selected.match(/^\S+\s*/)?.[0].length ?? 0);
    }

    if (
      selectionEnd < value.length &&
      /\w/.test(value[selectionEnd]) &&
      /\S/.test(selected[selected.length - 1])
    ) {
      words = words.slice(0, -1);
      const tail = value.slice(trimmedStart, selectionEnd);
      trimmedEnd = trimmedStart + (tail.match(/\s*\S+$/)?.index ?? tail.length);
    }

    if (words.length === 0) { setSelectionMenu(null); return; }
    const query = words.join(" ");
    if (query.length < 2) { setSelectionMenu(null); return; }

    const rhymeWords = words.length > RHYME_WORD_CAP ? words.slice(-RHYME_WORD_CAP) : words;
    onSelectionChange?.(rhymeWords.join(" "));

    if (onSendToChat) {
      const lineStart = value.lastIndexOf("\n", trimmedStart - 1) + 1;
      const lineIdx = (value.slice(0, trimmedStart).match(/\n/g) ?? []).length;
      const { top, left } = computeMenuPosition(lineIdx, trimmedStart - lineStart, trimmedEnd - lineStart);
      setSelectionMenu({ text: query, start: trimmedStart, end: trimmedEnd, top, left });
    }
  }

  async function handleChangeThis() {
    if (!selectionMenu) return;
    const { text, start, end, top, left } = selectionMenu;
    setSelectionMenu(null);
    setEditLoading(true);
    setEditError(null);
    try {
      const suggestion = await editSelection(text);
      setPendingEdit({ start, end, original: text, suggestion, top, left });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to get a suggestion");
    } finally {
      setEditLoading(false);
    }
  }

  function acceptEdit() {
    if (!pendingEdit) return;
    const { start, end, suggestion } = pendingEdit;
    const value = contentRef.current;
    onContentChange(value.slice(0, start) + suggestion + value.slice(end));
    setPendingEdit(null);
  }

  function rejectEdit() {
    setPendingEdit(null);
  }

  const baseLineH = parseFloat(lineHeight);

  return (
    <div ref={wrapperRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative" }}>

      {/* ── Selection action menu ── */}
      {selectionMenu && onSendToChat && (
        <div className="selection-action-menu" style={{ top: selectionMenu.top, left: selectionMenu.left }}>
          <span className="selection-action-text">"{selectionMenu.text}"</span>
          <button
            className="selection-action-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onSendToChat(selectionMenu.text); setSelectionMenu(null); }}
          >
            Send to Chat
          </button>
          <button
            className="selection-action-btn selection-action-btn--primary"
            onMouseDown={(e) => e.preventDefault()}
            disabled={editLoading}
            onClick={handleChangeThis}
          >
            {editLoading ? "Thinking…" : "Change this"}
          </button>
        </div>
      )}

      {/* ── Pending AI edit: inline diff, accept/reject ── */}
      {pendingEdit && (
        <div className="edit-diff-card" style={{ top: pendingEdit.top, left: pendingEdit.left }}>
          <div className="edit-diff-text">
            {diffWords(pendingEdit.original, pendingEdit.suggestion).map((tok, i) => (
              <span
                key={i}
                className={
                  tok.kind === "removed" ? "diff-removed" : tok.kind === "added" ? "diff-added" : undefined
                }
              >
                {tok.text}
              </span>
            ))}
          </div>
          <div className="edit-diff-actions">
            <button className="selection-action-btn" onMouseDown={(e) => e.preventDefault()} onClick={rejectEdit}>
              Reject
            </button>
            <button
              className="selection-action-btn selection-action-btn--primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={acceptEdit}
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {editError && (
        <div className="edit-diff-error">{editError}</div>
      )}

      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Mode</span>
          <button
            className={`toolbar-btn${mode === "rhymes" ? " toolbar-btn--active" : ""}`}
            onClick={() => setMode("rhymes")}
          >Rhymes</button>
          <button
            className={`toolbar-btn${mode === "stress" ? " toolbar-btn--active" : ""}`}
            onClick={() => setMode("stress")}
          >Stress</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <span className="toolbar-label">View</span>
          <button
            className="toolbar-btn"
            onClick={() => setAnnotation((a) => (a === "syllables" ? "phonemes" : "syllables"))}
            title="Toggle syllable count / phoneme labels"
          >{annotation === "syllables" ? "Syllables" : "Phonemes"}</button>
          <button
            className="toolbar-btn"
            onClick={() => setLocalRhymeMode((m) => (m === "highlight" ? "underline" : "highlight"))}
            title="Toggle rhyme highlight / underline"
          >{effectiveRhymeMode === "highlight" ? "Highlight" : "Underline"}</button>
        </div>
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

    </div>
  );
}
);

export default LyricEditor;
