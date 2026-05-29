import { useState, useEffect, useRef } from "react";

interface ScratchpadProps {
  words: string[];
  onInsert: (word: string) => void;
  onClose: () => void;
  onRemove: (word: string) => void;
}

export default function Scratchpad({ words, onInsert, onClose, onRemove }: ScratchpadProps) {
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 280), y: 120 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = dragRef.current.originX + dx;
      const newY = dragRef.current.originY + dy;
      setPos({
        x: Math.max(0, Math.min(newX, window.innerWidth  - 240)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 48)),
      });
    }
    function onMouseUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleHeaderMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
  }

  return (
    <div
      className="scratchpad-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="scratchpad-header"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="scratchpad-title">Scratchpad</span>
        <button className="scratchpad-close" onClick={onClose} aria-label="Close scratchpad">×</button>
      </div>
      <div className="scratchpad-body">
        {words.length === 0 && (
          <div className="scratchpad-empty">Pin words from the rhyme panel</div>
        )}
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="scratchpad-chip-wrap">
            <button
              className="scratchpad-chip"
              onClick={() => onInsert(word)}
              title="Insert into editor"
            >
              {word}
            </button>
            <button
              className="scratchpad-chip-remove"
              onClick={() => onRemove(word)}
              aria-label={`Remove ${word}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
