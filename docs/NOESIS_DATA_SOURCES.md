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
| Yeo-style network parcellation | Network memberships with `membershipSource` | Needed for roadmap #10 |
| HCP-MMP (Glasser) | Finer atlas upgrade | Deferred — WU-Minn terms must be accepted first |
| Harvard-Oxford (FSL) | Subcortex fallback only | Not needed (aseg path worked); **non-commercial license** — avoid |
| AAL | — | Deferred (registration-gated) |
| OpenNeuro EEG/MRI datasets | Future real-modality encoders (P3) | Per-dataset licenses; subject-level split rules apply |

## Explicitly rejected

- Blind web scraping of any source.
- Storing verbatim abstracts in `/data`.
- Hand-assigned network memberships (schema requires a documented source).
