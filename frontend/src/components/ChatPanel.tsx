import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatSession, ChatTurn } from "../api/chat";
import type { EditSuggestion } from "../App";
import { CHAT_CATEGORIES } from "../utils/chatModes";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { diffWords } from "../utils/diffWords";
import { MicIcon } from "./icons";

interface ChatPanelProps {
  isDark: boolean;
  session: ChatSession | null;
  turns: ChatTurn[];
  loadingTurns: boolean;
  sending: boolean;
  pendingUserText: string | null;
  streamingText: string | null;
  error: string | null;
  onSend: (content: string) => void;
  injectText: { text: string; seq: number } | null;
  showMinimizeButton: boolean;
  onMinimize: () => void;
  editSuggestions: Map<number, EditSuggestion>;
  userTurnDisplay: Map<number, string>;
  assistantEditText: Map<number, string>;
  resolvedTurnIds: Set<number>;
  onAcceptEdit: (turnId: number) => void;
  onRejectEdit: (turnId: number) => void;
  showNoteContextHint: boolean;
  onDismissNoteContextHint: () => void;
  onInsertFullNote: () => void;
  noteInsertDisabled: boolean;
}

export default function ChatPanel({
  isDark,
  session,
  turns,
  loadingTurns,
  sending,
  pendingUserText,
  streamingText,
  error,
  onSend,
  injectText,
  showMinimizeButton,
  onMinimize,
  editSuggestions,
  userTurnDisplay,
  assistantEditText,
  resolvedTurnIds,
  onAcceptEdit,
  onRejectEdit,
  showNoteContextHint,
  onDismissNoteContextHint,
  onInsertFullNote,
  noteInsertDisabled,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastInjectSeq = useRef<number | null>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  function appendToDraft(text: string) {
    setDraft((prev) => (prev ? prev.trimEnd() + "\n\n" + text : text));
    textareaRef.current?.focus();
  }

  const speech = useSpeechToText(appendToDraft);

  useEffect(() => {
    if (injectText && injectText.seq !== lastInjectSeq.current) {
      lastInjectSeq.current = injectText.seq;
      appendToDraft(injectText.text);
    }
  }, [injectText]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending, pendingUserText, streamingText]);

  useEffect(() => {
    if (openCategory === null) return;
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideRow = categoryRowRef.current?.contains(target);
      const insideMenu = categoryMenuRef.current?.contains(target);
      if (!insideRow && !insideMenu) {
        setOpenCategory(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openCategory]);

  // Position the portaled dropdown against its trigger button, flipping
  // horizontally/vertically so it always stays fully within the viewport.
  useLayoutEffect(() => {
    if (!openCategory) {
      setMenuStyle(null);
      return;
    }
    const trigger = categoryTriggerRefs.current.get(openCategory);
    const menu = categoryMenuRef.current;
    if (!trigger || !menu) return;

    const margin = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    let left = triggerRect.left;
    if (left + menuRect.width > window.innerWidth - margin) {
      left = triggerRect.right - menuRect.width;
    }
    left = Math.max(margin, left);

    let top = triggerRect.top - menuRect.height - 6;
    if (top < margin) {
      top = triggerRect.bottom + 6;
    }

    setMenuStyle({ position: "fixed", top, left, zIndex: 300 });
  }, [openCategory]);

  // Reposition data can go stale the instant the page scrolls or resizes
  // (fixed coords are viewport-relative) — closing is simpler and safer
  // than tracking every scrollable ancestor.
  useEffect(() => {
    if (!openCategory) return;
    function close() {
      setOpenCategory(null);
    }
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openCategory]);

  function handleSend() {
    const content = draft.trim();
    if (!content || sending || !session) return;
    onSend(content);
    setDraft("");
    setOpenCategory(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!session) {
    return (
      <div className="chat-panel chat-panel--empty">
        Select a chat session or start a new one from the sidebar.
      </div>
    );
  }

  const isEmpty = !loadingTurns && turns.length === 0 && !sending;

  const openCategoryData = CHAT_CATEGORIES.find((cat) => cat.id === openCategory) ?? null;

  const categoryRow = (
    <div className="chat-shortcuts" ref={categoryRowRef}>
      {CHAT_CATEGORIES.map((cat) => (
        <div key={cat.id} className="chat-category">
          <button
            ref={(el) => {
              categoryTriggerRefs.current.set(cat.id, el);
            }}
            className={`chat-shortcut-btn chat-category-btn${openCategory === cat.id ? " chat-category-btn--open" : ""}`}
            onClick={() => setOpenCategory((prev) => (prev === cat.id ? null : cat.id))}
          >
            <span aria-hidden="true">{cat.icon}</span> {cat.label}
          </button>
        </div>
      ))}
      {openCategoryData &&
        createPortal(
          <div
            ref={categoryMenuRef}
            className={`chat-category-dropdown${isDark ? " theme-dark" : ""}`}
            style={menuStyle ?? { position: "fixed", top: -9999, left: -9999, visibility: "hidden" }}
          >
            {openCategoryData.starters.map((starter) => (
              <button
                key={starter}
                className="chat-category-option"
                onClick={() => {
                  setDraft(starter);
                  setOpenCategory(null);
                  textareaRef.current?.focus();
                }}
              >
                {starter}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );

  const noteContextHint = showNoteContextHint && (
    <div className="chat-context-hint">
      <span>Tip: insert the full note first so the rewrite fits the rest of the song.</span>
      <div className="chat-context-hint-actions">
        <button className="chat-context-hint-btn" onClick={onInsertFullNote} disabled={noteInsertDisabled}>
          Insert full note
        </button>
        <button className="chat-context-hint-dismiss" onClick={onDismissNoteContextHint} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );

  const composer = (
    <div className="chat-composer">
      <textarea
        ref={textareaRef}
        className="chat-composer-input"
        placeholder="Write a message…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={isEmpty ? 2 : 3}
      />
      {speech.supported && (
        <button
          className={`chat-mic-btn${speech.listening ? " chat-mic-btn--active" : ""}`}
          onClick={speech.toggle}
          title={speech.listening ? "Stop voice input" : "Voice input"}
          aria-label="Toggle voice input"
          type="button"
        >
          <MicIcon />
        </button>
      )}
      <button className="chat-composer-send" onClick={handleSend} disabled={sending || !draft.trim()}>
        {sending ? "…" : "Send"}
      </button>
    </div>
  );

  const minimizeButton = showMinimizeButton && (
    <button
      className="chat-minimize-btn"
      onClick={onMinimize}
      title="Minimize to mini-window"
      aria-label="Minimize chat to mini-window"
    >
      ⧉ Mini-window
    </button>
  );

  if (isEmpty) {
    return (
      <div className="chat-panel chat-panel--centered">
        {minimizeButton}
        <div className="chat-center-wrap">
          <div className="chat-empty">Say hello to get started.</div>
          {noteContextHint}
          {composer}
          {categoryRow}
        </div>
        {error && <div className="chat-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="chat-panel">
      {minimizeButton}
      <div className="chat-thread" ref={threadRef}>
        {loadingTurns && <div className="chat-loading">Loading…</div>}
        {turns.map((t) => {
          const editSuggestion = editSuggestions.get(t.id);
          const isResolvedEdit = editSuggestion && resolvedTurnIds.has(t.id);
          const displayContent = t.role === "user" ? userTurnDisplay.get(t.id) ?? t.content : t.content;
          return (
            <div key={t.id} className={`chat-bubble chat-bubble--${t.role}`}>
              <div className="chat-bubble-role">{t.role === "user" ? "You" : "Rhymathic"}</div>
              {isResolvedEdit ? (
                <>
                  <div className="chat-bubble-content edit-diff-text">
                    {diffWords(editSuggestion.original, editSuggestion.suggestion).map((tok, i) => (
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
                    <button className="selection-action-btn" onClick={() => onRejectEdit(t.id)}>
                      Reject
                    </button>
                    <button
                      className="selection-action-btn selection-action-btn--primary"
                      onClick={() => onAcceptEdit(t.id)}
                    >
                      Accept
                    </button>
                  </div>
                </>
              ) : (
                <div className="chat-bubble-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {assistantEditText.get(t.id) ?? displayContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
        {pendingUserText !== null && (
          <div className="chat-bubble chat-bubble--user">
            <div className="chat-bubble-role">You</div>
            <div className="chat-bubble-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{pendingUserText}</ReactMarkdown>
            </div>
          </div>
        )}
        {sending && (
          <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
            <div className="chat-bubble-role">Rhymathic</div>
            {streamingText ? (
              <div className="chat-bubble-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
              </div>
            ) : (
              <div className="chat-typing-dots">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {categoryRow}
      {noteContextHint}
      {composer}
    </div>
  );
}
