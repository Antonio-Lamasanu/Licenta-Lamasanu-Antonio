const API_URL = import.meta.env.VITE_API_URL as string;

export interface RhymeColumn {
  chunk: string;
  anchor: string;
  chunk_phonemes: string[];
  rhymes_by_syllables: Record<string, string[]>;
  other_rhymes_by_syllables: Record<string, string[]>;
}

export interface RhymeSection {
  columns: RhymeColumn[];
}

export interface RhymeResponse {
  words: string[];
  sections: RhymeSection[];
}

export async function fetchRhymes(query: string): Promise<RhymeResponse> {
  const response = await fetch(`${API_URL}/api/rhymes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Rhymes API error: ${response.status}`);
  return response.json() as Promise<RhymeResponse>;
}
