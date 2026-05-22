import type { Note } from "../types/note";

interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeColorGroups: Set<number> | null;
  onColorGroupToggle: (index: number) => void;
}

// Colors cycling a-h for note left-tab strip
const NOTE_TAB_COLORS = [
  "#E9A33A", // a
  "#C8553D", // b
  "#5C81C5", // c
  "#8662C2", // d
  "#4A8B5E", // e
  "#C25584", // f
  "#B59247", // g
  "#4A8584", // h
];

// Legend chip colors (lighter palette matching rhyme highlight colors)
const LEGEND_CHIPS = [
  "#FFE7B0", "#FFD0C2", "#D9E8FF", "#E5DCFF",
  "#C9EBD2", "#FFD9EC", "#F1E1B8", "#CDE7E6",
];

export default function NotesSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  isOpen,
  onToggle,
  searchQuery,
  onSearchChange,
  activeColorGroups,
  onColorGroupToggle,
}: NotesSidebarProps) {
  if (!isOpen) {
    return (
      <div className="sidebar sidebar--collapsed">
        <button
          className="sidebar-collapse-btn"
          style={{ margin: "14px auto", display: "block" }}
          onClick={onToggle}
          aria-label="Open sidebar"
        >
          ☰
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      {/* ── Header: search + collapse row, then new-note button ── */}
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

      {/* ── Section label ── */}
      <div className="sidebar-section">
        <span className="sidebar-section-label">All notes</span>
        <span className="sidebar-section-count">{notes.length}</span>
      </div>

      {/* ── Note list ── */}
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
            onClick={() => onSelectNote(note.id)}
          >
            <div
              className="note-tab-strip"
              style={{ background: NOTE_TAB_COLORS[idx % NOTE_TAB_COLORS.length] }}
            />
            <div className="note-item-body">
              <div className="note-title-text">
                {note.title || "Untitled"}
              </div>
              <div className="note-meta-text">
                {note.content ? note.content.split("\n").filter((l) => l.trim().length > 0).length : 0} lines ·{" "}
                {new Date(note.updated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
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

      {/* ── Legend chips ── */}
      <div className="sidebar-legend">
        {LEGEND_CHIPS.map((color, i) => {
          const isActive = activeColorGroups === null || activeColorGroups.has(i);
          return (
            <div
              key={i}
              className={`legend-chip${isActive ? "" : " legend-chip--dim"}`}
              style={{ background: color, cursor: "pointer" }}
              title={`Filter rhyme group ${String.fromCharCode(97 + i)}`}
              onClick={() => onColorGroupToggle(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
