import { apiFetch } from "./client";

export interface SavedSearch {
  id: number;
  query: string;
  created_at: string;
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const response = await apiFetch(`/api/saved-searches`);
  if (!response.ok) throw new Error(`Saved searches error: ${response.status}`);
  return response.json() as Promise<SavedSearch[]>;
}

export async function createSavedSearch(query: string): Promise<SavedSearch> {
  const response = await apiFetch(`/api/saved-searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Create saved search error: ${response.status}`);
  return response.json() as Promise<SavedSearch>;
}

export async function deleteSavedSearch(id: number): Promise<void> {
  const response = await apiFetch(`/api/saved-searches/${id}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Delete saved search error: ${response.status}`);
  }
}
