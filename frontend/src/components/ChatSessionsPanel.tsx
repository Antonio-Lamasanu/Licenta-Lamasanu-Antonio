import { useState } from "react";
import type { ChatMode, ChatSession } from "../api/chat";
import { CHAT_MODES, CHAT_MODE_META } from "../utils/chatModes";

interface ChatSessionsPanelProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onCreate: (mode: ChatMode) => void;
  onDelete: (id: number) => void;
}

export default function ChatSessionsPanel({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: ChatSessionsPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="chat-sessions-pane">
      <div className="sidebar-section">
        <span className="sidebar-section-label">Chat sessions</span>
        <span className="sidebar-section-count">{sessions.length}</span>
      </div>

      <button className="sidebar-btn-new chat-sessions-new-btn" onClick={() => setPickerOpen(true)}>
        + New session
      </button>

      <div className="chat-session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-4)" }}>
            No chat sessions yet
          </div>
        )}
        {sessions.map((s) => {
          const meta = CHAT_MODE_META[s.mode];
          return (
            <div
              key={s.id}
              className={`chat-session-item${activeSessionId === s.id ? " chat-session-item--active" : ""}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="chat-session-icon" aria-hidden="true">
                {meta?.icon ?? "💬"}
              </span>
              <div className="chat-session-body">
                <div className="chat-session-mode">{meta?.label ?? s.mode}</div>
                <div className="chat-session-date">
                  {new Date(s.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <button
                className="note-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                aria-label="Delete session"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="mode-picker-card" onClick={(e) => e.stopPropagation()}>
            <div className="mode-picker-title">Start a new chat</div>
            {CHAT_MODES.map((m) => (
              <button
                key={m.id}
                className="mode-picker-option"
                onClick={() => {
                  onCreate(m.id);
                  setPickerOpen(false);
                }}
              >
                <span className="mode-picker-icon" aria-hidden="true">
                  {m.icon}
                </span>
                <span className="mode-picker-text">
                  <span className="mode-picker-label">{m.label}</span>
                  <span className="mode-picker-desc">{m.description}</span>
                </span>
              </button>
            ))}
            <button className="mode-picker-cancel" onClick={() => setPickerOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
