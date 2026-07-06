import { useEffect, useRef, useState } from "react";
import type { ChatSession, ChatTurn } from "../api/chat";
import { CHAT_MODE_META } from "../utils/chatModes";

interface ChatPanelProps {
  session: ChatSession | null;
  turns: ChatTurn[];
  loadingTurns: boolean;
  sending: boolean;
  error: string | null;
  onSend: (content: string) => void;
  activeNoteContent: string;
  injectText: { text: string; seq: number } | null;
}

const PROMPT_SHORTCUTS = ["Suggest a rhyme scheme for this", "Give me an idea", "Help me finish this"];

export default function ChatPanel({
  session,
  turns,
  loadingTurns,
  sending,
  error,
  onSend,
  activeNoteContent,
  injectText,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastInjectSeq = useRef<number | null>(null);

  useEffect(() => {
    if (injectText && injectText.seq !== lastInjectSeq.current) {
      lastInjectSeq.current = injectText.seq;
      setDraft((prev) => (prev ? prev.trimEnd() + "\n\n" + injectText.text : injectText.text));
      textareaRef.current?.focus();
    }
  }, [injectText]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  function handleSend() {
    const content = draft.trim();
    if (!content || sending || !session) return;
    onSend(content);
    setDraft("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function insertNote() {
    if (!activeNoteContent) return;
    setDraft((prev) => (prev ? prev.trimEnd() + "\n\n" + activeNoteContent : activeNoteContent));
    textareaRef.current?.focus();
  }

  if (!session) {
    return (
      <div className="chat-panel chat-panel--empty">
        Select a chat session or start a new one from the sidebar.
      </div>
    );
  }

  const meta = CHAT_MODE_META[session.mode];

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <span className="chat-panel-mode-icon" aria-hidden="true">{meta?.icon}</span>
        <div className="chat-panel-mode-text">
          <span className="chat-panel-mode-label">{meta?.label ?? session.mode}</span>
          <span className="chat-panel-mode-desc">{meta?.description}</span>
        </div>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {loadingTurns && <div className="chat-loading">Loading…</div>}
        {!loadingTurns && turns.length === 0 && (
          <div className="chat-empty">Say hello to get started.</div>
        )}
        {turns.map((t) => (
          <div key={t.id} className={`chat-bubble chat-bubble--${t.role}`}>
            <div className="chat-bubble-role">{t.role === "user" ? "You" : "Rhymathic"}</div>
            <div className="chat-bubble-content">{t.content}</div>
          </div>
        ))}
        {sending && (
          <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
            <div className="chat-bubble-role">Rhymathic</div>
            <div className="chat-typing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-shortcuts">
        {PROMPT_SHORTCUTS.map((p) => (
          <button key={p} className="chat-shortcut-btn" onClick={() => setDraft(p)}>
            {p}
          </button>
        ))}
        <button
          className="chat-shortcut-btn chat-shortcut-btn--insert"
          onClick={insertNote}
          disabled={!activeNoteContent}
          title={activeNoteContent ? "Paste the current note into the message box" : "No active note"}
        >
          Insert full note
        </button>
      </div>

      <div className="chat-composer">
        <textarea
          ref={textareaRef}
          className="chat-composer-input"
          placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <button className="chat-composer-send" onClick={handleSend} disabled={sending || !draft.trim()}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
