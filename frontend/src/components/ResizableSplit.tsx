import { useRef, useState, useCallback, useLayoutEffect, type ReactNode } from "react";

interface ResizableSplitProps {
  /** "column" stacks first/second top/bottom (horizontal drag handle). "row" places them side by side (vertical drag handle). */
  direction?: "column" | "row";
  first: ReactNode;
  second: ReactNode;
  /** Size (px) of the first pane along the split axis. Omit to default to half the container on mount. */
  defaultFirstSize?: number;
  minFirstSize?: number;
  minSecondSize?: number;
}

export default function ResizableSplit({
  direction = "column",
  first,
  second,
  defaultFirstSize,
  minFirstSize = 96,
  minSecondSize = 96,
}: ResizableSplitProps) {
  const [firstSize, setFirstSize] = useState(defaultFirstSize ?? 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pos: number; size: number } | null>(null);

  useLayoutEffect(() => {
    if (defaultFirstSize !== undefined) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = direction === "column" ? rect.height : rect.width;
    setFirstSize(total / 2);
    // Only auto-size once, from the container's initial measurement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const startPos = direction === "column" ? e.clientY : e.clientX;
      dragStart.current = { pos: startPos, size: firstSize };

      function onMove(ev: MouseEvent) {
        if (!dragStart.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const total = direction === "column" ? rect.height : rect.width;
        const curPos = direction === "column" ? ev.clientY : ev.clientX;
        const delta = curPos - dragStart.current.pos;
        const max = total - minSecondSize - 6;
        const next = Math.min(max, Math.max(minFirstSize, dragStart.current.size + delta));
        setFirstSize(next);
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
    [firstSize, direction, minFirstSize, minSecondSize]
  );

  const sizeStyle = direction === "column" ? { height: firstSize } : { width: firstSize };

  return (
    <div ref={containerRef} className={`resizable-split resizable-split--${direction}`}>
      <div className="resizable-split-pane" style={sizeStyle}>
        {first}
      </div>
      <div
        className={`resizable-split-handle resizable-split-handle--${direction}`}
        onMouseDown={onHandleMouseDown}
        role="separator"
        aria-orientation={direction === "column" ? "horizontal" : "vertical"}
      />
      <div className="resizable-split-pane resizable-split-pane--fill">{second}</div>
    </div>
  );
}
