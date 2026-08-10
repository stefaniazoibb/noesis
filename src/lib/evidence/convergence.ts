import type { Study } from "@/lib/schemas";
import type {
  EvidenceFilters,
  EvidenceLevel,
  PairEvidence,
  EvidenceIndex,
} from "./metrics";
import { NO_FILTERS } from "./metrics";

/**
 * Convergence profiles (Research Intelligence Layer, task A).
 *
 * Each disorder×region pair gets a profile whose dimensions are computed
 * SEPARATELY and never collapsed into one score (docs/METRICS.md). The
 * dimensions that the current study schema cannot support are listed
 * explicitly in `notAssessed` rather than being approximated.
 */

export const NOT_ASSESSED_DIMENSIONS = [
  "dataset_convergence",
  "methodological_convergence",
  "population_convergence",
  "longitudinal_convergence",
] as const;

export interface DirectionConsistency {
  /** false when fewer than 2 directional (study, findingType) units exist */
  assessed: boolean;
  /** units agreeing with the majority direction of their finding type */
  agreeing: number;
  total: number;
  ratio: number | null;
}

export interface ConflictReport {
  findingType: string;
  /** distinct study ids reporting each direction for this finding type */
  increased: string[];
  decreased: string[];
  /**
   * Structured differences between the conflicting studies — surfaced so a
   * researcher can judge possible reasons; NEVER auto-adjudicated.
   */
  differences: {
    years: [number, number];
    sampleSizes: (number | null)[];
    populations: (string | null)[];
  };
}

export interface ConvergenceProfile {
  disorder: string;
  region: string;
  studyIds: string[];
  modalities: string[];
  /** modality convergence: distinct categories (imaging counts once) */
  modalityCategories: string[];
  /** distinct study ids per modality category */
  categoryStudies: Record<string, string[]>;
  level: EvidenceLevel;
  direction: DirectionConsistency;
  conflicts: ConflictReport[];
  correlationalStudyIds: string[];
  interventionalStudyIds: string[];
  notAssessed: readonly string[];
}

/** unique (studyId, findingType, direction) tuples with a definite direction */
function directionalUnits(
  pair: PairEvidence,
): { studyId: string; findingType: string; direction: "increased" | "decreased" }[] {
  const seen = new Set<string>();
  const units: {
    studyId: string;
    findingType: string;
    direction: "increased" | "decreased";
  }[] = [];
  for (const a of pair.assertions) {
    if (a.direction !== "increased" && a.direction !== "decreased") continue;
    const key = `${a.studyId}|${a.findingType}|${a.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({
      studyId: a.studyId,
      findingType: a.findingType,
      direction: a.direction,
    });
  }
  return units;
}

export function buildProfile(
  pair: PairEvidence,
  studyById: Map<string, Study>,
  modalityCategoryOf: (modalityId: string) => string,
): ConvergenceProfile {
  const units = directionalUnits(pair);

  // direction consistency: per finding type, the majority direction agrees
  const byType = new Map<string, typeof units>();
  for (const u of units) {
    (byType.get(u.findingType) ?? byType.set(u.findingType, []).get(u.findingType)!).push(u);
  }
  let agreeing = 0;
  const conflicts: ConflictReport[] = [];
  for (const [findingType, group] of byType) {
    const inc = [...new Set(group.filter((u) => u.direction === "increased").map((u) => u.studyId))];
    const dec = [...new Set(group.filter((u) => u.direction === "decreased").map((u) => u.studyId))];
    agreeing += Math.max(
      group.filter((u) => u.direction === "increased").length,
      group.filter((u) => u.direction === "decreased").length,
    );
    if (inc.length > 0 && dec.length > 0) {
      const involved = [...inc, ...dec]
        .map((id) => studyById.get(id))
        .filter((s): s is Study => s !== undefined);
      const years = involved.map((s) => s.year);
      conflicts.push({
        findingType,
        increased: inc,
        decreased: dec,
        differences: {
          years: [Math.min(...years), Math.max(...years)],
          sampleSizes: involved.map((s) => s.sampleSize),
          populations: involved.map((s) => s.population),
        },
      });
    }
  }

  const categoryStudies: Record<string, string[]> = {};
  for (const a of pair.assertions) {
    const cat = modalityCategoryOf(a.modality);
    const list = (categoryStudies[cat] ??= []);
    if (!list.includes(a.studyId)) list.push(a.studyId);
  }

  const causal = (kind: "correlational" | "interventional") => [
    ...new Set(
      pair.assertions.filter((a) => a.causalSupport === kind).map((a) => a.studyId),
    ),
  ];

  return {
    disorder: pair.disorder,
    region: pair.region,
    studyIds: pair.studyIds,
    modalities: pair.modalities,
    modalityCategories: pair.modalityCategories,
    categoryStudies,
    level: pair.level,
    direction: {
      assessed: units.length >= 2,
      agreeing,
      total: units.length,
      ratio: units.length >= 2 ? agreeing / units.length : null,
    },
    conflicts,
    correlationalStudyIds: causal("correlational"),
    interventionalStudyIds: causal("interventional"),
    notAssessed: NOT_ASSESSED_DIMENSIONS,
  };
}

/** Profiles for one disorder (or all when null), after filters. */
export function computeProfiles(
  index: EvidenceIndex,
  disorder: string | null,
  filters: EvidenceFilters = NO_FILTERS,
): ConvergenceProfile[] {
  const categoryOf = (id: string) => index.modalityById.get(id)?.category ?? id;
  return index
    .pairsForDisorder(disorder, filters)
    .map((p) => buildProfile(p, index.studyById, categoryOf))
    .sort((a, b) => b.studyIds.length - a.studyIds.length);
}
