import type { Note } from "../types/note";

const API_URL = import.meta.env.VITE_API_URL as string;

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch(`${API_URL}/api/notes`);
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note[]>;
}

export async function createNote(title: string, content: string): Promise<Note> {
  const res = await fetch(`${API_URL}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note>;
}

export async function updateNote(id: number, title: string, content: string): Promise<Note> {
  const res = await fetch(`${API_URL}/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
  return res.json() as Promise<Note>;
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Notes API error: ${res.status}`);
}
