/* global React, ReactDOM */
const { useState, useMemo, useRef, useEffect } = React;

// ---------- sample lyric (original — written for this mockup) ----------
const SAMPLE_TITLE = "Slow weather";
const SAMPLE_LYRIC = `the rain keeps writing letters on the glass
each one a syllable i can't quite parse
i traced your name across the windowpane
then watched the morning wash it down the drain

a slow blue weather settles on the street
i count the hours out in even feet
the kettle hums a melody in three
the radiator answers, lazily

if i could fold this hour like a sheet
i'd press it flat and tuck it under me
and when the city wakes i'd let it go —
a paper boat across the afterglow`;

// Hand-tuned rhyme map for the sample so the mock looks real.
// Format: "lineIdx:wordIdx:sylIdx" -> color group key (a..h)
// We mark the LAST syllable of words at line ends, plus a couple of internal echoes,
// so the highlighting reads as a proper rhyme scheme.
const RHYMES = (() => {
  const m = new Map();
  const set = (l, w, s, k) => m.set(`${l}:${w}:${s}`, k);
  // Stanza 1: glass / parse / windowpane / drain  (a a / b b)
  set(0, 6, 0, "a");      // glass
  set(1, 6, 1, "a");      // parse
  set(2, 5, 2, "b");      // windowpane (last syl)
  set(3, 6, 0, "b");      // drain
  // internal echoes
  set(0, 1, 0, "c");      // rain
  set(2, 5, 0, "c");      // window... (win)
  set(1, 1, 0, "d");      // each / "ea"
  set(1, 5, 1, "d");      // can't quite parse → "quite" (long-i echo) — skip; keep simple

  // Stanza 2: street / feet / three / lazily  (e e / f f)
  set(4, 6, 0, "e");      // street
  set(5, 6, 1, "e");      // feet
  set(6, 6, 0, "e");      // three
  set(7, 3, 2, "e");      // lazily (last)
  // internal in stanza 2
  set(4, 2, 1, "g");      // weather
  set(7, 1, 2, "g");      // radiator (-tor)... loose
  // hours / even
  set(5, 3, 0, "h");      // hours
  set(6, 1, 0, "h");      // kettle? no — pick "hums"  -> skip

  // Stanza 3: sheet / me / go / afterglow  (i i / j j)
  set(8, 7, 0, "i");      // sheet
  set(9, 6, 0, "i");      // me
  set(10, 7, 0, "j");     // go
  set(11, 4, 1, "j");     // afterglow (-glow)
  // internal: fold/flat
  set(8, 3, 0, "f");      // fold
  set(9, 3, 0, "f");      // flat
  // city/paper
  set(10, 3, 0, "g");     // city
  set(11, 1, 0, "g");     // paper

  return m;
})();

// rhyme palette — paper highlighter washes (light) and ink-glow (dark)
const COLOR_KEYS = ["a","b","c","d","e","f","g","h","i","j","k"];
const PALETTE_LIGHT = {
  a: { bg: "#FFE7B0", ink: "#6B4A05" }, // butter
  b: { bg: "#FFD0C2", ink: "#7A2A12" }, // peach
  c: { bg: "#D9E8FF", ink: "#1E3A78" }, // sky
  d: { bg: "#E5DCFF", ink: "#3B2877" }, // lilac
  e: { bg: "#C9EBD2", ink: "#1E5E36" }, // mint
  f: { bg: "#FFD9EC", ink: "#7A1F4F" }, // rose
  g: { bg: "#F1E1B8", ink: "#5C4314" }, // sand
  h: { bg: "#CDE7E6", ink: "#1F4E4D" }, // teal
  i: { bg: "#FBE2A8", ink: "#6B4A05" }, // amber
  j: { bg: "#D8E4C2", ink: "#3F4F1F" }, // olive
  k: { bg: "#E8D9CC", ink: "#5A3A22" }, // clay
};
const PALETTE_DARK = {
  a: { bg: "rgba(255,200,80,0.22)",  ink: "#FFD58A" },
  b: { bg: "rgba(255,130,110,0.22)", ink: "#FFB39A" },
  c: { bg: "rgba(120,170,255,0.22)", ink: "#A8C4FF" },
  d: { bg: "rgba(170,140,255,0.22)", ink: "#C9B8FF" },
  e: { bg: "rgba(110,210,150,0.22)", ink: "#9FE6BA" },
  f: { bg: "rgba(255,140,200,0.22)", ink: "#FFB4D6" },
  g: { bg: "rgba(220,190,120,0.22)", ink: "#E8CD8C" },
  h: { bg: "rgba(120,200,200,0.22)", ink: "#A8D9D7" },
  i: { bg: "rgba(255,210,120,0.22)", ink: "#FFD58A" },
  j: { bg: "rgba(180,210,130,0.22)", ink: "#C5DA9A" },
  k: { bg: "rgba(220,180,150,0.22)", ink: "#E0BBA0" },
};

// fake syllable decomposition tuned to the sample text.
// Hard-coding this is fine — the real backend does the work; this mock just needs to look right.
const SYLLABLES = {
  "the": ["the"], "rain": ["rain"], "keeps": ["keeps"], "writing": ["writ","ing"],
  "letters": ["let","ters"], "on": ["on"], "glass": ["glass"], "each": ["each"],
  "one": ["one"], "a": ["a"], "syllable": ["syl","la","ble"], "i": ["i"], "can't": ["can't"],
  "quite": ["quite"], "parse": ["parse"], "traced": ["traced"], "your": ["your"],
  "name": ["name"], "across": ["a","cross"], "windowpane": ["win","dow","pane"],
  "then": ["then"], "watched": ["watched"], "morning": ["morn","ing"],
  "wash": ["wash"], "it": ["it"], "down": ["down"], "drain": ["drain"],
  "slow": ["slow"], "blue": ["blue"], "weather": ["weath","er"], "settles": ["set","tles"],
  "street": ["street"], "count": ["count"], "hours": ["hours"], "out": ["out"],
  "in": ["in"], "even": ["e","ven"], "feet": ["feet"], "kettle": ["ket","tle"],
  "hums": ["hums"], "melody": ["mel","o","dy"], "three": ["three"], "radiator": ["ra","di","a","tor"],
  "answers": ["an","swers"], "lazily": ["la","zi","ly"], "if": ["if"], "could": ["could"],
  "fold": ["fold"], "this": ["this"], "hour": ["hour"], "like": ["like"], "sheet": ["sheet"],
  "i'd": ["i'd"], "press": ["press"], "flat": ["flat"], "and": ["and"], "tuck": ["tuck"],
  "under": ["un","der"], "me": ["me"], "when": ["when"], "city": ["ci","ty"], "wakes": ["wakes"],
  "let": ["let"], "go": ["go"], "paper": ["pa","per"], "boat": ["boat"],
  "afterglow": ["af","ter","glow"], "to": ["to"],
};

function syllabify(word) {
  const lower = word.toLowerCase().replace(/[^\w']/g, "");
  return SYLLABLES[lower] || [lower || word];
}

function countSyllables(line) {
  const words = line.match(/\S+/g) || [];
  return words.reduce((acc, w) => acc + syllabify(w).length, 0);
}

// ---------- top-level app ----------
function App() {
  const [theme, setTheme] = useState("light"); // "light" | "dark"
  const [bodyFont, setBodyFont] = useState("serif"); // "serif" | "sans" | "mono"
  const [activeNoteId, setActiveNoteId] = useState(2);
  const [autoRhyme, setAutoRhyme] = useState(true);
  const [highlightDensity, setHighlightDensity] = useState("on"); // "on" | "soft" | "off"
  const [showSyllableNumbers, setShowSyllableNumbers] = useState(true);
  const [rhymeQuery, setRhymeQuery] = useState("afterglow");

  const palette = theme === "light" ? PALETTE_LIGHT : PALETTE_DARK;

  return (
    <div className={`app theme-${theme} body-${bodyFont} hl-${highlightDensity}`}>
      <TopBar theme={theme} setTheme={setTheme} />
      <div className="layout">
        <Sidebar activeId={activeNoteId} onSelect={setActiveNoteId} />
        <Editor
          palette={palette}
          showSyllableNumbers={showSyllableNumbers}
          highlightDensity={highlightDensity}
        />
        <RhymePanel
          query={rhymeQuery}
          setQuery={setRhymeQuery}
          autoMode={autoRhyme}
          setAutoMode={setAutoRhyme}
          palette={palette}
        />
      </div>
      <FooterStrip />
    </div>
  );
}

// ---------- top bar ----------
function TopBar({ theme, setTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <Wordmark />
      </div>
      <nav className="topbar-tabs">
        <button className="tab is-active">Write</button>
        <button className="tab">Library</button>
        <button className="tab">Voice</button>
      </nav>
      <div className="topbar-right">
        <span className="save-pill">
          <span className="dot" /> Saved · 2:14 pm
        </span>
        <button
          className="icon-btn"
          title="Toggle theme"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "◐" : "◑"}
        </button>
        <div className="avatar">A</div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <div className="wordmark">
      <svg viewBox="0 0 28 28" className="wordmark-glyph" aria-hidden="true">
        <circle cx="14" cy="14" r="13" fill="none" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M7 18 Q 10 8, 14 14 T 21 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="21" cy="12" r="1.6" fill="currentColor"/>
      </svg>
      <span className="wordmark-text">
        <em>rhym</em>athic
      </span>
    </div>
  );
}

// ---------- sidebar ----------
const NOTES = [
  { id: 1, title: "Cassette weather",   updated: "yesterday", lines: 41, color: "a" },
  { id: 2, title: "Slow weather",       updated: "just now",  lines: 12, color: "c" },
  { id: 3, title: "Letters to the rain",updated: "Apr 30",    lines: 28, color: "f" },
  { id: 4, title: "Bridge — verse 2",   updated: "Apr 28",    lines: 16, color: "e" },
  { id: 5, title: "Untitled",           updated: "Apr 22",    lines:  4, color: "g" },
  { id: 6, title: "Static / breath",    updated: "Apr 18",    lines: 33, color: "j" },
  { id: 7, title: "Empty rooms",        updated: "Apr 12",    lines: 22, color: "h" },
];

function Sidebar({ activeId, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="5"/>
            <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round"/>
          </svg>
          <input placeholder="Search notes" />
          <kbd>⌘K</kbd>
        </div>
        <button className="new-btn">
          <span>New</span>
          <span className="plus">+</span>
        </button>
      </div>

      <div className="sidebar-section-label">
        <span>All notes</span>
        <span>{NOTES.length}</span>
      </div>

      <div className="note-list">
        {NOTES.map((n) => (
          <button
            key={n.id}
            className={`note-row ${n.id === activeId ? "is-active" : ""}`}
            onClick={() => onSelect(n.id)}
          >
            <span className={`note-tab tab-${n.color}`} />
            <span className="note-body">
              <span className="note-title">{n.title}</span>
              <span className="note-meta">
                {n.lines} lines · {n.updated}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="legend-title">Rhyme legend</div>
        <div className="legend-grid">
          {["a","b","c","d","e","f","g","h"].map((k) => (
            <span key={k} className={`legend-chip chip-${k}`} />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ---------- editor ----------
function Editor({ palette, showSyllableNumbers }) {
  const lines = useMemo(() => SAMPLE_LYRIC.split("\n"), []);
  const stanzaBreaks = new Set([3, 7]); // after these line indices, render gap

  return (
    <main className="editor-pane">
      <div className="editor-head">
        <div className="title-row">
          <input className="lyric-title" defaultValue={SAMPLE_TITLE} />
          <span className="title-meta">draft · 12 lines · 96 syllables</span>
        </div>
        <div className="toolbar">
          <ToolGroup label="View">
            <ToolButton active>Lyric</ToolButton>
            <ToolButton>Phonemes</ToolButton>
            <ToolButton>Stress</ToolButton>
          </ToolGroup>
          <ToolGroup label="Highlight">
            <ToolButton active>Rhyme</ToolButton>
            <ToolButton>Meter</ToolButton>
            <ToolButton>Mood</ToolButton>
          </ToolGroup>
          <div className="toolbar-spacer" />
          <button className="ghost-btn">⌥+⏎ Suggest line</button>
          <button className="primary-btn">Export</button>
        </div>
      </div>

      <div className="lyric-frame">
        <div className="ruler">
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              <div className="ruler-row">
                <span className="ruler-num">{i + 1}</span>
                <span className="ruler-syl">{countSyllables(line) || ""}</span>
              </div>
              {stanzaBreaks.has(i) && <div className="ruler-gap" />}
            </React.Fragment>
          ))}
        </div>

        <div className="lyric-body">
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              <LyricLine
                line={line}
                lineIdx={i}
                palette={palette}
                showSyllableNumbers={showSyllableNumbers}
              />
              {stanzaBreaks.has(i) && <div className="lyric-stanza-gap" aria-hidden="true" />}
            </React.Fragment>
          ))}
        </div>

        <div className="meter-rail">
          {lines.map((line, i) => {
            const c = countSyllables(line);
            const target = 10;
            const pct = Math.min(1.4, c / target);
            return (
              <React.Fragment key={i}>
                <div className="meter-row">
                  <div className="meter-bar" style={{ width: `${Math.min(100, pct * 100)}%` }} />
                  {Math.abs(c - target) <= 1 && c > 0 && (
                    <span className="meter-flag" title="On meter">●</span>
                  )}
                </div>
                {stanzaBreaks.has(i) && <div className="meter-gap" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="editor-foot">
        <div className="caret-info">
          <span className="caret-label">Cursor</span>
          <span className="caret-word">afterglow</span>
          <span className="caret-phon">/ˈæf.tɚ.ɡloʊ/</span>
          <span className="caret-syls">3 syl</span>
        </div>
        <div className="rhyme-status">
          <span className="status-pill">
            <span className="status-dot dot-c" />
            scheme · ABAB BBCC DDEE
          </span>
        </div>
      </div>
    </main>
  );
}

function ToolGroup({ label, children }) {
  return (
    <div className="tool-group">
      <span className="tool-group-label">{label}</span>
      <div className="tool-group-buttons">{children}</div>
    </div>
  );
}
function ToolButton({ children, active }) {
  return <button className={`tool-btn ${active ? "is-active" : ""}`}>{children}</button>;
}

function LyricLine({ line, lineIdx, palette, showSyllableNumbers }) {
  // Tokenize preserving whitespace
  const tokens = line.split(/(\s+)/);
  let wordIdx = 0;
  return (
    <div className="lyric-line">
      {tokens.map((tok, ti) => {
        if (/^\s+$/.test(tok)) return <span key={ti}>{tok}</span>;
        const myWordIdx = wordIdx++;
        const sylls = syllabify(tok);
        const punctMatch = tok.match(/^([\W_]*)([\s\S]*?)([\W_]*)$/);
        const prefix = punctMatch?.[1] ?? "";
        const suffix = punctMatch?.[3] ?? "";
        const core = punctMatch?.[2] ?? tok;

        return (
          <span key={ti} className="word">
            {prefix && <span className="punct">{prefix}</span>}
            {sylls.map((syl, si) => {
              const colorKey = RHYMES.get(`${lineIdx}:${myWordIdx}:${si}`);
              const color = colorKey ? palette[colorKey] : null;
              const isLastSyl = si === sylls.length - 1;
              return (
                <span
                  key={si}
                  className={`syl ${color ? "syl-rhyme" : ""}`}
                  data-rhyme={colorKey || ""}
                  style={
                    color
                      ? {
                          "--bg": color.bg,
                          "--ink": color.ink,
                        }
                      : undefined
                  }
                >
                  {/* echo the original casing of `core` */}
                  {restoreCase(core, sylls, si)}
                  {showSyllableNumbers && isLastSyl && sylls.length > 1 && (
                    <sup className="syl-num">{sylls.length}</sup>
                  )}
                </span>
              );
            })}
            {suffix && <span className="punct">{suffix}</span>}
          </span>
        );
      })}
    </div>
  );
}

// recover the casing of the source word for the syllable slice we render
function restoreCase(originalCore, sylls, idx) {
  // Reconstruct the lowercase concatenation, then map back to original chars by position.
  const flat = sylls.join("");
  const start = sylls.slice(0, idx).reduce((a, s) => a + s.length, 0);
  const end = start + sylls[idx].length;
  // Pull from originalCore where possible
  if (originalCore.length >= flat.length) {
    return originalCore.slice(start, end);
  }
  return sylls[idx];
}

// ---------- rhyme dictionary ----------
const RHYME_DATA = {
  query: "afterglow",
  phonetic: "/ˈæf.tɚ.ɡloʊ/",
  perfect: [
    { word: "ago",        syl: 2, score: 0.96 },
    { word: "below",      syl: 2, score: 0.95 },
    { word: "echo",       syl: 2, score: 0.91 },
    { word: "follow",     syl: 2, score: 0.88 },
    { word: "tomorrow",   syl: 3, score: 0.86 },
    { word: "undertow",   syl: 3, score: 0.93 },
    { word: "overflow",   syl: 3, score: 0.94 },
    { word: "halo",       syl: 2, score: 0.84 },
    { word: "shadow",     syl: 2, score: 0.82 },
    { word: "window",     syl: 2, score: 0.80 },
  ],
  slant: [
    { word: "alone",     syl: 2, score: 0.71 },
    { word: "below the", syl: 3, score: 0.68 },
    { word: "older",     syl: 2, score: 0.62 },
    { word: "open road", syl: 3, score: 0.74 },
    { word: "moment",    syl: 2, score: 0.55 },
    { word: "almost",    syl: 2, score: 0.51 },
  ],
  multi: [
    { word: "after the snow",    syl: 4, score: 0.92 },
    { word: "matter of slow",    syl: 4, score: 0.88 },
    { word: "scatter and grow",  syl: 4, score: 0.86 },
    { word: "lantern below",     syl: 4, score: 0.84 },
    { word: "father i know",     syl: 4, score: 0.82 },
  ],
};

function RhymePanel({ query, setQuery, autoMode, setAutoMode, palette }) {
  const [tab, setTab] = useState("perfect");
  const list =
    tab === "perfect" ? RHYME_DATA.perfect :
    tab === "slant"   ? RHYME_DATA.slant   :
    RHYME_DATA.multi;

  return (
    <aside className="rhyme-panel">
      <div className="rhyme-head">
        <div className="rhyme-head-row">
          <span className="rhyme-eyebrow">Rhyme</span>
          <button
            className={`auto-toggle ${autoMode ? "is-on" : ""}`}
            onClick={() => setAutoMode((v) => !v)}
            title="Follow cursor"
          >
            <span className="auto-knob" />
            <span>Follow cursor</span>
          </button>
        </div>
        <div className="rhyme-search">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="5"/>
            <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a word…"
          />
          <span className="phonetic">{RHYME_DATA.phonetic}</span>
        </div>
        <div className="rhyme-tabs">
          {[
            ["perfect", "Perfect", RHYME_DATA.perfect.length],
            ["slant",   "Slant",   RHYME_DATA.slant.length],
            ["multi",   "Multi",   RHYME_DATA.multi.length],
          ].map(([k, label, n]) => (
            <button
              key={k}
              className={`rhyme-tab ${tab === k ? "is-active" : ""}`}
              onClick={() => setTab(k)}
            >
              {label} <span className="count">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rhyme-list">
        <div className="syl-bucket-label">2 syllables</div>
        {list.filter((r) => r.syl === 2).map((r) => <RhymeRow key={r.word} r={r} />)}

        <div className="syl-bucket-label">3 syllables</div>
        {list.filter((r) => r.syl === 3).map((r) => <RhymeRow key={r.word} r={r} />)}

        {list.some((r) => r.syl >= 4) && (
          <>
            <div className="syl-bucket-label">4+ syllables</div>
            {list.filter((r) => r.syl >= 4).map((r) => <RhymeRow key={r.word} r={r} />)}
          </>
        )}
      </div>

      <div className="rhyme-foot">
        <button className="ghost-btn-sm">+ Pin to scratchpad</button>
        <span className="rhyme-foot-meta">CMU dict · v0.7b</span>
      </div>
    </aside>
  );
}

function RhymeRow({ r }) {
  const score = Math.round(r.score * 100);
  return (
    <button className="rhyme-row">
      <span className="rhyme-word">{r.word}</span>
      <span className="rhyme-meter">
        <span className="rhyme-meter-fill" style={{ width: `${score}%` }} />
      </span>
      <span className="rhyme-score">{score}</span>
    </button>
  );
}

// ---------- footer status ----------
function FooterStrip() {
  return (
    <footer className="footer">
      <div className="foot-left">
        <span>en-US</span>
        <span className="dot-sep">·</span>
        <span>CMU + pyphen</span>
        <span className="dot-sep">·</span>
        <span>Auto-save 1s</span>
      </div>
      <div className="foot-right">
        <span>Ln 11, Col 18</span>
        <span className="dot-sep">·</span>
        <span>96 syl</span>
        <span className="dot-sep">·</span>
        <span>licenta · build 2026.05</span>
      </div>
    </footer>
  );
}

// ---------- mount ----------
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
