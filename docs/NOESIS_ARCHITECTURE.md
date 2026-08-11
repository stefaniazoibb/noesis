# NOĒSIS — Current Architecture (as-built)

Status date: 2026-08-11. This documents what **exists in the repository**;
the founding design is `docs/ARCHITECTURE.md` (v1 blueprint, still accurate
in its principles). Numbers: ~5.7k lines TS/TSX (63 files), ~1.8k lines
Python, 2.3 MB mesh assets, 62 studies / 236 assertions / 19 disorders,
3 embedding artifact sets, 20 unit tests, 14 commits.

## Stack

- **App**: Next.js 16.3 (App Router, Turbopack), React 19, TypeScript strict,
  Tailwind 4, three r185 + @react-three/fiber 9 + drei 10, zustand 5, zod 4,
  minisearch 7, d3-{scale,selection,zoom}, @anthropic-ai/sdk.
- **Offline pipeline**: Python 3.13 in conda env `noesis` — nibabel, MNE
  (fsaverage fetch), trimesh, fast-simplification, scikit-image (meshes);
  httpx (PubMed/OpenAlex); numpy/scikit-learn/umap-learn (representations).
- **No database, no Python server** — static JSON validated by Zod; all data
  access via `src/lib/repo/` (the future Postgres/Neo4j/pgvector seam).
- **Tests**: vitest (20 unit tests: citations, convergence, gaps, similarity,
  question ranking); Playwright browser verification via the webapp-testing
  flow (scripts currently ad-hoc, not committed — see roadmap).

## Layout (annotated)

```text
pipeline/               offline, emits artifacts; never serves requests
  meshes/               fsaverage+DK -> per-hemisphere GLB + vertex->region
                        sidecars; aseg -> 15 subcortical GLBs (surface RAS)
  curation/             fetch_pubmed.py (E-utilities + verbatim cache),
                        curated.py (the human-authored judgment table),
                        build_evidence.py (merges cache metadata -> /data),
                        verify_studies.py (PubMed+OpenAlex gate, DOI-alias aware)
  embeddings/           build_representation.py: modality-partitioned evidence
                        features -> log1p -> z-score -> PCA (+loadings) + UMAP
                        -> EmbeddingSet artifacts (region/disorder/study)
data/                   versioned scientific data, Zod-validated (validate:data)
  atlases/atlas.dk.json 83 regions (68 DK cortical + 15 aseg subcortical)
  disorders|modalities|networks/  19 / 4 / 4 entities (networks: memberships
                        deliberately empty until a provenanced parcellation)
  studies/ evidence/    62 studies, 236 assertions (every assertion -> studyId
                        -> DOI/PMID; verified; curation.verifiedByHuman=false
                        until human spot-check)
  embeddings/ provenance/ LICENSES.md
public/meshes|embeddings/  served copies of pipeline artifacts
src/
  app/                  / /brain /disorders(/[id]) /assistant /ml /compare(-)
                        api/assistant api/questions
  brain/                BrainViewer, CortexHemisphere (shader region highlight
                        + overlay DataTexture), Subcortex, FilterBar, Legend,
                        RegionPanel, ViewerControls, HoverLabel, sidecar loader
  lib/schemas/          Zod: atlas, entities, evidence, viz state, ML artifacts
  lib/repo/             atlas, entities, evidence (+EvidenceIndex, profiles,
                        gaps caches) — the only data access path
  lib/evidence/         metrics (EvidenceIndex, levels), convergence profiles,
                        gap rules, overlay computation (all modes)
  lib/ml/               similarity (cosine/kNN), embeddings loader
  ai/                   provider (opus-5 synth + haiku intent, env-overridable),
                        intent, retrieval, prompts, citations validator,
                        questions (gap->question pipeline)
  ml/ components/ evidence/ search/ state/  UI + MiniSearch + zustand VizState
scripts/                validate-data.ts (CI gate), report-gaps.ts
docs/                   ARCHITECTURE (blueprint), METRICS, NOESIS_* (this set)
```

## Key mechanisms

- **3D picking/overlay**: one mesh per hemisphere; per-vertex `_region`
  attribute + `onBeforeCompile` shader; hover/selection via uniforms; all
  evidence modes paint through one 256×1 RGBA DataTexture
  (`createCortexAssets` imperative API). Raycast face -> vertex -> region id.
- **Viz modes** (`VizState.mode`): anatomical, disorder (study counts,
  sequential ramp), convergence (ordinal, modality categories), gaps
  (categorical: conflicting/convergent/single-category/single-study),
  compare (A/B/shared — **WIP**: overlay+legend+filter done, /compare page
  missing). Legends always state the metric definition.
- **Provenance chain** (enforced): region -> assertion -> studyId -> DOI/PMID;
  referential integrity fails the build; UI always renders the chain.
- **RAG assistant**: haiku structured-output intent parse (catalog-constrained
  entity linking, re-validated) -> deterministic graph retrieval + MiniSearch
  -> opus-5 synthesis (server-side refusal fallbacks) -> deterministic
  citation validation (strip hallucinated ids, flag uncited claims) ->
  cited answer; empty retrieval answers deterministically. NL viz commands
  compile to `VizStatePatch` only. Never live-tested (no API key present).
- **Research questions**: deterministic gap ranking (magnitude × published
  rule weight) + fixed question type per rule + grounded package -> LLM prose
  -> citation validation. LLM never scores/ranks/picks targets.
- **Deep links**: /brain?region|disorder|disorder2(-)|mode|modality; search
  results and pages navigate into configured viz states.

## Cross-cutting constraints

- fsaverage surface-RAS frame everywhere; viewer applies RAS->y-up rotation
  (`BrainViewer` group) with hardcoded scene center [0.6, 15.6, 17.8].
- Artifacts are contracts: RegionScalarMap / EmbeddingSet / ModelRun
  (`src/lib/schemas/artifacts.ts`) — future real-modality ML plugs in by
  emitting these; the frontend never changes shape.
- Models: `claude-opus-5` (synthesis) and `claude-haiku-4-5` (intent),
  overridable via NOESIS_SYNTH_MODEL / NOESIS_INTENT_MODEL; credentials via
  ANTHROPIC_API_KEY in `.env.local` (see `.env.example`).
