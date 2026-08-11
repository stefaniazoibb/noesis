import { beforeEach, describe, expect, it } from "vitest";
import { toMarkdown, useNotebook } from "../notebook";

describe("notebook store", () => {
  beforeEach(() => useNotebook.getState().clearAll());

  it("adds entries, dedupes by key, and preserves order (newest first)", () => {
    const { add } = useNotebook.getState();
    add({ key: "region:x", type: "region", title: "X", aiGenerated: false });
    add({ key: "region:y", type: "region", title: "Y", aiGenerated: false });
    add({ key: "region:x", type: "region", title: "X again", aiGenerated: false });
    const entries = useNotebook.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe("Y");
    expect(entries[1].title).toBe("X"); // dedupe kept the original
  });

  it("updates notes and removes entries", () => {
    const { add, setNote, remove } = useNotebook.getState();
    add({ key: "study:s", type: "study", title: "S", aiGenerated: false });
    setNote("study:s", "check the sample size");
    expect(useNotebook.getState().entries[0].note).toBe("check the sample size");
    remove("study:s");
    expect(useNotebook.getState().entries).toHaveLength(0);
  });

  it("exports markdown with AI labels and citations", () => {
    const { add } = useNotebook.getState();
    add({
      key: "question:q1",
      type: "question",
      title: "Does X correspond to Y?",
      body: "Hypothesis: ...",
      citations: [{ id: "study_a", title: "Study A", url: "https://doi.org/10.0/a" }],
      aiGenerated: true,
    });
    add({ key: "region:r", type: "region", title: "Insula", aiGenerated: false });
    const md = toMarkdown(useNotebook.getState().entries);
    expect(md).toContain("## Research questions");
    expect(md).toContain("Does X correspond to Y?");
    expect(md).toContain("not experimentally validated");
    expect(md).toContain("- Study A — https://doi.org/10.0/a");
    expect(md).toContain("## Brain regions");
    // the non-AI entry carries no AI label
    expect(md.split("## Brain regions")[1]).not.toContain("not experimentally validated");
  });
});
