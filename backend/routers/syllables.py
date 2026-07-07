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
    _coda_consonants,
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

    # --- Slant rhyme groups: assonance (shared vowel) + consonance (shared ending
    # consonants), evaluated for every word in the document against every other word
    # (not just line endings), each excluding words that are already a perfect rhyme
    # with another occurrence.
    Pos = tuple[int, int]  # (line_idx, word_idx)
    word_anchor_data: list[tuple[Pos, str | None, str | None, str | None]] = []
    for line_idx, line in enumerate(request.lines):
        for word_idx, raw_word in enumerate(line.split()):
            clean = re.sub(r"[^\w']", "", raw_word).lower()
            if not clean:
                continue
            prons = _cmu_lookup(clean)
            if not prons:
                continue
            tail = _rhyme_tail(prons[0])
            tail_str = " ".join(tail) if tail else None
            vowel = _stressed_vowel(prons[0])
            coda = _coda_consonants(prons[0])
            coda_str = " ".join(coda) if coda else None
            word_anchor_data.append(((line_idx, word_idx), vowel, tail_str, coda_str))

    slant_groups: list[SlantGroup] = []

    # Assonance: group words by stressed vowel, then exclude words that already
    # share the same full rhyme tail with another word (those are perfect rhymes).
    vowel_to_words: dict[str, list[tuple[Pos, str | None]]] = {}
    for pos, vowel, tail, _coda in word_anchor_data:
        if vowel:
            vowel_to_words.setdefault(vowel, []).append((pos, tail))

    for vowel, entries in vowel_to_words.items():
        if len(entries) < 2:
            continue
        tail_buckets: dict[str | None, list[Pos]] = {}
        for pos, tail in entries:
            tail_buckets.setdefault(tail, []).append(pos)
        # Only words whose tail bucket has no other member lack a perfect-rhyme
        # partner in this vowel group, so only those count as slant.
        slant_positions = [
            pos
            for tail, positions in tail_buckets.items()
            if len(positions) == 1
            for pos in positions
        ]
        unique_tails = {tail for tail, _ in entries if tail is not None}
        if len(unique_tails) < 2 or len(slant_positions) < 2:
            continue
        slant_groups.append(SlantGroup(
            color_index=color_idx,
            kind="assonance",
            key=vowel,
            occurrences=[
                SlantOccurrence(line=li, word_index=wi)
                for li, wi in sorted(set(slant_positions))
            ],
        ))
        color_idx += 1

    # Consonance: group words by trailing consonant cluster, then exclude words
    # that share both the cluster and the vowel with another word (those are already
    # perfect rhymes). A word can carry both an assonance and a consonance
    # relationship with different partners, so this doesn't defer to assonance_words.
    coda_to_words: dict[str, list[tuple[Pos, str | None]]] = {}
    for pos, vowel, _tail, coda in word_anchor_data:
        if coda:
            coda_to_words.setdefault(coda, []).append((pos, vowel))

    for coda, entries in coda_to_words.items():
        if len(entries) < 2:
            continue
        vowel_buckets: dict[str | None, list[Pos]] = {}
        for pos, vowel in entries:
            vowel_buckets.setdefault(vowel, []).append(pos)
        consonance_positions = [
            pos
            for vowel, positions in vowel_buckets.items()
            if len(positions) == 1
            for pos in positions
        ]
        unique_vowels = {vowel for vowel, _ in entries if vowel is not None}
        if len(unique_vowels) < 2 or len(consonance_positions) < 2:
            continue
        slant_groups.append(SlantGroup(
            color_index=color_idx,
            kind="consonance",
            key=coda,
            occurrences=[
                SlantOccurrence(line=li, word_index=wi)
                for li, wi in sorted(set(consonance_positions))
            ],
        ))
        color_idx += 1

    return AnalyzeResponse(
        line_counts=line_counts,
        syllable_data=syllable_data,
        syllable_groups=syllable_groups,
        slant_groups=slant_groups,
    )
