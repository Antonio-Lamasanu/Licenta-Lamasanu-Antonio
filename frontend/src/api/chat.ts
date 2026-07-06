import { apiFetch } from "./client";

export type ChatMode = "brainstorm" | "write" | "discovery" | "refine";

export interface ChatSession {
  id: number;
  note_id: number | null;
  mode: ChatMode;
  created_at: string;
}

export interface ChatTurn {
  id: number;
  session_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ChatTurnPair {
  user_turn: ChatTurn;
  assistant_turn: ChatTurn;
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

export async function createChatSession(mode: ChatMode, noteId?: number | null): Promise<ChatSession> {
  const res = await apiFetch(`/api/chat-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, note_id: noteId ?? null }),
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

export async function postChatTurn(sessionId: number, content: string): Promise<ChatTurnPair> {
  const res = await apiFetch(`/api/chat-sessions/${sessionId}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) return extractError(res, `Chat turns API error: ${res.status}`);
  return res.json() as Promise<ChatTurnPair>;
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
