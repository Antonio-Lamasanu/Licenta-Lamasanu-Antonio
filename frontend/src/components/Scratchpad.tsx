import { useState, useRef, useCallback } from "react";

interface ScratchpadProps {
  words: string[];
  onRemove: (word: string) => void;
  onClose: () => void;
  onInsert: (word: string) => void;
}

export default function Scratchpad({ words, onRemove, onClose, onInsert }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - 320, y: 120 });
  const [minimized, setMinimized] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [pos]
  );

  return (
    <div
      className="scratchpad"
      style={{ left: pos.x, top: pos.y, height: minimized ? "auto" : 300 }}
    >
      <div className="scratchpad-header" onMouseDown={onMouseDown}>
        <span className="scratchpad-title">Scratchpad ({words.length})</span>
        <div className="scratchpad-controls">
          <button onClick={() => setMinimized((m) => !m)} aria-label="Minimize">
            {minimized ? "□" : "—"}
          </button>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      {!minimized && (
        <div className="scratchpad-body">
          {words.length === 0 && (
            <div className="scratchpad-empty">
              Pin words from the Rhyme Dictionary to collect them here.
            </div>
          )}
          {words.map((word) => (
            <div key={word} className="scratchpad-item">
              <span
                className="scratchpad-word"
                onClick={() => onInsert(word)}
                title="Click to insert at cursor"
              >
                {word}
              </span>
              <button
                className="scratchpad-remove"
                onClick={() => onRemove(word)}
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
