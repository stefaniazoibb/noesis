import { describe, expect, it } from "vitest";
import { compareDisorders } from "../compare";
import { getEvidenceIndex } from "@/lib/repo/evidence";
import { assertion, buildIndex, study } from "./fixtures";

describe("compareDisorders (real corpus)", () => {
  const cmp = compareDisorders(
    getEvidenceIndex(),
    "major_depressive_disorder",
    "post_traumatic_stress_disorder",
  );

  it("finds the shared hippocampal evidence between MDD and PTSD", () => {
    const sharedRegions = cmp.shared.map((s) => s.region);
    expect(sharedRegions).toContain("sub_lh_hippocampus");
    expect(sharedRegions).toContain("sub_rh_hippocampus");
    const hippo = cmp.shared.find((s) => s.region === "sub_lh_hippocampus")!;
    expect(hippo.a.studyCount).toBeGreaterThanOrEqual(3);
    expect(hippo.b.studyCount).toBeGreaterThanOrEqual(3);
  });

  it("keeps disorder-specific regions separate and sorted", () => {
    expect(cmp.aOnly.length).toBeGreaterThan(0);
    expect(cmp.bOnly.length).toBeGreaterThan(0);
    for (const { region } of cmp.aOnly) {
      expect(cmp.shared.some((s) => s.region === region)).toBe(false);
    }
  });

  it("reports modality overlap as distinct study counts", () => {
    const smri = cmp.modalityOverlap.find((m) => m.modality === "smri")!;
    expect(smri.aCount).toBeGreaterThan(0);
    expect(smri.bCount).toBeGreaterThan(0);
  });
});

describe("compareDisorders direction differences (fixtures)", () => {
  it("flags opposite majority directions for the same finding type", () => {
    const index = buildIndex(
      [
        study("study_a", { disorders: ["dis_a"] }),
        study("study_b", { disorders: ["dis_b"] }),
      ],
      [
        assertion({ studyId: "study_a", disorder: "dis_a", direction: "increased" }),
        assertion({ studyId: "study_b", disorder: "dis_b", direction: "decreased" }),
      ],
    );
    const cmp = compareDisorders(index, "dis_a", "dis_b");
    expect(cmp.directionDifferences).toHaveLength(1);
    expect(cmp.directionDifferences[0]).toMatchObject({
      region: "region_1",
      aDirection: "increased",
      bDirection: "decreased",
    });
  });

  it("does not flag differences across different finding types", () => {
    const index = buildIndex(
      [
        study("study_a", { disorders: ["dis_a"] }),
        study("study_b", { disorders: ["dis_b"] }),
      ],
      [
        assertion({ studyId: "study_a", disorder: "dis_a", direction: "increased", findingType: "activation" }),
        assertion({ studyId: "study_b", disorder: "dis_b", direction: "decreased", findingType: "volumetric" }),
      ],
    );
    expect(compareDisorders(index, "dis_a", "dis_b").directionDifferences).toHaveLength(0);
  });
});

describe("compare overlay values (real corpus)", () => {
  it("classifies shared vs exclusive regions", async () => {
    const { computeOverlay } = await import("../overlay");
    const overlay = computeOverlay(
      "compare",
      ["major_depressive_disorder", "post_traumatic_stress_disorder"],
      { modalities: [], yearMin: null, yearMax: null },
    );
    expect(overlay.kind).toBe("compare");
    expect(overlay.values.get("sub_lh_hippocampus")).toBe(3); // shared
  });
});
