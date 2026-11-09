import { describe, expect, it } from "vitest";
import { linkEntities } from "../linkEntities";

describe("deterministic entity linking (no-model fallback)", () => {
  it("maps disorder synonyms to canonical ids", () => {
    const e = linkEntities("What regions are associated with depression?");
    expect(e.disorders).toContain("major_depressive_disorder");
  });

  it("matches adjectival region stems on both hemispheres", () => {
    const e = linkEntities("What findings contradict the hippocampal association with depression?");
    expect(e.regions).toEqual(
      expect.arrayContaining(["sub_lh_hippocampus", "sub_rh_hippocampus"]),
    );
  });

  it("respects an explicit hemisphere", () => {
    const e = linkEntities("Show evidence for the left amygdala in PTSD");
    expect(e.regions).toContain("sub_lh_amygdala");
    expect(e.regions).not.toContain("sub_rh_amygdala");
    expect(e.disorders).toContain("post_traumatic_stress_disorder");
  });

  it("links several disorders and modality abbreviations", () => {
    const e = linkEntities("Compare the fMRI evidence for schizophrenia and bipolar disorder");
    expect(e.disorders).toEqual(expect.arrayContaining(["schizophrenia", "bipolar_disorder"]));
    expect(e.modalities).toContain("fmri");
  });

  it("does not read AD or HD inside ADHD", () => {
    const e = linkEntities("ADHD in children");
    expect(e.disorders).toEqual(["adhd"]);
  });

  it("does not read 'brains' as Brainstem", () => {
    const e = linkEntities("Studies of the brains of patients with OCD");
    expect(e.regions).toEqual([]);
    expect(e.disorders).toContain("obsessive_compulsive_disorder");
  });

  it("returns nothing rather than guessing", () => {
    const e = linkEntities("hello there");
    expect(e).toEqual({ disorders: [], regions: [], modalities: [] });
  });
});
