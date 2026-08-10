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
| GAP-ATTENTION | region has ≥3 studies for disorder A and 0 for disorder B, where A and B share ≥2 implicated regions in the corpus | study count in A |

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
