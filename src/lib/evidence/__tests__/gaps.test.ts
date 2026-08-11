import { describe, expect, it } from "vitest";
import { computeProfiles } from "../convergence";
import { detectGaps } from "../gaps";
import { assertion, buildIndex, study } from "./fixtures";
import type { EvidenceAssertion, Study } from "@/lib/schemas";

function profilesFor(
  studies: Study[],
  assertions: EvidenceAssertion[],
  disorders: string[],
) {
  const index = buildIndex(studies, assertions);
  return new Map(disorders.map((d) => [d, computeProfiles(index, d)]));
}

describe("detectGaps", () => {
  it("GAP-IMG-EP fires at >=3 imaging studies with zero electrophysiology", () => {
    const gaps = detectGaps(
      profilesFor(
        [study("study_a"), study("study_b"), study("study_c")],
        [
          assertion({ studyId: "study_a", modality: "fmri" }),
          assertion({ studyId: "study_b", modality: "smri" }),
          assertion({ studyId: "study_c", modality: "fmri" }),
        ],
        ["dis_a"],
      ),
    );
    const g = gaps.find((x) => x.ruleId === "GAP-IMG-EP");
    expect(g).toBeDefined();
    expect(g!.magnitude).toBe(3);
    expect(g!.supportingStudyIds.sort()).toEqual(["study_a", "study_b", "study_c"]);
  });

  it("GAP-IMG-EP does not fire below threshold or when EEG evidence exists", () => {
    // only 2 imaging studies
    const below = detectGaps(
      profilesFor(
        [study("study_a"), study("study_b")],
        [
          assertion({ studyId: "study_a", modality: "fmri" }),
          assertion({ studyId: "study_b", modality: "smri" }),
        ],
        ["dis_a"],
      ),
    );
    expect(below.find((x) => x.ruleId === "GAP-IMG-EP")).toBeUndefined();

    // 3 imaging + 1 EEG
    const covered = detectGaps(
      profilesFor(
        [study("study_a"), study("study_b"), study("study_c"), study("study_d")],
        [
          assertion({ studyId: "study_a", modality: "fmri" }),
          assertion({ studyId: "study_b", modality: "smri" }),
          assertion({ studyId: "study_c", modality: "fmri" }),
          assertion({ studyId: "study_d", modality: "eeg" }),
        ],
        ["dis_a"],
      ),
    );
    expect(covered.find((x) => x.ruleId === "GAP-IMG-EP")).toBeUndefined();
  });

  it("GAP-OBS-INT fires for correlational-only pairs and clears with intervention evidence", () => {
    const base = [study("study_a"), study("study_b"), study("study_c")];
    const correlational = [
      assertion({ studyId: "study_a" }),
      assertion({ studyId: "study_b" }),
      assertion({ studyId: "study_c" }),
    ];
    const gaps = detectGaps(profilesFor(base, correlational, ["dis_a"]));
    expect(gaps.find((x) => x.ruleId === "GAP-OBS-INT")).toBeDefined();

    const withTms = detectGaps(
      profilesFor(
        [...base, study("study_d", { modalities: ["tms"] })],
        [
          ...correlational,
          assertion({ studyId: "study_d", modality: "tms", causalSupport: "interventional" }),
        ],
        ["dis_a"],
      ),
    );
    expect(withTms.find((x) => x.ruleId === "GAP-OBS-INT")).toBeUndefined();
  });

  it("GAP-CONFLICT requires at least two studies on each side", () => {
    const oneVsOne = detectGaps(
      profilesFor(
        [study("study_a"), study("study_b")],
        [
          assertion({ studyId: "study_a", direction: "increased" }),
          assertion({ studyId: "study_b", direction: "decreased" }),
        ],
        ["dis_a"],
      ),
    );
    expect(oneVsOne.find((x) => x.ruleId === "GAP-CONFLICT")).toBeUndefined();

    const twoVsTwo = detectGaps(
      profilesFor(
        [study("study_a"), study("study_b"), study("study_c"), study("study_d")],
        [
          assertion({ studyId: "study_a", direction: "increased" }),
          assertion({ studyId: "study_b", direction: "increased" }),
          assertion({ studyId: "study_c", direction: "decreased" }),
          assertion({ studyId: "study_d", direction: "decreased" }),
        ],
        ["dis_a"],
      ),
    );
    const g = twoVsTwo.find((x) => x.ruleId === "GAP-CONFLICT");
    expect(g).toBeDefined();
    expect(g!.magnitude).toBe(2);
    expect(g!.conflictingStudyIds).toHaveLength(2);
  });

  it("GAP-ATTENTION fires only for related disorders (>=3 shared regions AND >=50% overlap)", () => {
    const studies = [
      study("study_a", { disorders: ["dis_a"] }),
      study("study_b", { disorders: ["dis_a"] }),
      study("study_c", { disorders: ["dis_a"] }),
      study("study_d", { disorders: ["dis_b"] }),
      study("study_e", { disorders: ["dis_c"] }),
    ];
    const assertions = [
      // dis_a: region_1 heavily studied + shares region_2/3/4 with dis_b
      assertion({ studyId: "study_a", disorder: "dis_a", region: "region_1" }),
      assertion({ studyId: "study_b", disorder: "dis_a", region: "region_1" }),
      assertion({ studyId: "study_c", disorder: "dis_a", region: "region_1" }),
      assertion({ studyId: "study_a", disorder: "dis_a", region: "region_2" }),
      assertion({ studyId: "study_b", disorder: "dis_a", region: "region_3" }),
      assertion({ studyId: "study_c", disorder: "dis_a", region: "region_4" }),
      // dis_b shares regions 2,3,4 (overlap 3/3 = 100%), lacks region_1 -> gap
      assertion({ studyId: "study_d", disorder: "dis_b", region: "region_2" }),
      assertion({ studyId: "study_d", disorder: "dis_b", region: "region_3" }),
      assertion({ studyId: "study_d", disorder: "dis_b", region: "region_4" }),
      // dis_c shares only regions 2,3 (below the 3-region floor) -> no gap
      assertion({ studyId: "study_e", disorder: "dis_c", region: "region_2" }),
      assertion({ studyId: "study_e", disorder: "dis_c", region: "region_3" }),
    ];
    const gaps = detectGaps(
      profilesFor(studies, assertions, ["dis_a", "dis_b", "dis_c"]),
    );
    const attention = gaps.filter((x) => x.ruleId === "GAP-ATTENTION");
    expect(attention).toHaveLength(1);
    expect(attention[0].disorder).toBe("dis_b");
    expect(attention[0].region).toBe("region_1");
    expect(attention[0].referenceDisorder).toBe("dis_a");
  });

  it("GAP-ATTENTION requires overlap ratio, not just absolute shared count", () => {
    // both disorders implicate 13+ regions but share only 3
    // -> shared >= 3 passes the floor, but 3/13 ≈ 23% < 25% -> no gap
    const mk = (disorder: string, studyId: string, regions: string[]) =>
      regions.map((region) => assertion({ studyId, disorder, region }));
    const studies = [
      study("study_a", { disorders: ["dis_a"] }),
      study("study_b", { disorders: ["dis_a"] }),
      study("study_c", { disorders: ["dis_a"] }),
      study("study_d", { disorders: ["dis_c"] }),
    ];
    const assertions = [
      assertion({ studyId: "study_a", disorder: "dis_a", region: "region_hot" }),
      assertion({ studyId: "study_b", disorder: "dis_a", region: "region_hot" }),
      assertion({ studyId: "study_c", disorder: "dis_a", region: "region_hot" }),
      ...mk("dis_a", "study_a", ["s1", "s2", "s3", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9"]),
      ...mk("dis_c", "study_d", ["s1", "s2", "s3", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"]),
    ];
    const gaps = detectGaps(profilesFor(studies, assertions, ["dis_a", "dis_c"]));
    expect(gaps.filter((x) => x.ruleId === "GAP-ATTENTION")).toHaveLength(0);
  });
});
