/** Anything that anchors an AI edit suggestion to a span of note text. */
export interface EditRangeMeta {
  start: number;
  end: number;
  original: string;
}

/**
 * Finds where `original` currently sits in `content`. Tries the recorded offsets
 * first (cheap, correct if nothing else changed), then falls back to a plain
 * substring search so small edits elsewhere in the note don't orphan the anchor.
 * Returns null once the original text genuinely can't be found anymore.
 */
export function locateEditRange(content: string, meta: EditRangeMeta): [number, number] | null {
  if (content.slice(meta.start, meta.end) === meta.original) return [meta.start, meta.end];
  const idx = content.indexOf(meta.original);
  if (idx === -1) return null;
  return [idx, idx + meta.original.length];
}
