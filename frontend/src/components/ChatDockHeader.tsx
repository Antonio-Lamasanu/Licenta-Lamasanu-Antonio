interface ChatDockHeaderProps {
  onDragStart: (e: React.MouseEvent) => void;
  onClose: () => void;
}

export default function ChatDockHeader({ onDragStart, onClose }: ChatDockHeaderProps) {
  return (
    <div className="chat-dock-header" onMouseDown={onDragStart}>
      <span className="chat-dock-header-title">Chat</span>
      <button
        className="chat-dock-header-close"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
        aria-label="Close chat window"
        title="Close chat window"
      >
        ×
      </button>
    </div>
  );
}
