@AGENTS.md

# NOĒSIS — project instructions for Claude Code

NOĒSIS is an AI atlas of brain, behavior & evidence: a real fsaverage/DK 3D
brain atlas + a DOI/PMID-verified evidence corpus + convergence/gap analytics
+ evidence-derived ML representations + a citation-validated RAG assistant.

## Read first

- `docs/NOESIS_ARCHITECTURE.md` — current architecture (what exists, where)
- `docs/NOESIS_SCIENTIFIC_RULES.md` — **non-negotiable** integrity rules
- `docs/NOESIS_ROADMAP.md` — prioritized work; `docs/NOESIS_DECISIONS.md` — why things are the way they are
- `docs/METRICS.md` — every displayed metric's exact definition

## Hard rules (summary — full text in NOESIS_SCIENTIFIC_RULES.md)

1. **Never fabricate science**: no invented studies, DOIs, PMIDs, findings,
   sample sizes, coordinates, or region associations. "Evidence unavailable"
   is a designed state. All studies enter via `pipeline/curation/` (PubMed
   cache → `curated.py` → `build_evidence.py` → `verify_studies.py` must pass).
2. **AI is an interpretation layer**: it never writes to `/data`; assistant
   answers only from retrieved records; citations are validated against the
   retrieved set (`src/ai/citations.ts`).
3. **Hedged language everywhere**: "implicated in / associated with", never
   causal or diagnostic claims. Association ≠ prediction ≠ model importance ≠
   causal evidence.
4. **Every metric has a published definition** (docs/METRICS.md) shown in its
   legend. No unexplained scores.
5. **Synthetic data only in tests**, clearly as test fixtures; if demo data
   ever reaches the UI it must be labeled "DEMO DATA — NOT SCIENTIFIC
   EVIDENCE". Currently the app contains **zero** demo data.

## Working agreements

- Data access goes through `src/lib/repo/` (the migration seam). Zod schemas
  in `src/lib/schemas/` are the single source of truth; `npm run
  validate:data` must pass before any commit that touches `/data`.
- Offline pipeline runs in conda env `noesis` (`pipeline/requirements.txt`).
  After corpus changes: rebuild evidence, re-verify, rebuild embeddings
  (`pipeline/embeddings/build_representation.py`), re-run `npm run report:gaps`.
- Gates before committing app changes: `npx tsc --noEmit`, `npm run lint`,
  `npx vitest run`, `npm run build` (and Playwright via the webapp-testing
  flow for UI changes).
- Next 16 hooks lint: don't mutate memoized values or read refs in render —
  imperative three.js mutation lives behind small APIs (see
  `src/brain/cortexMaterial.ts`); `server-only` imports are stubbed in vitest.
- Don't rewrite working components for cleanliness; preserve existing
  functionality; the repository is the source of truth for what exists.
- Project subagents live in `.claude/agents/` — use `noesis-orchestrator` to
  plan multi-domain work and `noesis-validator` before merging significant
  changes.
