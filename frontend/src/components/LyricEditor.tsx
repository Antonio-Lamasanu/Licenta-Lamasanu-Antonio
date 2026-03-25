import { useState, useEffect, useRef, useCallback } from "react";
import { fetchSyllableCounts } from "../api/syllables";

const DEBOUNCE_MS = 400;

interface LyricEditorProps {
  content: string;
  onContentChange: (value: string) => void;
}

export default function LyricEditor({ content, onContentChange }: LyricEditorProps) {
  const [counts, setCounts] = useState<number[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCounts = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchSyllableCounts(lines)
      .then(setCounts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => updateCounts(content), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, [content, updateCounts]);

  const lines = content.split("\n");

  return (
    <div className="flex gap-4 w-full">
      {/* Syllable counts */}
      <div className="flex flex-col text-right select-none min-w-[3rem]">
        {lines.map((_: string, i: number) => (
          <div key={i} className="leading-6 text-sm text-zinc-400 font-mono h-6">
            {counts[i] !== undefined && counts[i] > 0 ? counts[i] : ""}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        className="flex-1 bg-transparent resize-none outline-none font-mono text-sm leading-6 text-zinc-100 placeholder-zinc-600 h-[70vh]"
        placeholder="Start writing your lyrics..."
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        spellCheck={false}
        wrap="off"
      />
    </div>
  );
}
