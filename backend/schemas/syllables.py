from pydantic import BaseModel


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
    onset: str = ""  # space-joined consonant phonemes before the vowel, e.g. "K"
    coda: str = ""   # space-joined consonant phonemes after the vowel, e.g. "T"


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
    word_index: int    # which word within the line (0-indexed, whitespace-split)

class SlantGroup(BaseModel):
    color_index: int   # starts after the last syllable_groups color_index
    kind: str           # "assonance" (shared vowel) | "consonance" (shared trailing consonants)
    key: str            # the shared vowel phoneme (assonance) or consonant cluster (consonance)
    occurrences: list[SlantOccurrence]


class AnalyzeResponse(BaseModel):
    line_counts: list[int]
    syllable_data: list[list[list[SyllableInfo]]]  # [line][word][syllable]
    syllable_groups: list[SyllableGroup]
    slant_groups: list[SlantGroup] = []
