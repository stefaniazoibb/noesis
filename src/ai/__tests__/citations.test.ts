import { describe, expect, it } from "vitest";
import { validateCitations } from "../citations";

const RETRIEVED = new Set(["study_schmaal_2016", "study_videbech_2004"]);
const TERMS = ["hippocampus", "depression", "fMRI"];

describe("validateCitations", () => {
  it("keeps citations that exist in the retrieved set", () => {
    const r = validateCitations(
      "Hippocampal volume is reduced in depression [study_schmaal_2016].",
      RETRIEVED,
      TERMS,
    );
    expect(r.text).toContain("[study_schmaal_2016]");
    expect(r.citedIds).toEqual(["study_schmaal_2016"]);
    expect(r.strippedIds).toEqual([]);
    expect(r.uncitedScientificSentences).toBe(0);
  });

  it("strips citations that were not retrieved (hallucinated ids)", () => {
    const r = validateCitations(
      "Reduced volume was reported [study_fake_2020] and replicated [study_videbech_2004].",
      RETRIEVED,
      TERMS,
    );
    expect(r.text).not.toContain("study_fake_2020");
    expect(r.text).toContain("[study_videbech_2004]");
    expect(r.strippedIds).toEqual(["study_fake_2020"]);
  });

  it("counts scientific sentences without any citation", () => {
    const r = validateCitations(
      "The hippocampus shows reduced volume in depression. This is well established. See [study_schmaal_2016] for the mega-analysis.",
      RETRIEVED,
      TERMS,
    );
    expect(r.uncitedScientificSentences).toBe(1);
  });

  it("ignores non-scientific filler sentences", () => {
    const r = validateCitations(
      "Here is what the indexed corpus shows about your question today.",
      RETRIEVED,
      TERMS,
    );
    expect(r.uncitedScientificSentences).toBe(0);
  });
});
