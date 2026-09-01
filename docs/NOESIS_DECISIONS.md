# NOĒSIS — Decision Log

Why things are the way they are. Newest last. Don't relitigate without new
information; record reversals here.

| # | Decision | Rationale |
|---|---|---|
| 1 | fsaverage + Desikan-Killiany, subcortex from fsaverage's own aseg | Real anatomy, single license family, exact surface-RAS alignment with no cross-template registration; Harvard-Oxford rejected as fallback (FSL non-commercial) |
| 2 | One mesh per hemisphere + per-vertex region attribute + shader uniforms/DataTexture | No seams, minimal draw calls, highlight/overlay without React re-render or recompilation |
| 3 | Static Zod-validated JSON, no DB, no Python server (MVP) | Corpus is small; `src/lib/repo/` is the seam for Postgres/Neo4j/pgvector later |
| 4 | Assertions are the atomic evidence unit (never bare disorder→region) | Preserves provenance chain region→assertion→study→DOI/PMID by construction |
| 5 | Curation only from cached PubMed abstracts; metadata merged programmatically | The no-fabrication rule enforced structurally, not by discipline |
| 6 | DOI parser reads only the article's own id list; verifier cross-checks OpenAlex | Caught real bugs: reference-list DOIs (2026-08-10) and legacy DOI aliases (Vermetten) — alias accepted only when both DOIs resolve to the same target |
| 7 | Evidence levels & convergence are rule-based labels, formulas in METRICS.md | "No unexplained brain scores" — transparency over sophistication |
| 8 | Region assertions require the abstract to name the region/target; scalp EEG stays disorder-level | Honest atlas mapping; convergence can't be inflated by forced mappings |
| 9 | Reviews/meta-analyses are indexable; ambiguous records (EEG-vs-MEG) are dropped | Groundedness beats coverage |
| 10 | RAG: deterministic retrieval + citation validator; empty retrieval answers without LLM | The corpus is the source of truth; the model is presentation |
| 11 | claude-opus-5 synthesis + claude-haiku-4-5 intent (env-overridable) | Current API guidance (claude-api skill); blueprint's Sonnet remains a env-var switch |
| 12 | Non-streaming assistant responses | Citation validation needs the full text before display |
| 13 | Baseline representations: modality-partitioned evidence features → PCA with saved loadings (+UMAP) | Interpretable, honest about being literature-derived; kept as permanent reference vs future encoders; artifact contracts (RegionScalarMap/EmbeddingSet/ModelRun) isolate the frontend from ML changes |
| 14 | Convergence dimensions never collapsed; non-computable dimensions shown "not assessed" | Distinct convergence types are the scientific point (spec §10) |
| 15 | Gap detection = 4 named threshold rules; gaps labeled as corpus-relative | Deterministic, auditable, provenance-carrying; avoids "AI found a gap" hand-waving |
| 16 | Question generation: LLM writes prose only; ranking/type/candidates deterministic | Keeps the discovery loop auditable end-to-end |
| 17 | Networks ship with empty memberships | Schema demands `membershipSource`; no provenanced parcellation ingested yet |
| 18 | 19 disorder entities, 11 with curated evidence | Entities are cheap and honest with empty states; evidence is the expensive part (roadmap #15) |
| 19 | DID indexed under its current clinical name; "multiple personality disorder" as synonym; overview flags small contested literature | Scientific accuracy + user findability |
| 20 | PersonalExperienceNote alongside the technical disclaimer | Group statistics ≠ individual experience; direct users to licensed clinicians (user request, 2026-08-10) |
| 21 | Dark-only scientific UI; palette from the validated dataviz reference (sequential blue, ordinal steps, ≤3 categorical slots + status red for conflict) | Design spec §38 + colorblind-safe validated ramps |
| 22 | Playwright verification via ad-hoc scripts during build-out | Speed during MVP; promotion to committed e2e suite + CI is roadmap P1.6 |
| 23 | Compare mode paused mid-implementation (overlay done, page missing), committed as WIP | Development-system setup (2026-08-11) took precedence; repo stays green |
| 24 | ML runs: study nodes excluded from the link-prediction graph | A study linking D and R creates a two-hop D–study–R path that trivially leaks held-out pairs — the graph analog of a subject-level-split violation; the split is grouped at the disorder-region pair level instead |
| 25 | Alignment run validated by permutation test, not a train/test split | n=19 disorders makes held-out splits meaningless and in-sample CCA correlations near-guaranteed (observed: cc1=0.98 with perm p=0.54 — reported as an honest negative); both views derive from the literature, so alignment = curation/mining consistency, never independent validation |
| 26 | Link-prediction GNN in plain PyTorch (CPU, seeded), no torch-geometric; non-learned CF baseline reported alongside | ~109 nodes need no graph framework; dense per-relation aggregation is fully deterministic and auditable; the baseline keeps the comparison honest — GNN 0.77 vs CF 0.73 test AUC is within noise at 40 test pairs (bootstrap CI [0.66, 0.86]), so the run demonstrates the protocol, not GNN superiority |
| 27 | FastAPI service is compute-only; the web app never calls it at runtime | All model results reach the frontend as static schema-validated artifacts; a service-triggered run is byte-identical to a CLI run, and the app deploys with zero Python dependency |
| 28 | Region-level alignment nulls must preserve hemispheric-homolog structure (`alignment_cca_regions_v1` retracted, replaced by v2) | Science review 2026-08-31, empirically confirmed: 29 L/R homolog pairs are near-duplicates in both views (CV1 homolog correlations 0.96–0.98), so naive row shuffles violate exchangeability — all-components p=0.001 became p=0.128/0.045/0.081 under a homolog-block permutation and the "significant region alignment" claim was withdrawn; per-component p-values carry a no-deflation caveat (components ≥2 approximate) |
| 29 | ds002778 (UCSD PD rest EEG) rejected for encoder v1 despite CC0 license | Its README explicitly asks that PD-vs-HC ML classification not be performed (n≈15/group would mislead patients); NOĒSIS checks stewardship requests at ingestion, not just licenses — nothing from the dataset was retained |
| 30 | Encoder v1 uses ds004504 (AD/FTD/CN rest EEG, n=88, CC0) via the curators' preprocessed derivatives | Curators support ML use (own DICE-net paper + benchmark checklist); documented ethics approval; using their ASR/ICA pipeline avoids ad-hoc artifact-handling choices; one feature vector per subject makes the subject-level split structural; classification framed as a representation sanity check, never diagnosis |
