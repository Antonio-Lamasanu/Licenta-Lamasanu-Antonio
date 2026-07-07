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
