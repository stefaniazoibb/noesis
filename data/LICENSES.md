# Data licenses and provenance

Every dataset that enters `/data` or `/public/meshes` must have a provenance
record in `data/provenance/` **before** ingestion. No blind scraping.

| Dataset | Used for | License / terms | Provenance record |
|---|---|---|---|
| FreeSurfer fsaverage (surfaces, aparc.annot, aseg.mgz) via MNE-Python | all 3D geometry, atlas region table | FreeSurfer license; redistributed in the MNE fsaverage bundle | `provenance/fsaverage.json` |
| Yeo 2011 7-network parcellation (CBIG repository) | network memberships + canonical colors | CBIG repo MIT license; parcellation freely available with citation (Yeo et al. 2011) | `provenance/yeo2011.json` |

Planned sources (not yet ingested — terms to be verified at ingestion time):
PubMed/OpenAlex/Crossref (study metadata verification), Neurosynth/NeuroQuery
(automated meta-analytic maps, labeled as such), ENIGMA summary statistics
(per-publication). Harvard-Oxford (FSL) is a documented fallback only — its
license is non-commercial.
