import logging
from itertools import combinations

import requests
from english_words import get_english_words_set

from services.syllables import (
    VOWEL_PHONEMES,
    _cmu_lookup,
    _cmudict,
    _rhyme_index,
    _rhyme_tail,
    _stressed_vowel,
    _vowel_seq,
    _vowel_seq_index,
)

logger = logging.getLogger(__name__)

_english_words: frozenset[str] = frozenset(
    get_english_words_set(['web2'], lower=True, alpha=True)
)

DATAMUSE_URL = "https://api.datamuse.com/words"

BUCKET_LIMIT = 50


def _datamuse_fetch(rel_param: str, word: str, max_results: int = 100) -> list[str]:
    """Query Datamuse API. Returns list of words/phrases. Empty list on failure."""
    logger.info("datamuse_fetch: word=%r rel_param=%r", word, rel_param)
    try:
        resp = requests.get(
            DATAMUSE_URL,
            params={rel_param: word, "md": "s", "max": max_results},
            timeout=3,
        )
        resp.raise_for_status()
        results = [item["word"] for item in resp.json()]
        logger.info("datamuse_fetch ok: word=%r rel_param=%r count=%d", word, rel_param, len(results))
        return results
    except Exception as exc:
        logger.warning("datamuse_fetch error: word=%r rel_param=%r error=%r", word, rel_param, exc)
        return []


def _partitions(words: list[str]) -> list[list[list[str]]]:
    """All contiguous partitions of words, ordered by number of groups (1 → N)."""
    n = len(words)
    result: list[list[list[str]]] = []
    for num_groups in range(1, n + 1):
        for splits in combinations(range(1, n), num_groups - 1):
            groups: list[list[str]] = []
            prev = 0
            for sp in splits:
                groups.append(words[prev:sp])
                prev = sp
            groups.append(words[prev:])
            result.append(groups)
    return result


def _syllable_count(word: str) -> int:
    prons = _cmudict.get(word)
    if prons:
        return sum(1 for p in prons[0] if p[-1].isdigit())
    return 1


def _is_english(phrase: str) -> bool:
    """Return True if every word in the phrase is a common English word."""
    return all(p in _english_words for p in phrase.split())


def _rhymes_for_chunk(group: list[str]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Return (rhymes_by_syllables, other_rhymes_by_syllables) for a chunk.

    rhymes_by_syllables contains common English words/phrases.
    other_rhymes_by_syllables contains proper nouns, abbreviations, and other
    entries from the CMU dict that are not in the standard English word list.

    Single word: classic rhyme-tail matching (true rhymes).
    Multi-word: vowel-sequence matching across the full chunk — returns
    single words and 2-word phrases whose combined vowel sequence equals
    the chunk's vowel sequence.
    """
    by_syl: dict[str, list[str]] = {}
    other_by_syl: dict[str, list[str]] = {}

    def _add(r: str) -> None:
        parts = r.split()
        count = str(sum(_syllable_count(p) for p in parts))
        if _is_english(r):
            bucket = by_syl.setdefault(count, [])
            if len(bucket) < BUCKET_LIMIT:
                bucket.append(r)
        else:
            bucket = other_by_syl.setdefault(count, [])
            if len(bucket) < BUCKET_LIMIT:
                bucket.append(r)

    if len(group) == 1:
        anchor = group[0]
        prons = _cmu_lookup(anchor)
        tail = _rhyme_tail(prons[0]) if prons else None
        for r in (_rhyme_index.get(tail, []) if tail else []):
            if r != anchor:
                _add(r)
        return by_syl, other_by_syl

    # Multi-word: build the target vowel sequence from all words in the group
    target_seq: list[str] = []
    for w in group:
        prons = _cmu_lookup(w)
        if prons:
            target_seq.extend(_vowel_seq(prons[0]))
    if not target_seq:
        return by_syl, other_by_syl
    target = tuple(target_seq)
    exclude = set(group)

    # 1. Single words whose vowel sequence matches exactly
    candidates: list[str] = [
        w for w in _vowel_seq_index.get(target, []) if w not in exclude
    ]

    # 2. Two-word phrases: split target at every position
    HALF_LIMIT = 25
    n = len(target)
    for k in range(1, n):
        seq1 = target[:k]
        seq2 = target[k:]
        words1 = [w for w in _vowel_seq_index.get(seq1, []) if w not in exclude][:HALF_LIMIT]
        words2 = [w for w in _vowel_seq_index.get(seq2, []) if w not in exclude][:HALF_LIMIT]
        for w1 in words1:
            for w2 in words2:
                if w1 != w2:
                    candidates.append(f"{w1} {w2}")

    for r in candidates:
        _add(r)

    return by_syl, other_by_syl


def _chunk_phonemes(group: list[str]) -> list[str]:
    """Return a vowel-phoneme string for each word in the group."""
    result = []
    for w in group:
        prons = _cmu_lookup(w)
        if prons:
            vowels = [p.rstrip('012') for p in prons[0] if p.rstrip('012') in VOWEL_PHONEMES]
            result.append(" ".join(vowels))
        else:
            result.append("")
    return result


_DATAMUSE_MODE_MAP: dict[str, str] = {
    "slant":       "rel_nry",
    "synonyms":    "rel_syn",
    "antonyms":    "rel_ant",
    "descriptive": "rel_jja",
    "related":     "ml",
    "soundslike":  "sl",
    "homophones":  "rel_hom",
    "consonants":  "rel_cns",
    "phrases":     "rel_trg",
}


def _datamuse_results_for_mode(word: str, mode: str) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Return (rhymes_by_syllables, other_by_syllables) using Datamuse for the given mode.

    Falls back to empty CMU dicts if Datamuse returns nothing.
    """
    rel_param = _DATAMUSE_MODE_MAP.get(mode)
    if not rel_param:
        return {}, {}

    words = _datamuse_fetch(rel_param, word)

    # CMU fallback: if Datamuse returns nothing, use phoneme-distance near-rhymes
    if not words and mode == "slant":
        prons = _cmu_lookup(word)
        if prons:
            vowel = _stressed_vowel(prons[0])
            if vowel:
                candidates = [
                    w for w, pron_list in _cmudict.items()
                    if w != word and _stressed_vowel(pron_list[0]) == vowel
                    and _rhyme_tail(pron_list[0]) != _rhyme_tail(prons[0])
                ]
                words = candidates[:100]

    by_syl: dict[str, list[str]] = {}
    other_by_syl: dict[str, list[str]] = {}

    for w in words:
        parts = w.split()
        count = str(sum(_syllable_count(p) for p in parts))
        if _is_english(w):
            bucket = by_syl.setdefault(count, [])
            if len(bucket) < BUCKET_LIMIT:
                bucket.append(w)
        else:
            bucket = other_by_syl.setdefault(count, [])
            if len(bucket) < BUCKET_LIMIT:
                bucket.append(w)

    return by_syl, other_by_syl
