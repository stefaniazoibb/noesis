import { describe, expect, it } from "vitest";
import {
  buildGapPackage,
  rankExplanation,
  rankScore,
} from "../questions";
import type { EvidenceGap } from "@/lib/evidence/gaps";

const IMG_EP_GAP: EvidenceGap = {
  ruleId: "GAP-IMG-EP",
  disorder: "post_traumatic_stress_disorder",
  region: "sub_lh_hippocampus",
  magnitude: 4,
  description: "4 imaging studies, no electrophysiology.",
  supportingStudyIds: [
    "study_smith_2005",
    "study_karl_2006",
    "study_logue_2018",
    "study_bromis_2018",
  ],
  missingModalityCategory: "electrophysiology",
};

const CONFLICT_GAP: EvidenceGap = {
  ...IMG_EP_GAP,
  ruleId: "GAP-CONFLICT",
  magnitude: 2,
  conflictingStudyIds: ["study_smith_2005"],
};

describe("research-question ranking (deterministic)", () => {
  it("scores by magnitude x rule weight", () => {
    expect(rankScore(IMG_EP_GAP)).toBe(8); // 4 x 2
    expect(rankScore(CONFLICT_GAP)).toBe(6); // 2 x 3
  });

  it("produces a human-readable ranking explanation", () => {
    expect(rankExplanation(IMG_EP_GAP)).toContain("4 supporting studies");
    expect(rankExplanation(IMG_EP_GAP)).toContain("rule weight 2");
  });
});

describe("buildGapPackage (deterministic grounding)", () => {
  it("assembles a package with real study citations and derived candidates", () => {
    const pkg = buildGapPackage(IMG_EP_GAP);
    expect(pkg.questionType).toBe("cross_modal");
    expect(pkg.candidateRegions).toEqual(["sub_lh_hippocampus"]);
    // present modalities from the real corpus + the missing one proposed
    expect(pkg.candidateModalities).toContain("sMRI");
    expect(pkg.candidateModalities).toContain("EEG");
    // context text cites the real studies by id and names the region
    expect(pkg.contextText).toContain("[study_logue_2018]");
    expect(pkg.contextText).toContain("Hippocampus");
    expect(pkg.studyIds).toHaveLength(4);
  });
});
