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

export const RHYME_MODES = [
  { value: "perfect",     label: "Perfect rhymes" },
  { value: "slant",       label: "Near / slant rhymes" },
  { value: "synonyms",    label: "Synonyms" },
  { value: "antonyms",    label: "Antonyms" },
  { value: "descriptive", label: "Descriptive words" },
  { value: "related",     label: "Related words" },
  { value: "soundslike",  label: "Sounds like" },
  { value: "homophones",  label: "Homophones" },
  { value: "consonants",  label: "Consonant match" },
  { value: "phrases",     label: "Phrases / triggers" },
] as const;

export type RhymeMode = typeof RHYME_MODES[number]["value"];

export async function fetchRhymes(query: string, mode = "perfect"): Promise<RhymeResponse> {
  const response = await fetch(`${API_URL}/api/rhymes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, mode }),
  });
  if (!response.ok) throw new Error(`Rhymes API error: ${response.status}`);
  return response.json() as Promise<RhymeResponse>;
}
