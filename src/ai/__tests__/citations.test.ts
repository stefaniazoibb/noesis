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

describe("grouped citations", () => {
  it("validates each id inside [a, b] and strips the invented one", () => {
    const r = validateCitations(
      "Smaller hippocampal volume in depression [study_schmaal_2016, study_fake_1999; study_videbech_2004].",
      RETRIEVED,
      TERMS,
    );
    expect(r.citedIds.sort()).toEqual(["study_schmaal_2016", "study_videbech_2004"]);
    expect(r.strippedIds).toEqual(["study_fake_1999"]);
    expect(r.text).toContain("[study_schmaal_2016][study_videbech_2004]");
    expect(r.uncitedScientificSentences).toBe(0);
  });
});

describe("corpus marker cannot launder claims", () => {
  const FACTS = {
    counts: [
      { names: ["major depressive disorder", "depression", "MDD"], values: [9] },
      { names: ["anorexia nervosa"], values: [3] },
    ],
    blockedTerms: ["hippocampus", "hippocampal", "reduced", "volume", "increased", "decreased"],
  };

  it("honours [corpus] on a true coverage count", () => {
    const r = validateCitations(
      "Anorexia nervosa has 3 indexed studies [corpus].",
      new Set(),
      ["anorexia nervosa"],
      FACTS,
    );
    expect(r.text).toContain("[corpus]");
    expect(r.uncitedScientificSentences).toBe(0);
    expect(r.strippedCorpusMarkers).toBe(0);
  });

  it("strips [corpus] from a scientific finding and flags it", () => {
    const r = validateCitations(
      "Hippocampal volume is reduced in depression [corpus].",
      new Set(),
      TERMS,
      FACTS,
    );
    expect(r.text).not.toContain("[corpus]");
    expect(r.strippedCorpusMarkers).toBe(1);
    expect(r.uncitedScientificSentences).toBe(1);
  });

  it("strips [corpus] when the number is wrong or missing", () => {
    for (const s of [
      "Depression has 40 indexed studies in the corpus [corpus].",
      "Depression is well covered in this corpus [corpus].",
    ]) {
      const r = validateCitations(s, new Set(), TERMS, FACTS);
      expect(r.text).not.toContain("[corpus]");
      expect(r.uncitedScientificSentences).toBe(1);
    }
  });

  it("without facts, [corpus] is never honoured", () => {
    const r = validateCitations("Depression has 9 studies [corpus].", new Set(), TERMS);
    expect(r.text).not.toContain("[corpus]");
  });
});
