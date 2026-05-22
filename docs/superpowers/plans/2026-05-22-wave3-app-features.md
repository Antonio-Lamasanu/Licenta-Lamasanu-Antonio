# Wave 3 – App: Theme, Collapse, Library, Voice, Import, Scratchpad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all new props from Wave 2 components; implement 3-way auto theme; right-panel collapse; Library tab (Reference + Saved sub-tabs); Voice/STT tab (Web Speech API); Import .txt; Scratchpad floating/draggable window.

**Architecture:** `App.tsx` is the state orchestrator. New features are isolated components in `frontend/src/components/` — `LibraryPanel.tsx`, `VoiceInput.tsx`, `Scratchpad.tsx`. The Scratchpad is a floating layer in the app root, not inside any panel. Theme auto-mode uses `window.matchMedia` with a change listener.

**Tech Stack:** React 18, TypeScript strict, Web Speech API (browser-native, no extra deps), no new npm packages.

**Pre-requisite:** Wave 1 and Wave 2 plans must be merged. `RhymeDictionary` must have `onCollapse` and `onPin` props. `LyricEditor` must have `isDarkTheme`, `rhymeMode`, `showPhonemes`, `showStress`, `activeColorGroups` props. `NotesSidebar` must have `searchQuery`, `onSearchChange`, `activeColorGroups`, `onColorGroupToggle` props.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | All state orchestration changes |
| `frontend/src/index.css` | Theme auto, layout collapse, scratchpad styles |
| `frontend/src/components/LibraryPanel.tsx` | New file |
| `frontend/src/components/VoiceInput.tsx` | New file |
| `frontend/src/components/Scratchpad.tsx` | New file |

---

### Task 1: Implement 3-way auto theme

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace the `theme` state** with a 3-way type in `App.tsx`

Find:
```ts
const [theme, setTheme] = useState<"light" | "dark">("light");
```

Replace with:
```ts
const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("auto");
const [systemDark, setSystemDark] = useState(() =>
  window.matchMedia("(prefers-color-scheme: dark)").matches
);
```

- [ ] **Step 2: Add system theme listener** as a `useEffect`:

```ts
useEffect(() => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);
```

- [ ] **Step 3: Derive `isDark` from mode + system**

```ts
const isDark =
  themeMode === "dark" ||
  (themeMode === "auto" && systemDark);
```

- [ ] **Step 4: Update the app root class** — find:

```tsx
<div className={`app${theme === "dark" ? " theme-dark" : ""}`}>
```

Replace with:
```tsx
<div className={`app${isDark ? " theme-dark" : ""}`}>
```

- [ ] **Step 5: Replace the theme toggle button** — find:

```tsx
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "◑"}
          </button>
```

Replace with:
```tsx
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
            {themeMode === "dark" ? "☀" : themeMode === "auto" ? "◑" : "○"}
          </button>
```

- [ ] **Step 6: Pass `isDark` to LyricEditor**

Find the `<LyricEditor` in App.tsx and add:
```tsx
isDarkTheme={isDark}
```

- [ ] **Step 7: Verify**

1. Set OS to dark mode → app should go dark automatically (auto mode)
2. Click the toggle once → forces light mode (○ icon)
3. Click again → forces dark (☀ icon)
4. Click again → back to auto (◑ icon)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: 3-way auto/light/dark theme with system matchMedia listener"
```

---

### Task 2: Right panel collapse

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add `rhymePanelOpen` state** in `App.tsx`:

```ts
const [rhymePanelOpen, setRhymePanelOpen] = useState(true);
```

- [ ] **Step 2: Update the layout grid** to collapse the right panel:

Find:
```tsx
      <div className="layout" style={{ gridTemplateColumns: sidebarOpen ? "280px 1fr 360px" : "48px 1fr 360px" }}>
```

Replace with:
```tsx
      <div
        className="layout"
        style={{
          gridTemplateColumns: `${sidebarOpen ? "280px" : "48px"} 1fr ${rhymePanelOpen ? "360px" : "48px"}`,
        }}
      >
```

- [ ] **Step 3: Pass collapse callback to RhymeDictionary**

Find `<RhymeDictionary` and add:
```tsx
onCollapse={() => setRhymePanelOpen(false)}
```

- [ ] **Step 4: Render a collapsed rhyme panel icon when closed**

Wrap `<RhymeDictionary>` in a conditional:
```tsx
{rhymePanelOpen ? (
  <RhymeDictionary
    query={rhymeQuery}
    onQueryChange={setRhymeQuery}
    autoMode={autoMode}
    onAutoModeToggle={() => setAutoMode((o) => !o)}
    onCollapse={() => setRhymePanelOpen(false)}
    onPin={(word) => addScratchpadItem(word)}
  />
) : (
  <div className="rhyme-panel-collapsed">
    <button
      className="sidebar-collapse-btn"
      style={{ margin: "14px auto", display: "block" }}
      onClick={() => setRhymePanelOpen(true)}
      aria-label="Open rhyme panel"
    >
      ☰
    </button>
  </div>
)}
```

- [ ] **Step 5: Add CSS for collapsed rhyme panel** in `index.css`:

```css
.rhyme-panel-collapsed {
  width: 48px;
  background: var(--panel);
  border-left: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  height: 100%;
}
```

- [ ] **Step 6: Verify collapse/expand works**

Click the → button in the rhyme panel header — it collapses to 48px. Click the ☰ icon — it expands back.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: collapsible rhyme panel with collapse/expand toggle"
```

---

### Task 3: Create `LibraryPanel.tsx`

The Library panel has two sub-tabs: **Reference** (hardcoded rhyme scheme examples) and **Saved** (saved searches from backend).

**Files:**
- Create: `frontend/src/components/LibraryPanel.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/LibraryPanel.tsx`**

```tsx
import { useState, useEffect } from "react";
import { fetchSavedSearches, deleteSavedSearch, type SavedSearch } from "../api/savedSearches";

const RHYME_SCHEMES = [
  {
    name: "AABB",
    title: "Couplets",
    description: "Each pair of lines rhymes together. Common in nursery rhymes, rap.",
    example: ["Roses are red,", "Violets are blue,", "Sugar is sweet,", "And so are you."],
    labels: ["A", "A", "B", "B"],
  },
  {
    name: "ABAB",
    title: "Alternating",
    description: "Lines 1&3 rhyme, lines 2&4 rhyme. Classic ballad and pop song structure.",
    example: [
      "Shall I compare thee to a summer's day?",
      "Thou art more lovely and more temperate.",
      "Rough winds do shake the darling buds of May,",
      "And summer's lease hath all too short a date.",
    ],
    labels: ["A", "B", "A", "B"],
  },
  {
    name: "ABBA",
    title: "Enclosed / Italian",
    description: "Outer lines rhyme around inner rhyming pair. Used in sonnets.",
    example: [
      "I hold it true, whate'er befall;",
      "I feel it, when I sorrow most;",
      "'Tis better to have loved and lost",
      "Than never to have loved at all.",
    ],
    labels: ["A", "B", "B", "A"],
  },
  {
    name: "AABA",
    title: "Rubaiyat",
    description: "Three rhyming lines wrap a non-rhyming middle. Persian poetry, some folk.",
    example: [
      "A Book of Verses underneath the Bough,",
      "A Jug of Wine, a Loaf of Bread—and Thou",
      "Beside me singing in the Wilderness—",
      "Oh, Wilderness were Paradise enow!",
    ],
    labels: ["A", "A", "B", "A"],
  },
  {
    name: "ABCABC",
    title: "Sestet",
    description: "Six-line stanza where each line rhyme recurs once. Common in hymns.",
    example: [
      "Amazing grace! How sweet the sound",
      "That saved a wretch like me!",
      "I once was lost, but now am found;",
      "Was blind, but now I see.",
      "— (extend to 6 lines)",
      "—",
    ],
    labels: ["A", "B", "C", "A", "B", "C"],
  },
  {
    name: "Free verse",
    title: "Free Verse",
    description: "No fixed rhyme scheme. Rhythm comes from line breaks, repetition, cadence.",
    example: [
      "I am large, I contain multitudes.",
      "Do I contradict myself?",
      "Very well then I contradict myself.",
      "(I am large, I contain multitudes.)",
    ],
    labels: ["-", "-", "-", "-"],
  },
];

const SCHEME_COLORS: Record<string, string> = {
  A: "#FFE7B0", B: "#D9E8FF", C: "#C9EBD2",
  D: "#E5DCFF", E: "#FFD9EC", "-": "transparent",
};

interface LibraryPanelProps {
  onSearchSelect?: (query: string) => void;
}

export default function LibraryPanel({ onSearchSelect }: LibraryPanelProps) {
  const [tab, setTab] = useState<"reference" | "saved">("reference");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loadingSearches, setLoadingSearches] = useState(false);

  useEffect(() => {
    if (tab !== "saved") return;
    setLoadingSearches(true);
    fetchSavedSearches()
      .then(setSavedSearches)
      .catch(console.error)
      .finally(() => setLoadingSearches(false));
  }, [tab]);

  async function handleDelete(id: number) {
    await deleteSavedSearch(id).catch(console.error);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <main className="library-pane">
      <div className="library-header">
        <h2 className="library-title">Library</h2>
        <div className="library-tabs">
          <button
            className={`library-tab${tab === "reference" ? " library-tab--active" : ""}`}
            onClick={() => setTab("reference")}
          >Reference</button>
          <button
            className={`library-tab${tab === "saved" ? " library-tab--active" : ""}`}
            onClick={() => setTab("saved")}
          >Saved searches</button>
        </div>
      </div>

      {tab === "reference" && (
        <div className="library-schemes">
          {RHYME_SCHEMES.map((scheme) => (
            <div key={scheme.name} className="scheme-card">
              <div className="scheme-card-head">
                <span className="scheme-badge">{scheme.name}</span>
                <span className="scheme-card-title">{scheme.title}</span>
              </div>
              <p className="scheme-card-desc">{scheme.description}</p>
              <div className="scheme-example">
                {scheme.example.map((line, i) => (
                  <div key={i} className="scheme-example-line">
                    <span
                      className="scheme-example-label"
                      style={{ background: SCHEME_COLORS[scheme.labels[i]] ?? "transparent" }}
                    >
                      {scheme.labels[i]}
                    </span>
                    <span className="scheme-example-text">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "saved" && (
        <div className="library-saved">
          {loadingSearches && (
            <div className="library-empty">Loading…</div>
          )}
          {!loadingSearches && savedSearches.length === 0 && (
            <div className="library-empty">
              No saved searches yet. Use the ♡ Save button in the Rhyme Dictionary.
            </div>
          )}
          {!loadingSearches && savedSearches.map((s) => (
            <div key={s.id} className="saved-search-item">
              <button
                className="saved-search-query"
                onClick={() => onSearchSelect?.(s.query)}
                title="Search this in the Rhyme Dictionary"
              >
                {s.query}
              </button>
              <span className="saved-search-date">
                {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button
                className="saved-search-delete"
                onClick={() => handleDelete(s.id)}
                aria-label="Delete saved search"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add Library CSS** in `index.css`:

```css
/* ─── Library panel ─── */
.library-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  height: 100%;
}

.library-header {
  padding: 24px 36px 0;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}

.library-title {
  font-family: var(--serif);
  font-size: 28px;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 16px;
}

.library-tabs {
  display: flex;
  gap: 4px;
}

.library-tab {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ink-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.library-tab:hover { color: var(--ink-2); }
.library-tab--active { color: var(--ink); border-bottom-color: var(--ink); }

.library-schemes {
  flex: 1;
  overflow-y: auto;
  padding: 20px 36px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scheme-card {
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 14px 16px;
}

.scheme-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.scheme-badge {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  background: var(--bg-deep);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: 2px 7px;
  color: var(--ink-2);
  letter-spacing: 0.05em;
}

.scheme-card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}

.scheme-card-desc {
  font-size: 12.5px;
  color: var(--ink-3);
  margin: 0 0 10px;
  line-height: 1.5;
}

.scheme-example {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.scheme-example-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.scheme-example-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--ink-2);
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
}

.scheme-example-text {
  font-family: var(--serif);
  font-style: italic;
  font-size: 13.5px;
  color: var(--ink-3);
}

.library-saved {
  flex: 1;
  overflow-y: auto;
  padding: 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.library-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-4);
}

.saved-search-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
}

.saved-search-query {
  flex: 1;
  background: none;
  border: none;
  font-family: var(--serif);
  font-size: 15px;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  padding: 0;
}
.saved-search-query:hover { color: var(--accent); }

.saved-search-date {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-4);
  flex-shrink: 0;
}

.saved-search-delete {
  background: none;
  border: none;
  color: var(--ink-4);
  font-size: 15px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.saved-search-delete:hover { color: var(--accent); }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LibraryPanel.tsx frontend/src/index.css
git commit -m "feat: LibraryPanel with Reference rhyme schemes and Saved searches sub-tabs"
```

---

### Task 4: Wire Library tab into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add Library import and active tab state**

At top of `App.tsx`:
```ts
import LibraryPanel from "./components/LibraryPanel";
```

Add state:
```ts
const [activeTab, setActiveTab] = useState<"write" | "library" | "voice">("write");
```

- [ ] **Step 2: Update the topbar tab buttons** — find:

```tsx
        <nav className="topbar-nav">
          <button className="topbar-tab topbar-tab--active">Write</button>
          {/* TODO: Library tab — no backend */}
          <button className="topbar-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Library</button>
          {/* TODO: Voice tab — no backend */}
          <button className="topbar-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Voice</button>
        </nav>
```

Replace with:
```tsx
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
```

- [ ] **Step 3: Update the layout content** to show the right panel based on `activeTab`

Find the `<main className="editor-pane">` block and wrap the whole three-column layout content:

Replace the inner content of the `<div className="layout">` to conditionally render:

```tsx
      <div
        className="layout"
        style={{
          gridTemplateColumns: `${sidebarOpen ? "280px" : "48px"} 1fr ${
            activeTab === "write" && rhymePanelOpen ? "360px" : activeTab === "write" ? "48px" : "0px"
          }`,
        }}
      >
        <NotesSidebar ... />

        <main className="editor-pane">
          {activeTab === "write" && (
            /* existing write content */
          )}
          {activeTab === "library" && (
            <LibraryPanel
              onSearchSelect={(q) => {
                setRhymeQuery(q);
                setActiveTab("write");
              }}
            />
          )}
          {activeTab === "voice" && (
            <VoiceInput onTextReady={(text) => {
              setActiveContent((c) => c + (c.endsWith("\n") || c === "" ? "" : "\n") + text);
              setActiveTab("write");
            }} />
          )}
        </main>

        {activeTab === "write" && (rhymePanelOpen ? (
          <RhymeDictionary ... />
        ) : (
          <div className="rhyme-panel-collapsed">...</div>
        ))}
      </div>
```

Note: The exact nesting will require reading the current layout code and inserting conditionals carefully. The key replacements are:
1. Wrap write-mode editor content in `{activeTab === "write" && (...)}` 
2. Add `{activeTab === "library" && <LibraryPanel ... />}`
3. Add `{activeTab === "voice" && <VoiceInput ... />}`
4. Wrap `RhymeDictionary` in `{activeTab === "write" && (...)}` since the rhyme panel only makes sense in Write mode

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire Library and Voice tabs, active tab state in App"
```

---

### Task 5: Create `VoiceInput.tsx` (Web Speech API)

**Files:**
- Create: `frontend/src/components/VoiceInput.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/VoiceInput.tsx`**

```tsx
import { useState, useEffect, useRef } from "react";

interface VoiceInputProps {
  onTextReady: (text: string) => void;
}

// Web Speech API types are not in standard TS lib — declare minimal interface
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }
}

const SpeechRecognitionClass =
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export default function VoiceInput({ onTextReady }: VoiceInputProps) {
  const [supported] = useState(() => SpeechRecognitionClass !== null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startListening() {
    if (!SpeechRecognitionClass) return;
    setError(null);
    setFinalLines([]);
    setInterimText("");

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setFinalLines((prev) => [...prev, result[0].transcript.trim()]);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setError("Microphone error. Check browser permissions.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function handleInsert() {
    const text = [...finalLines, interimText].filter(Boolean).join("\n");
    if (text.trim()) {
      onTextReady(text.trim());
    }
  }

  if (!supported) {
    return (
      <main className="voice-pane">
        <div className="voice-unsupported">
          <p>Voice input is not supported in this browser.</p>
          <p>Use <strong>Chrome</strong> or <strong>Edge</strong> for Web Speech API support.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="voice-pane">
      <div className="voice-header">
        <h2 className="library-title">Voice Input</h2>
        <p className="voice-subtitle">Speak your lyrics — they'll be transcribed below. Chrome/Edge only.</p>
      </div>

      <div className="voice-controls">
        {!listening ? (
          <button className="voice-record-btn" onClick={startListening}>
            ● Start recording
          </button>
        ) : (
          <button className="voice-record-btn voice-record-btn--active" onClick={stopListening}>
            ■ Stop recording
          </button>
        )}
        {(finalLines.length > 0 || interimText) && (
          <button className="voice-insert-btn" onClick={handleInsert}>
            ↩ Insert into note
          </button>
        )}
      </div>

      {error && <p className="voice-error">{error}</p>}

      <div className="voice-transcript">
        {finalLines.map((line, i) => (
          <div key={i} className="voice-line voice-line--final">{line}</div>
        ))}
        {interimText && (
          <div className="voice-line voice-line--interim">{interimText}</div>
        )}
        {!listening && finalLines.length === 0 && !interimText && (
          <div className="voice-placeholder">Transcription will appear here…</div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add Voice CSS** in `index.css`:

```css
/* ─── Voice panel ─── */
.voice-pane {
  display: flex;
  flex-direction: column;
  padding: 24px 36px;
  overflow: hidden;
  background: var(--bg);
  height: 100%;
  gap: 20px;
}

.voice-header { flex-shrink: 0; }

.voice-subtitle {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0;
}

.voice-controls {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.voice-record-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid var(--ink);
  border-radius: var(--r-md);
  background: none;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.15s;
}
.voice-record-btn:hover { background: var(--bg-soft); }
.voice-record-btn--active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.voice-insert-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid var(--accent-2);
  border-radius: var(--r-md);
  background: none;
  color: var(--accent-2);
  cursor: pointer;
  transition: all 0.15s;
}
.voice-insert-btn:hover { background: var(--bg-soft); }

.voice-error {
  color: var(--accent);
  font-size: 13px;
  margin: 0;
}

.voice-transcript {
  flex: 1;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 200px;
}

.voice-line {
  font-family: var(--serif);
  font-size: 19px;
  line-height: 1.6;
  color: var(--ink);
}
.voice-line--interim { color: var(--ink-4); font-style: italic; }

.voice-placeholder {
  font-size: 13px;
  color: var(--ink-4);
  font-style: italic;
  align-self: center;
  margin: auto;
}

.voice-unsupported {
  padding: 40px;
  text-align: center;
  color: var(--ink-3);
  font-size: 14px;
  line-height: 1.8;
}
```

- [ ] **Step 3: Import VoiceInput in App.tsx**

```ts
import VoiceInput from "./components/VoiceInput";
```

- [ ] **Step 4: Verify voice input**

1. Switch to the Voice tab
2. Click "Start recording" (browser will ask for microphone permission — grant it)
3. Speak a line
4. Transcription appears below
5. Click "Insert into note" — switches back to Write tab and appends the text

(Test in Chrome or Edge. Firefox/Safari show the "not supported" message.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VoiceInput.tsx frontend/src/index.css frontend/src/App.tsx
git commit -m "feat: Voice tab with Web Speech API transcription"
```

---

### Task 6: Scratchpad floating window

**Files:**
- Create: `frontend/src/components/Scratchpad.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `frontend/src/components/Scratchpad.tsx`**

```tsx
import { useState, useRef, useCallback } from "react";

export interface ScratchpadItem {
  id: number;
  text: string;
}

interface ScratchpadProps {
  items: ScratchpadItem[];
  onRemove: (id: number) => void;
  onClose: () => void;
  onInsert?: (text: string) => void;
}

export default function Scratchpad({ items, onRemove, onClose, onInsert }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - 320, y: 120 });
  const [minimized, setMinimized] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };

    function onMove(ev: MouseEvent) {
      if (!dragStart.current) return;
      setPos({
        x: dragStart.current.px + (ev.clientX - dragStart.current.mx),
        y: dragStart.current.py + (ev.clientY - dragStart.current.my),
      });
    }

    function onUp() {
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  return (
    <div
      className="scratchpad"
      style={{ left: pos.x, top: pos.y, height: minimized ? "auto" : 300 }}
    >
      <div className="scratchpad-header" onMouseDown={onMouseDown}>
        <span className="scratchpad-title">Scratchpad ({items.length})</span>
        <div className="scratchpad-controls">
          <button onClick={() => setMinimized((m) => !m)} aria-label="Minimize">
            {minimized ? "□" : "—"}
          </button>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      {!minimized && (
        <div className="scratchpad-body">
          {items.length === 0 && (
            <div className="scratchpad-empty">
              Pin words from the Rhyme Dictionary to collect them here.
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="scratchpad-item">
              <span
                className="scratchpad-word"
                onClick={() => onInsert?.(item.text)}
                title="Click to insert at cursor"
              >
                {item.text}
              </span>
              <button
                className="scratchpad-remove"
                onClick={() => onRemove(item.id)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Scratchpad CSS** in `index.css`:

```css
/* ─── Scratchpad floating window ─── */
.scratchpad {
  position: fixed;
  z-index: 100;
  width: 260px;
  background: var(--panel);
  border: 1px solid var(--rule-2);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scratchpad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--rule);
  cursor: grab;
  user-select: none;
}
.scratchpad-header:active { cursor: grabbing; }

.scratchpad-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.scratchpad-controls {
  display: flex;
  gap: 4px;
}

.scratchpad-controls button {
  background: none;
  border: none;
  color: var(--ink-4);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 3px;
}
.scratchpad-controls button:hover { color: var(--ink-2); background: var(--bg-soft); }

.scratchpad-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
}

.scratchpad-empty {
  width: 100%;
  padding: 20px 8px;
  text-align: center;
  font-size: 11.5px;
  color: var(--ink-4);
  line-height: 1.5;
}

.scratchpad-item {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-soft);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: 3px 6px 3px 8px;
}

.scratchpad-word {
  font-family: var(--serif);
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}
.scratchpad-word:hover { color: var(--accent); }

.scratchpad-remove {
  background: none;
  border: none;
  color: var(--ink-4);
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.scratchpad-remove:hover { color: var(--accent); }
```

- [ ] **Step 3: Wire Scratchpad into App.tsx**

Add import:
```ts
import Scratchpad, { type ScratchpadItem } from "./components/Scratchpad";
```

Add state:
```ts
const [scratchpadItems, setScratchpadItems] = useState<ScratchpadItem[]>([]);
const [scratchpadOpen, setScratchpadOpen] = useState(false);
const scratchpadNextId = useRef(0);

function addScratchpadItem(text: string) {
  setScratchpadItems((prev) => {
    if (prev.some((i) => i.text === text)) return prev; // dedupe
    return [...prev, { id: scratchpadNextId.current++, text }];
  });
  setScratchpadOpen(true);
}
```

In the JSX (inside the app root div, after `<footer>`):
```tsx
{scratchpadOpen && (
  <Scratchpad
    items={scratchpadItems}
    onRemove={(id) => setScratchpadItems((prev) => prev.filter((i) => i.id !== id))}
    onClose={() => setScratchpadOpen(false)}
    onInsert={(text) => {
      // Append text at end of active content
      setActiveContent((c) => c + (c.endsWith("\n") || c === "" ? "" : "\n") + text);
    }}
  />
)}
```

Pass `onPin` to `RhymeDictionary`:
```tsx
onPin={(word) => addScratchpadItem(word)}
```

- [ ] **Step 4: Verify scratchpad**

1. Search for a word in the Rhyme Dictionary
2. Hover over a result chip — pin button appears
3. Click pin — scratchpad window opens in bottom-right area
4. Multiple words can be pinned (duplicates are deduped)
5. Drag the scratchpad header — window moves freely
6. Click "—" to minimize (shows header only)
7. Click a word in the scratchpad — it appends to the current note
8. Click "×" on a word to remove it
9. Click "×" in the header to close the scratchpad

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Scratchpad.tsx frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: draggable floating Scratchpad with pin from RhymeDictionary"
```

---

### Task 7: Import .txt

**Files:**
- Modify: `frontend/src/App.tsx`

The Import button was already scaffolded in the LyricEditor toolbar in Wave 2. Wave 3 should move it to the App level (as a proper handler) so it creates a new note rather than replacing the current content.

- [ ] **Step 1: Add import handler in App.tsx**

```ts
function handleImportTxt() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt";
  input.onchange = async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const title = file.name.replace(/\.txt$/, "");
    try {
      const note = await createNote(title, text);
      setNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      setActiveTitle(note.title);
      setActiveContent(note.content);
      setLastSaved(note.title, note.content);
    } catch (e) {
      console.error(e);
    }
  };
  input.click();
}
```

- [ ] **Step 2: Replace the toolbar Import button in `LyricEditor.tsx`**

Remove the inline import button that was added in Wave 2 (the `onClick` with `document.createElement("input")`). Instead, add an `onImport` optional prop to `LyricEditorProps`:

```ts
onImport?: () => void;
```

And in the toolbar JSX:
```tsx
        {onImport && (
          <button className="toolbar-action toolbar-action--primary" onClick={onImport}>
            Import .txt
          </button>
        )}
```

Pass it from App:
```tsx
<LyricEditor
  ...
  onImport={handleImportTxt}
/>
```

- [ ] **Step 3: Verify import**

1. Create a `.txt` file on disk with some lyric content
2. Click "Import .txt" in the toolbar
3. A new note is created with the filename as title and file content as content
4. The note appears in the sidebar and becomes active

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/LyricEditor.tsx
git commit -m "feat: Import .txt creates a new note from file"
```
