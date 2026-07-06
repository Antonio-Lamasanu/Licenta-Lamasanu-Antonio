import { useState, useEffect, useRef } from "react";
import LyricEditor, { type LyricEditorHandle } from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import RhymeDictionary from "./components/RhymeDictionary";
import LibraryPanel from "./components/LibraryPanel";
import AdminPanel from "./components/AdminPanel";
import Scratchpad from "./components/Scratchpad";
import ChatPanel from "./components/ChatPanel";
import OnboardingModal from "./components/OnboardingModal";
import PreferencesModal from "./components/PreferencesModal";
import { useAutoSave } from "./hooks/useAutoSave";
import { fetchNotes, createNote, deleteNote, updateNote, searchNotes } from "./api/notes";
import { fetchScratchpad, pinScratchpadWord, unpinScratchpadWord } from "./api/scratchpad";
import {
  fetchChatSessions,
  createChatSession,
  deleteChatSession,
  fetchChatTurns,
  streamChatTurn,
  type ChatSession,
  type ChatTurn,
} from "./api/chat";
import type { Note } from "./types/note";
import type { ActiveGroup } from "./api/syllables";
import type { User } from "./api/auth";

function Wordmark({ isDark }: { isDark: boolean }) {
  return (
    <div className="wordmark">
      <img
        src={isDark ? "/logo-dark.png" : "/logo-light.png"}
        alt="Rhymathic logo"
        className="wordmark-logo"
        aria-hidden="true"
      />
      <span className="wordmark-text">
        <span className="wordmark-rhy">rhy</span>mathic
      </span>
    </div>
  );
}

interface AppProps {
  user: User;
  onLogout: () => void;
  justRegistered: boolean;
}

export default function App({ user, onLogout, justRegistered }: AppProps) {
  // ── Notes state ──
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("");
  const [activeContent, setActiveContent] = useState("");
  const titleIsManual = useRef(false);
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
  const [activeTab, setActiveTab] = useState<"write" | "library" | "chat" | "admin">("write");

  // ── Chat state ──
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<number | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatTurnsLoading, setChatTurnsLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatPendingUserText, setChatPendingUserText] = useState<string | null>(null);
  const [chatStreamingText, setChatStreamingText] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInject, setChatInject] = useState<{ text: string; seq: number } | null>(null);

  // ── Onboarding / preferences ──
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // ── Rhyme query + auto mode ──
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [autoMode, setAutoMode] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // ── Active rhyme groups ──
  const [activeGroups, setActiveGroups] = useState<ActiveGroup[]>([]);
  const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);

  // ── Scratchpad ──
  const [scratchpadWords, setScratchpadWords] = useState<string[]>([]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  const editorRef = useRef<LyricEditorHandle>(null);
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
          titleIsManual.current = first.title.trim() !== "";
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

  useEffect(() => {
    fetchScratchpad()
      .then((words) => setScratchpadWords(words.map((w) => w.word)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchChatSessions().then(setChatSessions).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeChatSessionId === null) {
      setChatTurns([]);
      return;
    }
    setChatTurnsLoading(true);
    setChatError(null);
    fetchChatTurns(activeChatSessionId)
      .then(setChatTurns)
      .catch(console.error)
      .finally(() => setChatTurnsLoading(false));
  }, [activeChatSessionId]);

  useEffect(() => {
    if (justRegistered) setShowOnboarding(true);
  }, [justRegistered]);

  // ── Handlers ──

  function handleSelectNote(id: number) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setActiveNoteId(note.id);
    setActiveTitle(note.title);
    setActiveContent(note.content);
    setLastSaved(note.title, note.content);
    setActiveColorGroups(null);
    titleIsManual.current = note.title.trim() !== "";
    setActiveTab("write");
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
      titleIsManual.current = false;
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

  async function handleRenameNote(id: number, title: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    try {
      await updateNote(id, title, note.content);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
      if (activeNoteId === id) {
        setActiveTitle(title);
        titleIsManual.current = title.trim() !== "";
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleContentChange(content: string) {
    setActiveContent(content);
    if (!titleIsManual.current) {
      const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
      const words = firstLine.trim().split(/\s+/).filter(Boolean);
      const autoTitle = words.length
        ? words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "")
        : "";
      setActiveTitle(autoTitle);
      if (activeNoteId !== null) {
        setNotes((prev) =>
          prev.map((n) => (n.id === activeNoteId ? { ...n, title: autoTitle } : n))
        );
      }
    }
  }

  function handleTitleChange(title: string) {
    setActiveTitle(title);
    titleIsManual.current = title.trim() !== "";
    if (activeNoteId !== null) {
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title } : n))
      );
    }
  }

  function handleColorGroupToggle(index: number) {
    setActiveColorGroups((prev) => {
      const allIndices = activeGroups.map((g) => g.colorIndex);
      // Build the current active set (null means all active)
      const current = prev ?? new Set(allIndices);
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
        return next;
      } else {
        next.add(index);
        // If all are now selected, return null (canonical "all" state)
        if (allIndices.every((i) => next.has(i))) return null;
        return next;
      }
    });
  }

  function handleToggleAll() {
    // Simple binary toggle: all selected → deselect all; anything else → select all
    setActiveColorGroups((prev) => (prev === null ? new Set<number>() : null));
  }

  function addToScratchpad(word: string) {
    setScratchpadWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setScratchpadOpen(true);
    pinScratchpadWord(word).catch(console.error);
  }

  function removeFromScratchpad(word: string) {
    setScratchpadWords((prev) => prev.filter((w) => w !== word));
    unpinScratchpadWord(word).catch(console.error);
  }

  async function handleNewChatSession() {
    try {
      const session = await createChatSession();
      setChatSessions((prev) => [session, ...prev]);
      setActiveChatSessionId(session.id);
      setActiveTab("chat");
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteChatSession(id: number) {
    try {
      await deleteChatSession(id);
      setChatSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeChatSessionId === id) {
        setActiveChatSessionId(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSendChatMessage(content: string) {
    if (activeChatSessionId === null) return;
    const sessionId = activeChatSessionId;
    setChatError(null);
    setChatSending(true);
    setChatPendingUserText(content);
    setChatStreamingText("");
    try {
      await streamChatTurn(sessionId, content, {
        onUserTurn: (turn) => {
          setChatTurns((prev) => [...prev, turn]);
          setChatPendingUserText(null);
        },
        onDelta: (text) => {
          setChatStreamingText((prev) => (prev ?? "") + text);
        },
        onDone: (assistantTurn, sessionTitle) => {
          setChatTurns((prev) => [...prev, assistantTurn]);
          setChatStreamingText(null);
          if (sessionTitle) {
            setChatSessions((prev) =>
              prev.map((s) => (s.id === sessionId ? { ...s, title: sessionTitle } : s))
            );
          }
        },
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setChatSending(false);
      setChatPendingUserText(null);
      setChatStreamingText(null);
    }
  }

  function handleSendToChat(text: string) {
    setChatInject({ text, seq: Date.now() });
    setActiveTab("chat");
  }

  function handleSearchRhymesFromSelection(text: string) {
    setRhymeQuery(text);
    setRhymePanelOpen(true);
  }

  const lineCount = activeContent
    ? activeContent.split("\n").filter((l) => l.trim().length > 0).length
    : 0;

  const themeIcon =
    themeMode === "dark" ? "☀" : themeMode === "light" ? "🖥" : "◑";

  const col3 = activeTab === "write" ? (rhymePanelOpen ? "360px" : "48px") : "0";
  const gridCols = `${sidebarOpen ? "280px" : "48px"} 1fr ${col3}`;

  return (
    <div className={`app${isDark ? " theme-dark" : ""}`}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <Wordmark isDark={isDark} />
        </div>

        <nav className="topbar-nav">
          <button
            className={`topbar-tab${activeTab === "write" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("write")}
          >Write</button>
          <button
            className={`topbar-tab${activeTab === "chat" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >Chat</button>
          <button
            className={`topbar-tab${activeTab === "library" ? " topbar-tab--active" : ""}`}
            onClick={() => setActiveTab("library")}
          >Library</button>
          {user.is_admin && (
            <button
              className={`topbar-tab${activeTab === "admin" ? " topbar-tab--active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >Admin</button>
          )}
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
            onClick={() => setShowPreferences(true)}
            title="Songwriting preferences"
            aria-label="Preferences"
          >
            ⚙
          </button>
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
          <button
            className="theme-toggle"
            onClick={onLogout}
            title={`Signed in as ${user.email} — click to sign out`}
            aria-label="Sign out"
          >
            ⏻
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
          onRenameNote={handleRenameNote}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          searchQuery={sidebarSearch}
          onSearchChange={setSidebarSearch}
          activeColorGroups={activeColorGroups}
          onColorGroupToggle={handleColorGroupToggle}
          onSelectAll={handleToggleAll}
          activeGroups={activeGroups}
          isDarkTheme={isDark}
          chatSessions={chatSessions}
          activeChatSessionId={activeChatSessionId}
          onSelectChatSession={(id) => { setActiveChatSessionId(id); setActiveTab("chat"); }}
          onNewChatSession={handleNewChatSession}
          onDeleteChatSession={handleDeleteChatSession}
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
                    onContentChange={handleContentChange}
                    onSelectionChange={(q) => { if (!autoMode) setRhymeQuery(q); }}
                    onCursorChange={(q) => { if (autoMode) setRhymeQuery(q); }}
                    isDarkTheme={isDark}
                    activeColorGroups={activeColorGroups}
                    onGroupsChange={setActiveGroups}
                    onSendToChat={handleSendToChat}
                    onSearchRhymes={handleSearchRhymesFromSelection}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "library" && (
            <LibraryPanel
              isDarkTheme={isDark}
              onSearchSelect={(q) => {
                setRhymeQuery(q);
                setActiveTab("write");
                setRhymePanelOpen(true);
              }}
            />
          )}

          {activeTab === "chat" && (
            <ChatPanel
              session={chatSessions.find((s) => s.id === activeChatSessionId) ?? null}
              turns={chatTurns}
              loadingTurns={chatTurnsLoading}
              sending={chatSending}
              pendingUserText={chatPendingUserText}
              streamingText={chatStreamingText}
              error={chatError}
              onSend={handleSendChatMessage}
              activeNoteContent={activeContent}
              injectText={chatInject}
            />
          )}

          {activeTab === "admin" && user.is_admin && (
            <AdminPanel currentUserId={user.id} />
          )}
        </main>

        {activeTab === "write" && (
          <RhymeDictionary
            isOpen={rhymePanelOpen}
            query={rhymeQuery}
            onQueryChange={setRhymeQuery}
            autoMode={autoMode}
            onAutoModeToggle={() => setAutoMode((o) => !o)}
            onCollapse={() => setRhymePanelOpen(false)}
            onExpand={() => setRhymePanelOpen(true)}
            onPin={(word) => addToScratchpad(word)}
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <footer className="status-bar">
        <span>en-US · CMU + pyphen · Auto-save 1s</span>
        <span>build 2026.06</span>
      </footer>

      {/* ── Scratchpad overlay ── */}
      {scratchpadOpen && (
        <Scratchpad
          words={scratchpadWords}
          onRemove={removeFromScratchpad}
          onClose={() => setScratchpadOpen(false)}
          onInsert={(word) => {
            editorRef.current?.insertAtCursor(word);
          }}
        />
      )}

      {/* ── Onboarding / preferences ── */}
      {showOnboarding && (
        <OnboardingModal onDone={() => setShowOnboarding(false)} />
      )}
      {showPreferences && (
        <PreferencesModal onClose={() => setShowPreferences(false)} />
      )}
    </div>
  );
}
