import { useState, useEffect, useRef } from "react";
import { fetchRhymes, type RhymeSection, RHYME_MODES, type RhymeMode } from "../api/rhymes";
import { createSavedSearch } from "../api/savedSearches";

interface RhymeDictionaryProps {
  query: string;
  onQueryChange: (q: string) => void;
  autoMode: boolean;
  onAutoModeToggle: () => void;
  onCollapse?: () => void;
  onPin?: (word: string) => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s",
        color: "var(--ink-4)",
      }}
    >
      <polyline points="2,4 6,8 10,4" />
    </svg>
  );
}

interface SectionProps {
  section: RhymeSection;
  isOpen: boolean;
  onToggle: () => void;
  onPin?: (word: string) => void;
}

function RhymesSectionPanel({ section, isOpen, onToggle, onPin }: SectionProps) {
  const colCount = section.columns.length;

  return (
    <div className="rhyme-section-panel">
      <button className="rhyme-section-header" onClick={onToggle}>
        <span className="rhyme-section-title">
          {section.columns.map((c) => c.chunk).join(" · ")}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div
          className="rhyme-section-body"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, 1fr)`,
            gap: "0 12px",
          }}
        >
          {section.columns.map((col, ci) => (
            <div key={ci}>
              {colCount > 1 && (
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", marginBottom: 4 }}>
                  {col.anchor}
                </div>
              )}
              {Object.entries(col.rhymes_by_syllables).map(([syl, words]) => (
                <div key={syl} style={{ marginBottom: 6 }}>
                  <div className="rhyme-section-label" style={{ padding: "0 0 4px", fontSize: 9.5 }}>
                    {syl} syl
                  </div>
                  <div className="rhyme-chip-grid">
                    {words.map((w) => (
                      <span key={w} className="rhyme-chip-wrap">
                        <span className="rhyme-chip">{w}</span>
                        {onPin && (
                          <button
                            className="rhyme-chip-pin"
                            onClick={() => onPin(w)}
                            title="Pin to scratchpad"
                          >
                            +
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {Object.entries(col.other_rhymes_by_syllables).map(([syl, words]) =>
                words.length > 0 ? (
                  <div key={`other-${syl}`} style={{ marginBottom: 6 }}>
                    <div className="rhyme-section-label" style={{ padding: "0 0 4px", fontSize: 9.5, opacity: 0.6 }}>
                      {syl} syl (other)
                    </div>
                    <div className="rhyme-chip-grid">
                      {words.map((w) => (
                        <span key={w} className="rhyme-chip-wrap">
                          <span className="rhyme-chip rhyme-chip--other">{w}</span>
                          {onPin && (
                            <button
                              className="rhyme-chip-pin"
                              onClick={() => onPin(w)}
                              title="Pin to scratchpad"
                            >
                              +
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RhymeDictionary({
  query,
  onQueryChange,
  autoMode,
  onAutoModeToggle,
  onCollapse,
  onPin,
}: RhymeDictionaryProps) {
  const [sections, setSections] = useState<RhymeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [rhymeMode, setRhymeMode] = useState<RhymeMode>("perfect");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState<null | "saved" | "error">(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!query.trim()) {
      setSections([]);
      setError(null);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRhymes(query, rhymeMode);
        setSections(result.sections);
        setExpanded(new Set([0]));
      } catch {
        setError("Failed to fetch rhymes");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query, rhymeMode]);

  return (
    <div className="rhyme-panel">

      {/* ── Panel header ── */}
      <div className="rhyme-panel-head">
        <div className="rhyme-eyebrow-row">
          <div className="rhyme-eyebrow">Rhyme Dictionary</div>
          {onCollapse && (
            <button
              className="rhyme-collapse-btn"
              onClick={onCollapse}
              aria-label="Collapse rhyme panel"
            >
              →
            </button>
          )}
        </div>

        <div className="rhyme-follow-row">
          <span className="rhyme-follow-label">Follow cursor</span>
          <button
            className={`rhyme-toggle${autoMode ? " rhyme-toggle--on" : ""}`}
            onClick={onAutoModeToggle}
            aria-label="Toggle follow cursor"
          >
            <span className="rhyme-toggle-knob" />
          </button>
        </div>

        <div className="rhyme-search">
          <span className="rhyme-search-icon">⌕</span>
          <input
            className="rhyme-search-input"
            placeholder={autoMode ? "Auto — move cursor in editor" : "Search rhymes…"}
            value={query}
            readOnly={autoMode}
            onChange={autoMode ? undefined : (e) => onQueryChange(e.target.value)}
          />
        </div>
      </div>

      {/* ── Mode selector ── */}
      <div className="rhyme-mode-row">
        <select
          className="rhyme-mode-select"
          value={rhymeMode}
          onChange={(e) => setRhymeMode(e.target.value as RhymeMode)}
        >
          {RHYME_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {query.trim() && (
          <button
            className={`rhyme-save-btn${saved === "error" ? " rhyme-save-btn--error" : ""}`}
            onClick={async () => {
              try {
                await createSavedSearch(query.trim());
                setSaved("saved");
              } catch {
                setSaved("error");
              } finally {
                if (savedTimer.current) clearTimeout(savedTimer.current);
                savedTimer.current = setTimeout(() => setSaved(null), 2000);
              }
            }}
            title="Save this search to Library"
          >
            {saved === "saved" ? "✓ Saved" : saved === "error" ? "Failed" : "♡ Save"}
          </button>
        )}
      </div>

      {/* ── Results ── */}
      <div className="rhyme-results">
        {!query.trim() && (
          <div className="rhyme-empty">
            Type or select a word to find rhymes
          </div>
        )}
        {loading && (
          <div className="rhyme-empty">Finding rhymes…</div>
        )}
        {error && (
          <div className="rhyme-empty" style={{ color: "var(--accent)" }}>
            {error}
          </div>
        )}
        {!loading && !error && query.trim() && sections.length === 0 && (
          <div className="rhyme-empty">No rhymes found for "{query}"</div>
        )}
        {!loading && !error && sections.length > 0 && !sections.some(s =>
          s.columns.some(c =>
            Object.keys(c.rhymes_by_syllables).length > 0 ||
            Object.keys(c.other_rhymes_by_syllables).length > 0
          )
        ) && (
          <div className="rhyme-empty">No rhymes found for "{query}"</div>
        )}
        {!loading && sections.map((section, i) => (
          <RhymesSectionPanel
            key={i}
            section={section}
            isOpen={expanded.has(i)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
            onPin={onPin}
          />
        ))}
      </div>

      {/* ── Panel footer ── */}
      <div className="rhyme-panel-foot">
        <span className="rhyme-meta">Hover a word to pin → scratchpad</span>
        <span className="rhyme-meta">CMU dict</span>
      </div>
    </div>
  );
}
