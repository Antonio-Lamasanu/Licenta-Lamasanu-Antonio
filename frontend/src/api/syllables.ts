const API_URL = import.meta.env.VITE_API_URL as string;

export interface SyllableInfo {
  text: string;
  key: string;    // vowel phoneme e.g. "AH"
  stress: number; // 0=unstressed, 1=primary, 2=secondary
}

export interface SyllableOccurrence {
  line: number;
  word_index: number;
  syllable_index: number;
}

export interface SyllableGroup {
  color_index: number;
  phoneme_key: string;
  occurrences: SyllableOccurrence[];
}

export interface SlantOccurrence {
  line: number;
}

export interface SlantGroup {
  color_index: number;
  vowel_key: string;
  occurrences: SlantOccurrence[];
}

export interface AnalyzeResponse {
  line_counts: number[];
  syllable_data: SyllableInfo[][][];  // [line][word][syllable]
  syllable_groups: SyllableGroup[];
  slant_groups?: SlantGroup[];
}

export async function fetchAnalysis(lines: string[]): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!response.ok) throw new Error(`Analyze error: ${response.status}`);
  return response.json() as Promise<AnalyzeResponse>;
}

export async function fetchSyllableCounts(lines: string[]): Promise<number[]> {
  const response = await fetch(`${API_URL}/api/syllables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });

  if (!response.ok) {
    throw new Error(`Syllable API error: ${response.status}`);
  }

  const data = (await response.json()) as { counts: number[] };
  return data.counts;
}
