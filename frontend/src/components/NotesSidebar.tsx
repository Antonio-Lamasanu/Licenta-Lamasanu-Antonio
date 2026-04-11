import type { Note } from "../types/note";

interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onNewNote: () => void;
  onDeleteNote: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function NotesSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  isOpen,
  onToggle,
}: NotesSidebarProps) {
  if (!isOpen) {
    return (
      <aside className="w-8 shrink-0 bg-zinc-800 border-r border-zinc-700 flex flex-col items-center py-3">
        <button
          onClick={onToggle}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Open notes"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-zinc-800 border-r border-zinc-700 flex flex-col h-full">
      <div className="p-3 border-b border-zinc-700 flex items-center gap-2">
        <button
          onClick={onNewNote}
          className="flex-1 text-left px-3 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 transition-colors"
        >
          + New note
        </button>
        <button
          onClick={onToggle}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <polyline points="10,4 6,8 10,12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center mt-8 px-4">No notes yet</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`group flex items-center gap-1 px-3 py-2 cursor-pointer border-b border-zinc-700/50 ${
                note.id === activeNoteId
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-300 hover:bg-zinc-700/50"
              }`}
              onClick={() => onSelectNote(note.id)}
            >
              <span className="flex-1 truncate text-sm">
                {note.title || "Untitled"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNote(note.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 text-xs px-1 transition-opacity shrink-0"
                title="Delete note"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
