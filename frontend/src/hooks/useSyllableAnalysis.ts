import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAnalysis, type ActiveGroup, type SyllableInfo } from "../api/syllables";
import { phonemeToColorIndex } from "../utils/phonemeColors";

const DEBOUNCE_MS = 400;

/** Debounced /api/analyze call: builds per-syllable rhyme/slant color maps and
 * reports the active perfect-rhyme groups (for the sidebar legend) as content changes. */
export function useSyllableAnalysis(content: string, onGroupsChange?: (groups: ActiveGroup[]) => void) {
  const [counts, setCounts] = useState<number[]>([]);
  const [syllableData, setSyllableData] = useState<SyllableInfo[][][]>([]);
  const [syllableColorMap, setSyllableColorMap] = useState<Map<string, string>>(new Map());
  const [slantColorMap, setSlantColorMap] = useState<Map<number, string>>(new Map());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback((value: string) => {
    const lines = value.split("\n");
    fetchAnalysis(lines)
      .then(({ line_counts, syllable_data, syllable_groups, slant_groups }) => {
        setCounts(line_counts);
        setSyllableData(syllable_data);

        const map = new Map<string, string>();
        for (const group of syllable_groups) {
          for (const occ of group.occurrences) {
            map.set(`${occ.line}:${occ.word_index}:${occ.syllable_index}`, group.phoneme_key);
          }
        }
        setSyllableColorMap(map);

        const slantMap = new Map<number, string>();
        for (const group of slant_groups ?? []) {
          for (const occ of group.occurrences) {
            slantMap.set(occ.line, group.vowel_key);
          }
        }
        setSlantColorMap(slantMap);

        // Only expose perfect rhyme groups to the legend — slant rhymes are ambient
        if (onGroupsChange) {
          const groups: ActiveGroup[] = syllable_groups.map((g) => ({
            phonemeKey: g.phoneme_key,
            isSlant: false,
            colorIndex: phonemeToColorIndex(g.phoneme_key),
          }));
          onGroupsChange(groups);
        }
      })
      .catch(console.error);
  }, [onGroupsChange]);

  useEffect(() => {
    if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runAnalysis(content), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current !== null) clearTimeout(debounceTimer.current);
    };
  }, [content, runAnalysis]);

  return { counts, syllableData, syllableColorMap, slantColorMap };
}
