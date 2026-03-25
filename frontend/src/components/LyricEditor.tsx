import { useState, useEffect, useRef, useCallback } from "react";
import { fetchSyllableCounts } from "../api/syllables";

const DEBOUNCE_MS = 400;

export default function LyricEditor() {
  // Toggle VITE_DEBUG_LYRICS in .env — restart dev server after changing it
  const debugLyrics = import.meta.env.VITE_DEBUG_LYRICS === 'true'
    ? (import.meta.env.VITE_DEBUG_LYRICS_TEXT ?? '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
    : ''
  console.log('DEBUG_LYRICS env:', import.meta.env.VITE_DEBUG_LYRICS)
  const [text, setText] = useState(debugLyrics);
  const [counts, setCounts] = useState<number[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCounts = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchSyllableCounts(lines)
      .then(setCounts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      updateCounts(text);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [text, updateCounts]);

  const lines = text.split("\n");

  return (
    <div className="flex gap-4 w-full max-w-3xl mx-auto mt-10 px-4">
      {/* Line numbers + syllable counts */}
      <div className="flex flex-col text-right select-none min-w-[3rem]">
        {lines.map((_: string, i: number) => (
          <div
            key={i}
            className="leading-6 text-sm text-zinc-400 font-mono h-6"
          >
            {counts[i] !== undefined && counts[i] > 0 ? counts[i] : ""}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        className="flex-1 bg-transparent resize-none outline-none font-mono text-sm leading-6 text-zinc-100 placeholder-zinc-600 h-[70vh]"
        placeholder="Start writing your lyrics..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        wrap="off"
      />
    </div>
  );
}
