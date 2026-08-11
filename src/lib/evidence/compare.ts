import type {
  EvidenceFilters,
  EvidenceIndex,
  EvidenceLevel,
  PairEvidence,
} from "./metrics";
import { NO_FILTERS } from "./metrics";

/**
 * Disorder comparison (roadmap #5). Pure functions over the EvidenceIndex —
 * shared/specific regions, modality overlap, and cross-disorder direction
 * differences (same finding type, different majority direction). Directions
 * are compared, never adjudicated.
 */

export interface ComparisonCell {
  studyCount: number;
  level: EvidenceLevel;
  studyIds: string[];
}

export interface DisorderComparison {
  shared: { region: string; a: ComparisonCell; b: ComparisonCell }[];
  aOnly: { region: string; cell: ComparisonCell }[];
  bOnly: { region: string; cell: ComparisonCell }[];
  /** distinct study counts per modality id for each disorder */
  modalityOverlap: { modality: string; aCount: number; bCount: number }[];
  directionDifferences: {
    region: string;
    findingType: string;
    aDirection: "increased" | "decreased";
    bDirection: "increased" | "decreased";
  }[];
}

function cell(p: PairEvidence): ComparisonCell {
  return { studyCount: p.studyIds.length, level: p.level, studyIds: p.studyIds };
}

/** Majority direction per finding type from unique (study, type, direction) units. */
function majorityDirections(
  p: PairEvidence,
): Map<string, "increased" | "decreased"> {
  const units = new Map<string, Set<string>>();
  for (const a of p.assertions) {
    if (a.direction !== "increased" && a.direction !== "decreased") continue;
    const key = `${a.findingType}|${a.direction}`;
    (units.get(key) ?? units.set(key, new Set()).get(key)!).add(a.studyId);
  }
  const out = new Map<string, "increased" | "decreased">();
  const types = new Set([...units.keys()].map((k) => k.split("|")[0]));
  for (const t of types) {
    const inc = units.get(`${t}|increased`)?.size ?? 0;
    const dec = units.get(`${t}|decreased`)?.size ?? 0;
    if (inc > dec) out.set(t, "increased");
    else if (dec > inc) out.set(t, "decreased");
    // ties: no majority — omitted rather than guessed
  }
  return out;
}

export function compareDisorders(
  index: EvidenceIndex,
  a: string,
  b: string,
  filters: EvidenceFilters = NO_FILTERS,
): DisorderComparison {
  const pairsA = new Map(
    index.pairsForDisorder(a, filters).map((p) => [p.region, p]),
  );
  const pairsB = new Map(
    index.pairsForDisorder(b, filters).map((p) => [p.region, p]),
  );

  const shared: DisorderComparison["shared"] = [];
  const aOnly: DisorderComparison["aOnly"] = [];
  const bOnly: DisorderComparison["bOnly"] = [];
  const directionDifferences: DisorderComparison["directionDifferences"] = [];

  for (const [region, pa] of pairsA) {
    const pb = pairsB.get(region);
    if (!pb) {
      aOnly.push({ region, cell: cell(pa) });
      continue;
    }
    shared.push({ region, a: cell(pa), b: cell(pb) });
    const da = majorityDirections(pa);
    const db = majorityDirections(pb);
    for (const [findingType, aDirection] of da) {
      const bDirection = db.get(findingType);
      if (bDirection && bDirection !== aDirection) {
        directionDifferences.push({ region, findingType, aDirection, bDirection });
      }
    }
  }
  for (const [region, pb] of pairsB) {
    if (!pairsA.has(region)) bOnly.push({ region, cell: cell(pb) });
  }

  const byCount = <T extends { cell?: ComparisonCell; a?: ComparisonCell }>(
    x: T,
  ) => (x.cell ?? x.a)!.studyCount;
  shared.sort((x, y) => byCount(y) - byCount(x));
  aOnly.sort((x, y) => byCount(y) - byCount(x));
  bOnly.sort((x, y) => byCount(y) - byCount(x));

  const modalityStudies = (disorder: string) => {
    const m = new Map<string, Set<string>>();
    for (const asrt of index.filtered(filters)) {
      if (asrt.disorder !== disorder) continue;
      (m.get(asrt.modality) ?? m.set(asrt.modality, new Set()).get(asrt.modality)!).add(
        asrt.studyId,
      );
    }
    return m;
  };
  const ma = modalityStudies(a);
  const mb = modalityStudies(b);
  const modalityOverlap = [...new Set([...ma.keys(), ...mb.keys()])]
    .sort()
    .map((modality) => ({
      modality,
      aCount: ma.get(modality)?.size ?? 0,
      bCount: mb.get(modality)?.size ?? 0,
    }));

  return { shared, aOnly, bOnly, modalityOverlap, directionDifferences };
}
