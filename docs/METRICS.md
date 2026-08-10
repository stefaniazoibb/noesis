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

## Not yet implemented

Disorder specificity, network centrality, and representation similarity are
defined in `docs/ARCHITECTURE.md` §8/§17 and will get entries here when their
implementations land.
