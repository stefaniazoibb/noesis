# Metric definitions

Every quantity shown on the brain or in a panel is computed from the evidence
assertions in `data/evidence/assertions.json` by the functions in
`src/lib/evidence/metrics.ts`. Nothing here is hand-assigned, and every legend
in the UI states which of these definitions it is showing. If a metric cannot
be computed from indexed evidence, the UI shows "Evidence unavailable".

## Study count (disorder–region)

Number of **distinct studies** with at least one assertion linking the region
to the disorder, after any active modality/year filters. One study contributes
1 regardless of how many assertions it yields.

## Cross-modal convergence (disorder–region)

Number of **distinct modality categories** (imaging, electrophysiology,
stimulation, hemodynamic) with at least one assertion linking the region to
the disorder, after filters. Two imaging modalities (e.g. fMRI + sMRI) count
as ONE category — convergence measures methodological independence, not
modality count. Range for the MVP corpus: 0–3 (imaging, electrophysiology,
stimulation).

## Evidence level (disorder–region)

A transparent, rule-based label — not a learned score:

| Label | Rule (evaluated in this order) |
|---|---|
| Mixed | ≥2 studies report the same finding type with opposite directions |
| Strong | ≥3 distinct studies AND ≥2 modality categories |
| Moderate | ≥2 distinct studies |
| Emerging | exactly 1 study |

Direction comparison treats `increased` vs `decreased` on the same finding
type as opposition; `mixed`/null directions never trigger the Mixed label on
their own. These labels summarize the **indexed corpus only** — the corpus is
curated and small, not a systematic review, and the labels must not be read
as clinical consensus.

## Convergence profile (disorder–region)

Computed by `src/lib/evidence/convergence.ts`. Each dimension is reported
separately and never collapsed into a single score.

| Dimension | Definition |
|---|---|
| Study convergence | Distinct studies with ≥1 assertion for the pair (= study count above). |
| Modality convergence | Distinct modality categories (= cross-modal convergence above); per-category study lists are also reported. |
| Direction consistency | Unit = a distinct (study, finding type, direction) tuple with direction increased/decreased. Consistency = (units agreeing with the majority direction of their finding type) / (all directional units). Reported as **not assessed** with fewer than 2 units. |
| Conflict | Same finding type reported with opposite directions. The report lists the study ids on each side plus their year range, sample sizes, and populations — possible reasons for disagreement are surfaced for the researcher, never adjudicated automatically. |
| Intervention coverage | Distinct studies whose assertions carry `causalSupport: interventional` (vs `correlational`). |

**Not assessed** (the current study schema cannot support them; shown
explicitly instead of being approximated): dataset convergence,
methodological convergence, population convergence, longitudinal convergence.

## Evidence-gap rules

Detected by `src/lib/evidence/gaps.ts`. Gaps describe the **indexed corpus**,
which is curated and small — a detected gap may reflect a curation gap rather
than a gap in the literature, and every consumer must display that caveat.
Each gap carries the study ids behind it (full provenance chain).

| Rule | Fires when | Magnitude |
|---|---|---|
| GAP-IMG-EP | ≥3 distinct imaging studies for the pair, 0 electrophysiology studies | imaging study count |
| GAP-OBS-INT | ≥3 distinct correlational studies for the pair, 0 interventional | correlational study count |
| GAP-CONFLICT | a conflict (above) with ≥2 distinct studies on each side | smaller side |
| GAP-ATTENTION | region has ≥3 studies for disorder A and 0 for disorder B, where A and B are related: they share ≥3 implicated regions AND the overlap covers ≥50% of the smaller disorder's implicated-region set (tightened 2026-08-11 from ≥2 shared regions, which made nearly every disorder pair "related" at 19 disorders; sensitivity: ≥2→168 gaps, 25%→124, 40%→80, 50%→48) | study count in A |

Run `npm run report:gaps` to print the profiles and detected gaps for the
current corpus.

## Gaps visualization mode (3D brain)

Each region with evidence is classified by the structure of its indexed
evidence, first matching category wins (per disorder; across all indexed
disorders the highest-priority category among a region's profiles is shown):

1. **Conflicting** — the profile has ≥1 directional conflict (same finding
   type, opposite directions).
2. **Convergent** — evidence from ≥2 independent modality categories.
3. **Single category** — ≥2 studies, all in one modality category.
4. **Single study** — exactly one indexed study.

Regions with no indexed evidence keep the anatomical base color.

## Network membership (Networks viz mode)

A cortical region's **primary functional network** is the Yeo 2011 7-network
label with the highest vertex overlap among network-labeled vertices of that
region on fsaverage, kept only when that overlap is ≥25%. Computed by
`pipeline/networks/build_networks.py` (full fraction matrix in
`pipeline/networks/report.json`); provenance in
`data/provenance/yeo2011.json`. Cortical only; colors are the canonical Yeo
colors from the annot color table. DK regions are coarse relative to network
boundaries — secondary overlaps are discarded from display but preserved in
the report.

## Meta-analytic association (Meta-map viz mode)

Mean NeuroQuery z-value per region for the disorder-name query, computed by
`pipeline/metamaps/build_metamaps.py` (NeuroQuery model, Dockès et al. eLife
2020, BSD-3-Clause; fsaverage aparc+aseg sampling with the standard
MNI305→MNI152 affine). **A separate, model-generated evidence stratum** —
automated literature text mining, not curated studies, never merged with the
corpus metrics; negative values clip to 0 for display. Provenance:
`data/provenance/neuroquery.json`.

## ML Lab model runs (`/ml/lab`)

Every run is a `ModelRun` artifact (schema in `src/lib/schemas/artifacts.ts`)
built by `pipeline/mlruns/` and served from `public/ml_runs/`. A run without
a valid manifest and declared split strategy / validation protocol is never
rendered. Model outputs are a separate stratum from the curated corpus —
**ML importance ≠ biological causality**, and candidate links are hypotheses
about the corpus, never evidence.

### Representation alignment (`alignment_cca_v1`)

CCA between the 19 disorder evidence-corpus embeddings (PCA-8) and the 19
NeuroQuery meta-map region profiles (83 regions, column-z-scored, PCA-8).
Reported per component: canonical correlation (in-sample) and a permutation
p-value from 1000 refits under row-shuffled Y
(p = (1 + #perm ≥ observed) / (1 + N)). With n=19, in-sample correlations
are near-guaranteed to be high — only permutation-significant components
indicate alignment beyond chance, and the UI applies Bonferroni correction
across the tested components (α = 0.05/k) before calling any component
significant. Current result (v1) is an honest negative: cc1 = 0.98 with
perm p = 0.54, and no component survives correction. Interpretation caveat: both views derive
from the research literature, so even a significant alignment measures
curation/automated-mining **consistency**, not independent validation.

### Graph link prediction (`linkpred_rgcn_v1`)

Heterogeneous graph of disorders, regions, and Yeo networks; positives are
the distinct disorder–region pairs from the curated assertions. **Split:**
grouped at the pair level, 70/15/15 (all assertions of a pair held out
together); message passing sees train pairs only; **study nodes are excluded
from the graph** because a study linking D and R creates a two-hop
D–study–R path that leaks held-out pairs (the graph analog of a
subject-level-split violation). Model: 2-layer relational GCN with learned
node embeddings and a dot-product decoder; model selection on validation
ROC-AUC; seeded evaluation negatives disjoint from all positives (per-epoch
training negatives exclude positives only, so evaluation negatives may also
be sampled as training negatives — standard practice, but it makes reported
AUC mildly optimistic). Reported:
test ROC-AUC, test average precision, and a non-learned
collaborative-filtering baseline (Jaccard-weighted disorder-disorder voting
over train pairs) for context. Candidate links = highest-scored pairs absent
from the corpus, always labeled "model-suggested — not evidence".

## Research-question ranking

Generated research questions are ranked by a transparent rule — never by a
model score: `score = gap magnitude × rule weight`, with weights
GAP-CONFLICT 3 (resolving contradictions), GAP-IMG-EP 2 and GAP-OBS-INT 2
(missing-modality/intervention gaps), GAP-ATTENTION 1. The question *type*
is likewise fixed per rule (conflict → methodological, imaging/EP →
cross-modal, observational/intervention → interventional, attention →
comparative). The LLM writes only the prose; candidate regions, modalities,
provenance, and ranking are deterministic, and inline citations are
validated against the gap's own studies.

## Not yet implemented

Disorder specificity, network centrality, and representation similarity are
defined in `docs/ARCHITECTURE.md` §8/§17 and will get entries here when their
implementations land.
