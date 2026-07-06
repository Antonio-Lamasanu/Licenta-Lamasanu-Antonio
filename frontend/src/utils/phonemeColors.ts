// frontend/src/utils/phonemeColors.ts

export interface PaletteEntry { bg: string; ink: string }

// 15 named slots (a–o), one per CMU vowel — no two vowels share a hue.
// Order is stable; phonemes map into these by PHONEME_COLOR_INDEX below.
const LIGHT: PaletteEntry[] = [
  { bg: "#FFE7B0", ink: "#6B4A05" }, // 0 butter
  { bg: "#FFD0C2", ink: "#7A2A12" }, // 1 peach
  { bg: "#D9E8FF", ink: "#1E3A78" }, // 2 sky
  { bg: "#E5DCFF", ink: "#3B2877" }, // 3 lilac
  { bg: "#C9EBD2", ink: "#1E5E36" }, // 4 mint
  { bg: "#FFD9EC", ink: "#7A1F4F" }, // 5 rose
  { bg: "#F1E1B8", ink: "#5C4314" }, // 6 sand
  { bg: "#CDE7E6", ink: "#1F4E4D" }, // 7 teal
  { bg: "#FBE2A8", ink: "#6B4A05" }, // 8 amber
  { bg: "#D8E4C2", ink: "#3F4F1F" }, // 9 olive
  { bg: "#E8D9CC", ink: "#5A3A22" }, // 10 clay
  { bg: "#C4EDE0", ink: "#145C46" }, // 11 seafoam
  { bg: "#FFC9B8", ink: "#8A3010" }, // 12 coral
  { bg: "#CBD6FF", ink: "#29348A" }, // 13 periwinkle
  { bg: "#E9CFF2", ink: "#6B2670" }, // 14 plum
];

const DARK: PaletteEntry[] = [
  { bg: "#5C4200", ink: "#FFD87A" },
  { bg: "#5C1F0E", ink: "#FFAA8A" },
  { bg: "#0D2550", ink: "#8FB8FF" },
  { bg: "#22144F", ink: "#C4AAFF" },
  { bg: "#0D3A1E", ink: "#7DD8A0" },
  { bg: "#4A0D2C", ink: "#FFB3D6" },
  { bg: "#3A2800", ink: "#D4B87A" },
  { bg: "#0D3030", ink: "#7DCFCE" },
  { bg: "#3D2800", ink: "#F5CC70" },
  { bg: "#1F2E0A", ink: "#B8D46E" },
  { bg: "#2D1A0A", ink: "#C49878" },
  { bg: "#0D3A30", ink: "#7DE8C8" }, // 11 OW
  { bg: "#4A2010", ink: "#FFB399" }, // 12 OY
  { bg: "#10164A", ink: "#A8B8FF" }, // 13 UH
  { bg: "#3A1240", ink: "#E8B8F5" }, // 14 UW
];

function withAlpha(palette: PaletteEntry[], alpha: string): PaletteEntry[] {
  return palette.map(({ bg, ink }) => ({ bg: bg + alpha, ink }));
}

const LIGHT_SLANT = withAlpha(LIGHT, "66");
const DARK_SLANT = withAlpha(DARK, "66");

// Deterministic CMU vowel phoneme → palette slot (0–14). Every vowel gets its own hue.
const PHONEME_COLOR_INDEX: Record<string, number> = {
  AA: 0, AE: 1, AH: 2, AO: 3, AW: 4,
  AY: 5, EH: 6, ER: 7, EY: 8, IH: 9,
  IY: 10, OW: 11, OY: 12, UH: 13, UW: 14,
};

export function phonemeToColorIndex(key: string): number {
  return PHONEME_COLOR_INDEX[key] ?? key.charCodeAt(0) % 15;
}

export function getPhonemeColor(key: string, isDark: boolean): PaletteEntry {
  return (isDark ? DARK : LIGHT)[phonemeToColorIndex(key)];
}

export function getSlantColor(key: string, isDark: boolean): PaletteEntry {
  return (isDark ? DARK_SLANT : LIGHT_SLANT)[phonemeToColorIndex(key)];
}

export { LIGHT as PALETTE_LIGHT, DARK as PALETTE_DARK };
