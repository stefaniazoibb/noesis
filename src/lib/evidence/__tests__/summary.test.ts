import { describe, expect, it } from "vitest";
import studiesJson from "../../../../data/studies/studies.json";
import assertionsJson from "../../../../data/evidence/assertions.json";
import disordersJson from "../../../../data/disorders/disorders.json";
import {
  categoryDistribution,
  conflicts,
  convergentPairs,
  corpusCounts,
  disorderCoverage,
  gapCountsByRule,
  provenanceExample,
  regionStudyCounts,
  regionsWithoutEvidence,
  studiesByYear,
} from "../summary";
import { getGaps, getStudy } from "@/lib/repo/evidence";

// These tests pin the landing-page numbers to the raw artifacts: if a
// count on the page ever diverges from /data, they fail.
describe("corpus summary", () => {
  it("counts come straight from the validated data files", () => {
    const c = corpusCounts();
    expect(c.studies).toBe(studiesJson.length);
    expect(c.assertions).toBe(assertionsJson.length);
    expect(c.disorders).toBe(disordersJson.length);
    expect(c.corticalRegions + c.subcorticalRegions).toBe(83);
    expect(c.corticalRegions).toBe(68);
    expect(c.subcorticalRegions).toBe(15);
    expect(c.regionsWithEvidence + regionsWithoutEvidence().length).toBe(83);
  });

  it("per-year counts sum to the study count", () => {
    const total = studiesByYear().reduce((n, y) => n + y.studies, 0);
    expect(total).toBe(corpusCounts().studies);
  });

  it("disorder coverage lists every disorder once", () => {
    const cov = disorderCoverage();
    expect(cov.length).toBe(disordersJson.length);
    expect(new Set(cov.map((d) => d.id)).size).toBe(cov.length);
  });

  it("the provenance example is a real, linked chain", () => {
    const p = provenanceExample();
    const study = getStudy(p.study.id);
    expect(study).toBeDefined();
    expect(study!.doi ?? study!.pmid).toBeTruthy();
    const a = assertionsJson.find((x) => x.id === p.assertion.id)!;
    expect(a.studyId).toBe(p.study.id);
    expect(a.region).toBe(p.region.id);
    expect(a.disorder).toBe(p.disorder.id);
  });

  it("convergent pairs span ≥2 modality categories", () => {
    for (const p of convergentPairs())
      expect(Object.keys(p.categories).length).toBeGreaterThanOrEqual(2);
    const multi = categoryDistribution()
      .filter((d) => d.categories >= 2)
      .reduce((n, d) => n + d.pairs, 0);
    expect(multi).toBe(convergentPairs().length);
  });

  it("conflicts have studies on both sides", () => {
    for (const c of conflicts()) {
      expect(c.increased.length).toBeGreaterThan(0);
      expect(c.decreased.length).toBeGreaterThan(0);
    }
  });

  it("gap counts by rule sum to all detected gaps", () => {
    const total = gapCountsByRule().reduce((n, r) => n + r.count, 0);
    expect(total).toBe(getGaps().length);
  });

  it("region study counts never exceed the corpus", () => {
    for (const v of regionStudyCounts().values())
      expect(v).toBeLessThanOrEqual(corpusCounts().studies);
  });
});

describe("surname", () => {
  it("keeps multi-word surnames and drops initials", async () => {
    const { surname } = await import("../summary");
    expect(surname("van Rooij D")).toBe("van Rooij");
    expect(surname("Schmaal L")).toBe("Schmaal");
    expect(surname("ENIGMA Consortium")).toBe("ENIGMA Consortium");
  });
});
