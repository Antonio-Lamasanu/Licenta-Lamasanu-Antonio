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
    description: "Outer lines rhyme around an inner rhyming pair. Used in sonnets.",
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
    name: "ABBA (Sestet)",
    title: "Sestet",
    description: "Six-line stanza where each rhyme recurs once.",
    example: [
      "Amazing grace! How sweet the sound",
      "That saved a wretch like me!",
      "I once was lost, but now am found;",
      "Was blind, but now I see.",
      "Through many dangers, toils and snares,",
      "I have already come.",
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

const SCHEME_COLORS_LIGHT: Record<string, string> = {
  A: "#FFE7B0", B: "#D9E8FF", C: "#C9EBD2",
  D: "#E5DCFF", E: "#FFD9EC", "-": "transparent",
};

const SCHEME_COLORS_DARK: Record<string, string> = {
  A: "#5C4200", B: "#0D2550", C: "#0D3A1E",
  D: "#22144F", E: "#4A0D2C", "-": "transparent",
};

const SCHEME_INK_DARK: Record<string, string> = {
  A: "#FFD87A", B: "#8FB8FF", C: "#7DD8A0",
  D: "#C4AAFF", E: "#FFB3D6", "-": "var(--ink-3)",
};

interface LibraryPanelProps {
  onSearchSelect?: (query: string) => void;
  isDarkTheme?: boolean;
}

export default function LibraryPanel({ onSearchSelect, isDarkTheme = false }: LibraryPanelProps) {
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
                      style={{
                        background: (isDarkTheme ? SCHEME_COLORS_DARK : SCHEME_COLORS_LIGHT)[scheme.labels[i]] ?? "transparent",
                        color: isDarkTheme ? (SCHEME_INK_DARK[scheme.labels[i]] ?? "var(--ink-2)") : undefined,
                      }}
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
          {loadingSearches && <div className="library-empty">Loading…</div>}
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
