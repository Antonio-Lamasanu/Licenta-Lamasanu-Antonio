import { useState, useEffect, useRef } from "react";
import LyricEditor, { type LyricEditorHandle } from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import RhymeDictionary from "./components/RhymeDictionary";
import LibraryPanel from "./components/LibraryPanel";
import VoicePanel from "./components/VoicePanel";
import Scratchpad from "./components/Scratchpad";
import { useAutoSave } from "./hooks/useAutoSave";
import { fetchNotes, createNote, deleteNote, searchNotes } from "./api/notes";
import type { Note } from "./types/note";
import type { ActiveGroup } from "./api/syllables";

export default function App() {
  // ── Notes state ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const { saveStatus, setLastSaved } = useAutoSave(activeNoteId, activeTitle, activeContent);

  // ── Theme: 3-state light / dark / auto ──
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("auto");
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const isDark = themeMode === "dark" || (themeMode === "auto" && systemDark);

  // ── Layout state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rhymePanelOpen, setRhymePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"write" | "library" | "voice">("write");

  // ── Rhyme query + auto mode ──
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // ── Active rhyme groups (emitted by LyricEditor after each analysis) ──
  const [activeGroups, setActiveGroups] = useState<ActiveGroup[]>([]);
  const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);

  // ── Scratchpad ──
  const [scratchpadWords, setScratchpadWords] = useState<string[]>([]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  // ── Editor ref (for insertAtCursor from Scratchpad) ──
  const editorRef = useRef<LyricEditorHandle>(null);

  // ── Layout ref (for responsive ResizeObserver) ──
  const layoutRef = useRef<HTMLDivElement>(null);

  // ── Effects ──

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const el = layoutRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width < 900) {
        setSidebarOpen(false);
        setRhymePanelOpen(false);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
        searchNotes(sidebarSearch).then(setNotes).catch(console.error);
      } else {
        fetchNotes().then(setNotes).catch(console.error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sidebarSearch]);

  // ── Handlers ──

  function handleSelectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
    setActiveColorGroups(null);
  }

  async function handleNewNote() {
    try {
      const note = await createNote("", "");
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setActiveTitle(note.title);
      setActiveContent(note.content);
      setLastSaved(note.title, note.content);
      setActiveColorGroups(null);
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

  function handleColorGroupToggle(index: number) {
    setActiveColorGroups((prev) => {
      if (prev === null) return new Set([index]);
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        return next.size === 0 ? null : next;
      }
      next.add(index);
      return next;
    });
  }

  function addToScratchpad(word: string) {
    setScratchpadWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setScratchpadOpen(true);
  }

  const lineCount = activeContent
    ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
    : 0;

  const themeIcon =
    themeMode === "dark" ? "☀" : themeMode === "light" ? "🖥" : "◑";

  // Grid columns: sidebar | editor | rhyme panel (only in write tab)
  const col3 = activeTab === "write" && rhymePanelOpen ? "360px" : "0";
  const gridCols = `${sidebarOpen ? "280px" : "48px"} 1fr ${col3}`;

  return (
    <div className={`app${isDark ? " theme-dark" : ""}`}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="wordmark">Rhymathic</span>
        </div>

        <nav className="topbar-nav">
          <button
            className={`topbar-tab${activeTab === "write" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("write")}
          >Write</button>
          <button
            className={`topbar-tab${activeTab === "library" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("library")}
          >Library</button>
          <button
            className={`topbar-tab${activeTab === "voice" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >Voice</button>
        </nav>

        <div className="topbar-controls">
          {activeTab === "write" && !rhymePanelOpen && (
            <button
              className="theme-toggle"
              style={{ width: "auto", borderRadius: "var(--r-sm)", padding: "0 8px", fontSize: 11 }}
              onClick={() => setRhymePanelOpen(true)}
              aria-label="Open rhyme panel"
            >
              ⊞ Rhymes
            </button>
          )}
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
            onClick={() =>
              setThemeMode((m) =>
                m === "light" ? "dark" : m === "dark" ? "auto" : "light"
              )
            }
            title={`Theme: ${themeMode} — click to cycle`}
            aria-label="Cycle theme"
          >
            {themeIcon}
          </button>
        </div>
      </header>

      {/* ── Three-column layout ── */}
      <div
        className="layout"
        ref={layoutRef}
        style={{ gridTemplateColumns: gridCols }}
      >
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
          activeGroups={activeGroups}
        />

        <main className="editor-pane">
          {activeTab === "write" && (
            <>
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
                    ref={editorRef}
                    content={activeContent}
                    onContentChange={setActiveContent}
                    onSelectionChange={(q) => { if (!autoMode) setRhymeQuery(q); }}
                    onCursorChange={(q) => { if (autoMode) setRhymeQuery(q); }}
                    isDarkTheme={isDark}
                    activeColorGroups={activeColorGroups}
                    onGroupsChange={setActiveGroups}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "library" && (
            <LibraryPanel
              onSearchSelect={(q) => {
                setRhymeQuery(q);
                setActiveTab("write");
                setRhymePanelOpen(true);
              }}
            />
          )}

          {activeTab === "voice" && (
            <VoicePanel
              onTextReady={(text) => {
                setActiveContent((c) =>
                  c + (c.endsWith("\n") || c === "" ? "" : "\n") + text
                );
                setActiveTab("write");
              }}
            />
          )}
        </main>

        {activeTab === "write" && rhymePanelOpen && (
          <RhymeDictionary
            query={rhymeQuery}
            onQueryChange={setRhymeQuery}
            autoMode={autoMode}
            onAutoModeToggle={() => setAutoMode((o) => !o)}
            onCollapse={() => setRhymePanelOpen(false)}
            onPin={(word) => addToScratchpad(word)}
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <footer className="status-bar">
        <span>en-US · CMU + pyphen · Auto-save 1s</span>
        <span>build 2026.05</span>
      </footer>

      {/* ── Scratchpad overlay ── */}
      {scratchpadOpen && (
        <Scratchpad
          words={scratchpadWords}
          onRemove={(word) =>
            setScratchpadWords((prev) => prev.filter((w) => w !== word))
          }
          onClose={() => setScratchpadOpen(false)}
          onInsert={(word) => {
            editorRef.current?.insertAtCursor(word);
          }}
        />
      )}
    </div>
  );
}
