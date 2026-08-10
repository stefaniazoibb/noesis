# NOĒSIS — Technical Blueprint (v1)

**NOĒSIS — An AI atlas of brain, behavior & evidence.**

Status: proposed, pre-implementation. This document becomes `docs/ARCHITECTURE.md` in the repo.
Environment facts: no existing repository; macOS (darwin), Homebrew present, Node.js being installed,
Python 3.13 available for the offline pipeline. Everything below is greenfield.

---

## 1. Exact stack and dependencies

**Runtime targets:** Node 22 LTS (Homebrew), Python 3.13 (venv, offline pipeline only — no Python server in MVP).

**Web app — runtime dependencies (exact packages):**

| Package | Version line | Role |
|---|---|---|
| `next` | 15.x (App Router) | framework, route handlers for AI API |
| `react`, `react-dom` | 19.x | UI |
| `typescript` | 5.x, `strict: true` | typing |
| `three` | current r17x | 3D engine |
| `@react-three/fiber` | 9.x | React renderer for three |
| `@react-three/drei` | 10.x | OrbitControls, helpers |
| `zustand` | 5.x | viewer/selection/filter state (URL-serializable) |
| `zod` | 4.x | runtime schema validation — single source of truth for all data files |
| `minisearch` | 7.x | local keyword/BM25-style search (MVP) |
| `d3-scale`, `d3-selection`, `d3-zoom` | 7.x | embedding scatter, legends (not all of d3) |
| `@anthropic-ai/sdk` | current | default LLM provider behind an abstraction |

**Dev dependencies:** `tailwindcss` 4.x, `eslint` + `eslint-config-next`, `prettier`, `vitest` (schema/data validation tests run in CI), `tsx` (data validation scripts).

Explicitly **not** in MVP: no database, no ORM, no vector DB, no LangChain-style framework (the RAG loop is ~300 lines of typed code we control), no Python backend.

**Offline pipeline (conda env `noesis`, from `pipeline/requirements.txt`):** `nibabel`, `nilearn`, `mne` (fsaverage fetch), `numpy`, `scipy`, `scikit-image`, `trimesh`, `fast-simplification`, `scikit-learn`, `umap-learn`, `httpx` (PubMed/OpenAlex/Crossref metadata), `pydantic` (mirrors the Zod schemas for pipeline-side validation).

---

## 2. Folder structure

```text
noesis/
├── docs/                       # this file, DATA_PROVENANCE.md, METRICS.md (metric definitions)
├── pipeline/                   # offline Python; outputs artifacts, never serves requests
│   ├── meshes/                 # atlas → GLB + region maps
│   ├── curation/               # study metadata fetch/verify (PubMed, OpenAlex, Crossref)
│   ├── embeddings/             # co-occurrence SVD, text embeddings, UMAP projections
│   └── validate/               # pydantic validation of everything in /data
├── data/                       # versioned scientific data. NO presentation code. NO derived truth.
│   ├── atlases/                #   atlas.dk.json (region ids, names, hemisphere, system, synonyms)
│   ├── regions/ disorders/ networks/ modalities/
│   ├── studies/studies.json
│   ├── evidence/assertions.json
│   ├── embeddings/             #   *.manifest.json + *.f32 binary vectors + *.proj2d.json
│   ├── provenance/             #   one provenance record per ingested dataset
│   └── LICENSES.md
├── public/meshes/              # GLB geometry + vertex→region maps (lazy-loaded)
└── src/
    ├── app/                    # routes: / /brain /disorders/[id] /evidence /assistant /ml
    │   └── api/assistant/      #   POST: retrieval + synthesis (streamed)
    ├── brain/                  # BrainViewer, RegionMesh, EvidenceOverlay, Legend, picking
    ├── components/             # AppShell, GlobalSearch, FilterBar, panels
    ├── evidence/ disorders/ studies/ search/ graph/ ml/
    ├── ai/                     # provider abstraction, retrieval, ranking, citation validator
    ├── state/                  # zustand stores; VizState is one serializable object
    └── lib/
        ├── schemas/            # Zod schemas (entities, assertions, VizState, artifacts)
        └── repo/               # DataRepository interface — the ONLY data access path
```

`lib/repo/` is the migration seam: MVP implementation reads static JSON; later implementations target Postgres/Neo4j/pgvector without touching components.

---

## 3. 3D brain / atlas strategy — real meshes only

No placeholder geometry at any point. One-time offline pipeline:

**Cortex.** `mne.datasets.fetch_fsaverage` → FreeSurfer fsaverage subject: `{lh,rh}.pial`
(163,842 vertices/hemisphere) + `{lh,rh}.aparc.annot` (Desikan-Killiany, 34 regions/hemisphere;
names and colors read from the annot color table — never typed by hand). Then per hemisphere:
decimate with `fast-simplification` to ~18k vertices → transfer region labels to decimated
vertices by nearest-neighbor (scipy cKDTree) against the original labeled surface → export
one GLB per hemisphere (positions + normals + indices) plus a sidecar
`{hemi}.regions.json` (`Uint16` vertex→region-index array + region-index→canonical-id table).
Geometry carries zero science — only anatomy.

**Subcortex.** From the same fsaverage subject's `mri/aseg.mgz`: marching cubes
(scikit-image) per structure — bilateral thalamus, caudate, putamen, pallidum, hippocampus,
amygdala, accumbens, plus brainstem (FreeSurfer label ids from the standard FreeSurfer LUT) —
Laplacian smoothing → decimation → one small GLB per structure. Coordinates via the MGZ
`vox2ras_tkr` affine, i.e. the **same surface-RAS frame as the pial surfaces**: exact alignment,
no cross-template registration, single license family (FreeSurfer). Fallback if aseg is absent
from the MNE bundle: Harvard-Oxford subcortical atlas (nilearn) + documented MNI152→MNI305
affine — noted as fallback because of FSL's non-commercial license.

**Rendering & interaction.** One mesh per hemisphere (not 68 meshes — avoids seams and
draw-call overload). Region highlighting via a per-vertex `_region` attribute (built client-side
from the sidecar) and a small `onBeforeCompile` injection into `MeshStandardMaterial`: uniforms
`uSelectedRegion`, `uHoverRegion`, plus a data texture of per-region overlay colors for evidence
modes. Picking: raycast → face index → vertex → region id from the CPU-side array. Hemisphere
toggle, named camera views, subcortex visibility toggle.

**Atlas upgrades** (Destrieux, HCP-MMP after accepting WU-Minn terms) are new asset sets with
the same sidecar format; `atlas.dk.json` generalizes to `atlas.<name>.json` and evidence
assertions reference atlas-qualified region ids, so a finer parcellation never breaks data.

**Size budget:** ~18k verts/hemi ≈ 650 KB GLB before gzip; subcortical structures ~50–100 KB
each; total first-load geometry < 2.5 MB, lazy: left hemisphere first, then right, subcortex on
demand. Draco added only if budgets are exceeded.

---

## 4. Evidence database schema (with exact provenance chain)

All files Zod-validated at build; **the build fails on any referential-integrity violation.**

```jsonc
// data/studies/studies.json — one record per real publication
{
  "id": "study_017",
  "title": "…", "authors": ["…"], "year": 2019, "journal": "…",
  "doi": "10.…",            // REQUIRED unless pmid present
  "pmid": "…",              // REQUIRED unless doi present
  "disorders": ["major_depressive_disorder"],
  "regions": ["dk_lh_rostralanteriorcingulate"],
  "networks": [], "modalities": ["fmri"],
  "finding_type": "functional_connectivity",
  "finding": "faithful one-sentence summary of the reported result",
  "direction": "decreased",         // increased | decreased | mixed | null
  "sample_size": 120,               // null if not reported
  "population": "…", "coordinates": [], "atlas": null,
  "effect_size": null, "evidence_level": null,
  "source": "pubmed",
  "curation": {
    "method": "manual",             // manual | ai_extracted
    "verified_by_human": true,
    "metadata_verified_against": "pubmed",   // where title/DOI/authors were checked
    "curated_date": "2026-08-10"
  }
}
```

```jsonc
// data/evidence/assertions.json — the atomic evidence unit. Never a bare disorder→region link.
{
  "id": "ev_0042",
  "disorder": "major_depressive_disorder",
  "region": "dk_lh_rostralanteriorcingulate",
  "network": "default_mode_network",     // nullable
  "modality": "fmri",
  "finding_type": "functional_connectivity",
  "direction": "decreased",
  "statement": "verbatim-faithful finding summary",
  "study_id": "study_017",               // REQUIRED — orphan assertions fail the build
  "causal_support": "correlational",     // none | correlational | interventional
  "confidence": null                     // only populated for ai_extracted rows
}
```

**Provenance chain, enforced end to end:**
`region_id → assertion (ev_*) → study_id → DOI/PMID → external link`.
Guarantees: (1) every assertion has a `study_id`; (2) every study has DOI or PMID whose metadata
was verified against PubMed/OpenAlex/Crossref at curation time (`pipeline/curation` fetches and
diffs title/year/authors; mismatches block ingestion); (3) CI validation rejects dangling
region/disorder/modality/study references; (4) the UI never renders an association without a
click-through to its assertions and studies; (5) derived metrics (counts, convergence,
Strong/Moderate/Emerging/Mixed/Limited labels) are **computed at build from assertions** with
their formulas published in `docs/METRICS.md` and shown in every legend — never stored as
hand-edited truth. Unknown values are `null`; "Evidence unavailable" is a first-class UI state.

Entity files (`regions`, `disorders`, `modalities`, `networks`) carry descriptive metadata and
controlled-vocabulary `synonyms` arrays ("ACC", "anterior cingulate", …) used by curation
normalization and search.

---

## 5. Knowledge-graph schema

The graph is a **derived artifact** compiled from entities + assertions (never hand-edited),
emitted as typed node/edge lists — trivially portable to Neo4j later (same labels/types).

```text
Node types:  Region | Network | Disorder | Modality | Study | (later: Symptom, StimTarget)
Edge types:
  ASSOCIATED_WITH      Region↔Disorder      provenance: assertion ids (≥1 required)
  STUDIED_WITH         Region|Disorder↔Modality        from assertions
  REPORTED_IN          Assertion→Study                  intrinsic
  MEMBER_OF            Region→Network                   from atlas/network metadata
  CONNECTED_TO         Region↔Region        kind: anatomical|structural|functional; source req.
  MODULATED_BY         Region↔Modality(stim)            from stimulation assertions
```

Every edge carries `{assertion_ids: [], study_ids: [], source, date_compiled, confidence?}`.
Graph queries in MVP are plain typed TypeScript over these lists (intersection, convergence,
neighborhoods) — sufficient at this scale; Neo4j only when the corpus outgrows memory.

---

## 6. RAG architecture — grounding guarantees

**Indexing (offline):** each study and each assertion statement becomes a retrieval document
`{doc_id, text, entity_refs}`; embedded via the `EmbeddingProvider` interface; vectors stored as
`.f32` binary + manifest; a MiniSearch index is built over the same docs at startup.

**Query path (route handler):**

```text
question
  → intent router (small LLM, structured output): {intent, entities, filters}
  → structured retrieval: graph queries for entity-shaped questions
      (overlap, convergence, "regions for X") — deterministic, not LLM
  → text retrieval: hybrid score = BM25 (minisearch) ⊕ cosine (embeddings), top-k
  → ranking: evidence level, modality diversity, recency, sample-size availability
  → synthesis LLM call: context = ONLY retrieved records, serialized with ids;
      system prompt requires hedged scientific language + [study_id] citation per claim
  → citation validator (post-hoc, deterministic):
      every cited id must exist in the retrieved set → else stripped;
      scientific sentences without citations → flagged "uncited" and withheld or labeled
  → response: streamed synthesis + structured citation list (DOI/PMID links) + disclaimer
```

**Hard grounding rules:** empty retrieval ⇒ the assistant answers "no indexed evidence" and
says what the index does cover — it never answers scientific questions from model memory; the
LLM never writes to `/data` (rule 54: AI is an interpretation layer over the evidence DB);
every answer is reproducible from `(question, corpus_version, retrieved_ids)`, all logged.

---

## 7. AI assistant architecture

- **Provider abstraction** (`src/ai/provider.ts`): `LLMProvider { complete(), stream(), structured<T>(schema) }` and `EmbeddingProvider { embed() }`. Anthropic implementation first — `claude-sonnet-5` for synthesis, `claude-haiku-4-5` for intent parsing/query understanding; keys via env; OpenAI-compatible implementation is a drop-in later.
- **Two intents, one router:** (a) *scientific question* → RAG path above; (b) *visualization command* ("only fMRI", "add EEG", "show regions shared with PTSD") → structured output constrained to a `VizStatePatch` Zod schema, applied to the zustand store — the assistant drives the 3D brain; unparseable commands degrade to a clarifying reply, never a guessed mutation.
- **Contextual, not dominant:** the assistant panel is contextual to selection (region selected → suggested prompts: disorders, cross-modal evidence, connectivity, recent studies, compare). It reads the current `VizState` so "add EEG" is interpreted against what's shown.
- Every scientific output carries: citations block, evidence-level labels per claim, and the fixed disclaimer ("AI-generated synthesis based on indexed evidence…").

---

## 8. ML / embedding architecture

Everything ML enters the frontend through **three stable artifact contracts** (this is also the
answer to future extensibility, §9):

1. **`RegionScalarMap`** — `{artifact_id, atlas, values: {region_id: number}, metric_def, provenance}` → rendered by the existing evidence-overlay shader (evidence density, convergence, model importance, saliency all use this one contract).
2. **`EmbeddingSet`** — `{manifest: {artifact_id, entity_type, method, inputs, corpus_version, params, created}, vectors: .f32, ids: [], projection2d: [[x,y]]}` → powers similarity search and the 2D explorer.
3. **`ModelRun`** — `{run_id, task, dataset_def, split_strategy, preprocessing, model, metrics{AUROC, AUPRC, sensitivity, specificity, F1, calibration}, uncertainty, version}` → ML Lab reporting; schema reserved now, enforced later.

**v0 (MVP):** disorder and region embeddings from the evidence corpus itself — truncated SVD of
the disorder×(region ⊗ modality ⊗ finding_type) co-occurrence matrix, plus text embeddings of
finding statements; cosine similarity; precomputed UMAP **and** PCA 2D projections (labeled
"learned evidence-space representation", with the distortion caveat). Framing everywhere:
computational similarity over the indexed literature — not clinical equivalence, not biology.

---

## 9. Multimodal learning roadmap (no frontend rebuild)

- **v0 — literature space** (MVP): co-occurrence + text embeddings, as above. Static artifacts.
- **v1 — real imaging-derived features, still offline:** per-region feature vectors from openly licensed sources (e.g., Neurosynth/NeuroQuery association maps aggregated to DK regions; published ENIGMA summary statistics where licensing allows). Ships as `RegionScalarMap`s + richer `EmbeddingSet`s. Frontend unchanged.
- **v2 — Python service (first backend):** FastAPI + PyTorch/scikit-learn behind the same artifact contracts; enables training on real datasets (OpenNeuro EEG/MRI). First models: linear/CCA cross-modal alignment, contrastive region alignment; GNN link prediction (PyTorch Geometric) over the knowledge graph — predictions always labeled as model output, rendered via `RegionScalarMap` + `ModelRun`.
- **v3 — ML Lab:** dataset upload, preprocessing, training, evaluation, SHAP/permutation importance. Leakage safety enforced in the service, not the UI: subject-level splits mandatory, site-aware validation options, nested CV, `ModelRun` refuses to render without a declared split strategy.

Because every stage emits the same three contracts, the 3D brain, the embedding explorer, and
the reporting views never change shape when real neuroimaging/EEG data arrives.

---

## 10. MVP scope

Real fsaverage/DK brain (68 cortical regions rendered, +8 subcortical structures); 5 disorders
(MDD, PTSD, schizophrenia, Alzheimer's, Parkinson's); 4 modalities (fMRI, sMRI, EEG, TMS);
~40–60 hand-curated, metadata-verified real studies with assertions; region + disorder selection
with evidence panel (chain always visible down to DOI/PMID); modality filters; cross-modal
convergence mode with legend; global search (regions/disorders/studies/DOI/PMID/synonyms);
RAG assistant with citations + NL viz commands; v0 embeddings + similarity + 2D explorer;
disclaimers in the app shell. **Deferred:** disorder comparison view, hypothesis generation,
networks beyond static definitions, graph ML, ML Lab, Python service.

---

## 11. Data sources and licensing

| Source | Use | License status | Action |
|---|---|---|---|
| fsaverage surfaces + DK annot (FreeSurfer, via MNE) | geometry, parcellation | FreeSurfer license; redistribution precedent via MNE/nilearn | document in LICENSES.md |
| fsaverage `aseg.mgz` derivatives | subcortical meshes | same family | same |
| PubMed / PubMed Central | study metadata verification | metadata freely usable; we store our own finding summaries + links, not verbatim abstracts | rate-limited API use |
| OpenAlex | metadata cross-check | CC0 | — |
| Crossref | DOI resolution | open | — |
| Neurosynth / NeuroQuery | later: automated meta-analytic maps (labeled as such, separate from curated studies) | permissive; **verify exact terms at ingestion** | provenance record before use |
| ENIGMA summary stats | later, per publication | per-paper | case-by-case |
| Harvard-Oxford (FSL) | fallback subcortex only | **non-commercial** | avoid if aseg path works |
| HCP-MMP, AAL | deferred | restricted/registration | defer |

Process rule: no dataset enters `/data` without a `data/provenance/<dataset>.json` record
(origin, license, retrieval date, limitations) — blind scraping is prohibited.

---

## 12. Performance risks

1. **Mesh weight / first paint** — decimation budget, lazy hemisphere loading, subcortex on demand, gzip; Draco only if needed.
2. **Highlight-driven re-renders** — region state changes touch shader **uniforms/data-texture only**; React never re-mounts geometry; memoized meshes.
3. **Raycast cost on 36k faces** — acceptable; if hover jank appears, raycast a decimated collider proxy.
4. **Data payloads** — assertions/studies loaded per route, not globally; MiniSearch index built lazily; embedding binaries only on /ml.
5. **LLM latency** — streaming responses; deterministic graph queries answer entity-shaped questions without waiting on synthesis; parse step on a fast model.
6. **Memory growth of the corpus** — repo interface allows moving studies/assertions behind Postgres before JSON becomes the bottleneck.

---

## 13. Scientific validity risks

1. **Fabrication** (worst risk) — mitigated structurally: curation pipeline verifies every study's metadata against PubMed/OpenAlex before ingestion; CI referential integrity; "Evidence unavailable" as a designed state; AI cannot write to `/data`; citation validator strips unverifiable citations.
2. **Curation selection bias** — MVP corpus is small and non-exhaustive; UI labels coverage explicitly ("N indexed studies; not a systematic review").
3. **Causal over-reading** — `causal_support` field distinguishes correlational vs interventional; UI copy uses hedged vocabulary ("implicated in", "associated with"); review checklist for all user-facing scientific strings; association / prediction / model-importance / causal evidence are visually distinct categories (rule 55).
4. **Convergence overclaiming** — convergence counts **independent modality categories**, and its formula is in `docs/METRICS.md` and on the legend.
5. **Atlas mapping errors** — assertions bind to atlas-qualified canonical ids via the synonym vocabulary; curation flags regions that don't map cleanly instead of forcing them.
6. **AI extraction errors** (post-MVP) — `ai_extracted` rows carry confidence, are visually distinct, and require human verification to reach the default view.
7. **Diagnostic misuse** — persistent shell messaging; no individual-level upload paths in MVP; ML Lab (later) gates results on declared validation strategy.

---

## 14. Implementation order (each step lands working)

1. Repo scaffold: Next.js + TS strict + Tailwind + ESLint/Prettier/vitest; Zod schemas + CI data validation (empty datasets validate).
2. Mesh pipeline → GLB + sidecar assets; validation script reports vertex/region coverage.
3. BrainViewer: load, orbit, hover, click, hemisphere toggle, region shader highlight, views. **Acceptance: named-region picking on real anatomy.**
4. Entity datasets + atlas metadata generated from annot color table; region info panel.
5. Curated studies + assertions (metadata-verified); evidence panel with full provenance chain; disorder pages; filters; convergence mode + legends.
6. Global search + DOI/PMID navigation.
7. AI provider abstraction + RAG index + assistant with citation validator; NL viz commands.
8. v0 embeddings + similarity + 2D explorer.
9. Polish: loading/empty states, accessibility pass, responsive layout, performance audit.
10. Tag v0.1; then Phase 6+ per roadmap (§9).
