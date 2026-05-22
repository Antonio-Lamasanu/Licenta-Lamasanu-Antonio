# Wave 1 – Backend: Datamuse, Slant Rhymes, Phonemes, Saved Searches, Note Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the FastAPI backend with Datamuse-powered rhyme modes, slant-rhyme detection for the editor, stress/phoneme data in the analyze response, saved-searches CRUD, and note title/content search.

**Architecture:** All changes are in `backend/main.py` and `backend/requirements.txt`. Datamuse is called synchronously via `requests` (existing endpoints are sync); CMU dict is the fallback when Datamuse returns nothing. New SQLite table `saved_searches` is created in `init_db`. No breaking changes to existing response shapes — only additive fields.

**Tech Stack:** Python 3, FastAPI, SQLite, cmudict, pyphen, requests (new), Datamuse REST API (`https://api.datamuse.com/words`)

---

## File Map

| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `requests==2.32.3` |
| `backend/main.py` | All logic changes below |

---

### Task 1: Add `requests` dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add requests to requirements.txt**

Open `backend/requirements.txt` and append one line so it reads:

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-dotenv==1.0.1
pydantic==2.8.2
pyphen==0.17.2
english-words==2.0.0
cmudict==1.0.13
requests==2.32.3
```

- [ ] **Step 2: Install the new dependency**

```bash
cd backend
pip install requests==2.32.3
```

Expected: `Successfully installed requests-2.32.3` (or already satisfied).

- [ ] **Step 3: Verify import works**

```bash
python -c "import requests; print(requests.__version__)"
```

Expected output: `2.32.3`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "deps: add requests for Datamuse API calls"
```

---

### Task 2: Add Datamuse helper + update imports

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `requests` import at the top of main.py**

Find the existing import block (around line 1–14) and add `import requests` after the standard library imports:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import cmudict
import pyphen
import re
import requests
from english_words import get_english_words_set
import sqlite3
from itertools import combinations
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
```

- [ ] **Step 2: Add `_datamuse_fetch` helper after the `_vowel_seq_index` block (around line 62)**

Place this function right after the line `_vowel_seq_index.setdefault(_vseq, []).append(_w)` loop closes, before the `FRONTEND_ORIGIN` line:

```python
DATAMUSE_URL = "https://api.datamuse.com/words"

def _datamuse_fetch(rel_param: str, word: str, max_results: int = 100) -> list[str]:
    """Query Datamuse API. Returns list of words/phrases. Empty list on failure."""
    try:
        resp = requests.get(
            DATAMUSE_URL,
            params={rel_param: word, "md": "s", "max": max_results},
            timeout=3,
        )
        resp.raise_for_status()
        return [item["word"] for item in resp.json()]
    except Exception:
        return []
```

- [ ] **Step 3: Start the backend and confirm it still boots**

```bash
cd backend
uvicorn main:app --reload
```

Expected: `Application startup complete.` — no import errors.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add Datamuse fetch helper"
```

---

### Task 3: Add `stress` field to `SyllableInfo` + update `syllabify_word`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update the `SyllableInfo` model** (around line 121–123)

Replace:
```python
class SyllableInfo(BaseModel):
    text: str   # e.g. "hun"
    key: str    # vowel phoneme e.g. "AH"; empty if word not in CMU dict
```

With:
```python
class SyllableInfo(BaseModel):
    text: str    # e.g. "hun"
    key: str     # vowel phoneme e.g. "AH"; empty if word not in CMU dict
    stress: int = 0  # 0=unstressed, 1=primary, 2=secondary (CMU stress digit)
```

- [ ] **Step 2: Update `syllabify_word` to extract stress digits**

Find the section in `syllabify_word` that builds the result list (around line 288–294):

```python
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
```

Replace with:

```python
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
```

Also update the two early-return lines in the same function (around lines 278–283) that construct single-syllable SyllableInfo without stress:

Find:
```python
    if not entries:
        return [SyllableInfo(text=core, key='')]
```
Replace with:
```python
    if not entries:
        return [SyllableInfo(text=core, key='', stress=0)]
```

And the hyphenated-word sub-call already recurses through `syllabify_word`, so no change needed there.

- [ ] **Step 3: Verify the analyze endpoint still returns valid JSON**

```bash
curl -s -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"lines": ["hello world"]}' | python -m json.tool
```

Expected: `syllable_data[0][0][0]` has `"stress": 0` (or 1/2 depending on the word). No 422 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add stress digit to SyllableInfo in /api/analyze"
```

---

### Task 4: Add `slant_groups` to `AnalyzeResponse`

Slant rhymes in the editor are detected by comparing the **last non-empty word** of each line. Two lines slant-rhyme if they share the same last stressed vowel phoneme (`_stressed_vowel`) but do NOT share the same full rhyme tail (`_rhyme_tail`). Slant groups get color indices starting after the last perfect-rhyme color index so they can use a different visual treatment.

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `_stressed_vowel` helper** — place it right after `_rhyme_tail` (around line 35):

```python
def _stressed_vowel(phonemes: list[str]) -> str | None:
    """Return the last primary or secondary stressed vowel phoneme, stress stripped."""
    for i in range(len(phonemes) - 1, -1, -1):
        if phonemes[i][-1] in '12':
            return phonemes[i].rstrip('012')
    return None
```

- [ ] **Step 2: Add `SlantGroup` model** — place it right after `SyllableGroup` (around line 136):

```python
class SlantOccurrence(BaseModel):
    line: int          # which line (0-indexed)

class SlantGroup(BaseModel):
    color_index: int   # starts after the last syllable_groups color_index
    vowel_key: str     # the shared stressed vowel phoneme
    occurrences: list[SlantOccurrence]
```

- [ ] **Step 3: Update `AnalyzeResponse` model** — add `slant_groups` field:

```python
class AnalyzeResponse(BaseModel):
    line_counts: list[int]
    syllable_data: list[list[list[SyllableInfo]]]  # [line][word][syllable]
    syllable_groups: list[SyllableGroup]
    slant_groups: list[SlantGroup] = []
```

- [ ] **Step 4: Update the `analyze` endpoint** to compute slant groups — find the return statement at the end of the `analyze` function (around line 367) and replace the whole function body after the `syllable_groups` list is built:

Find this section (end of analyze function):
```python
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
```

Replace with:

```python
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
```

- [ ] **Step 5: Test the slant group detection**

```bash
curl -s -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"lines": ["I ride tonight", "the cold outside", "feeling right"]}' | python -m json.tool
```

Expected: `slant_groups` contains at least one entry grouping lines 0 and 2 ("tonight"/"right" share the AY vowel; "outside" shares AY too). All three share AY so expect one group with lines 0,1,2. Perfect if "tonight" and "right" share the same tail they'd be in syllable_groups instead.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py
git commit -m "feat: add slant_groups to /api/analyze response"
```

---

### Task 5: Add `mode` parameter to `/api/rhymes` with Datamuse

The rhymes endpoint gains a `mode` field. Existing `perfect` mode uses CMU (unchanged). All other modes call Datamuse with CMU as a fallback for empty results.

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update `RhymeRequest` model** to include `mode`:

```python
class RhymeRequest(BaseModel):
    query: str
    mode: str = "perfect"  # perfect | slant | synonyms | antonyms | descriptive | related | soundslike | homophones | consonants | phrases
```

- [ ] **Step 2: Add `_datamuse_rhymes_for_word` helper** — place it right before the `get_rhymes` endpoint (after `_chunk_phonemes`):

```python
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
```

- [ ] **Step 3: Update `get_rhymes` endpoint** to branch on `mode`:

Replace the existing `get_rhymes` function body (around line 492–513):

```python
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
```

- [ ] **Step 4: Test perfect mode still works**

```bash
curl -s -X POST http://localhost:8000/api/rhymes \
  -H "Content-Type: application/json" \
  -d '{"query": "cat"}' | python -m json.tool
```

Expected: `sections[0].columns[0].rhymes_by_syllables` contains `"1": ["bat", "hat", ...]`.

- [ ] **Step 5: Test slant mode**

```bash
curl -s -X POST http://localhost:8000/api/rhymes \
  -H "Content-Type: application/json" \
  -d '{"query": "cat", "mode": "slant"}' | python -m json.tool
```

Expected: results like "back", "land", "bad" (same AE vowel, different tail).

- [ ] **Step 6: Test synonyms mode**

```bash
curl -s -X POST http://localhost:8000/api/rhymes \
  -H "Content-Type: application/json" \
  -d '{"query": "happy", "mode": "synonyms"}' | python -m json.tool
```

Expected: words like "glad", "joyful", "cheerful" in `rhymes_by_syllables`.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: add mode parameter to /api/rhymes with Datamuse integration"
```

---

### Task 6: Add `saved_searches` table + CRUD endpoints

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `saved_searches` table creation to `init_db`**

Find `init_db` (around line 76) and add a second `conn.execute` call:

```python
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_searches (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            query      TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()
```

- [ ] **Step 2: Add models for saved searches** — place them after `NoteOut` (around line 184):

```python
class SavedSearchCreate(BaseModel):
    query: str

class SavedSearchOut(BaseModel):
    id: int
    query: str
    created_at: str
```

- [ ] **Step 3: Add CRUD endpoints** — place them after the `delete_note` endpoint (end of file):

```python
# --- Saved searches endpoints ---

@app.get("/api/saved-searches", response_model=list[SavedSearchOut])
def list_saved_searches():
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, query, created_at FROM saved_searches ORDER BY created_at DESC"
        ).fetchall()
        return [SavedSearchOut(**dict(row)) for row in rows]


@app.post("/api/saved-searches", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(body: SavedSearchCreate):
    now = datetime.now(timezone.utc).isoformat()
    for conn in get_db():
        cur = conn.execute(
            "INSERT INTO saved_searches (query, created_at) VALUES (?, ?)",
            (body.query.strip(), now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, query, created_at FROM saved_searches WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return SavedSearchOut(**dict(row))


@app.delete("/api/saved-searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: int):
    for conn in get_db():
        cur = conn.execute("DELETE FROM saved_searches WHERE id = ?", (search_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 4: Test the saved searches endpoints**

```bash
# Create
curl -s -X POST http://localhost:8000/api/saved-searches \
  -H "Content-Type: application/json" \
  -d '{"query": "moonlight"}' | python -m json.tool

# List
curl -s http://localhost:8000/api/saved-searches | python -m json.tool

# Delete (replace 1 with the id returned above)
curl -s -X DELETE http://localhost:8000/api/saved-searches/1
echo "Status: $?"
```

Expected: create returns `{"id": 1, "query": "moonlight", "created_at": "..."}`, list returns array, delete returns 204.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: add saved_searches table and CRUD endpoints"
```

---

### Task 7: Add search parameter to `GET /api/notes`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update `list_notes` to accept a query parameter**

Find `list_notes` (around line 518):

```python
@app.get("/api/notes", response_model=list[NoteOut])
def list_notes():
    for conn in get_db():
        rows = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC"
        ).fetchall()
        return [NoteOut(**dict(row)) for row in rows]
```

Replace with:

```python
@app.get("/api/notes", response_model=list[NoteOut])
def list_notes(q: str = ""):
    for conn in get_db():
        if q.strip():
            pattern = f"%{q.strip()}%"
            rows = conn.execute(
                """SELECT id, title, content, created_at, updated_at FROM notes
                   WHERE title LIKE ? OR content LIKE ?
                   ORDER BY updated_at DESC""",
                (pattern, pattern),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC"
            ).fetchall()
        return [NoteOut(**dict(row)) for row in rows]
```

- [ ] **Step 2: Test search**

```bash
# Create a test note first
curl -s -X POST http://localhost:8000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title": "Moonlight Sonata", "content": "da da dum"}' > /dev/null

# Search
curl -s "http://localhost:8000/api/notes?q=moon" | python -m json.tool
```

Expected: returns the note with title "Moonlight Sonata". Empty query returns all notes.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add ?q= search parameter to GET /api/notes"
```
