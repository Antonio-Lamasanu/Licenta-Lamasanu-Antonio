import { useState } from "react";
import type { Note } from "../types/note";
import type { ActiveGroup } from "../api/syllables";
import type { ChatSession } from "../api/chat";
import { getPhonemeColor, getSlantColor } from "../utils/phonemeColors";
import ResizableSplit from "./ResizableSplit";
import ChatSessionsPanel from "./ChatSessionsPanel";

interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  onRenameNote: (id: number, title: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeColorGroups: Set<number> | null;
  onColorGroupToggle: (index: number) => void;
  onSelectAll: () => void;
  activeGroups: ActiveGroup[];
  editorMode: "rhymes" | "stress";
  isDarkTheme: boolean;
  chatSessions: ChatSession[];
  activeChatSessionId: number | null;
  onSelectChatSession: (id: number) => void;
  onNewChatSession: () => void;
  onDeleteChatSession: (id: number) => void;
}

const NOTE_TAB_COLORS = [
  "#E9A33A", "#C8553D", "#5C81C5", "#8662C2",
  "#4A8B5E", "#C25584", "#B59247", "#4A8584",
];

export default function NotesSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onRenameNote,
  isOpen,
  onToggle,
  searchQuery,
  onSearchChange,
  activeColorGroups,
  onColorGroupToggle,
  onSelectAll,
  activeGroups,
  editorMode,
  isDarkTheme,
  chatSessions,
  activeChatSessionId,
  onSelectChatSession,
  onNewChatSession,
  onDeleteChatSession,
}: NotesSidebarProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function startRename(note: Note, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(note.id);
    setEditingTitle(note.title || "");
  }

  function commitRename() {
    if (editingId !== null) {
      onRenameNote(editingId, editingTitle);
      setEditingId(null);
    }
  }

  return (
    <div className={`sidebar${isOpen ? "" : " sidebar--collapsed"}`}>
      {/* ── Collapsed lip ── */}
      {!isOpen && (
        <button
          className="sidebar-collapse-btn sidebar-lip-btn"
          onClick={onToggle}
          aria-label="Open sidebar"
        >
          ☰
        </button>
      )}

      {/* ── Full content (hidden when collapsed) ── */}
      {isOpen && (
        <ResizableSplit
          defaultFirstSize={320}
          first={
            <div className="sidebar-notes-pane">
              <div className="sidebar-head">
                <div className="sidebar-head-row">
                  <div className="sidebar-search">
                    <span className="sidebar-search-icon">⌕</span>
                    <input
                      className="sidebar-search-input"
                      placeholder="Search notes…"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        className="sidebar-search-clear"
                        onClick={() => onSearchChange("")}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <button
                    className="sidebar-collapse-btn"
                    onClick={onToggle}
                    aria-label="Collapse sidebar"
                  >
                    ←
                  </button>
                </div>
                <button className="sidebar-btn-new" onClick={onNewNote}>
                  + New note
                </button>
              </div>

              <div className="sidebar-section">
                <span className="sidebar-section-label">All notes</span>
                <span className="sidebar-section-count">{notes.length}</span>
              </div>

              <div className="note-list">
                {notes.length === 0 && (
                  <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-4)" }}>
                    No notes yet
                  </div>
                )}
                {notes.map((note, idx) => (
                  <div
                    key={note.id}
                    className={`note-item${activeNoteId === note.id ? " note-item--active" : ""}`}
                    onClick={() => {
                      if (editingId !== note.id) onSelectNote(note.id);
                    }}
                  >
                    <div
                      className="note-tab-strip"
                      style={{ background: NOTE_TAB_COLORS[idx % NOTE_TAB_COLORS.length] }}
                    />
                    <div className="note-item-body">
                      {editingId === note.id ? (
                        <input
                          className="note-title-edit"
                          value={editingTitle}
                          autoFocus
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setEditingId(null);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="note-title-text">
                          {note.title || "Untitled"}
                        </div>
                      )}
                      <div className="note-meta-text">
                        {note.content ? note.content.split("\n").filter((l) => l.trim().length > 0).length : 0} lines ·{" "}
                        {new Date(note.updated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <button
                      className="note-rename-btn"
                      onClick={(e) => startRename(note, e)}
                      aria-label="Rename note"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      className="note-delete-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                      aria-label="Delete note"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          }
          second={
            <ChatSessionsPanel
              sessions={chatSessions}
              activeSessionId={activeChatSessionId}
              onSelect={onSelectChatSession}
              onCreate={onNewChatSession}
              onDelete={onDeleteChatSession}
            />
          }
        />
      )}

      {isOpen && editorMode === "stress" && (
        <div className="sidebar-legend stress-legend">
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
      )}

      {isOpen && editorMode === "rhymes" && activeGroups.length > 0 && (
        <div className="sidebar-legend">
          {activeGroups.map((group) => {
            const palette = group.isSlant
              ? getSlantColor(group.phonemeKey, isDarkTheme)
              : getPhonemeColor(group.phonemeKey, isDarkTheme);
            const isActive =
              activeColorGroups === null || activeColorGroups.has(group.colorIndex);
            return (
              <div
                key={`${group.colorIndex}-${group.isSlant}`}
                className={`legend-chip${isActive ? "" : " legend-chip--dim"}`}
                style={{ background: palette.bg, cursor: "pointer" }}
                title={`${group.isSlant ? "Slant rhyme" : "Rhyme"}: ${group.phonemeKey}`}
                onClick={() => onColorGroupToggle(group.colorIndex)}
              >
                <span className="legend-chip-label">{group.phonemeKey}</span>
              </div>
            );
          })}

          {/* Select/deselect-all chip — last */}
          <div
            className={`legend-chip legend-chip--all${activeColorGroups === null ? " legend-chip--all-active" : ""}`}
            onClick={onSelectAll}
            title={activeColorGroups === null ? "Deselect all" : "Select all"}
            style={{ cursor: "pointer" }}
          />
        </div>
      )}
    </div>
  );
}
