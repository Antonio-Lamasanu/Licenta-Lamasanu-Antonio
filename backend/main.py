from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import cmudict
import pyphen
import re
from english_words import get_english_words_set
import sqlite3
from itertools import combinations
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

_cmudict = cmudict.dict()
_pyphen = pyphen.Pyphen(lang='en_US')
_english_words: frozenset[str] = frozenset(
    get_english_words_set(['web2'], lower=True, alpha=True)
)


def _rhyme_tail(phonemes: list[str]) -> tuple[str, ...] | None:
    """Return the rhyme-determining suffix starting from the last stressed vowel.

    Strips stress digits so 'AH0' and 'AH1' are treated as the same phoneme.
    Returns None if no stressed vowel is found.
    """
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i][-1] in '12':
            return tuple(p.rstrip('012') for p in phonemes[i:])
    return None


# Reverse index: rhyme tail → list of words sharing that tail
_rhyme_index: dict[tuple[str, ...], list[str]] = {}
for _w, _prons in _cmudict.items():
    _tail = _rhyme_tail(_prons[0])
    if _tail:
        _rhyme_index.setdefault(_tail, []).append(_w)

VOWEL_PHONEMES = frozenset([
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY',
    'EH', 'ER', 'EY', 'IH', 'IY',
    'OW', 'OY', 'UH', 'UW',
])


def _vowel_seq(phonemes: list[str]) -> tuple[str, ...]:
    """Vowels-only sequence from a phoneme list, stress digits stripped."""
    return tuple(p.rstrip('012') for p in phonemes if p.rstrip('012') in VOWEL_PHONEMES)


# Vowel-sequence index: vowel_seq → list of words with exactly that sequence
_vowel_seq_index: dict[tuple[str, ...], list[str]] = {}
for _w, _prons in _cmudict.items():
    _vseq = _vowel_seq(_prons[0])
    if _vseq:
        _vowel_seq_index.setdefault(_vseq, []).append(_w)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
DB_PATH = os.getenv("DB_PATH", "notes.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            title      TEXT NOT NULL DEFAULT '',
            content    TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# --- Syllable models ---

class SyllableRequest(BaseModel):
    lines: list[str]


class SyllableResponse(BaseModel):
    counts: list[int]


class AnalyzeRequest(BaseModel):
    lines: list[str]


class SyllableInfo(BaseModel):
    text: str   # e.g. "hun"
    key: str    # vowel phoneme e.g. "AH"; empty if word not in CMU dict


class SyllableOccurrence(BaseModel):
    line: int
    word_index: int
    syllable_index: int


class SyllableGroup(BaseModel):
    color_index: int
    phoneme_key: str
    occurrences: list[SyllableOccurrence]


class AnalyzeResponse(BaseModel):
    line_counts: list[int]
    syllable_data: list[list[list[SyllableInfo]]]  # [line][word][syllable]
    syllable_groups: list[SyllableGroup]


# --- Rhyme models ---

class RhymeRequest(BaseModel):
    query: str


class RhymeColumn(BaseModel):
    chunk: str                            # display label, e.g. "she wants"
    anchor: str                           # last word being rhymed, e.g. "wants"
    chunk_phonemes: list[str]             # vowel phonemes per word in chunk, e.g. ["IH", "AO IY"]
    rhymes_by_syllables: dict[str, list[str]]
    other_rhymes_by_syllables: dict[str, list[str]]


class RhymeSection(BaseModel):
    columns: list[RhymeColumn]


class RhymeResponse(BaseModel):
    words: list[str]
    sections: list[RhymeSection]


# --- Note models ---

class NoteCreate(BaseModel):
    title: str = ""
    content: str = ""


class NoteUpdate(BaseModel):
    title: str
    content: str


class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
    updated_at: str


# --- Syllable logic ---

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


def _cmu_lookup(clean: str) -> list | None:
    """CMU dict lookup with fallbacks for common contractions.

    Tries the word as-is, then common apostrophe-contracted forms:
    - Words ending in ' (e.g. scorin') → try appending 'g' (scoring), then strip '
    - Known abbreviations ('n' → and, 'em → them, etc.)
    """
    entries = _cmudict.get(clean)
    if entries:
        return entries
    if clean.endswith("'"):
        for candidate in (clean[:-1] + 'g', clean[:-1]):
            entries = _cmudict.get(candidate)
            if entries:
                return entries
    fallback = _APOSTROPHE_ABBREVS.get(clean)
    if fallback:
        return _cmudict.get(fallback)
    if clean.startswith("'"):
        entries = _cmudict.get(clean[1:])
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
                sub_syls[0] = SyllableInfo(text='-' + sub_syls[0].text, key=sub_syls[0].key)
            result.extend(sub_syls)
        return result

    clean = core.lower()
    entries = _cmu_lookup(clean)
    if not entries:
        return [SyllableInfo(text=core, key='')]
    phonemes = entries[0]
    vowel_keys = [ph.rstrip('012') for ph in phonemes if ph.rstrip('012') in VOWEL_PHONEMES]
    if not vowel_keys:
        return [SyllableInfo(text=core, key='')]
    parts = _pyphen.inserted(clean).split('-')
    if len(parts) != len(vowel_keys):
        # Orthographic / phonemic count mismatch — treat whole core as one syllable
        return [SyllableInfo(text=core, key=vowel_keys[-1])]
    # Map lowercase split positions back to original-case core
    result: list[SyllableInfo] = []
    pos = 0
    for i, part in enumerate(parts):
        syl_text = core[pos: pos + len(part)]
        result.append(SyllableInfo(text=syl_text, key=vowel_keys[i]))
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


# --- Syllable endpoint ---

@app.post("/api/syllables", response_model=SyllableResponse)
def syllables(request: SyllableRequest) -> SyllableResponse:
    counts = [count_line_syllables(line) for line in request.lines]
    return SyllableResponse(counts=counts)


@app.post("/api/analyze", response_model=AnalyzeResponse)
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

    return AnalyzeResponse(
        line_counts=line_counts,
        syllable_data=syllable_data,
        syllable_groups=syllable_groups,
    )


# --- Rhyme helpers ---

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

    BUCKET_LIMIT = 50

    if len(group) == 1:
        anchor = group[0]
        prons = _cmudict.get(anchor)
        tail = _rhyme_tail(prons[0]) if prons else None
        for r in (_rhyme_index.get(tail, []) if tail else []):
            if r != anchor:
                _add(r)
        return by_syl, other_by_syl

    # Multi-word: build the target vowel sequence from all words in the group
    target_seq: list[str] = []
    for w in group:
        prons = _cmudict.get(w)
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
        prons = _cmudict.get(w)
        if prons:
            vowels = [p.rstrip('012') for p in prons[0] if p.rstrip('012') in VOWEL_PHONEMES]
            result.append(" ".join(vowels))
        else:
            result.append("")
    return result


# --- Rhyme endpoint ---

@app.post("/api/rhymes", response_model=RhymeResponse)
def get_rhymes(request: RhymeRequest) -> RhymeResponse:
    raw = request.query.strip().split()[:5]
    words = [re.sub(r"[^\w']", "", w).lower() for w in raw]
    words = [w for w in words if w]

    sections: list[RhymeSection] = []
    for partition in _partitions(words):
        columns: list[RhymeColumn] = []
        for group in partition:
            anchor = group[-1]
            rhymes_en, rhymes_other = _rhymes_for_chunk(group)
            columns.append(RhymeColumn(
                chunk=" ".join(group),
                anchor=anchor,
                chunk_phonemes=_chunk_phonemes(group),
                rhymes_by_syllables=rhymes_en,
                other_rhymes_by_syllables=rhymes_other,
            ))
        sections.append(RhymeSection(columns=columns))

    return RhymeResponse(words=words, sections=sections)


# --- Notes endpoints ---

@app.get("/api/notes", response_model=list[NoteOut])
def list_notes():
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC"
        ).fetchall()
        return [NoteOut(**dict(row)) for row in rows]


@app.post("/api/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(body: NoteCreate):
    now = datetime.now(timezone.utc).isoformat()
    for conn in get_db():
        cur = conn.execute(
            "INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (body.title, body.content, now, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return NoteOut(**dict(row))


@app.put("/api/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, body: NoteUpdate):
    now = datetime.now(timezone.utc).isoformat()
    for conn in get_db():
        cur = conn.execute(
            "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (body.title, body.content, now, note_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()
        return NoteOut(**dict(row))


@app.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int):
    for conn in get_db():
        cur = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
