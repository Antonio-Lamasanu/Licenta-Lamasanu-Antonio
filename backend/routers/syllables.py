import re

from fastapi import APIRouter

from schemas.syllables import (
    AnalyzeRequest,
    AnalyzeResponse,
    SlantGroup,
    SlantOccurrence,
    SyllableGroup,
    SyllableInfo,
    SyllableOccurrence,
    SyllableRequest,
    SyllableResponse,
)
from services.syllables import (
    _cmu_lookup,
    _rhyme_tail,
    _stressed_vowel,
    count_line_syllables,
    syllabify_word,
)

router = APIRouter()


@router.post("/api/syllables", response_model=SyllableResponse)
def syllables(request: SyllableRequest) -> SyllableResponse:
    counts = [count_line_syllables(line) for line in request.lines]
    return SyllableResponse(counts=counts)


@router.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    line_counts: list[int] = []
    syllable_data: list[list[list[SyllableInfo]]] = []
    # phoneme_key → [(line_idx, word_idx, syl_idx), ...]
    phoneme_map: dict[str, list[tuple[int, int, int]]] = {}

    for line_idx, line in enumerate(request.lines):
        words = line.split()
        line_syls: list[list[SyllableInfo]] = []
        total = 0
        for word_idx, word in enumerate(words):
            syls = syllabify_word(word)
            line_syls.append(syls)
            total += len(syls)
            for syl_idx, syl in enumerate(syls):
                if syl.key:
                    phoneme_map.setdefault(syl.key, []).append(
                        (line_idx, word_idx, syl_idx)
                    )
        line_counts.append(total)
        syllable_data.append(line_syls)

    syllable_groups: list[SyllableGroup] = []
    color_idx = 0
    for phoneme_key, occurrences in phoneme_map.items():
        if len(occurrences) >= 2:
            syllable_groups.append(SyllableGroup(
                color_index=color_idx,
                phoneme_key=phoneme_key,
                occurrences=[
                    SyllableOccurrence(line=l, word_index=wi, syllable_index=si)
                    for l, wi, si in occurrences
                ],
            ))
            color_idx += 1

    # --- Slant rhyme groups: lines that share a stressed vowel but not the full rhyme tail ---
    # Operate on the last non-empty word of each line.
    line_anchor_data: list[tuple[int, str | None, str | None]] = []
    for line_idx, line in enumerate(request.lines):
        words = [re.sub(r"[^\w']", "", w).lower() for w in line.split()]
        words = [w for w in words if w]
        if not words:
            line_anchor_data.append((line_idx, None, None))
            continue
        anchor = words[-1]
        prons = _cmu_lookup(anchor)
        if not prons:
            line_anchor_data.append((line_idx, None, None))
            continue
        tail_str = " ".join(_rhyme_tail(prons[0])) if _rhyme_tail(prons[0]) else None
        vowel = _stressed_vowel(prons[0])
        line_anchor_data.append((line_idx, vowel, tail_str))

    # Group lines by stressed vowel, then exclude lines that already share the same tail
    vowel_to_lines: dict[str, list[tuple[int, str | None]]] = {}
    for line_idx, vowel, tail in line_anchor_data:
        if vowel:
            vowel_to_lines.setdefault(vowel, []).append((line_idx, tail))

    slant_groups: list[SlantGroup] = []
    for vowel, entries in vowel_to_lines.items():
        if len(entries) < 2:
            continue
        # Separate by rhyme tail: lines with the same tail are perfect rhymes (skip)
        tail_buckets: dict[str | None, list[int]] = {}
        for line_idx, tail in entries:
            tail_buckets.setdefault(tail, []).append(line_idx)
        # Lines with different tails that share this vowel = slant rhyme group
        slant_lines = [
            line_idx
            for tail, idxs in tail_buckets.items()
            for line_idx in idxs
        ]
        # Only include lines where not ALL are in the same perfect-rhyme tail
        unique_tails = {tail for tail, _ in entries if tail is not None}
        if len(unique_tails) < 2:
            continue
        slant_groups.append(SlantGroup(
            color_index=color_idx,
            vowel_key=vowel,
            occurrences=[SlantOccurrence(line=li) for li in sorted(set(slant_lines))],
        ))
        color_idx += 1

    return AnalyzeResponse(
        line_counts=line_counts,
        syllable_data=syllable_data,
        syllable_groups=syllable_groups,
        slant_groups=slant_groups,
    )
