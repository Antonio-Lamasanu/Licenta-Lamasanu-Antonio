from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import cmudict
import pyphen
import re
import requests
from english_words import get_english_words_set
import psycopg
from psycopg.rows import dict_row
from itertools import combinations
import logging
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from passlib.context import CryptContext
import jwt

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

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


def _stressed_vowel(phonemes: list[str]) -> str | None:
    """Return the last primary or secondary stressed vowel phoneme, stress stripped."""
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i][-1] in '12':
            return phonemes[i].rstrip('012')
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

DATAMUSE_URL = "https://api.datamuse.com/words"

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


FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://rhymathic:rhymathic@localhost:5432/rhymathic"
)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@rhymathic.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change_me")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_MODEL = "mistral-small-latest"

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer_scheme = HTTPBearer()


def get_db():
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin      BOOLEAN NOT NULL DEFAULT false,
            last_login_at TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false")
    conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title      TEXT NOT NULL DEFAULT '',
            content    TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_searches (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query      TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scratchpad_words (
            id        SERIAL PRIMARY KEY,
            user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            word      TEXT NOT NULL,
            pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (user_id, word)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            note_id    INTEGER REFERENCES notes(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute(
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL "
        "DEFAULT 'write' CHECK (mode IN ('brainstorm', 'write', 'discovery', 'refine'))"
    )
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_turns (
            id         SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content    TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            genres            TEXT[],
            experience_level  TEXT,
            goal              TEXT,
            hardest_part      TEXT,
            blocker           TEXT,
            frustration       TEXT,
            updated_at        TIMESTAMPTZ
        )
    """)
    conn.execute(
        """INSERT INTO users (email, password_hash, is_admin)
           VALUES (%s, %s, true)
           ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, is_admin = true""",
        (ADMIN_EMAIL.strip().lower(), hash_password(ADMIN_PASSWORD)),
    )
    conn.close()


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    for conn in get_db():
        row = conn.execute(
            "SELECT id, email, is_admin, created_at FROM users WHERE id = %s", (user_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        return row


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# --- Syllable models ---

class SyllableRequest(BaseModel):
    lines: list[str]


class SyllableResponse(BaseModel):
    counts: list[int]


class AnalyzeRequest(BaseModel):
    lines: list[str]


class SyllableInfo(BaseModel):
    text: str    # e.g. "hun"
    key: str     # vowel phoneme e.g. "AH"; empty if word not in CMU dict
    stress: int = 0  # 0=unstressed, 1=primary, 2=secondary (CMU stress digit)


class SyllableOccurrence(BaseModel):
    line: int
    word_index: int
    syllable_index: int


class SyllableGroup(BaseModel):
    color_index: int
    phoneme_key: str
    occurrences: list[SyllableOccurrence]


class SlantOccurrence(BaseModel):
    line: int          # which line (0-indexed)

class SlantGroup(BaseModel):
    color_index: int   # starts after the last syllable_groups color_index
    vowel_key: str     # the shared stressed vowel phoneme
    occurrences: list[SlantOccurrence]


class AnalyzeResponse(BaseModel):
    line_counts: list[int]
    syllable_data: list[list[list[SyllableInfo]]]  # [line][word][syllable]
    syllable_groups: list[SyllableGroup]
    slant_groups: list[SlantGroup] = []


# --- Rhyme models ---

class RhymeRequest(BaseModel):
    query: str
    mode: str = "perfect"  # perfect | slant | synonyms | antonyms | descriptive | related | soundslike | homophones | consonants | phrases


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


# --- Auth models ---

class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    is_admin: bool
    created_at: datetime


class AdminUserOut(BaseModel):
    id: int
    email: str
    is_admin: bool
    created_at: datetime
    last_login_at: datetime | None
    note_count: int


class AdminStatsOut(BaseModel):
    total_users: int
    total_notes: int
    total_chat_sessions: int
    total_chat_turns: int
    signups_last_7_days: int


class AdminPasswordReset(BaseModel):
    password: str


class AdminAdminToggle(BaseModel):
    is_admin: bool


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


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
    created_at: datetime
    updated_at: datetime


class SavedSearchCreate(BaseModel):
    query: str

class SavedSearchOut(BaseModel):
    id: int
    query: str
    created_at: datetime


# --- Scratchpad models ---

class ScratchpadWordCreate(BaseModel):
    word: str


class ScratchpadWordOut(BaseModel):
    id: int
    word: str
    pinned_at: datetime


# --- Chat models ---

CHAT_MODES = ("brainstorm", "write", "discovery", "refine")


class ChatSessionCreate(BaseModel):
    note_id: int | None = None
    mode: str = "write"


class ChatSessionOut(BaseModel):
    id: int
    note_id: int | None
    mode: str
    created_at: datetime


class ChatTurnOut(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime


class ChatTurnCreate(BaseModel):
    content: str


class ChatTurnPairOut(BaseModel):
    user_turn: ChatTurnOut
    assistant_turn: ChatTurnOut


# --- User profile models ---

class UserProfileIn(BaseModel):
    genres: list[str] | None = None
    experience_level: str | None = None
    goal: str | None = None
    hardest_part: str | None = None
    blocker: str | None = None
    frustration: str | None = None


class UserProfileOut(BaseModel):
    genres: list[str] | None
    experience_level: str | None
    goal: str | None
    hardest_part: str | None
    blocker: str | None
    frustration: str | None
    updated_at: datetime | None


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
                sub_syls[0] = SyllableInfo(text='-' + sub_syls[0].text, key=sub_syls[0].key, stress=sub_syls[0].stress)
            result.extend(sub_syls)
        return result

    clean = core.lower()
    entries = _cmu_lookup(clean)
    if not entries:
        return [SyllableInfo(text=core, key='', stress=0)]
    phonemes = entries[0]
    vowel_phonemes_raw = [ph for ph in phonemes if ph.rstrip('012') in VOWEL_PHONEMES]
    vowel_keys = [ph.rstrip('012') for ph in vowel_phonemes_raw]
    stress_digits = [int(ph[-1]) if ph[-1].isdigit() else 0 for ph in vowel_phonemes_raw]
    if not vowel_keys:
        return [SyllableInfo(text=core, key='', stress=0)]
    parts = _pyphen.inserted(clean).split('-')
    if len(parts) != len(vowel_keys):
        return [SyllableInfo(text=core, key=vowel_keys[-1], stress=stress_digits[-1])]
    result: list[SyllableInfo] = []
    pos = 0
    for i, part in enumerate(parts):
        syl_text = core[pos: pos + len(part)]
        result.append(SyllableInfo(text=syl_text, key=vowel_keys[i], stress=stress_digits[i]))
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
    BUCKET_LIMIT = 50

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


# --- Rhyme endpoint ---

@app.post("/api/rhymes", response_model=RhymeResponse)
def get_rhymes(request: RhymeRequest) -> RhymeResponse:
    raw = request.query.strip().split()[:5]
    words = [re.sub(r"[^\w']", "", w).lower() for w in raw]
    words = [w for w in words if w]

    if not words:
        return RhymeResponse(words=[], sections=[])

    sections: list[RhymeSection] = []

    if request.mode == "perfect":
        # Existing CMU-based perfect rhyme logic (unchanged)
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
    else:
        # Datamuse-based modes: use only the last word as the anchor
        anchor = words[-1]
        rhymes_en, rhymes_other = _datamuse_results_for_mode(anchor, request.mode)
        sections.append(RhymeSection(columns=[
            RhymeColumn(
                chunk=" ".join(words),
                anchor=anchor,
                chunk_phonemes=_chunk_phonemes(words),
                rhymes_by_syllables=rhymes_en,
                other_rhymes_by_syllables=rhymes_other,
            )
        ]))

    return RhymeResponse(words=words, sections=sections)


# --- Auth endpoints ---

@app.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def auth_register(body: UserCreate):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    password_hash = hash_password(body.password)
    for conn in get_db():
        try:
            row = conn.execute(
                """INSERT INTO users (email, password_hash)
                   VALUES (%s, %s)
                   RETURNING id, email, is_admin, created_at""",
                (email, password_hash),
            ).fetchone()
        except psycopg.errors.UniqueViolation:
            conn.rollback()
            raise HTTPException(status_code=409, detail="Email already registered")
        conn.commit()
        return UserOut(**row)


@app.post("/api/auth/login", response_model=TokenOut)
def auth_login(body: LoginRequest):
    email = body.email.strip().lower()
    for conn in get_db():
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = %s", (email,)
        ).fetchone()
        if not row or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        conn.execute(
            "UPDATE users SET last_login_at = now() WHERE id = %s", (row["id"],)
        )
        conn.commit()
        return TokenOut(access_token=create_access_token(row["id"]))


@app.get("/api/auth/me", response_model=UserOut)
def auth_me(current_user: dict = Depends(get_current_user)):
    return UserOut(**current_user)


# --- Admin endpoints ---

@app.get("/api/admin/users", response_model=list[AdminUserOut])
def admin_list_users(admin: dict = Depends(require_admin)):
    for conn in get_db():
        rows = conn.execute("""
            SELECT u.id, u.email, u.is_admin, u.created_at, u.last_login_at,
                   COUNT(n.id) AS note_count
            FROM users u
            LEFT JOIN notes n ON n.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """).fetchall()
        return [AdminUserOut(**row) for row in rows]


@app.get("/api/admin/stats", response_model=AdminStatsOut)
def admin_stats(admin: dict = Depends(require_admin)):
    for conn in get_db():
        total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        total_notes = conn.execute("SELECT COUNT(*) AS c FROM notes").fetchone()["c"]
        total_chat_sessions = conn.execute("SELECT COUNT(*) AS c FROM chat_sessions").fetchone()["c"]
        total_chat_turns = conn.execute("SELECT COUNT(*) AS c FROM chat_turns").fetchone()["c"]
        signups_last_7_days = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE created_at >= now() - interval '7 days'"
        ).fetchone()["c"]
        return AdminStatsOut(
            total_users=total_users,
            total_notes=total_notes,
            total_chat_sessions=total_chat_sessions,
            total_chat_turns=total_chat_turns,
            signups_last_7_days=signups_last_7_days,
        )


@app.put("/api/admin/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def admin_reset_password(user_id: int, body: AdminPasswordReset, admin: dict = Depends(require_admin)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    for conn in get_db():
        result = conn.execute(
            "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s",
            (hash_password(body.password), user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()


@app.put("/api/admin/users/{user_id}/admin", status_code=status.HTTP_204_NO_CONTENT)
def admin_toggle_admin(user_id: int, body: AdminAdminToggle, admin: dict = Depends(require_admin)):
    if user_id == admin["id"] and not body.is_admin:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")
    for conn in get_db():
        result = conn.execute(
            "UPDATE users SET is_admin = %s, updated_at = now() WHERE id = %s",
            (body.is_admin, user_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()


@app.delete("/api/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(user_id: int, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    for conn in get_db():
        result = conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()


# --- Notes endpoints ---

@app.get("/api/notes", response_model=list[NoteOut])
def list_notes(q: str = "", current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        if q.strip():
            pattern = f"%{q.strip()}%"
            rows = conn.execute(
                """SELECT id, title, content, created_at, updated_at FROM notes
                   WHERE user_id = %s AND (title ILIKE %s OR content ILIKE %s)
                   ORDER BY updated_at DESC""",
                (current_user["id"], pattern, pattern),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = %s ORDER BY updated_at DESC",
                (current_user["id"],),
            ).fetchall()
        return [NoteOut(**row) for row in rows]


@app.post("/api/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(body: NoteCreate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO notes (user_id, title, content)
               VALUES (%s, %s, %s)
               RETURNING id, title, content, created_at, updated_at""",
            (current_user["id"], body.title, body.content),
        ).fetchone()
        conn.commit()
        return NoteOut(**row)


@app.put("/api/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, body: NoteUpdate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """UPDATE notes SET title = %s, content = %s, updated_at = now()
               WHERE id = %s AND user_id = %s
               RETURNING id, title, content, created_at, updated_at""",
            (body.title, body.content, note_id, current_user["id"]),
        ).fetchone()
        conn.commit()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return NoteOut(**row)


@app.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM notes WHERE id = %s AND user_id = %s", (note_id, current_user["id"])
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Saved searches endpoints ---

@app.get("/api/saved-searches", response_model=list[SavedSearchOut])
def list_saved_searches(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, query, created_at FROM saved_searches WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [SavedSearchOut(**row) for row in rows]


@app.post("/api/saved-searches", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(body: SavedSearchCreate, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO saved_searches (user_id, query)
               VALUES (%s, %s)
               RETURNING id, query, created_at""",
            (current_user["id"], body.query.strip()),
        ).fetchone()
        conn.commit()
        return SavedSearchOut(**row)


@app.delete("/api/saved-searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM saved_searches WHERE id = %s AND user_id = %s",
            (search_id, current_user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Scratchpad endpoints ---

@app.get("/api/scratchpad", response_model=list[ScratchpadWordOut])
def list_scratchpad(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, word, pinned_at FROM scratchpad_words WHERE user_id = %s ORDER BY pinned_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [ScratchpadWordOut(**row) for row in rows]


@app.post("/api/scratchpad", response_model=ScratchpadWordOut, status_code=status.HTTP_201_CREATED)
def pin_scratchpad_word(body: ScratchpadWordCreate, current_user: dict = Depends(get_current_user)):
    word = body.word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word must not be empty")
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO scratchpad_words (user_id, word)
               VALUES (%s, %s)
               ON CONFLICT (user_id, word) DO UPDATE SET word = EXCLUDED.word
               RETURNING id, word, pinned_at""",
            (current_user["id"], word),
        ).fetchone()
        conn.commit()
        return ScratchpadWordOut(**row)


@app.delete("/api/scratchpad/{word}", status_code=status.HTTP_204_NO_CONTENT)
def unpin_scratchpad_word(word: str, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM scratchpad_words WHERE user_id = %s AND word = %s",
            (current_user["id"], word),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Word not pinned")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Chat session endpoints ---

@app.get("/api/chat-sessions", response_model=list[ChatSessionOut])
def list_chat_sessions(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, note_id, mode, created_at FROM chat_sessions WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["id"],),
        ).fetchall()
        return [ChatSessionOut(**row) for row in rows]


@app.post("/api/chat-sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
def create_chat_session(body: ChatSessionCreate, current_user: dict = Depends(get_current_user)):
    if body.mode not in CHAT_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {CHAT_MODES}")
    for conn in get_db():
        if body.note_id is not None:
            owned = conn.execute(
                "SELECT id FROM notes WHERE id = %s AND user_id = %s",
                (body.note_id, current_user["id"]),
            ).fetchone()
            if not owned:
                raise HTTPException(status_code=404, detail="Note not found")
        row = conn.execute(
            """INSERT INTO chat_sessions (user_id, note_id, mode)
               VALUES (%s, %s, %s)
               RETURNING id, note_id, mode, created_at""",
            (current_user["id"], body.note_id, body.mode),
        ).fetchone()
        conn.commit()
        return ChatSessionOut(**row)


@app.delete("/api/chat-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(session_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        cur = conn.execute(
            "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Chat session not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/chat-sessions/{session_id}/turns", response_model=list[ChatTurnOut])
def list_chat_turns(session_id: int, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        session = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        rows = conn.execute(
            """SELECT id, session_id, role, content, created_at FROM chat_turns
               WHERE session_id = %s ORDER BY created_at ASC""",
            (session_id,),
        ).fetchall()
        return [ChatTurnOut(**row) for row in rows]


# --- Mistral integration ---

_MODE_PROMPTS: dict[str, str] = {
    "brainstorm": (
        "Free-flowing creative conversation. Throw out many ideas, metaphors, and "
        "directions. Use this style when the user is starting fresh or needs inspiration."
    ),
    "write": (
        "Focused lyric writing. Help develop verses, choruses, and bridges. Use this "
        "style when the user knows what they want and needs help writing it."
    ),
    "discovery": (
        "Guided discovery through questions. Ask questions to help the user find their "
        "own voice rather than writing for them. Use this style when the user is stuck "
        "or wants to dig deeper into meaning."
    ),
    "refine": (
        "Polish and improve existing lyrics - rhythm, word choice, flow. Use this style "
        "when the user has lyrics that need fine-tuning."
    ),
}

_BASE_SYSTEM_PROMPT = (
    "You are a songwriting and poetry assistant. Help the user write lyrics, verses, "
    "and poetry in any genre or style. If asked to write code, functions, or "
    "technical/programming content, decline and steer back to lyrics - even a song "
    "about coding should stay in lyric form, not actual code."
)


def _profile_summary(profile: dict | None) -> str | None:
    """Build a one-line profile summary for the system prompt, or None if the
    profile is missing or has no non-null fields."""
    if not profile:
        return None
    clauses: list[str] = []
    if profile.get("genres"):
        clauses.append(f"writes mostly {', '.join(profile['genres'])}")
    if profile.get("experience_level"):
        clauses.append(f"{profile['experience_level']} level")
    if profile.get("goal"):
        clauses.append(f"current goal is to {profile['goal']}")
    if profile.get("hardest_part"):
        clauses.append(f"finds {profile['hardest_part']} hardest")
    if profile.get("blocker"):
        clauses.append(f"most often blocked by {profile['blocker']}")
    if profile.get("frustration"):
        clauses.append(f"currently frustrated by {profile['frustration']}")
    if not clauses:
        return None
    return "About this user: " + "; ".join(clauses) + "."


def _build_system_prompt(mode: str, profile: dict | None) -> str:
    parts = [_BASE_SYSTEM_PROMPT, _MODE_PROMPTS[mode]]
    summary = _profile_summary(profile)
    if summary:
        parts.append(summary)
    return "\n\n".join(parts)


def _call_mistral(messages: list[dict]) -> str:
    if not MISTRAL_API_KEY:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")
    try:
        resp = requests.post(
            MISTRAL_CHAT_URL,
            headers={
                "Authorization": f"Bearer {MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": MISTRAL_MODEL, "messages": messages},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except requests.RequestException as exc:
        logger.warning("mistral call failed: %r", exc)
        raise HTTPException(status_code=502, detail="Failed to reach Mistral API") from exc


@app.post(
    "/api/chat-sessions/{session_id}/turns",
    response_model=ChatTurnPairOut,
    status_code=status.HTTP_201_CREATED,
)
def create_chat_turn(session_id: int, body: ChatTurnCreate, current_user: dict = Depends(get_current_user)):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="content must not be empty")

    for conn in get_db():
        session = conn.execute(
            "SELECT id, mode FROM chat_sessions WHERE id = %s AND user_id = %s",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        history = conn.execute(
            """SELECT role, content FROM chat_turns
               WHERE session_id = %s ORDER BY created_at ASC""",
            (session_id,),
        ).fetchall()

        profile = conn.execute(
            """SELECT genres, experience_level, goal, hardest_part, blocker, frustration
               FROM user_profiles WHERE user_id = %s""",
            (current_user["id"],),
        ).fetchone()

        system_prompt = _build_system_prompt(session["mode"], profile)
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend({"role": h["role"], "content": h["content"]} for h in history)
        messages.append({"role": "user", "content": content})

        user_row = conn.execute(
            """INSERT INTO chat_turns (session_id, role, content)
               VALUES (%s, 'user', %s)
               RETURNING id, session_id, role, content, created_at""",
            (session_id, content),
        ).fetchone()
        conn.commit()

        reply = _call_mistral(messages)

        assistant_row = conn.execute(
            """INSERT INTO chat_turns (session_id, role, content)
               VALUES (%s, 'assistant', %s)
               RETURNING id, session_id, role, content, created_at""",
            (session_id, reply),
        ).fetchone()
        conn.commit()

        return ChatTurnPairOut(
            user_turn=ChatTurnOut(**user_row),
            assistant_turn=ChatTurnOut(**assistant_row),
        )


# --- User profile endpoints ---

@app.get("/api/profile", response_model=UserProfileOut)
def get_profile(current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """SELECT genres, experience_level, goal, hardest_part, blocker, frustration, updated_at
               FROM user_profiles WHERE user_id = %s""",
            (current_user["id"],),
        ).fetchone()
        if not row:
            return UserProfileOut(
                genres=None, experience_level=None, goal=None,
                hardest_part=None, blocker=None, frustration=None, updated_at=None,
            )
        return UserProfileOut(**row)


@app.put("/api/profile", response_model=UserProfileOut)
def upsert_profile(body: UserProfileIn, current_user: dict = Depends(get_current_user)):
    for conn in get_db():
        row = conn.execute(
            """INSERT INTO user_profiles
                   (user_id, genres, experience_level, goal, hardest_part, blocker, frustration, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, now())
               ON CONFLICT (user_id) DO UPDATE SET
                   genres = EXCLUDED.genres,
                   experience_level = EXCLUDED.experience_level,
                   goal = EXCLUDED.goal,
                   hardest_part = EXCLUDED.hardest_part,
                   blocker = EXCLUDED.blocker,
                   frustration = EXCLUDED.frustration,
                   updated_at = now()
               RETURNING genres, experience_level, goal, hardest_part, blocker, frustration, updated_at""",
            (
                current_user["id"], body.genres, body.experience_level, body.goal,
                body.hardest_part, body.blocker, body.frustration,
            ),
        ).fetchone()
        conn.commit()
        return UserProfileOut(**row)
