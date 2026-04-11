import { useState, useEffect, useRef } from "react";
import { fetchRhymes, type RhymeSection } from "../api/rhymes";

const DEBOUNCE_MS = 400;

interface RhymeDictionaryProps {
  query: string;
  onQueryChange: (q: string) => void;
  autoMode: boolean;
  onAutoModeToggle: () => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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
  const multiCol = section.columns.length > 1;
  const chipClass = multiCol
    ? "text-[10px] bg-zinc-800 text-zinc-200 rounded px-1.5 py-0.5"
    : "text-xs bg-zinc-800 text-zinc-200 rounded px-2 py-0.5";

  const gridClass =
    section.columns.length === 1
      ? "grid-cols-1"
      : section.columns.length === 2
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <div className="border border-zinc-800 rounded overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1.5 bg-zinc-850 hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex-1 flex flex-wrap items-center gap-1 min-w-0">
          {section.columns.map((col, ci) => {
            const chunkWords = col.chunk.split(" ");
            return (
              <span key={ci} className="flex items-center gap-1">
                {ci > 0 && <span className="text-zinc-600 text-xs">|</span>}
                <span className="flex items-center gap-1">
                  {chunkWords.map((word, wi) => (
                    <span key={wi} className="flex flex-col items-center">
                      <span className="text-xs text-zinc-300 font-medium leading-tight">
                        {word}
                      </span>
                      {col.chunk_phonemes[wi] && (
                        <span className="text-[8px] text-zinc-500 font-mono leading-tight">
                          {col.chunk_phonemes[wi]}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              </span>
            );
          })}
        </div>
        <span className="text-zinc-500 ml-1">
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      {/* Content — fixed height + scrollable */}
      {isOpen && (
        <div className="max-h-48 overflow-y-auto">
          <div className={`grid ${gridClass} divide-x divide-zinc-800`}>
            {section.columns.map((col, ci) => {
              const syllableKeys = Object.keys(col.rhymes_by_syllables).sort(
                (a, b) => Number(a) - Number(b)
              );
              const hasRhymes = syllableKeys.length > 0;

              return (
                <div key={ci} className="p-2 min-w-0">
                  {multiCol && (
                    <p className="text-[10px] text-zinc-500 mb-1 truncate font-medium">
                      ∼ {col.anchor}
                    </p>
                  )}
                  {!hasRhymes && (
                    <p className="text-[10px] text-zinc-600 italic">none</p>
                  )}
                  {syllableKeys.map((count) => (
                    <div key={count} className="mb-2">
                      <p className="text-[9px] text-zinc-600 mb-1 uppercase tracking-wide">
                        {count}syl
                      </p>
                      <div className="flex flex-wrap gap-0.5">
                        {col.rhymes_by_syllables[count].map((rhyme) => (
                          <span key={rhyme} className={chipClass}>
                            {rhyme}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(col.other_rhymes_by_syllables).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-800">
                      <p className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-wide">Other</p>
                      {Object.keys(col.other_rhymes_by_syllables)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((count) => (
                          <div key={count} className="mb-2">
                            <p className="text-[9px] text-zinc-700 mb-1 uppercase tracking-wide">
                              {count}syl
                            </p>
                            <div className="flex flex-wrap gap-0.5">
                              {col.other_rhymes_by_syllables[count].map((rhyme) => (
                                <span key={rhyme} className={chipClass + " opacity-60"}>
                                  {rhyme}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);

    if (!query.trim()) {
      setSections([]);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchRhymes(query)
        .then((data) => {
          setSections(data.sections);
          setExpanded(new Set([0]));
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const hasAnyRhymes = sections.some((s) =>
    s.columns.some(
      (c) =>
        Object.keys(c.rhymes_by_syllables).length > 0 ||
        Object.keys(c.other_rhymes_by_syllables).length > 0
    )
  );

  return (
    <aside className="w-96 shrink-0 border-l border-zinc-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-500">Rhyme Dictionary</p>
          <button
            onClick={onAutoModeToggle}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              autoMode
                ? "bg-zinc-600 text-zinc-100"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Auto
          </button>
        </div>
        <input
          type="text"
          className={`w-full bg-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600 transition-opacity ${
            autoMode ? "opacity-60 cursor-default" : ""
          }`}
          placeholder={autoMode ? "Auto — move cursor in editor" : "Search rhymes…"}
          value={query}
          readOnly={autoMode}
          onChange={autoMode ? undefined : (e) => onQueryChange(e.target.value)}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {!query.trim() && (
          <p className="text-zinc-500 text-xs text-center mt-4">
            {autoMode ? "Move the cursor in the editor" : "Select text in the editor to search"}
          </p>
        )}

        {loading && (
          <p className="text-zinc-400 text-xs text-center mt-4">Loading…</p>
        )}

        {error && (
          <p className="text-red-400 text-xs text-center mt-4">{error}</p>
        )}

        {!loading && !error && query.trim() && sections.length > 0 && !hasAnyRhymes && (
          <p className="text-zinc-500 text-xs text-center mt-4">No rhymes found</p>
        )}

        {!loading &&
          !error &&
          sections.map((section, i) => (
            <RhymesSectionPanel
              key={i}
              section={section}
              isOpen={expanded.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
      </div>
    </aside>
  );
}
