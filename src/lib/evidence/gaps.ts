import type { ConvergenceProfile } from "./convergence";

/**
 * Evidence-gap detection (Research Intelligence Layer, task A).
 *
 * Four named, deterministic rules with published thresholds (docs/METRICS.md).
 * Every gap carries the study ids behind it — the provenance chain the UI and
 * the research-question generator must render. Gaps describe the INDEXED
 * CORPUS, which is curated and small: a gap here may be a curation gap, and
 * every consumer must say so.
 */

export const GAP_RULES = {
  "GAP-IMG-EP": {
    name: "Imaging-strong, electrophysiology-absent",
    definition:
      "≥3 distinct imaging studies link the region to the disorder, but no electrophysiology study does. Magnitude = imaging study count.",
  },
  "GAP-OBS-INT": {
    name: "Observational-strong, intervention-absent",
    definition:
      "≥3 distinct correlational studies link the region to the disorder, but no interventional study does. Magnitude = correlational study count.",
  },
  "GAP-CONFLICT": {
    name: "Unresolved directional conflict",
    definition:
      "Studies of the same finding type report opposite directions with ≥2 distinct studies on each side. Magnitude = size of the smaller side.",
  },
  "GAP-ATTENTION": {
    name: "Cross-disorder attention asymmetry",
    definition:
      "A region has ≥3 studies for one disorder but none for a related disorder (related = the two disorders share ≥2 implicated regions in the corpus). Magnitude = study count in the reference disorder.",
  },
} as const;

export type GapRuleId = keyof typeof GAP_RULES;

export interface EvidenceGap {
  ruleId: GapRuleId;
  disorder: string;
  region: string;
  magnitude: number;
  /** deterministic, template-generated description using canonical ids */
  description: string;
  supportingStudyIds: string[];
  conflictingStudyIds?: string[];
  missingModalityCategory?: string;
  /** GAP-ATTENTION: the disorder where the region IS studied */
  referenceDisorder?: string;
}

const MIN_STRONG = 3;
const MIN_CONFLICT_SIDE = 2;
const MIN_SHARED_REGIONS = 2;

/**
 * Detect gaps over per-disorder profiles. `profilesByDisorder` must cover
 * every disorder to consider (GAP-ATTENTION is cross-disorder).
 */
export function detectGaps(
  profilesByDisorder: Map<string, ConvergenceProfile[]>,
): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];

  for (const profiles of profilesByDisorder.values()) {
    for (const p of profiles) {
      const imaging = p.categoryStudies["imaging"] ?? [];
      const ep = p.categoryStudies["electrophysiology"] ?? [];
      if (imaging.length >= MIN_STRONG && ep.length === 0) {
        gaps.push({
          ruleId: "GAP-IMG-EP",
          disorder: p.disorder,
          region: p.region,
          magnitude: imaging.length,
          description: `${imaging.length} imaging studies link ${p.region} to ${p.disorder}, but the indexed corpus contains no electrophysiology study for this pair.`,
          supportingStudyIds: imaging,
          missingModalityCategory: "electrophysiology",
        });
      }
      if (
        p.correlationalStudyIds.length >= MIN_STRONG &&
        p.interventionalStudyIds.length === 0
      ) {
        gaps.push({
          ruleId: "GAP-OBS-INT",
          disorder: p.disorder,
          region: p.region,
          magnitude: p.correlationalStudyIds.length,
          description: `${p.correlationalStudyIds.length} correlational studies link ${p.region} to ${p.disorder}, but the indexed corpus contains no interventional evidence for this pair.`,
          supportingStudyIds: p.correlationalStudyIds,
          missingModalityCategory: "stimulation",
        });
      }
      for (const c of p.conflicts) {
        if (
          c.increased.length >= MIN_CONFLICT_SIDE &&
          c.decreased.length >= MIN_CONFLICT_SIDE
        ) {
          gaps.push({
            ruleId: "GAP-CONFLICT",
            disorder: p.disorder,
            region: p.region,
            magnitude: Math.min(c.increased.length, c.decreased.length),
            description: `Studies of ${c.findingType} for ${p.region} in ${p.disorder} report opposite directions (${c.increased.length} increased vs ${c.decreased.length} decreased).`,
            supportingStudyIds: c.increased,
            conflictingStudyIds: c.decreased,
          });
        }
      }
    }
  }

  // GAP-ATTENTION: cross-disorder
  const regionsOf = new Map<string, Set<string>>();
  for (const [disorder, profiles] of profilesByDisorder) {
    regionsOf.set(disorder, new Set(profiles.map((p) => p.region)));
  }
  for (const [disorderA, profiles] of profilesByDisorder) {
    for (const p of profiles) {
      if (p.studyIds.length < MIN_STRONG) continue;
      for (const [disorderB, regionsB] of regionsOf) {
        if (disorderB === disorderA || regionsB.has(p.region)) continue;
        const shared = [...regionsOf.get(disorderA)!].filter((r) =>
          regionsB.has(r),
        ).length;
        if (shared < MIN_SHARED_REGIONS) continue;
        gaps.push({
          ruleId: "GAP-ATTENTION",
          disorder: disorderB,
          region: p.region,
          magnitude: p.studyIds.length,
          description: `${p.region} has ${p.studyIds.length} studies for ${disorderA} but none for the related disorder ${disorderB} (the two share ${shared} implicated regions in the corpus).`,
          supportingStudyIds: p.studyIds,
          referenceDisorder: disorderA,
        });
      }
    }
  }

  return gaps.sort((a, b) => b.magnitude - a.magnitude);
}
