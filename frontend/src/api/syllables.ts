const API_URL = import.meta.env.VITE_API_URL as string;

export interface SyllableInfo {
  text: string;
  key: string;
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

export interface AnalyzeResult {
  line_counts: number[];
  syllable_data: SyllableInfo[][][];
  syllable_groups: SyllableGroup[];
}

export async function fetchAnalysis(lines: string[]): Promise<AnalyzeResult> {
  const response = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!response.ok) throw new Error(`Analyze API error: ${response.status}`);
  return response.json() as Promise<AnalyzeResult>;
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
