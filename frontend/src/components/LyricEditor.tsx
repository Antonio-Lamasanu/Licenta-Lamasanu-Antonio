import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import type { ActiveGroup } from "../api/syllables";
import { getPhonemeColor, phonemeToColorIndex } from "../utils/phonemeColors";
import type { SpeechRecognitionEvent, SpeechRecognitionInstance } from "../types/speechRecognition";
import type { ResolvedEdit } from "../App";
import { diffWords } from "../utils/diffWords";
import { useSyllableAnalysis } from "../hooks/useSyllableAnalysis";
import { useSelectionMenu } from "../hooks/useSelectionMenu";
import { MicIcon } from "./icons";

const CONTENT_PUSH_DEBOUNCE_MS = 200;

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
  replaceRange: (start: number, end: number, text: string) => void;
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
  onChangeThis?: (text: string, start: number, end: number) => void;
  activeEdits?: ResolvedEdit[];
  onAcceptEdit?: (turnId: number) => void;
  onRejectEdit?: (turnId: number) => void;
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
      onChangeThis,
      activeEdits = [],
      onAcceptEdit,
      onRejectEdit,
    }: LyricEditorProps,
    ref
  ) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // ── Plain text lives here, decoupled from `content` (App's lifted, auto-saved
  // state). Typing only ever touches this local state, so a keystroke's render is
  // scoped to this component - App and its siblings (sidebar, rhyme panel, chat)
  // never re-render from a keystroke, they only see updates via the debounced
  // push below. This is the actual fix for input lag; the mirror-render debounce
  // further down is a separate, smaller optimization on top of it. ─────────────
  const [localContent, setLocalContent] = useState(content);
  const localContentRef = useRef(localContent);
  const syncedContentRef = useRef(content); // last value known to match `content` in either direction
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref (not just closed over) so the useCallback-memoized functions below
  // stay correct even if the parent recreates onContentChange on every render.
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => { onContentChangeRef.current = onContentChange; }, [onContentChange]);

  function setLocal(value: string) {
    localContentRef.current = value;
    setLocalContent(value);
  }

  function flushPush() {
    if (pushTimer.current !== null) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    if (syncedContentRef.current !== localContentRef.current) {
      syncedContentRef.current = localContentRef.current;
      onContentChangeRef.current(localContentRef.current);
    }
  }

  function handleLocalChange(value: string) {
    setLocal(value);
    if (pushTimer.current !== null) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      syncedContentRef.current = value;
      onContentChangeRef.current(value);
    }, CONTENT_PUSH_DEBOUNCE_MS);
  }

  // External content change (note switch, chat "accept edit", etc.) - resync local
  // state and drop any in-flight push so it can't clobber the newly loaded value.
  useEffect(() => {
    if (content !== syncedContentRef.current) {
      if (pushTimer.current !== null) { clearTimeout(pushTimer.current); pushTimer.current = null; }
      syncedContentRef.current = content;
      setLocal(content);
    }
  }, [content]);

  // Flush on unmount (e.g. switching away from the Write tab) so a pending edit
  // isn't silently dropped.
  useEffect(() => () => flushPush(), []);

  // Inserts/replaces via the browser's native editing command (when available) so the
  // change lands on the textarea's own undo/redo stack, same as a real keystroke would -
  // a plain handleLocalChange(next) bypasses that stack entirely. When it succeeds, the
  // resulting native "input" event still runs through the textarea's onChange below.
  const applyProgrammaticEdit = useCallback((start: number, end: number, text: string) => {
    const el = textareaRef.current;
    if (el && document.execCommand) {
      el.focus();
      el.setSelectionRange(start, end);
      const applied = document.execCommand("insertText", false, text);
      if (applied) return;
    }
    const value = localContentRef.current;
    handleLocalChange(value.slice(0, start) + text + value.slice(end));
  }, []);

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
  }, [localContent]);
  // ──────────────────────────────────────────────────────────────────────

  // ── Voice / speech ────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechInsertPos = useRef(0);

  function startRecording() {
    if (!SpeechRecognitionClass) return;
    speechInsertPos.current = textareaRef.current?.selectionStart ?? localContentRef.current.length;
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
          const cur = localContentRef.current;
          const sep = pos > 0 && !cur.slice(0, pos).endsWith("\n") ? " " : "";
          applyProgrammaticEdit(pos, pos, sep + text);
          speechInsertPos.current = textareaRef.current?.selectionStart ?? pos + sep.length + text.length;
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
      applyProgrammaticEdit(el.selectionStart, el.selectionEnd, text);
    },
    replaceRange(start: number, end: number, text: string) {
      applyProgrammaticEdit(start, end, text);
    },
  }), [applyProgrammaticEdit]);

  const [mode, setMode] = useState<"rhymes" | "stress">("rhymes");
  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);
  const [annotation, setAnnotation] = useState<"syllables" | "phonemes">("syllables");
  const [localRhymeMode, setLocalRhymeMode] = useState<"highlight" | "underline">(rhymeMode);

  const effectiveShowPhonemes = showPhonemes || annotation === "phonemes";
  const effectiveShowStress = showStress || mode === "stress";
  const effectiveRhymeMode = rhymeMode !== "highlight" ? rhymeMode : localRhymeMode;
  const lineHeight = EDITOR_STYLE.lineHeight;

  const { counts, syllableData, syllableColorMap, slantColorMap } = useSyllableAnalysis(localContent, onGroupsChange);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [localContent]);

  const lines = useMemo(() => localContent.split("\n"), [localContent]);

  // "Change this" selections never span multiple lines (see handleSelectionChange),
  // so each active edit maps to exactly one line for the inline diff overlay.
  const activeEditsByLine = useMemo(() => {
    const map = new Map<
      number,
      { turnId: number; startInLine: number; endInLine: number; original: string; suggestion: string }
    >();
    for (const edit of activeEdits) {
      const before = localContent.slice(0, edit.start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineIdx = (before.match(/\n/g) ?? []).length;
      map.set(lineIdx, {
        turnId: edit.turnId,
        startInLine: edit.start - lineStart,
        endInLine: edit.end - lineStart,
        original: edit.original,
        suggestion: edit.suggestion,
      });
    }
    return map;
  }, [activeEdits, localContent]);

  // Accept/Reject for the inline diff must live outside the mirror div (which is
  // pointer-events:none so the textarea on top of it can capture typing/selection),
  // so they're rendered as a floating overlay positioned off the line's real DOM rect.
  const [editButtonPositions, setEditButtonPositions] = useState<Map<number, { top: number; left: number }>>(new Map());
  useLayoutEffect(() => {
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;
    const next = new Map<number, { top: number; left: number }>();
    for (const [lineIdx, edit] of activeEditsByLine) {
      const lineEl = lineRefs.current[lineIdx];
      if (!lineEl) continue;
      const rect = lineEl.getBoundingClientRect();
      next.set(edit.turnId, { top: rect.top - wrapperRect.top, left: rect.right - wrapperRect.left + 12 });
    }
    setEditButtonPositions(next);
  }, [activeEditsByLine, lineHeights, localContent]);

  const renderedLines = useMemo(() => {
    return lines.map((line, lineIdx) => {
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
        const slantInfo = slantColorMap.get(`${lineIdx}:${currentWordIdx}`);

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

          // Perfect rhymes and slant rhymes use opposite visual channels so a word that
          // belongs to both can show both at once: highlight mode fills perfect rhymes
          // and underlines slant rhymes; underline mode underlines perfect rhymes and
          // fills slant rhymes. Slant is evaluated on the last syllable of every word in
          // the document (ambient, not filterable), independent of the perfect check.
          const hasPerfect = !effectiveShowStress && phonemeKey !== undefined && !isFiltered;
          const isLastSyl = si === wordSyls.length - 1;
          const hasSlant = !effectiveShowStress && slantInfo !== undefined && isLastSyl;

          if (hasPerfect || hasSlant) {
            const style: CSSProperties = { color: "inherit" };
            if (hasPerfect) {
              const palette = getPhonemeColor(phonemeKey!, isDarkTheme);
              if (effectiveRhymeMode === "underline") {
                style.borderBottom = `4px solid ${palette.ink}`;
              } else {
                style.backgroundColor = palette.bg;
                style.color = palette.ink;
                style.borderRadius = "3px";
                style.boxShadow = `0 0 0 1px ${palette.bg}`;
              }
            }
            if (hasSlant) {
              const slantPalette = getPhonemeColor(slantInfo!.key, isDarkTheme);
              if (effectiveRhymeMode === "highlight") {
                style.borderBottom = `4px solid ${slantPalette.ink}`;
              } else {
                style.backgroundColor = slantPalette.bg;
                style.color = slantPalette.ink;
                style.borderRadius = "3px";
                style.boxShadow = `0 0 0 1px ${slantPalette.bg}`;
              }
            }
            return (
              <span key={si} style={style}>
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
          ? wordSyls
              .map((s) => [s.onset, s.key, s.coda].filter(Boolean).join(" ") || "·")
              .join("-")
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

  const { selectionMenu, handleSelectionChange, handleChangeThis, handleSelectLine, dismissSelectionMenu } = useSelectionMenu({
    textareaRef,
    wrapperRef,
    lineRefs,
    onSelectionChange,
    onCursorChange,
    onSendToChat,
    onChangeThis,
  });

  const baseLineH = parseFloat(lineHeight);

  return (
    <div ref={wrapperRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", position: "relative" }}>

      {/* ── Inline edit Accept/Reject (floating above the mirror, which is pointer-events:none) ── */}
      {activeEdits.map((edit) => {
        const pos = editButtonPositions.get(edit.turnId);
        if (!pos) return null;
        return (
          <div key={edit.turnId} className="inline-edit-actions-float" style={{ top: pos.top, left: pos.left }}>
            <button
              className="selection-action-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRejectEdit?.(edit.turnId)}
            >
              Reject
            </button>
            <button
              className="selection-action-btn selection-action-btn--primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAcceptEdit?.(edit.turnId)}
            >
              Accept
            </button>
          </div>
        );
      })}

      {/* ── Selection action menu ── */}
      {selectionMenu && onSendToChat && (
        <div className="selection-action-menu" style={{ top: selectionMenu.top, left: selectionMenu.left }}>
          <button
            className="selection-action-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onSendToChat(selectionMenu.text); dismissSelectionMenu(); }}
          >
            Send to Chat
          </button>
          <button
            className="selection-action-btn selection-action-btn--primary"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleChangeThis}
          >
            Change this
          </button>
        </div>
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
          <span className="toolbar-hint">
            {effectiveRhymeMode === "highlight"
              ? "Highlighting perfect rhymes? Underlines mark the slant ones and vice-versa."
              : "Underlining perfect rhymes? Highlights mark the slant ones."}
          </span>
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
              file.text().then((text) => applyProgrammaticEdit(0, localContentRef.current.length, text));
            };
            input.click();
          }}
        >Import .txt</button>
      </div>

      {/* ── Lyric frame: ruler | body | meter rail ── */}
      <div className="lyric-frame">

        {/* Ruler */}
        <div className="lyric-ruler">
          {lines.map((line, i) => {
            const h = lineHeights[i] ?? baseLineH;
            return (
              <div key={i} className="ruler-row" style={{ height: h, lineHeight: `${baseLineH}px` }}>
                {(onSendToChat || onChangeThis) && line.trim().length > 0 && (
                  <button
                    type="button"
                    className="line-select-btn"
                    title="Select this line"
                    aria-label={`Select line ${i + 1}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectLine(i)}
                  >
                    ✨
                  </button>
                )}
                <div className="ruler-nums">
                  <span className="ruler-line-num">{i + 1}</span>
                  <span className="ruler-syl-count">{counts[i] ?? ""}</span>
                </div>
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
            {renderedLines.map((rendered, lineIdx) => {
              const edit = activeEditsByLine.get(lineIdx);
              const lineText = lines[lineIdx] ?? "";
              return (
                <div
                  key={lineIdx}
                  ref={el => { lineRefs.current[lineIdx] = el; }}
                  style={{ lineHeight, minHeight: lineHeight }}
                >
                  {edit ? (
                    <>
                      {lineText.slice(0, edit.startInLine)}
                      <span className="inline-edit-diff">
                        {diffWords(edit.original, edit.suggestion).map((tok, i) => (
                          <span
                            key={i}
                            className={
                              tok.kind === "removed" ? "diff-removed" : tok.kind === "added" ? "diff-added" : undefined
                            }
                          >
                            {tok.text}
                          </span>
                        ))}
                      </span>
                      {lineText.slice(edit.endInLine)}
                    </>
                  ) : (
                    rendered
                  )}
                </div>
              );
            })}
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
            value={localContent}
            onChange={(e) => handleLocalChange(e.target.value)}
            onBlur={flushPush}
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
