import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * End-to-end test of the assistant route with the model stubbed out:
 * intent -> deterministic retrieval -> synthesis -> citation validation.
 * Exercises everything except the network call, so a key-less CI can still
 * prove the wiring that a live key will use.
 */
const structured = vi.fn();
const complete = vi.fn();
vi.mock("@/ai/provider", () => ({
  structured: (...a: unknown[]) => structured(...a),
  complete: (...a: unknown[]) => complete(...a),
  isAuthError: () => false,
  ProviderRefusalError: class extends Error {},
}));

const { POST } = await import("../route");

function ask(question: string) {
  return POST(
    new NextRequest("http://localhost/api/assistant", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  );
}

const MDD_INTENT = {
  intent: "question",
  disorders: ["major_depressive_disorder"],
  regions: [],
  modalities: [],
  vizCommand: null,
};

describe("assistant route (model stubbed)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    structured.mockReset();
    complete.mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("keeps retrieved citations, strips invented ones, returns regions", async () => {
    structured.mockResolvedValue(MDD_INTENT);
    complete.mockResolvedValue(
      "Smaller hippocampal volume has been reported in MDD [study_schmaal_2016]. " +
        "A larger effect was also found [study_invented_2099].",
    );
    const data = await (await ask("hippocampus in depression?")).json();
    expect(data.type).toBe("answer");
    expect(data.answer).toContain("[study_schmaal_2016]");
    expect(data.answer).not.toContain("study_invented_2099");
    expect(data.flags.strippedCitations).toBe(1);
    expect(data.citations.map((c: { id: string }) => c.id)).toEqual(["study_schmaal_2016"]);
    expect(data.regions.length).toBeGreaterThan(0);
    // the model only ever saw retrieved records + the coverage block
    const prompt = complete.mock.calls[0][0].user as string;
    expect(prompt).toContain("EVIDENCE RECORDS");
    expect(prompt).toContain("CORPUS COVERAGE");
  });

  it("compiles a viz command to a validated patch without synthesis", async () => {
    structured.mockResolvedValue({
      ...MDD_INTENT,
      disorders: ["schizophrenia"],
      modalities: ["fmri"],
      intent: "viz_command",
      vizCommand: { mode: "disorder", showSubcortical: null, selectRegion: null },
    });
    const data = await (await ask("show schizophrenia evidence, fMRI only")).json();
    expect(data.type).toBe("viz");
    expect(data.patch).toMatchObject({ mode: "disorder", disorders: ["schizophrenia"], modalities: ["fmri"] });
    expect(complete).not.toHaveBeenCalled();
  });

  it("answers 'no indexed evidence' without calling the model", async () => {
    structured.mockResolvedValue({ ...MDD_INTENT, disorders: [] });
    const data = await (await ask("zzqx")).json();
    expect(data.answer).toMatch(/No indexed evidence/);
    expect(complete).not.toHaveBeenCalled();
  });

  it("without a key returns records only, never synthesis", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const data = await (await ask("What regions are associated with depression?")).json();
    expect(data.type).toBe("retrieval");
    expect(data.answer).toMatch(/Anthropic API key/);
    expect(data.citations.length).toBeGreaterThan(0);
    expect(structured).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
});
