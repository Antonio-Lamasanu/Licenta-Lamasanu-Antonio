import type { Note } from "../types/note";
import type { ActiveGroup } from "../api/syllables";
import { RHYME_COLORS, RHYME_COLORS_SLANT } from "../phonemeColors";

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
  activeGroups: ActiveGroup[];
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
  activeGroups,
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

      {activeGroups.length > 0 && (
        <div className="sidebar-legend">
          {activeGroups.map((group) => {
            const palette = group.isSlant
              ? RHYME_COLORS_SLANT[group.colorIndex % RHYME_COLORS_SLANT.length]
              : RHYME_COLORS[group.colorIndex % RHYME_COLORS.length];
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
        </div>
      )}
    </div>
  );
}
