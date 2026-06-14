/**
 * Fixed phoneme→color mapping for all 15 CMU vowel phonemes.
 *
 * Each phoneme gets:
 *   perfect — used when syllables share the same rhyme tail (true rhyme)
 *   slant   — used when lines share the same stressed vowel but different tail;
 *             hue is shifted +22° from the perfect color so it reads as a
 *             "related but distinct" relationship
 *
 * Both perfect and slant provide light/dark variants.
 *
 * Usage:
 *   import { getPhonemeColor } from "../constants/phonemeColors";
 *   const { bg, ink } = getPhonemeColor("AH", isDarkTheme, isSlant);
 */

export interface ColorPair {
  bg: string;
  ink: string;
}

export interface PhonemeColorEntry {
  perfect: { light: ColorPair; dark: ColorPair };
  slant:   { light: ColorPair; dark: ColorPair };
}

function entry(h: number): PhonemeColorEntry {
  const s = (h + 22) % 360;
  return {
    perfect: {
      light: { bg: `hsl(${h},68%,86%)`,  ink: `hsl(${h},65%,22%)` },
      dark:  { bg: `hsl(${h},62%,19%)`,  ink: `hsl(${h},75%,76%)` },
    },
    slant: {
      light: { bg: `hsl(${s},52%,85%)`,  ink: `hsl(${s},48%,26%)` },
      dark:  { bg: `hsl(${s},48%,16%)`,  ink: `hsl(${s},62%,72%)` },
    },
  };
}

// 15 CMU vowel phonemes spread evenly across the hue wheel (24° apart)
export const PHONEME_COLORS: Record<string, PhonemeColorEntry> = {
  AA: entry(0),    // red
  AE: entry(24),   // orange-red
  AH: entry(48),   // orange
  AO: entry(72),   // yellow
  AW: entry(96),   // yellow-green
  AY: entry(120),  // green
  EH: entry(144),  // teal-green
  ER: entry(168),  // cyan
  EY: entry(192),  // sky blue
  IH: entry(216),  // blue
  IY: entry(240),  // blue-violet
  OW: entry(264),  // violet
  OY: entry(288),  // purple
  UH: entry(312),  // magenta-pink
  UW: entry(336),  // pink-red
};

// Stable display order for legend chips
export const PHONEME_ORDER = [
  'AA','AE','AH','AO','AW','AY',
  'EH','ER','EY',
  'IH','IY',
  'OW','OY','UH','UW',
] as const;

export type PhonemeKey = typeof PHONEME_ORDER[number];

const FALLBACK_LIGHT: ColorPair = { bg: "hsl(0,0%,88%)",  ink: "hsl(0,0%,28%)" };
const FALLBACK_DARK:  ColorPair = { bg: "hsl(0,0%,22%)",  ink: "hsl(0,0%,76%)" };

/**
 * Resolve the bg/ink pair for a phoneme in a given context.
 * Falls back to a neutral grey for unknown phoneme keys.
 */
export function getPhonemeColor(
  phonemeKey: string,
  isDark: boolean,
  isSlant: boolean,
): ColorPair {
  const e = PHONEME_COLORS[phonemeKey];
  if (!e) return isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const palette = isSlant ? e.slant : e.perfect;
  return isDark ? palette.dark : palette.light;
}
