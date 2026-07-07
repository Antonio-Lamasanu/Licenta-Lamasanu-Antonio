import re

import cmudict
import pyphen

from schemas.syllables import SyllableInfo

_cmudict = cmudict.dict()
_pyphen = pyphen.Pyphen(lang='en_US')

VOWEL_PHONEMES = frozenset([
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY',
    'EH', 'ER', 'EY', 'IH', 'IY',
    'OW', 'OY', 'UH', 'UW',
])

# Legal English syllable-onset consonant clusters (ARPAbet), used to split an
# inter-vowel consonant run between two syllables via the maximal onset principle.
_ONSET_CLUSTERS_3 = frozenset([
    ('S', 'P', 'L'), ('S', 'P', 'R'), ('S', 'T', 'R'), ('S', 'K', 'R'), ('S', 'K', 'W'),
])
_ONSET_CLUSTERS_2 = frozenset([
    ('P', 'L'), ('P', 'R'), ('B', 'L'), ('B', 'R'), ('T', 'R'), ('D', 'R'),
    ('K', 'L'), ('K', 'R'), ('G', 'L'), ('G', 'R'),
    ('F', 'L'), ('F', 'R'), ('TH', 'R'), ('SH', 'R'),
    ('S', 'P'), ('S', 'T'), ('S', 'K'), ('S', 'M'), ('S', 'N'), ('S', 'L'), ('S', 'W'),
    ('T', 'W'), ('D', 'W'), ('G', 'W'), ('K', 'W'),
    ('P', 'Y'), ('B', 'Y'), ('T', 'Y'), ('D', 'Y'), ('K', 'Y'), ('G', 'Y'),
    ('F', 'Y'), ('V', 'Y'), ('M', 'Y'), ('HH', 'Y'),
])
# NG never begins an English syllable, so it can only ever land in a coda.
_ILLEGAL_SINGLE_ONSET = frozenset(['NG'])


def _is_legal_onset(cluster: tuple[str, ...]) -> bool:
    if len(cluster) == 0:
        return True
    if len(cluster) == 1:
        return cluster[0] not in _ILLEGAL_SINGLE_ONSET
    if len(cluster) == 2:
        return cluster in _ONSET_CLUSTERS_2
    if len(cluster) == 3:
        return cluster in _ONSET_CLUSTERS_3
    return False


def _split_onset(run: list[str]) -> tuple[list[str], list[str]]:
    """Split an inter-vowel consonant run into (coda of previous syllable, onset of next).

    Maximal onset principle: the longest suffix of the run that is a legal English
    onset cluster becomes the next syllable's onset; everything before it stays behind
    as the previous syllable's coda.
    """
    for length in (3, 2, 1):
        if length <= len(run):
            suffix = tuple(run[len(run) - length:])
            if _is_legal_onset(suffix):
                return run[: len(run) - length], list(suffix)
    return run, []


def _rhyme_tail(phonemes: list[str]) -> tuple[str, ...] | None:
    """Return the rhyme-determining suffix starting from the last stressed vowel.

    Strips stress digits so 'AH0' and 'AH1' are treated as the same phoneme.
    Returns None if no stressed vowel is found.
    """
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i][-1] in '12':
            return tuple(p.rstrip('012') for p in phonemes[i:])
    return None


def _stressed_vowel(phonemes: list[str]) -> str | None:
    """Return the last primary or secondary stressed vowel phoneme, stress stripped."""
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i][-1] in '12':
            return phonemes[i].rstrip('012')
    return None


def _coda_consonants(phonemes: list[str]) -> tuple[str, ...] | None:
    """Trailing consonant cluster after the last vowel in the word.

    None if the word ends in a vowel or has no vowel at all — used to detect
    consonance (shared ending consonants, differing vowel) between line endings.
    """
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i].rstrip('012') in VOWEL_PHONEMES:
            coda = tuple(phonemes[i + 1:])
            return coda if coda else None
    return None


def _vowel_seq(phonemes: list[str]) -> tuple[str, ...]:
    """Vowels-only sequence from a phoneme list, stress digits stripped."""
    return tuple(p.rstrip('012') for p in phonemes if p.rstrip('012') in VOWEL_PHONEMES)


# Reverse index: rhyme tail → list of words sharing that tail
_rhyme_index: dict[tuple[str, ...], list[str]] = {}
for _w, _prons in _cmudict.items():
    _tail = _rhyme_tail(_prons[0])
    if _tail:
        _rhyme_index.setdefault(_tail, []).append(_w)

# Vowel-sequence index: vowel_seq → list of words with exactly that sequence
_vowel_seq_index: dict[tuple[str, ...], list[str]] = {}
for _w, _prons in _cmudict.items():
    _vseq = _vowel_seq(_prons[0])
    if _vseq:
        _vowel_seq_index.setdefault(_vseq, []).append(_w)


def _strip_punct(word: str) -> tuple[str, str, str]:
    """Split a token into (prefix_punct, word_core, suffix_punct)."""
    m = re.match(r"^([^\w']*)([\w'].*?[\w']|[\w'])([^\w']*)$", word)
    return (m.group(1), m.group(2), m.group(3)) if m else ('', word, '')


_APOSTROPHE_ABBREVS: dict[str, str] = {
    "'n'": "and",
    "n'": "and",
    "'em": "them",
    "'cause": "because",
}

# Suffixes commonly dropped in informal/lyric writing (ordered: most frequent first)
_DROPPED_SUFFIXES = ('g', 'ng', 'd', 'nd', 'ld', 't', 'st')

# Prefixes commonly dropped in informal/lyric writing
_DROPPED_PREFIXES = ('a', 'be', 'un', 'e', 'in')


def _cmu_lookup(clean: str) -> list | None:
    """CMU dict lookup with fallbacks for common contractions and shortenings.

    Tries the word as-is, then:
    - Words ending in ' → try appending each dropped suffix, then bare stem
    - Known abbreviations ('n' → and, 'em → them, etc.)
    - Words starting with ' → try bare stem, then prepend dropped prefixes
    - Try appending each dropped suffix (e.g. 'runnin' → 'running')
    - Try prepending each dropped prefix (e.g. 'gainst' → 'against')
    """
    entries = _cmudict.get(clean)
    if entries:
        return entries
    if clean.endswith("'"):
        stem = clean[:-1]
        for suffix in _DROPPED_SUFFIXES:
            entries = _cmudict.get(stem + suffix)
            if entries:
                return entries
        entries = _cmudict.get(stem)
        if entries:
            return entries
    fallback = _APOSTROPHE_ABBREVS.get(clean)
    if fallback:
        return _cmudict.get(fallback)
    if clean.startswith("'"):
        stem = clean[1:]
        entries = _cmudict.get(stem)
        if entries:
            return entries
        for prefix in _DROPPED_PREFIXES:
            entries = _cmudict.get(prefix + stem)
            if entries:
                return entries
    for suffix in _DROPPED_SUFFIXES:
        entries = _cmudict.get(clean + suffix)
        if entries:
            return entries
    for prefix in _DROPPED_PREFIXES:
        entries = _cmudict.get(prefix + clean)
        if entries:
            return entries
    return None


def syllabify_word(word: str) -> list[SyllableInfo]:
    """Return per-syllable info for a word token.

    Uses pyphen for orthographic splits and CMU dict for phoneme vowel keys.
    Falls back to a single-syllable entry if the word is unknown or counts mismatch.
    Hyphenated words (e.g. hide-and-seek) are split on '-' and each part is
    processed independently, then rejoined with the hyphen preserved in the text.
    """
    _prefix, core, _suffix = _strip_punct(word)

    # Hyphenated words: process each part independently and rejoin
    if '-' in core:
        parts = core.split('-')
        result: list[SyllableInfo] = []
        for i, part in enumerate(parts):
            sub_syls = syllabify_word(part)
            if i > 0 and sub_syls:
                # Restore the '-' separator before the first syllable of this part
                first = sub_syls[0]
                sub_syls[0] = SyllableInfo(
                    text='-' + first.text, key=first.key, stress=first.stress,
                    onset=first.onset, coda=first.coda,
                )
            result.extend(sub_syls)
        return result

    clean = core.lower()
    entries = _cmu_lookup(clean)
    if not entries:
        return [SyllableInfo(text=core, key='', stress=0)]
    phonemes = entries[0]
    vowel_positions = [i for i, ph in enumerate(phonemes) if ph.rstrip('012') in VOWEL_PHONEMES]
    if not vowel_positions:
        return [SyllableInfo(text=core, key='', stress=0)]
    vowel_keys = [phonemes[i].rstrip('012') for i in vowel_positions]
    stress_digits = [int(phonemes[i][-1]) if phonemes[i][-1].isdigit() else 0 for i in vowel_positions]

    # Assign consonants to onsets/codas via the maximal onset principle: leading
    # consonants go entirely to the first onset, trailing ones entirely to the last
    # coda, and each inter-vowel run is split between the syllables it separates.
    n = len(vowel_positions)
    onsets: list[list[str]] = [[] for _ in range(n)]
    codas: list[list[str]] = [[] for _ in range(n)]
    onsets[0] = phonemes[:vowel_positions[0]]
    for i in range(n - 1):
        run = phonemes[vowel_positions[i] + 1: vowel_positions[i + 1]]
        coda_part, onset_part = _split_onset(run)
        codas[i] = coda_part
        onsets[i + 1] = onset_part
    codas[n - 1] = phonemes[vowel_positions[-1] + 1:]

    parts = _pyphen.inserted(clean).split('-')
    if len(parts) != n:
        return [SyllableInfo(
            text=core, key=vowel_keys[-1], stress=stress_digits[-1],
            onset=' '.join(ph.rstrip('012') for ph in phonemes[:vowel_positions[-1]]),
            coda=' '.join(ph.rstrip('012') for ph in phonemes[vowel_positions[-1] + 1:]),
        )]
    result: list[SyllableInfo] = []
    pos = 0
    for i, part in enumerate(parts):
        syl_text = core[pos: pos + len(part)]
        result.append(SyllableInfo(
            text=syl_text, key=vowel_keys[i], stress=stress_digits[i],
            onset=' '.join(onsets[i]), coda=' '.join(codas[i]),
        ))
        pos += len(part)
    return result


def count_syllables(word: str) -> int:
    phones = _cmudict.get(word.lower())
    if phones:
        return sum(1 for ph in phones[0] if ph[-1].isdigit())
    # Fallback: count vowel groups for unknown words
    vowels = "aeiouy"
    word = word.lower().strip(".,!?;:'\"")
    count = 0
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    return max(1, count)


def count_line_syllables(line: str) -> int:
    words = line.split()
    if not words:
        return 0
    return sum(count_syllables(w) for w in words)
