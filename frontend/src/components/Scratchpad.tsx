import { useState, useRef, useCallback } from "react";

interface ScratchpadProps {
  words: string[];
  text: string;
  onTextChange: (text: string) => void;
  onRemove: (word: string) => void;
  onClose: () => void;
  onInsert: (word: string) => void;
}

const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 360;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 220;

export default function Scratchpad({ words, text, onTextChange, onRemove, onClose, onInsert }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: window.innerWidth - DEFAULT_WIDTH - 20, y: 120 });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [minimized, setMinimized] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

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

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.width, h: size.height };

      function onMove(ev: MouseEvent) {
        if (!resizeStart.current) return;
        const start = resizeStart.current;
        setSize({
          width: Math.max(MIN_WIDTH, start.w + (ev.clientX - start.mx)),
          height: Math.max(MIN_HEIGHT, start.h + (ev.clientY - start.my)),
        });
      }

      function onUp() {
        resizeStart.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [size]
  );

  return (
    <div
      className="scratchpad"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: minimized ? "auto" : size.height,
      }}
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
        <>
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

          <textarea
            className="scratchpad-notes"
            placeholder="Jot down anything…"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
          />

          <div
            className="scratchpad-resize"
            onMouseDown={onResizeMouseDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize scratchpad"
          />
        </>
      )}
    </div>
  );
}
