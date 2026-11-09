# NOĒSIS — Roadmap & Feature Status

Status date: 2026-11-09. Mirrors the session task list; update both together.
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

## 2026-11 product evolution & redesign (branch `redesign-2026-11`, uncommitted)

- Design system: dark editorial palette, serif display type, remapped
  Tailwind scales (decision #33), sticky navigation with the seven primary
  sections + "More", mobile menu, `/` search shortcut, route fade.
- Landing page: scroll-driven, data-driven story over the real fsaverage
  brain (decisions #34–35) — nine sections, statically prerendered.
- Explore: anatomical region search, eased camera presets, fly-to-region,
  reset view, responsive overlay layout, crisp region boundaries (#36).
- New `/convergence` (profiles by disorder or region across disorders,
  pin-and-compare up to three, expandable study lists) and `/gaps`
  (ranked gap cards with provenance, sparse coverage, missing modality
  matrix, conflicts, regions without evidence, AI questions per disorder).
- Evidence browser: region / direction / year filters, sort, URL filters,
  traceability panel (assertions → atlas, DOI/PMID).
- Representations: point search + highlight, placed tooltips, "reading
  this plot" panel, loadings open by default.
- Ask: example questions, labelled synthesis vs sources, source cards,
  region chips that drive the atlas, `?q=` hand-off, keyless retrieval-only
  mode (#37), corpus-coverage citations (#38), direction info in context.
- `/about`: methodology, metric definitions, integrity rules, data
  sources, data-driven limitations.
- Tests: +15 unit tests (summary, entity linker, corpus marker, surnames);
  e2e suite extended from 20 to 49 checks (landing data, new pages,
  traceability, region search, eight pages at phone width, mobile menu).
- ESLint now ignores `.vercel/**` (the CLI build output produced 71
  spurious lint errors).

Limitations pass (2026-11-09, same branch):
- **#8 live AI verification DONE** with a real key (`npm run check:ai`):
  intent, retrieval, synthesis and validation pass; the run exposed and
  fixed grouped `[a, b]` citations bypassing the validator and an
  implausible EEG methodology in a generated question (decision #42).
  Pipeline also covered by a stubbed-model route test (4 cases).
- **Science review DONE** (independent pass against the integrity rules):
  11 findings, all applied — `[corpus]` laundering guard (#40), ADHD/AD
  and "brains"/brainstem entity-linking bugs, eight copy corrections
  (density-as-quality, unsupported causal phrasing, validator over-claims).
- **Performance measured** on the production build: 60 fps on desktop and
  on a 390 px / DPR 3 viewport with 4x CPU throttling (Apple M4 GPU via
  Metal); 26–27 fps on software rendering, the worst case without a GPU.
  Both 3D views now drop to 1x pixels when frame rate declines; low-core
  devices start at 1x without antialiasing or particles. Transfer ≈1.4 MB
  per 3D page, dominated by the two cortex meshes.
- Landing HTML 202 → 183 KB raw (≈30 KB gzipped): atlas palettes now derived
  client-side. GitHub link hidden until `NEXT_PUBLIC_GITHUB_URL` is set (#41).
Still open: a test on a physical phone; Draco-compressing the cortex GLBs
(the largest remaining transfer); making the repository public and
deploying (owner decisions).

## Broken

- None known. All gates green on 2026-11-09 (tsc, lint, 49 unit tests,
  build, validate:data incl. 8 ML runs, 49-check e2e locally).

## Missing / not started (priority order)

**P0 — verify the AI layer**
1. ~~#8 Live end-to-end AI verification~~ — DONE 2026-11-09
   (`npm run check:ai`, see the limitations pass above).
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

**Note:** GAP-ATTENTION tuning done (#17, 2026-08-11): ≥3 shared regions +
≥50% overlap-of-smaller-set → 85 gaps (was 168 on the full corpus).

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
14. Future-scope sweep DONE (2026-09-01): MRI morphometry encoder v1
    (ds000030 FreeSurfer stats; honest negative for individual prediction,
    canonical ENIGMA group effect sizes — METRICS.md); typed-edge link
    prediction (`--relations modality`, within-noise vs binary); /ml/lab
    runs-overview table. Contrastive alignment was DEFERRED here (views
    shared too few entities) — resolved at subject level in item 15.
15. "Cool three" sweep DONE (2026-09-01, commits d25dc73..6fcb158):
    Morphometry viz mode + strata-agreement cards; Vercel deployability
    verified end-to-end (README documents; permanent deploy needs
    Stefania's `vercel login`); fMRI connectivity encoder
    (conn_fc_cnp_v1 — SCZ AUC 0.68 perm-significant, ADHD honest null)
    + the formerly-deferred multi-view alignment, now at subject level
    with n=250 (alignment_subject_multiview_v1: cc1=0.90, p=0.002,
    survives Bonferroni — first positive alignment finding). 8 ML runs.

## Technical debt register

(refreshed 2026-09-01)

- Corpus-wide `verifiedByHuman: false` (by design until #9).
- AI paths (assistant, questions) never exercised against the live API
  (#8 — needs ANTHROPIC_API_KEY).
- ~~Playwright coverage outside the repo; no CI~~ — committed e2e suite +
  CI e2e job, green on GitHub runners since 2026-09-01.
- Evidence JSON bundles into client chunks (fine at this scale; repo seam
  exists for growth).
- `/api/questions` per-process cache has no invalidation — ACCEPTED, not a
  bug: the corpus is statically imported, so a changed corpus always means
  a new build/process; within one process the cache can never go stale.
- Artifact duplication (data/ canonical + public/ served copy: embeddings,
  metamaps, ml_runs) — intentional; sync only via pipelines; validate-data
  does not check data↔public sync (verified manually per commit).
- ~~Per-point evidence-count cue in /ml~~ — point radius ∝ √(distinct
  studies) with legend note, 2026-09-01.
- Scene center/camera constants hardcoded in BrainViewer.
- Intent-parser catalog includes all 83 regions per call (token cost grows
  with atlas upgrades; fine today).
- Raw encoder downloads (~2.4 GB EEG + 8 MB MRI stats) live in gitignored
  `pipeline/encoders/raw/` — deletable; artifacts + provenance are the
  durable record.
