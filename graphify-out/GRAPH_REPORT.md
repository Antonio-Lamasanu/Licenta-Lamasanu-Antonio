# Graph Report - .  (2026-05-21)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 165 nodes · 203 edges · 23 communities (13 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Syllabification & Analysis Backend|Syllabification & Analysis Backend]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Notes API & App State|Notes API & App State]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Syllables API Client|Syllables API Client]]
- [[_COMMUNITY_Rhyme Dictionary API|Rhyme Dictionary API]]
- [[_COMMUNITY_Architecture Docs & README|Architecture Docs & README]]
- [[_COMMUNITY_CMU Phoneme & Rhyme Logic|CMU Phoneme & Rhyme Logic]]
- [[_COMMUNITY_Claude Code Hooks|Claude Code Hooks]]
- [[_COMMUNITY_Claude Code Permissions|Claude Code Permissions]]
- [[_COMMUNITY_LyricEditor Core|LyricEditor Core]]
- [[_COMMUNITY_Frontend Entry Point|Frontend Entry Point]]
- [[_COMMUNITY_Uvicorn|Uvicorn]]
- [[_COMMUNITY_Pydantic|Pydantic]]
- [[_COMMUNITY_English Words|English Words]]
- [[_COMMUNITY_Python-dotenv|Python-dotenv]]
- [[_COMMUNITY_Rhyme Highlight Rendering|Rhyme Highlight Rendering]]
- [[_COMMUNITY_Analyze Endpoint|Analyze Endpoint]]
- [[_COMMUNITY_RHYME_COLORS Palette|RHYME_COLORS Palette]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Rhymathic README` - 8 edges
3. `get_rhymes()` - 7 edges
4. `syllabify_word()` - 6 edges
5. `_rhymes_for_chunk()` - 6 edges
6. `get_db()` - 5 edges
7. `NoteOut` - 5 edges
8. `_cmu_lookup()` - 5 edges
9. `analyze()` - 5 edges
10. `_chunk_phonemes()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Per-line Syllable Count Feature` --rationale_for--> `Pyphen Dependency`  [INFERRED]
  README.md → backend/requirements.txt
- `CMU Pronouncing Dictionary Usage` --rationale_for--> `CMUdict Dependency`  [INFERRED]
  README.md → backend/requirements.txt
- `API Endpoint /api/syllables` --rationale_for--> `FastAPI Dependency`  [INFERRED]
  README.md → backend/requirements.txt
- `App()` --calls--> `useAutoSave()`  [EXTRACTED]
  frontend/src/App.tsx → frontend/src/hooks/useAutoSave.ts
- `LyricEditor Component` --calls--> `/api/analyze Endpoint`  [INFERRED]
  frontend/src/components/LyricEditor.tsx → backend/main.py

## Hyperedges (group relationships)
- **Syllabification Pipeline (CMUdict + Pyphen + English-words)** — requirements_cmudict, requirements_pyphen, requirements_english_words, readme_feature_syllable_count, readme_feature_cmu [INFERRED 0.95]
- **Backend Core Dependencies** — requirements_fastapi, requirements_uvicorn, requirements_pydantic, requirements_dotenv [EXTRACTED 1.00]

## Communities (23 total, 10 thin omitted)

### Community 0 - "Syllabification & Analysis Backend"
Cohesion: 0.11
Nodes (35): analyze(), AnalyzeRequest, AnalyzeResponse, count_line_syllables(), count_syllables(), create_note(), delete_note(), get_db() (+27 more)

### Community 1 - "Frontend Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, fix, react, react-dom, devDependencies, autoprefixer, postcss, tailwindcss (+13 more)

### Community 2 - "Notes API & App State"
Cohesion: 0.18
Nodes (12): API_URL, createNote(), deleteNote(), fetchNotes(), updateNote(), LEGEND_CHIPS, NOTE_TAB_COLORS, NotesSidebarProps (+4 more)

### Community 3 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 4 - "Syllables API Client"
Cohesion: 0.19
Nodes (9): AnalyzeResult, API_URL, fetchAnalysis(), SyllableGroup, SyllableInfo, SyllableOccurrence, EDITOR_STYLE, LyricEditorProps (+1 more)

### Community 5 - "Rhyme Dictionary API"
Cohesion: 0.20
Nodes (7): API_URL, fetchRhymes(), RhymeColumn, RhymeResponse, RhymeSection, RhymeDictionaryProps, SectionProps

### Community 6 - "Architecture Docs & README"
Cohesion: 0.17
Nodes (12): API Endpoint /api/analyze, API Endpoint /api/notes, API Endpoint /api/syllables, Auto-save Feature, CMU Pronouncing Dictionary Usage, Rhyme Highlighting Feature, Per-line Syllable Count Feature, Nginx API Proxy Pattern (+4 more)

### Community 7 - "CMU Phoneme & Rhyme Logic"
Cohesion: 0.20
Nodes (10): _chunk_phonemes(), _cmu_lookup(), CMU dict lookup with fallbacks for common contractions and shortenings.      Tri, Return the rhyme-determining suffix starting from the last stressed vowel., Return (rhymes_by_syllables, other_rhymes_by_syllables) for a chunk.      rhymes, Return a vowel-phoneme string for each word in the group., Vowels-only sequence from a phoneme list, stress digits stripped., _rhyme_tail() (+2 more)

### Community 10 - "LyricEditor Core"
Cohesion: 0.67
Nodes (3): /api/analyze Endpoint, LyricEditor Component, Mirror Div Overlay Pattern

## Knowledge Gaps
- **65 isolated node(s):** `PreToolUse`, `name`, `version`, `private`, `type` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `PreToolUse`, `Return the rhyme-determining suffix starting from the last stressed vowel.`, `Vowels-only sequence from a phoneme list, stress digits stripped.` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Syllabification & Analysis Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.10510510510510511 - nodes in this community are weakly interconnected._
- **Should `Frontend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `TypeScript Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._