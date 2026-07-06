import type { ChatMode } from "../api/chat";

export interface ChatModeMeta {
  id: ChatMode;
  label: string;
  icon: string;
  description: string;
}

export const CHAT_MODES: ChatModeMeta[] = [
  {
    id: "brainstorm",
    label: "Brainstorm",
    icon: "✨",
    description:
      "Free-flowing creative conversation. Throw out many ideas, metaphors, and directions. Use this when you're starting fresh or need inspiration.",
  },
  {
    id: "write",
    label: "Write",
    icon: "✎",
    description:
      "Focused lyric writing. Help develop verses, choruses, and bridges. Use this when you know what you want and need help writing it.",
  },
  {
    id: "discovery",
    label: "Discovery",
    icon: "◎",
    description:
      "Guided discovery through questions. Ask questions to help you find your own voice rather than writing for you. Use this when you're stuck or want to dig deeper into meaning.",
  },
  {
    id: "refine",
    label: "Refine",
    icon: "◆",
    description:
      "Polish and improve existing lyrics — rhythm, word choice, flow. Use this when you have lyrics that need fine-tuning.",
  },
];

export const CHAT_MODE_META: Record<ChatMode, ChatModeMeta> = Object.fromEntries(
  CHAT_MODES.map((m) => [m.id, m])
) as Record<ChatMode, ChatModeMeta>;
