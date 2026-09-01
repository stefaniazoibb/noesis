# NOĒSIS — Roadmap & Feature Status

Status date: 2026-09-01. Mirrors the session task list; update both together.
Repo pushed to https://github.com/stefaniazoibb/noesis (private) 2026-09-01;
CI live. Open items: #8 (needs ANTHROPIC_API_KEY in .env.local) and #9
(per-study review via `mark_verified.py --show-next`) — both owner Stefania.

## Completed (verified, committed)

| Feature | Notes |
|---|---|
| Mesh pipeline + 83-region atlas | fsaverage/DK + aseg, GLB + sidecars, provenance records |
| BrainViewer | orbit/hover/click picking, shader highlight, hemisphere/subcortex toggles, camera presets |
| Entity datasets | 19 disorders, 4 modalities, 4 networks (memberships pending provenance) |
| Evidence corpus | 62 studies / 236 assertions, PubMed+OpenAlex verified (DOI-alias aware) |
| Evidence viz modes | disorder density, convergence, gaps (+legends with definitions) |
| Region/disorder evidence panels | full provenance chains, modality checklists, level chips |
| Global search + deep links | regions/disorders/studies/synonyms/DOI/PMID |
| RAG assistant | intent parse, retrieval, cited synthesis, citation validator, NL viz commands (not yet live-tested) |
| Representation pipeline + /ml | PCA(+loadings)/UMAP artifacts, scatter, neighbors, brain bridge |
| Convergence profiles + gap rules | 4 documented rules; report:gaps |
| Research-question generation | deterministic ranking + grounded LLM prose + provenance UI (not yet live-tested) |
| Personal-experience note | lived-experience/clinician message on disorder surfaces |

## Also completed (2026-08-11)

- **#5 Disorder comparison** — /compare page (shared/specific regions,
  modality overlap, direction differences, embedding cosine) + brain
  Compare overlay + `disorder2` deep link; unit + e2e tested.
- **#6 /evidence browser** — filterable corpus + /evidence/[id] study detail
  with assertions, brain deep links, curation-status badge; search study
  results now land here.
- **#9 tooling** — `pipeline/curation/mark_verified.py` +
  `verified_by_human.json` registry (rebuild-safe); the review itself
  remains with Stefania.
- **e2e + CI** — `npm run e2e` (self-contained runner + 16-check smoke
  suite, all passing); GitHub Actions gates (validate:data, tsc, lint,
  vitest, build).

## Broken

- None known. All gates green (tsc, lint, 26 tests, build, validate:data,
  16-check e2e).

## Missing / not started (priority order)

**P0 — verify the AI layer**
1. #8 Live end-to-end AI verification (assistant + question generation) —
   **blocked on ANTHROPIC_API_KEY in `.env.local`** (owner: Stefania).
2. #9 Human spot-check of the corpus using `mark_verified.py`
   (owner: Stefania).

**P1 — done 2026-08-11**
3. ~~#15 roster curation~~ — **19/19 disorders curated: 89 studies / 355
   assertions, all verified.** First genuine directional conflict (ASD
   amygdala volume) now in the corpus; honest negatives indexed (rTMS in
   panic: Cochrane-insufficient; rTMS in ASD: no significant effect).
4. ~~E2e job in CI~~ — done 2026-08-31: `e2e` job in ci.yml (Playwright
   Chromium with `--use-gl=angle --use-angle=swiftshader` for GPU-less
   runners; pick-retry hardening in smoke.py). NOTE: the repo has no git
   remote yet, so CI has never executed anywhere — the workflow activates
   on first push to GitHub (owner: Stefania).

**Note:** GAP-ATTENTION now fires 168× on the larger corpus — threshold
tuning (P2 item 10) has become more pressing.

**P2 — depth features**
7. #7 Research notebook (localStorage first; human-in-the-loop save/approve).
8. #10 Network memberships ingestion with provenance (unlocks network panels,
   network embeddings, graph edges).
9. #11 Polish pass (a11y, responsive, loading/empty states, perf) + tag v0.1.
10. Gap-rule tuning: GAP-ATTENTION currently fires 75× (low signal); consider
    stricter relatedness or magnitude thresholds — documented change to
    METRICS.md required.

**P3 — the ML frontier (ARCHITECTURE.md §9 v2–v3)**
11. #12 first increment DONE (2026-08-11): NeuroQuery meta-analytic maps —
    `pipeline/metamaps/build_metamaps.py` (BSD-3-Clause verified), 19
    RegionScalarMap artifacts, Meta-map viz mode with a labeled
    model-generated stratum (never merged with corpus metrics).
12. #12 second increment DONE (2026-08-11): `pipeline/mlruns/` ModelRun
    pipelines — CCA alignment (permutation-validated; honest negative at
    n=19) and relational-GCN link prediction (grouped pair-level split,
    study-leakage-free graph, CF baseline); FastAPI compute service
    (`pipeline/service/app.py`, never a runtime dependency); `/ml/lab` UI
    rendering only schema-valid runs. Third increment (2026-08-14):
    region-level CCA alignment; /ml/lab covered by the committed e2e suite.
    CORRECTED 2026-08-31 after science review (decision #28):
    alignment_cca_regions_v1's "all p=0.001 significant" was an artifact of
    naive row shuffling over L/R homolog pairs — retracted, replaced by v2
    with a homolog-block permutation null (cc1 p=0.13; both alignment runs
    are now honest negatives). Link-pred manifests gained bootstrap CIs +
    full leakage disclosures (GNN vs CF baseline within noise).
13. Real-modality encoder v1 DONE (2026-09-01): OpenNeuro ds004504 resting
    EEG (AD/FTD/CN, n=88, CC0 + ethics verified; ds002778 rejected on its
    README's stewardship request, decision #29). `pipeline/encoders/` —
    subject-level zone band-power features, LOSO + full-loop permutation
    test, ModelRun `eeg_spectral_dementia_v1` (AD-vs-CN AUC 0.843, canonical
    EEG-slowing pattern), framed as representation sanity check, never
    diagnosis; disorder-level only (decision #8).
    Remaining future scope: MRI encoder, contrastive alignment once >2
    real views exist, richer graph (edge types/directions), run
    comparison UI.

## Technical debt register

- Corpus-wide `verifiedByHuman: false` (by design until #9).
- AI paths (assistant, questions) never exercised against the live API.
- Playwright coverage lives outside the repo; no CI.
- Evidence JSON bundles into client chunks (fine at this scale; repo seam
  exists for growth).
- `/api/questions` per-process cache has no invalidation besides restart.
- Embedding artifacts duplicated (data/ canonical + public/ served copy) —
  intentional but must stay in sync via the pipeline only.
- Sparse-evidence disorders (DID/GAD/HD) cluster in embedding space by
  evidence structure — labeled, but worth a visible per-point evidence-count
  cue in /ml.
- Scene center/camera constants hardcoded in BrainViewer.
- Intent-parser catalog includes all 83 regions per call (token cost grows
  with atlas upgrades; fine today).
