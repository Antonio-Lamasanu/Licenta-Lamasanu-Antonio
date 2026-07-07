import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import ChatDockHeader from "./ChatDockHeader";

interface FloatingChatWindowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onClose: () => void;
  children: ReactNode;
}

export default function FloatingChatWindow({
  x,
  y,
  width,
  height,
  onDragStart,
  onResizeStart,
  onClose,
  children,
}: FloatingChatWindowProps) {
  return createPortal(
    <div className="floating-chat-window" style={{ left: x, top: y, width, height }}>
      <ChatDockHeader onDragStart={onDragStart} onClose={onClose} />
      <div className="floating-chat-body">{children}</div>
      <div
        className="floating-chat-resize"
        onMouseDown={onResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat window"
      />
    </div>,
    document.body
  );
}
