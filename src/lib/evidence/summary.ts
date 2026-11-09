import { getAtlas, getRegion } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import {
  getAssertions,
  getEvidenceIndex,
  getGaps,
  getProfilesByDisorder,
  getStudies,
  getStudy,
} from "@/lib/repo/evidence";
import { NO_FILTERS } from "./metrics";
import { GAP_RULES, type GapRuleId } from "./gaps";

/**
 * Corpus-level summaries for the landing page, the About page and the
 * Research Gaps page. Everything here is COMPUTED from the validated
 * artifacts in /data at build time — no number on the landing page is typed
 * by hand. Pure functions over the repo layer, unit-tested in __tests__.
 */

const HEMI = { left: "L", right: "R", midline: "" } as const;

export function regionLabel(id: string): string {
  const r = getRegion(id);
  return r
    ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}`
    : id;
}

export function disorderName(id: string): string {
  return getDisorders().find((d) => d.id === id)?.name ?? id;
}

export interface CorpusCounts {
  studies: number;
  assertions: number;
  disorders: number;
  disordersWithEvidence: number;
  corticalRegions: number;
  subcorticalRegions: number;
  regionsWithEvidence: number;
  modalities: number;
  disorderRegionPairs: number;
  humanVerified: number;
  yearMin: number;
  yearMax: number;
}

export function corpusCounts(): CorpusCounts {
  const studies = getStudies();
  const assertions = getAssertions();
  const regions = getAtlas().regions;
  const years = studies.map((s) => s.year);
  return {
    studies: studies.length,
    assertions: assertions.length,
    disorders: getDisorders().length,
    disordersWithEvidence: new Set(studies.flatMap((s) => s.disorders)).size,
    corticalRegions: regions.filter((r) => r.kind === "cortical").length,
    subcorticalRegions: regions.filter((r) => r.kind === "subcortical").length,
    regionsWithEvidence: new Set(assertions.map((a) => a.region)).size,
    modalities: getModalities().length,
    disorderRegionPairs: new Set(
      assertions.map((a) => `${a.disorder}|${a.region}`),
    ).size,
    humanVerified: studies.filter((s) => s.curation.verifiedByHuman).length,
    yearMin: Math.min(...years),
    yearMax: Math.max(...years),
  };
}

export interface DisorderCoverage {
  id: string;
  name: string;
  category: string;
  studies: number;
  regions: number;
  /** distinct studies per modality id */
  byModality: Record<string, number>;
}

/** Studies, implicated regions and per-modality study counts per disorder. */
export function disorderCoverage(): DisorderCoverage[] {
  const studies = getStudies();
  const assertions = getAssertions();
  const modalities = getModalities();
  return getDisorders()
    .map((d) => {
      const ds = studies.filter((s) => s.disorders.includes(d.id));
      const byModality: Record<string, number> = {};
      for (const m of modalities)
        byModality[m.id] = ds.filter((s) => s.modalities.includes(m.id)).length;
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        studies: ds.length,
        regions: new Set(
          assertions.filter((a) => a.disorder === d.id).map((a) => a.region),
        ).size,
        byModality,
      };
    })
    .sort((a, b) => b.studies - a.studies || a.name.localeCompare(b.name));
}

/** Distinct studies per modality (a study can use several). */
export function modalityCoverage(): {
  id: string;
  abbreviation: string;
  category: string;
  studies: number;
}[] {
  const studies = getStudies();
  return getModalities().map((m) => ({
    id: m.id,
    abbreviation: m.abbreviation,
    category: m.category,
    studies: studies.filter((s) => s.modalities.includes(m.id)).length,
  }));
}

/** Study counts per publication year, contiguous from first to last year. */
export function studiesByYear(): { year: number; studies: number }[] {
  const studies = getStudies();
  const { yearMin, yearMax } = corpusCounts();
  const out: { year: number; studies: number }[] = [];
  for (let y = yearMin; y <= yearMax; y++)
    out.push({ year: y, studies: studies.filter((s) => s.year === y).length });
  return out;
}

export interface ProvenanceExample {
  region: { id: string; name: string };
  assertion: {
    id: string;
    statement: string;
    findingType: string;
    direction: string | null;
    modality: string;
  };
  disorder: { id: string; name: string };
  study: {
    id: string;
    title: string;
    firstAuthor: string;
    journal: string | null;
    year: number;
    doi: string | null;
    pmid: string | null;
  };
}

/**
 * One real provenance chain: the best-supported disorder-region pair
 * (most distinct studies; ties broken by id for determinism) and its first
 * assertion.
 */
export function provenanceExample(): ProvenanceExample {
  const pairs = getEvidenceIndex()
    .pairsForDisorder(null, NO_FILTERS)
    .sort(
      (a, b) =>
        b.studyIds.length - a.studyIds.length ||
        `${a.disorder}${a.region}`.localeCompare(`${b.disorder}${b.region}`),
    );
  const pair = pairs[0];
  const a = [...pair.assertions].sort((x, y) => x.id.localeCompare(y.id))[0];
  const s = getStudy(a.studyId)!;
  return {
    region: { id: pair.region, name: regionLabel(pair.region) },
    assertion: {
      id: a.id,
      statement: a.statement,
      findingType: a.findingType,
      direction: a.direction,
      modality:
        getModalities().find((m) => m.id === a.modality)?.abbreviation ??
        a.modality,
    },
    disorder: { id: pair.disorder, name: disorderName(pair.disorder) },
    study: {
      id: s.id,
      title: s.title,
      firstAuthor: s.authors[0] ?? "",
      journal: s.journal,
      year: s.year,
      doi: s.doi,
      pmid: s.pmid,
    },
  };
}

export interface ConvergentPair {
  disorder: string;
  disorderName: string;
  region: string;
  regionName: string;
  studies: number;
  level: string;
  /** distinct studies per modality category (imaging / EP / stimulation) */
  categories: Record<string, number>;
}

/** Disorder-region pairs whose evidence spans ≥2 modality categories. */
export function convergentPairs(): ConvergentPair[] {
  const out: ConvergentPair[] = [];
  for (const [d, profiles] of getProfilesByDisorder()) {
    for (const p of profiles) {
      if (p.modalityCategories.length < 2) continue;
      out.push({
        disorder: d,
        disorderName: disorderName(d),
        region: p.region,
        regionName: regionLabel(p.region),
        studies: p.studyIds.length,
        level: p.level,
        categories: Object.fromEntries(
          Object.entries(p.categoryStudies).map(([k, v]) => [k, v.length]),
        ),
      });
    }
  }
  return out.sort(
    (a, b) =>
      Object.keys(b.categories).length - Object.keys(a.categories).length ||
      b.studies - a.studies ||
      a.regionName.localeCompare(b.regionName),
  );
}

/** Distribution of pairs by number of modality categories (1, 2, 3…). */
export function categoryDistribution(): { categories: number; pairs: number }[] {
  const counts = new Map<number, number>();
  for (const profiles of getProfilesByDisorder().values())
    for (const p of profiles)
      counts.set(
        p.modalityCategories.length,
        (counts.get(p.modalityCategories.length) ?? 0) + 1,
      );
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([categories, pairs]) => ({ categories, pairs }));
}

export interface ConflictSummary {
  disorder: string;
  disorderName: string;
  region: string;
  regionName: string;
  findingType: string;
  increased: StudyRef[];
  decreased: StudyRef[];
  years: [number, number];
}

export interface StudyRef {
  id: string;
  label: string;
  title: string;
  journal: string | null;
  year: number;
  population: string | null;
  url: string;
}

/** "van Rooij D" -> "van Rooij"; "Schmaal L" -> "Schmaal" (PubMed "Surname Initials"). */
export function surname(author: string | undefined): string {
  if (!author) return "?";
  const parts = author.trim().split(/\s+/);
  return parts.length > 1 && /^[A-Z]{1,3}$/.test(parts[parts.length - 1])
    ? parts.slice(0, -1).join(" ")
    : author;
}

export function studyRef(id: string): StudyRef {
  const s = getStudy(id)!;
  return {
    id,
    label: `${surname(s.authors[0])} et al. ${s.year}`,
    title: s.title,
    journal: s.journal,
    year: s.year,
    population: s.population,
    url: s.doi
      ? `https://doi.org/${s.doi}`
      : `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`,
  };
}

/** Every directional conflict in the corpus (never adjudicated). */
export function conflicts(): ConflictSummary[] {
  const out: ConflictSummary[] = [];
  for (const [d, profiles] of getProfilesByDisorder()) {
    for (const p of profiles) {
      for (const c of p.conflicts) {
        out.push({
          disorder: d,
          disorderName: disorderName(d),
          region: p.region,
          regionName: regionLabel(p.region),
          findingType: c.findingType,
          increased: c.increased.map(studyRef),
          decreased: c.decreased.map(studyRef),
          years: c.differences.years,
        });
      }
    }
  }
  return out;
}

export function gapCountsByRule(): {
  ruleId: GapRuleId;
  name: string;
  definition: string;
  count: number;
}[] {
  const gaps = getGaps();
  return (Object.keys(GAP_RULES) as GapRuleId[]).map((ruleId) => ({
    ruleId,
    name: GAP_RULES[ruleId].name,
    definition: GAP_RULES[ruleId].definition,
    count: gaps.filter((g) => g.ruleId === ruleId).length,
  }));
}

/** Regions of the atlas with no indexed assertion at all. */
export function regionsWithoutEvidence(): string[] {
  const withEv = new Set(getAssertions().map((a) => a.region));
  return getAtlas()
    .regions.filter((r) => !withEv.has(r.id))
    .map((r) => r.id);
}

/** Region -> distinct study count over the whole corpus. */
export function regionStudyCounts(): Map<string, number> {
  return getEvidenceIndex().studyCounts(null, NO_FILTERS);
}
