import { useRef, useState, useCallback, type ReactNode } from "react";

interface ResizableSplitProps {
  top: ReactNode;
  bottom: ReactNode;
  defaultTopHeight?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
}

export default function ResizableSplit({
  top,
  bottom,
  defaultTopHeight = 320,
  minTopHeight = 96,
  minBottomHeight = 96,
}: ResizableSplitProps) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragStart.current = { y: e.clientY, height: topHeight };

      function onMove(ev: MouseEvent) {
        if (!dragStart.current || !containerRef.current) return;
        const containerHeight = containerRef.current.getBoundingClientRect().height;
        const delta = ev.clientY - dragStart.current.y;
        const maxTop = containerHeight - minBottomHeight - 6;
        const next = Math.min(maxTop, Math.max(minTopHeight, dragStart.current.height + delta));
        setTopHeight(next);
      }

      function onUp() {
        dragStart.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      e.preventDefault();
    },
    [topHeight, minBottomHeight, minTopHeight]
  );

  return (
    <div ref={containerRef} className="resizable-split">
      <div className="resizable-split-pane" style={{ height: topHeight }}>
        {top}
      </div>
      <div
        className="resizable-split-handle"
        onMouseDown={onHandleMouseDown}
        role="separator"
        aria-orientation="horizontal"
      />
      <div className="resizable-split-pane resizable-split-pane--fill">{bottom}</div>
    </div>
  );
}
