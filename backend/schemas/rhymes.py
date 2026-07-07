from pydantic import BaseModel


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
