import { describe, expect, it } from "vitest";
import { computeProfiles, NOT_ASSESSED_DIMENSIONS } from "../convergence";
import { assertion, buildIndex, study } from "./fixtures";

describe("computeProfiles", () => {
  it("computes direction consistency across agreeing studies", () => {
    const index = buildIndex(
      [study("study_a"), study("study_b"), study("study_c")],
      [
        assertion({ studyId: "study_a", direction: "decreased" }),
        assertion({ studyId: "study_b", direction: "decreased" }),
        assertion({ studyId: "study_c", direction: "increased" }),
      ],
    );
    const [p] = computeProfiles(index, "dis_a");
    expect(p.direction.assessed).toBe(true);
    expect(p.direction.total).toBe(3);
    expect(p.direction.agreeing).toBe(2);
    expect(p.direction.ratio).toBeCloseTo(2 / 3);
  });

  it("marks direction consistency unassessed with fewer than two directional units", () => {
    const index = buildIndex(
      [study("study_a"), study("study_b")],
      [
        assertion({ studyId: "study_a", direction: "decreased" }),
        assertion({ studyId: "study_b", direction: null }),
      ],
    );
    const [p] = computeProfiles(index, "dis_a");
    expect(p.direction.assessed).toBe(false);
    expect(p.direction.ratio).toBeNull();
  });

  it("reports a conflict only for opposite directions on the SAME finding type", () => {
    const index = buildIndex(
      [
        study("study_a", { year: 2010, sampleSize: 40 }),
        study("study_b", { year: 2022, sampleSize: 900 }),
        study("study_c"),
      ],
      [
        assertion({ studyId: "study_a", direction: "increased", findingType: "activation" }),
        assertion({ studyId: "study_b", direction: "decreased", findingType: "activation" }),
        // different finding type, opposite direction — NOT a conflict
        assertion({ studyId: "study_c", direction: "decreased", findingType: "volumetric" }),
      ],
    );
    const [p] = computeProfiles(index, "dis_a");
    expect(p.conflicts).toHaveLength(1);
    expect(p.conflicts[0].findingType).toBe("activation");
    expect(p.conflicts[0].increased).toEqual(["study_a"]);
    expect(p.conflicts[0].decreased).toEqual(["study_b"]);
    expect(p.conflicts[0].differences.years).toEqual([2010, 2022]);
    expect(p.conflicts[0].differences.sampleSizes).toContain(900);
  });

  it("separates modality categories, causal support, and lists unassessed dimensions", () => {
    const index = buildIndex(
      [
        study("study_a", { modalities: ["fmri"] }),
        study("study_b", { modalities: ["smri"] }),
        study("study_c", { modalities: ["tms"] }),
      ],
      [
        assertion({ studyId: "study_a", modality: "fmri" }),
        assertion({ studyId: "study_b", modality: "smri" }),
        assertion({ studyId: "study_c", modality: "tms", causalSupport: "interventional" }),
      ],
    );
    const [p] = computeProfiles(index, "dis_a");
    // two imaging modalities count as ONE category + stimulation
    expect(p.modalityCategories.sort()).toEqual(["imaging", "stimulation"]);
    expect(p.categoryStudies["imaging"].sort()).toEqual(["study_a", "study_b"]);
    expect(p.categoryStudies["stimulation"]).toEqual(["study_c"]);
    expect(p.correlationalStudyIds.sort()).toEqual(["study_a", "study_b"]);
    expect(p.interventionalStudyIds).toEqual(["study_c"]);
    expect(p.notAssessed).toEqual(NOT_ASSESSED_DIMENSIONS);
  });
});
