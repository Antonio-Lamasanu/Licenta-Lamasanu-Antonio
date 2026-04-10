from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import cmudict
import pyphen
import re
import sqlite3
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

_cmudict = cmudict.dict()
_pyphen = pyphen.Pyphen(lang='en_US')

VOWEL_PHONEMES = frozenset([
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY',
    'EH', 'ER', 'EY', 'IH', 'IY',
    'OW', 'OY', 'UH', 'UW',
])

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
