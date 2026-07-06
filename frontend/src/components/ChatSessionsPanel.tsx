import type { ChatSession } from "../api/chat";

interface ChatSessionsPanelProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export default function ChatSessionsPanel({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: ChatSessionsPanelProps) {
  return (
    <div className="chat-sessions-pane">
      <div className="sidebar-section">
        <span className="sidebar-section-label">Chat sessions</span>
        <span className="sidebar-section-count">{sessions.length}</span>
      </div>

      <div className="chat-session-list">
        {sessions.length === 0 && (
          <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-4)" }}>
            No chat sessions yet
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`chat-session-item${activeSessionId === s.id ? " chat-session-item--active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="chat-session-body">
              <div className="chat-session-title">{s.title ?? "New chat"}</div>
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
        ))}
      </div>

      <button className="sidebar-btn-new chat-sessions-new-btn" onClick={onCreate}>
        + New session
      </button>
    </div>
  );
}
