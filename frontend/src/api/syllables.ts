const API_URL = import.meta.env.VITE_API_URL as string;

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
