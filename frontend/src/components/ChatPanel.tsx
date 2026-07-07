import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatSession, ChatTurn } from "../api/chat";
import type { EditSuggestion } from "../App";
import { CHAT_CATEGORIES } from "../utils/chatModes";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { diffWords } from "../utils/diffWords";
import { MicIcon } from "./icons";

interface ChatPanelProps {
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
  onAcceptEdit: (turnId: number) => void;
  onRejectEdit: (turnId: number) => void;
}

export default function ChatPanel({
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
  onAcceptEdit,
  onRejectEdit,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastInjectSeq = useRef<number | null>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending, pendingUserText, streamingText]);

  useEffect(() => {
    if (openCategory === null) return;
    function handleOutsideClick(e: MouseEvent) {
      if (categoryRowRef.current && !categoryRowRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
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

  const categoryRow = (
    <div className="chat-shortcuts" ref={categoryRowRef}>
      {CHAT_CATEGORIES.map((cat) => (
        <div key={cat.id} className="chat-category">
          <button
            className={`chat-shortcut-btn chat-category-btn${openCategory === cat.id ? " chat-category-btn--open" : ""}`}
            onClick={() => setOpenCategory((prev) => (prev === cat.id ? null : cat.id))}
          >
            <span aria-hidden="true">{cat.icon}</span> {cat.label}
          </button>
          {openCategory === cat.id && (
            <div className="chat-category-dropdown">
              {cat.starters.map((starter) => (
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
            </div>
          )}
        </div>
      ))}
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
          return (
            <div key={t.id} className={`chat-bubble chat-bubble--${t.role}`}>
              <div className="chat-bubble-role">{t.role === "user" ? "You" : "Rhymathic"}</div>
              {editSuggestion ? (
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
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
      {composer}
    </div>
  );
}
