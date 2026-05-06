import { useState, useEffect, useRef } from "react";
import { fetchRhymes, type RhymeSection } from "../api/rhymes";

interface RhymeDictionaryProps {
  query: string;
  onQueryChange: (q: string) => void;
  autoMode: boolean;
  onAutoModeToggle: () => void;
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
}

function RhymesSectionPanel({ section, isOpen, onToggle }: SectionProps) {
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
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", marginBottom: 4 }}>
                {col.anchor}
              </div>
              {Object.entries(col.rhymes_by_syllables).map(([syl, words]) => (
                <div key={syl} style={{ marginBottom: 6 }}>
                  <div className="rhyme-section-label" style={{ padding: "0 0 4px", fontSize: 9.5 }}>
                    {syl} syl
                  </div>
                  <div className="rhyme-chip-grid">
                    {words.map((w) => (
                      <span key={w} className="rhyme-chip">{w}</span>
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
                        <span key={w} className="rhyme-chip rhyme-chip--other">{w}</span>
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
}: RhymeDictionaryProps) {
  const [sections, setSections] = useState<RhymeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSections([]);
      setError(null);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRhymes(query);
        setSections(result.sections);
        setExpanded(new Set([0]));
      } catch {
        setError("Failed to fetch rhymes");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query]);

  return (
    <div className="rhyme-panel">

      {/* ── Panel header ── */}
      <div className="rhyme-panel-head">
        <div className="rhyme-eyebrow">Rhyme</div>

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
            placeholder="Search rhymes…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="rhyme-tabs">
        <button className="rhyme-tab rhyme-tab--active">
          Perfect{sections.length > 0 ? ` (${sections.length})` : ""}
        </button>
        {/* TODO: Slant rhymes tab — no backend slant matching */}
        <button className="rhyme-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Slant</button>
        {/* TODO: Multi-syllable rhymes tab — no backend multi matching */}
        <button className="rhyme-tab" disabled style={{ opacity: 0.45, cursor: "default" }}>Multi</button>
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
        {!loading && !error && sections.length === 0 && query.trim() && (
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
          />
        ))}
      </div>

      {/* ── Panel footer ── */}
      <div className="rhyme-panel-foot">
        {/* TODO: Pin to scratchpad — no backend scratchpad */}
        <button className="rhyme-pin-btn">+ Pin to scratchpad</button>
        <span className="rhyme-meta">CMU dict</span>
      </div>
    </div>
  );
}
