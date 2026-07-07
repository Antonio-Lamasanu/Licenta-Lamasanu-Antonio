export type DiffToken = { text: string; kind: "same" | "removed" | "added" };

/** Word-level LCS diff, for rendering a small before/after preview. */
export function diffWords(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], kind: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ text: a[i], kind: "removed" });
      i++;
    } else {
      tokens.push({ text: b[j], kind: "added" });
      j++;
    }
  }
  while (i < n) tokens.push({ text: a[i++], kind: "removed" });
  while (j < m) tokens.push({ text: b[j++], kind: "added" });

  return tokens;
}
