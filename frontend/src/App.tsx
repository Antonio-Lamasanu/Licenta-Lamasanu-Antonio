import { useState, useEffect } from "react";
import LyricEditor from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import RhymeDictionary from "./components/RhymeDictionary";
import { useAutoSave } from "./hooks/useAutoSave";
import { fetchNotes, createNote, deleteNote, searchNotes } from "./api/notes";
import type { Note } from "./types/note";

export default function App() {
  // ── All existing state unchanged ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const { saveStatus, setLastSaved } = useAutoSave(activeNoteId, activeTitle, activeContent);

  // NEW: theme toggle state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Legend chip color group filtering
  const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);

  function handleColorGroupToggle(index: number) {
    setActiveColorGroups((prev) => {
      if (prev === null) {
        // First click: activate only this group
        return new Set([index]);
      }
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        return next.size === 0 ? null : next;
      } else {
        next.add(index);
        return next;
      }
    });
  }

  // ── All existing effects + handlers unchanged ──
  useEffect(() => {
    fetchNotes()
      .then((loaded) => {
        setNotes(loaded);
        if (loaded.length > 0) {
          const first = loaded[0];
          setActiveNoteId(first.id);
          setActiveTitle(first.title);
          setActiveContent(first.content);
          setLastSaved(first.title, first.content);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sidebarSearch.trim()) {
        searchNotes(sidebarSearch)
          .then(setNotes)
          .catch(console.error);
      } else {
        fetchNotes()
          .then((loaded) => setNotes(loaded))
          .catch(console.error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearch]);

  function handleSelectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
  }

  async function handleNewNote() {
    try {
      const note = await createNote("", "");
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setActiveTitle(note.title);
      setActiveContent(note.content);
      setLastSaved(note.title, note.content);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteNote(id: number) {
    try {
      await deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id) {
        if (remaining.length > 0) {
          handleSelectNote(remaining[0].id);
        } else {
          setActiveNoteId(null);
          setActiveTitle("");
          setActiveContent("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleTitleChange(title: string) {
    setActiveTitle(title);
    if (activeNoteId !== null) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title } : n))
      );
    }
  }

  const lineCount = activeContent
    ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
    : 0;

  return (
    <div className={`app${theme === "dark" ? " theme-dark" : ""}`}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="wordmark">Rhymathic</span>
        </div>

        <nav className="topbar-nav">
          <button className="topbar-tab topbar-tab--active">Write</button>
          {/* TODO: Library tab — no backend */}
          <button className="topbar-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Library</button>
          {/* TODO: Voice tab — no backend */}
          <button className="topbar-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Voice</button>
        </nav>

        <div className="topbar-controls">
          <div className="save-pill">
            {saveStatus === "saving" && (
              <><span className="save-dot saving" />Saving…</>
            )}
            {saveStatus === "saved" && (
              <><span className="save-dot saved" />Saved</>
            )}
            {saveStatus === "error" && (
              <><span className="save-dot error" />Save failed</>
            )}
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "◑"}
          </button>
        </div>
      </header>

      {/* ── Three-column layout ── */}
      <div className="layout" style={{ gridTemplateColumns: sidebarOpen ? "280px 1fr 360px" : "48px 1fr 360px" }}>
        <NotesSidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={handleSelectNote}
          onNewNote={handleNewNote}
          onDeleteNote={handleDeleteNote}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          searchQuery={sidebarSearch}
          onSearchChange={setSidebarSearch}
          activeColorGroups={activeColorGroups}
          onColorGroupToggle={handleColorGroupToggle}
        />

        <main className="editor-pane">
          {activeNoteId === null ? (
            <div className="editor-empty">Select a note or create a new one</div>
          ) : (
            <>
              <div className="editor-header">
                <input
                  className="lyric-title"
                  placeholder="Untitled"
                  value={activeTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
                <div className="editor-meta">
                  draft · {lineCount} {lineCount === 1 ? "line" : "lines"}
                </div>
              </div>
              <LyricEditor
                content={activeContent}
                onContentChange={setActiveContent}
                onSelectionChange={(q) => { if (!autoMode) setRhymeQuery(q); }}
                onCursorChange={(q) => { if (autoMode) setRhymeQuery(q); }}
                isDarkTheme={theme === "dark"}
                activeColorGroups={activeColorGroups}
              />
            </>
          )}
        </main>

        <RhymeDictionary
          query={rhymeQuery}
          onQueryChange={setRhymeQuery}
          autoMode={autoMode}
          onAutoModeToggle={() => setAutoMode((o) => !o)}
        />
      </div>

      {/* ── Status bar ── */}
      <footer className="status-bar">
        <span>en-US · CMU + pyphen · Auto-save 1s</span>
        <span>build 2026.05</span>
      </footer>
    </div>
  );
}
