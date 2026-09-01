# NOĒSIS — Data Sources

Rule: nothing enters `/data` or `/public` without a record in
`data/provenance/` and a row here. `data/LICENSES.md` is the license
summary; this file adds usage detail and status.

## Ingested (in use)

| Source | Used for | How | License / terms | Provenance |
|---|---|---|---|---|
| FreeSurfer fsaverage (surfaces, aparc.annot, aseg.mgz) via MNE-Python | All 3D geometry; 83-region atlas table | `pipeline/meshes/` one-time build; cached at `~/mne_data` | FreeSurfer license; redistribution precedent via MNE bundle | `provenance/fsaverage.json` |
| PubMed (NCBI E-utilities) | Study discovery + bibliographic metadata + abstracts for curation | `pipeline/curation/fetch_pubmed.py`; verbatim per-PMID cache in `pipeline/curation/cache/` | Metadata freely usable; we store our own faithful finding summaries + links, never verbatim abstracts in `/data` | cache files are the audit trail |
| OpenAlex | DOI cross-check in the verification gate | `verify_studies.py` (accepts legacy DOI aliases when both resolve to the same target) | CC0 | — |
| doi.org resolution | DOI-alias adjudication | `verify_studies.py` HEAD requests | — | — |
| Yeo 2011 7-network parcellation (fsaverage5 annots via CBIG repo) | DK-region network memberships (vertex overlap on fsaverage), canonical network colors | `pipeline/networks/build_networks.py`; cached with SHA-256 | CBIG repository MIT license; cite Yeo et al. 2011 J Neurophysiol | `provenance/yeo2011.json` |
| NeuroQuery meta-analytic model (neuroquery + neuroquery_data) | Per-disorder model-generated brain maps aggregated to atlas regions (Meta-map mode; RegionScalarMap artifacts) — separate labeled stratum, never merged with curated metrics | `pipeline/metamaps/build_metamaps.py` | BSD-3-Clause (code + data), verified 2026-08-11; cite Dockès et al. eLife 2020 | `provenance/neuroquery.json` |
| OpenNeuro ds004504 (AD/FTD/CN resting EEG, Miltiadous et al.) | EEG spectral encoder v1 (`pipeline/encoders/`; ModelRun `eeg_spectral_dementia_v1`) — aggregate artifacts only, raw data gitignored, disorder-level (no region mapping) | curators' preprocessed derivatives via openneuro-py | CC0 verified at ingestion 2026-09-01; ethics AHEPA 142/12-04-2023; cite Data 8(6):95 2023 | `provenance/ds004504.json` |
| OpenNeuro ds000030 (UCLA CNP LA5c; 265 usable subjects: CN/SCZ/BD/ADHD) | MRI morphometry encoder v1 (ModelRun `mri_morphometry_cnp_v1`) — FreeSurfer aparc/aseg stats tables from the published derivatives ONLY (legacy S3 R1.0.5, ~KBs/subject); aggregate effect-size payload keyed to atlas region ids | `pipeline/encoders/build_mri_encoder.py` | CC0 verified at ingestion 2026-09-01; IRB consent documented; cite Poldrack et al. Sci Data 2016 + Gorgolewski et al. F1000Res 2017 | `provenance/ds000030.json` |
| ~~OpenNeuro ds002778 (UCSD PD rest EEG)~~ | REJECTED at ingestion (decision #29): README asks that PD-vs-HC ML not be run on it (n≈15/group); nothing retained | — | CC0, but stewardship request honored | recorded in `provenance/ds004504.json` note |

## Derived artifacts (built, not sourced)

Evidence corpus (`data/studies`, `data/evidence`) — curated from cached
abstracts only; embeddings (`data/embeddings`) — computed from the corpus,
manifests carry corpus-version hash; convergence/gap outputs — computed at
runtime from assertions (never stored as truth).

## Evaluated / planned (terms to verify AT ingestion time)

| Source | Planned use | Status |
|---|---|---|
| Neurosynth | Alternative automated meta-analytic maps (NeuroQuery ingested 2026-08-11, see above) | Not ingested; NeuroQuery covers the use case |
| ENIGMA summary statistics | Per-publication regional effect sizes | Case-by-case with each paper |
| ~~Yeo-style network parcellation~~ | Network memberships with `membershipSource` | Ingested 2026-08-11 (see Yeo 2011 row above) |
| HCP-MMP (Glasser) | Finer atlas upgrade | Deferred — WU-Minn terms must be accepted first |
| Harvard-Oxford (FSL) | Subcortex fallback only | Not needed (aseg path worked); **non-commercial license** — avoid |
| AAL | — | Deferred (registration-gated) |
| OpenNeuro EEG/MRI datasets | Future real-modality encoders (P3) | Per-dataset licenses; subject-level split rules apply |

## Explicitly rejected

- Blind web scraping of any source.
- Storing verbatim abstracts in `/data`.
- Hand-assigned network memberships (schema requires a documented source).
