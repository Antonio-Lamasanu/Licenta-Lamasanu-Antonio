import { useEffect, useRef, useState } from "react";
import LyricEditor, { type LyricEditorHandle } from "./components/LyricEditor";
import NotesSidebar from "./components/NotesSidebar";
import RhymeDictionary from "./components/RhymeDictionary";
import LibraryPanel from "./components/LibraryPanel";
import AdminPanel from "./components/AdminPanel";
import Scratchpad from "./components/Scratchpad";
import ChatPanel from "./components/ChatPanel";
import ChatDockHeader from "./components/ChatDockHeader";
import FloatingChatWindow from "./components/FloatingChatWindow";
import ResizableSplit from "./components/ResizableSplit";
import OnboardingModal from "./components/OnboardingModal";
import PreferencesModal from "./components/PreferencesModal";
import { useChatDock } from "./hooks/useChatDock";
import { useTheme } from "./hooks/useTheme";
import { useScratchpad } from "./hooks/useScratchpad";
import { useNotes } from "./hooks/useNotes";
import { useChatWorkflow, type EditSuggestion, type ResolvedEdit } from "./hooks/useChatWorkflow";
import type { ActiveGroup } from "./api/syllables";
import type { User } from "./api/auth";

export type { EditSuggestion, ResolvedEdit };

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
  const { themeMode, isDark, themeIcon, cycleTheme } = useTheme();

  // ── Layout state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rhymePanelOpen, setRhymePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"write" | "library" | "chat" | "admin">("write");

  // ── Onboarding / preferences ──
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // ── Rhyme query + auto mode ──
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [autoMode, setAutoMode] = useState(false);

  // ── Active rhyme groups ──
  const [activeGroups, setActiveGroups] = useState<ActiveGroup[]>([]);
  const [activeColorGroups, setActiveColorGroups] = useState<Set<number> | null>(null);
  const [editorMode, setEditorMode] = useState<"rhymes" | "stress">("rhymes");

  const {
    notes,
    activeNoteId,
    activeTitle,
    activeContent,
    setActiveContent,
    sidebarSearch,
    setSidebarSearch,
    saveStatus,
    lineCount,
    selectNote,
    newNote,
    removeNote,
    renameNote,
    handleContentChange,
    handleTitleChange,
  } = useNotes(() => setActiveColorGroups(null));

  const {
    scratchpadWords,
    scratchpadText,
    setScratchpadText,
    scratchpadOpen,
    setScratchpadOpen,
    addToScratchpad,
    removeFromScratchpad,
  } = useScratchpad();

  const editorRef = useRef<LyricEditorHandle>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const chatDockCtl = useChatDock(mainAreaRef, rightColumnRef);
  const { dock: chatDock, preview: chatDockPreview } = chatDockCtl;

  const {
    chatSessions,
    activeChatSessionId,
    chatTurns,
    chatTurnsLoading,
    chatSending,
    chatPendingUserText,
    chatStreamingText,
    chatError,
    chatInject,
    editSuggestions,
    userTurnDisplay,
    assistantEditText,
    noteContextHint,
    setNoteContextHint,
    resolvedEdits,
    resolvedTurnIds,
    openChatSession,
    handleNewChatSession,
    handleDeleteChatSession,
    handleRenameChatSession,
    handleSendChatMessage,
    handleChangeThisRequest,
    handleAcceptEditSuggestion,
    handleRejectEditSuggestion,
    injectIntoChat,
  } = useChatWorkflow({
    activeNoteId,
    activeContent,
    setActiveContent,
    editorRef,
    activeTab,
    chatDock,
    openFloatingChat: chatDockCtl.openFloating,
  });

  // ── Effects ──

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
    if (justRegistered) setShowOnboarding(true);
  }, [justRegistered]);

  // ── Handlers ──

  function handleSelectNote(id: number) {
    selectNote(id);
    switchTab("write");
  }

  async function handleNewNote() {
    try {
      await newNote();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteNote(id: number) {
    try {
      await removeNote(id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRenameNote(id: number, title: string) {
    try {
      await renameNote(id, title);
    } catch (e) {
      console.error(e);
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

  function switchTab(tab: "write" | "library" | "chat" | "admin") {
    if (tab === activeTab) return;
    if (tab === "chat") {
      if (chatDock.mode !== "closed") chatDockCtl.close();
    } else if (activeTab === "chat" && activeChatSessionId !== null && chatDock.mode === "closed") {
      chatDockCtl.openFloating();
    }
    setActiveTab(tab);
  }

  const themeToggleTitle = `Theme: ${themeMode} — click to cycle`;

  const dockedInMain = chatDock.mode === "main" && activeTab !== "chat";
  const dockedInSide = chatDock.mode === "side" && activeTab !== "chat";
  const rightColumnVisible = (activeTab === "write" && rhymePanelOpen) || dockedInSide;
  const col3 = rightColumnVisible ? "360px" : activeTab === "write" ? "48px" : "0";
  const gridCols = `${sidebarOpen ? "280px" : "48px"} 1fr ${col3}`;

  function renderChatPanel(showMinimize: boolean) {
    return (
      <ChatPanel
        isDark={isDark}
        session={chatSessions.find((s) => s.id === activeChatSessionId) ?? null}
        turns={chatTurns}
        loadingTurns={chatTurnsLoading}
        sending={chatSending}
        pendingUserText={chatPendingUserText}
        streamingText={chatStreamingText}
        error={chatError}
        onSend={handleSendChatMessage}
        injectText={chatInject}
        showMinimizeButton={showMinimize}
        onMinimize={() => switchTab("write")}
        editSuggestions={editSuggestions}
        userTurnDisplay={userTurnDisplay}
        assistantEditText={assistantEditText}
        resolvedTurnIds={resolvedTurnIds}
        onAcceptEdit={handleAcceptEditSuggestion}
        onRejectEdit={handleRejectEditSuggestion}
        showNoteContextHint={noteContextHint}
        onDismissNoteContextHint={() => setNoteContextHint(false)}
        onInsertFullNote={() => {
          setNoteContextHint(false);
          void injectIntoChat(activeContent, "Full note");
        }}
      />
    );
  }

  function renderDockedChatPane() {
    return (
      <div className="chat-dock-pane">
        <ChatDockHeader onDragStart={chatDockCtl.startDrag} onClose={chatDockCtl.close} />
        <div className="chat-dock-pane-body">{renderChatPanel(false)}</div>
      </div>
    );
  }

  const tabContent = (
    <>
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
                <button
                  className="editor-meta-btn editor-meta-btn--highlight"
                  onClick={() => injectIntoChat(activeContent, "Full note")}
                  disabled={!activeContent}
                  title="Insert this note into the current chat"
                >
                  Insert into Chat
                </button>
              </div>
              <LyricEditor
                ref={editorRef}
                content={activeContent}
                onContentChange={handleContentChange}
                onSelectionChange={(q) => { if (q) setRhymeQuery(q); }}
                onCursorChange={(q) => { if (autoMode) setRhymeQuery(q); }}
                isDarkTheme={isDark}
                activeColorGroups={activeColorGroups}
                onGroupsChange={setActiveGroups}
                onModeChange={setEditorMode}
                onSendToChat={injectIntoChat}
                onChangeThis={handleChangeThisRequest}
                activeEdits={resolvedEdits}
                onAcceptEdit={handleAcceptEditSuggestion}
                onRejectEdit={handleRejectEditSuggestion}
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
            switchTab("write");
            setRhymePanelOpen(true);
          }}
        />
      )}

      {activeTab === "chat" && renderChatPanel(true)}

      {activeTab === "admin" && user.is_admin && (
        <AdminPanel currentUserId={user.id} />
      )}
    </>
  );

  const rhymeDictionaryNode = (
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
  );

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
            onClick={() => switchTab("write")}
          >Write</button>
          <button
            className={`topbar-tab${activeTab === "chat" ? " topbar-tab--active" : ""}`}
            onClick={() => switchTab("chat")}
          >Chat</button>
          <button
            className={`topbar-tab${activeTab === "library" ? " topbar-tab--active" : ""}`}
            onClick={() => switchTab("library")}
          >Library</button>
          {user.is_admin && (
            <button
              className={`topbar-tab${activeTab === "admin" ? " topbar-tab--active" : ""}`}
              onClick={() => switchTab("admin")}
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
            className={`theme-toggle${scratchpadOpen ? " theme-toggle--active" : ""}`}
            onClick={() => setScratchpadOpen((o) => !o)}
            title="Scratchpad"
            aria-label="Toggle scratchpad"
          >
            📌
          </button>
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
            onClick={cycleTheme}
            title={themeToggleTitle}
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
          editorMode={editorMode}
          isDarkTheme={isDark}
          chatSessions={chatSessions}
          activeChatSessionId={activeChatSessionId}
          onSelectChatSession={openChatSession}
          onNewChatSession={handleNewChatSession}
          onDeleteChatSession={handleDeleteChatSession}
          onRenameChatSession={handleRenameChatSession}
        />

        <main className="editor-pane" ref={mainAreaRef}>
          {dockedInMain ? (
            <ResizableSplit
              direction={chatDock.side === "left" || chatDock.side === "right" ? "row" : "column"}
              first={
                chatDock.side === "left" || chatDock.side === "top" ? renderDockedChatPane() : tabContent
              }
              second={
                chatDock.side === "left" || chatDock.side === "top" ? tabContent : renderDockedChatPane()
              }
            />
          ) : (
            tabContent
          )}
        </main>

        {activeTab === "write" || dockedInSide ? (
          <div className="rhyme-panel-slot" ref={rightColumnRef}>
            {dockedInSide ? (
              <ResizableSplit
                direction="column"
                first={chatDock.side === "top" ? renderDockedChatPane() : rhymeDictionaryNode}
                second={chatDock.side === "top" ? rhymeDictionaryNode : renderDockedChatPane()}
              />
            ) : (
              rhymeDictionaryNode
            )}
          </div>
        ) : null}
      </div>

      {chatDock.mode === "floating" && activeTab !== "chat" && (
        <FloatingChatWindow
          x={chatDock.x}
          y={chatDock.y}
          width={chatDock.width}
          height={chatDock.height}
          isDark={isDark}
          onDragStart={chatDockCtl.startDrag}
          onResizeStart={chatDockCtl.startResize}
          onClose={chatDockCtl.close}
        >
          {renderChatPanel(false)}
        </FloatingChatWindow>
      )}

      {chatDockPreview && (
        <div
          className="chat-dock-preview"
          style={{
            left: chatDockPreview.rect.left,
            top: chatDockPreview.rect.top,
            width: chatDockPreview.rect.width,
            height: chatDockPreview.rect.height,
          }}
        />
      )}

      {/* ── Scratchpad overlay ── */}
      {scratchpadOpen && (
        <Scratchpad
          words={scratchpadWords}
          text={scratchpadText}
          onTextChange={setScratchpadText}
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
