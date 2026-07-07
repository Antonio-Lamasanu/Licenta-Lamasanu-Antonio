import { useCallback, useRef, useState, type RefObject } from "react";

export type MainSide = "top" | "bottom" | "left" | "right";
export type SideHalf = "top" | "bottom";

export type ChatDock =
  | { mode: "closed" }
  | { mode: "floating"; x: number; y: number; width: number; height: number }
  | { mode: "main"; side: MainSide }
  | { mode: "side"; side: SideHalf };

export type DockPreview =
  | { kind: "main"; side: MainSide; rect: DOMRect }
  | { kind: "side"; side: SideHalf; rect: DOMRect }
  | null;

const EDGE_ZONE_FRACTION = 0.28;
const SCREEN_SNAP_THRESHOLD = 40;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 480;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 280;

export function useChatDock(
  mainAreaRef: RefObject<HTMLDivElement | null>,
  rightColumnRef: RefObject<HTMLDivElement | null>
) {
  const [dock, setDock] = useState<ChatDock>({ mode: "closed" });
  const [preview, setPreview] = useState<DockPreview>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastFloatingRect = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const close = useCallback(() => {
    setDock((prev) => {
      if (prev.mode === "floating") {
        lastFloatingRect.current = { x: prev.x, y: prev.y, width: prev.width, height: prev.height };
      }
      return { mode: "closed" };
    });
    setPreview(null);
  }, []);

  const defaultFloatingRect = useCallback(() => {
    if (lastFloatingRect.current) return lastFloatingRect.current;
    return {
      x: Math.max(20, window.innerWidth - DEFAULT_WIDTH - 40),
      y: Math.max(20, window.innerHeight - DEFAULT_HEIGHT - 100),
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }, []);

  const openFloating = useCallback(() => {
    setDock((prev) => {
      if (prev.mode === "floating") return prev;
      return { mode: "floating", ...defaultFloatingRect() };
    });
    setPreview(null);
  }, [defaultFloatingRect]);

  const toggle = useCallback(() => {
    setDock((prev) => {
      if (prev.mode !== "closed") {
        if (prev.mode === "floating") {
          lastFloatingRect.current = { x: prev.x, y: prev.y, width: prev.width, height: prev.height };
        }
        return { mode: "closed" };
      }
      return { mode: "floating", ...defaultFloatingRect() };
    });
    setPreview(null);
  }, [defaultFloatingRect]);

  const computePreview = useCallback(
    (clientX: number, clientY: number): DockPreview => {
      const mainRect = mainAreaRef.current?.getBoundingClientRect();
      if (
        mainRect &&
        clientX >= mainRect.left &&
        clientX <= mainRect.right &&
        clientY >= mainRect.top &&
        clientY <= mainRect.bottom
      ) {
        const zoneX = mainRect.width * EDGE_ZONE_FRACTION;
        const zoneY = mainRect.height * EDGE_ZONE_FRACTION;
        const candidates: { side: MainSide; dist: number; within: boolean }[] = [
          { side: "left", dist: clientX - mainRect.left, within: clientX - mainRect.left <= zoneX },
          { side: "right", dist: mainRect.right - clientX, within: mainRect.right - clientX <= zoneX },
          { side: "top", dist: clientY - mainRect.top, within: clientY - mainRect.top <= zoneY },
          { side: "bottom", dist: mainRect.bottom - clientY, within: mainRect.bottom - clientY <= zoneY },
        ];
        const within = candidates.filter((c) => c.within);
        if (within.length === 0) return null;
        within.sort((a, b) => a.dist - b.dist);
        const side = within[0].side;
        const half = side === "left" || side === "right" ? mainRect.width / 2 : mainRect.width;
        const halfH = side === "top" || side === "bottom" ? mainRect.height / 2 : mainRect.height;
        const rect = new DOMRect(
          side === "right" ? mainRect.left + mainRect.width / 2 : mainRect.left,
          side === "bottom" ? mainRect.top + mainRect.height / 2 : mainRect.top,
          half,
          halfH
        );
        return { kind: "main", side, rect };
      }

      const sideRect = rightColumnRef.current?.getBoundingClientRect();
      if (
        sideRect &&
        clientX >= sideRect.left &&
        clientX <= sideRect.right &&
        clientY >= sideRect.top &&
        clientY <= sideRect.bottom
      ) {
        const midpoint = sideRect.top + sideRect.height / 2;
        const side: SideHalf = clientY < midpoint ? "top" : "bottom";
        const rect = new DOMRect(
          sideRect.left,
          side === "bottom" ? midpoint : sideRect.top,
          sideRect.width,
          sideRect.height / 2
        );
        return { kind: "side", side, rect };
      }

      return null;
    },
    [mainAreaRef, rightColumnRef]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let width = DEFAULT_WIDTH;
      let height = DEFAULT_HEIGHT;
      let x: number;
      let y: number;

      if (dock.mode === "floating") {
        width = dock.width;
        height = dock.height;
        x = dock.x;
        y = dock.y;
      } else {
        x = e.clientX - width / 2;
        y = e.clientY - 16;
      }

      dragOffset.current = { x: e.clientX - x, y: e.clientY - y };
      setDock({ mode: "floating", x, y, width, height });

      function onMove(ev: MouseEvent) {
        if (!dragOffset.current) return;
        setDock((prev) => {
          if (prev.mode !== "floating") return prev;
          return {
            mode: "floating",
            x: ev.clientX - dragOffset.current!.x,
            y: ev.clientY - dragOffset.current!.y,
            width: prev.width,
            height: prev.height,
          };
        });
        setPreview(computePreview(ev.clientX, ev.clientY));
      }

      function onUp(ev: MouseEvent) {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        dragOffset.current = null;
        const finalPreview = computePreview(ev.clientX, ev.clientY);
        setPreview(null);

        if (finalPreview) {
          setDock((prev) => {
            if (prev.mode === "floating") {
              lastFloatingRect.current = { x: prev.x, y: prev.y, width: prev.width, height: prev.height };
            }
            return finalPreview.kind === "main"
              ? { mode: "main", side: finalPreview.side }
              : { mode: "side", side: finalPreview.side };
          });
          return;
        }

        setDock((prev) => {
          if (prev.mode !== "floating") return prev;
          let { x: fx, y: fy } = prev;
          const { width: w, height: h } = prev;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          if (fx <= SCREEN_SNAP_THRESHOLD) fx = 8;
          else if (fx + w >= vw - SCREEN_SNAP_THRESHOLD) fx = vw - w - 8;
          if (fy <= SCREEN_SNAP_THRESHOLD) fy = 8;
          else if (fy + h >= vh - SCREEN_SNAP_THRESHOLD) fy = vh - h - 8;
          return { mode: "floating", x: fx, y: fy, width: w, height: h };
        });
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dock, computePreview]
  );

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dock.mode !== "floating") return;
      resizeStart.current = { x: e.clientX, y: e.clientY, width: dock.width, height: dock.height };

      function onMove(ev: MouseEvent) {
        if (!resizeStart.current) return;
        const start = resizeStart.current;
        setDock((prev) => {
          if (prev.mode !== "floating") return prev;
          return {
            ...prev,
            width: Math.max(MIN_WIDTH, start.width + (ev.clientX - start.x)),
            height: Math.max(MIN_HEIGHT, start.height + (ev.clientY - start.y)),
          };
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
    [dock]
  );

  return { dock, preview, close, toggle, openFloating, startDrag, startResize };
}
