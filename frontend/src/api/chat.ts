import { apiFetch } from "./client";

export interface ChatSession {
  id: number;
  note_id: number | null;
  title: string | null;
  created_at: string;
}

export interface ChatTurn {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ChatStreamHandlers {
  onUserTurn: (turn: ChatTurn) => void;
  onDelta: (text: string) => void;
  onDone: (assistantTurn: ChatTurn, sessionTitle: string | null) => void;
}

export interface UserProfile {
  genres: string[] | null;
  experience_level: string | null;
  goal: string | null;
  hardest_part: string | null;
  blocker: string | null;
  frustration: string | null;
  updated_at: string | null;
}

export type UserProfileInput = Omit<UserProfile, "updated_at">;

async function extractError(res: Response, fallback: string): Promise<never> {
  const detail = await res.json().catch(() => null);
  throw new Error(detail?.detail ?? fallback);
}

export async function fetchChatSessions(): Promise<ChatSession[]> {
  const res = await apiFetch(`/api/chat-sessions`);
  if (!res.ok) return extractError(res, `Chat sessions API error: ${res.status}`);
  return res.json() as Promise<ChatSession[]>;
}

export async function createChatSession(noteId?: number | null): Promise<ChatSession> {
  const res = await apiFetch(`/api/chat-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_id: noteId ?? null }),
  });
  if (!res.ok) return extractError(res, `Chat sessions API error: ${res.status}`);
  return res.json() as Promise<ChatSession>;
}

export async function deleteChatSession(id: number): Promise<void> {
  const res = await apiFetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
  if (!res.ok) return extractError(res, `Chat sessions API error: ${res.status}`);
}

export async function fetchChatTurns(sessionId: number): Promise<ChatTurn[]> {
  const res = await apiFetch(`/api/chat-sessions/${sessionId}/turns`);
  if (!res.ok) return extractError(res, `Chat turns API error: ${res.status}`);
  return res.json() as Promise<ChatTurn[]>;
}

export async function streamChatTurn(
  sessionId: number,
  content: string,
  handlers: ChatStreamHandlers
): Promise<void> {
  const res = await apiFetch(`/api/chat-sessions/${sessionId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok || !res.body) return extractError(res, `Chat turns API error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let eventName = "message";
      let dataStr = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      const data = JSON.parse(dataStr);

      if (eventName === "user_turn") handlers.onUserTurn(data as ChatTurn);
      else if (eventName === "delta") handlers.onDelta(data.text as string);
      else if (eventName === "done") handlers.onDone(data.assistant_turn as ChatTurn, data.session_title ?? null);
      else if (eventName === "error") throw new Error(data.detail ?? "Chat stream error");
    }
  }
}

export async function editSelection(text: string, instruction?: string): Promise<string> {
  const res = await apiFetch(`/api/edit-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, instruction: instruction ?? null }),
  });
  if (!res.ok) return extractError(res, `Edit selection API error: ${res.status}`);
  const data = (await res.json()) as { result: string };
  return data.result;
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await apiFetch(`/api/profile`);
  if (!res.ok) return extractError(res, `Profile API error: ${res.status}`);
  return res.json() as Promise<UserProfile>;
}

export async function updateProfile(profile: UserProfileInput): Promise<UserProfile> {
  const res = await apiFetch(`/api/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) return extractError(res, `Profile API error: ${res.status}`);
  return res.json() as Promise<UserProfile>;
}
