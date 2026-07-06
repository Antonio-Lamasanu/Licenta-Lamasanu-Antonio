import type { Note } from "../types/note";
import { apiFetch } from "./client";

export async function fetchNotes(): Promise<Note[]> {
  const res = await apiFetch(`/api/notes`);
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note[]>;
}

export async function createNote(title: string, content: string): Promise<Note> {
  const res = await apiFetch(`/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note>;
}

export async function updateNote(id: number, title: string, content: string): Promise<Note> {
  const res = await apiFetch(`/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note>;
}

export async function deleteNote(id: number): Promise<void> {
  const res = await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
}

export async function searchNotes(q: string): Promise<Note[]> {
  const response = await apiFetch(
    `/api/notes?q=${encodeURIComponent(q)}`
  );
  if (!response.ok) throw new Error(`Search error: ${response.status}`);
  return response.json() as Promise<Note[]>;
}
