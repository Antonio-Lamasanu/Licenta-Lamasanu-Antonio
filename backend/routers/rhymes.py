import re

from fastapi import APIRouter

from schemas.rhymes import RhymeColumn, RhymeRequest, RhymeResponse, RhymeSection
from services.rhymes import _chunk_phonemes, _datamuse_results_for_mode, _partitions, _rhymes_for_chunk

router = APIRouter()


@router.post("/api/rhymes", response_model=RhymeResponse)
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
