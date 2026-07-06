import { apiFetch } from "./client";

export interface ScratchpadWord {
  id: number;
  word: string;
  pinned_at: string;
}

export async function fetchScratchpad(): Promise<ScratchpadWord[]> {
  const res = await apiFetch(`/api/scratchpad`);
  if (!res.ok) throw new Error(`Scratchpad error: ${res.status}`);
  return res.json() as Promise<ScratchpadWord[]>;
}

export async function pinScratchpadWord(word: string): Promise<ScratchpadWord> {
  const res = await apiFetch(`/api/scratchpad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) throw new Error(`Pin word error: ${res.status}`);
  return res.json() as Promise<ScratchpadWord>;
}

export async function unpinScratchpadWord(word: string): Promise<void> {
  const res = await apiFetch(`/api/scratchpad/${encodeURIComponent(word)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`Unpin word error: ${res.status}`);
}
