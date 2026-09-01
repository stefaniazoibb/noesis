# Data licenses and provenance

Every dataset that enters `/data` or `/public/meshes` must have a provenance
record in `data/provenance/` **before** ingestion. No blind scraping.

| Dataset | Used for | License / terms | Provenance record |
|---|---|---|---|
| FreeSurfer fsaverage (surfaces, aparc.annot, aseg.mgz) via MNE-Python | all 3D geometry, atlas region table | FreeSurfer license; redistributed in the MNE fsaverage bundle | `provenance/fsaverage.json` |
| Yeo 2011 7-network parcellation (CBIG repository) | network memberships + canonical colors | CBIG repo MIT license; parcellation freely available with citation (Yeo et al. 2011) | `provenance/yeo2011.json` |
| NeuroQuery model + neuroquery_data | Meta-map mode RegionScalarMap artifacts (model-generated stratum) | BSD-3-Clause, verified 2026-08-11; cite Dockès et al. eLife 2020 | `provenance/neuroquery.json` |
| OpenNeuro ds004504 (AD/FTD/CN resting EEG) | EEG spectral encoder v1 ModelRun (aggregate stats only; raw data never committed) | CC0, verified at ingestion 2026-09-01; ethics approval in dataset metadata; cite Miltiadous et al. Data 2023 | `provenance/ds004504.json` |

Rejected at ingestion: OpenNeuro ds002778 — CC0, but its README asks that
PD-vs-HC ML classification not be run on it (decision #29); nothing retained.

Planned sources (not yet ingested — terms to be verified at ingestion time):
ENIGMA summary statistics (per-publication). Harvard-Oxford (FSL) is a
documented fallback only — its license is non-commercial.
