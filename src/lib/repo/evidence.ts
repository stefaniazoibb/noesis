import { z } from "zod";
import studiesJson from "../../../data/studies/studies.json";
import assertionsJson from "../../../data/evidence/assertions.json";
import {
  StudySchema,
  EvidenceAssertionSchema,
  type Study,
  type EvidenceAssertion,
} from "@/lib/schemas";
import { getDisorders, getModalities } from "./entities";
import { EvidenceIndex } from "@/lib/evidence/metrics";
import {
  computeProfiles,
  type ConvergenceProfile,
} from "@/lib/evidence/convergence";
import { detectGaps, type EvidenceGap } from "@/lib/evidence/gaps";

let studies: Study[] | null = null;
let assertions: EvidenceAssertion[] | null = null;
let index: EvidenceIndex | null = null;

export function getStudies(): Study[] {
  if (!studies) studies = z.array(StudySchema).parse(studiesJson);
  return studies;
}

export function getStudy(id: string): Study | undefined {
  return getStudies().find((s) => s.id === id);
}

export function getAssertions(): EvidenceAssertion[] {
  if (!assertions)
    assertions = z.array(EvidenceAssertionSchema).parse(assertionsJson);
  return assertions;
}

export function getEvidenceIndex(): EvidenceIndex {
  if (!index) {
    index = new EvidenceIndex(
      getAssertions(),
      new Map(getStudies().map((s) => [s.id, s])),
      new Map(getModalities().map((m) => [m.id, m])),
    );
  }
  return index;
}

let profilesByDisorder: Map<string, ConvergenceProfile[]> | null = null;
let gaps: EvidenceGap[] | null = null;

export function getProfilesByDisorder(): Map<string, ConvergenceProfile[]> {
  if (!profilesByDisorder) {
    const idx = getEvidenceIndex();
    profilesByDisorder = new Map(
      getDisorders().map((d) => [d.id, computeProfiles(idx, d.id)]),
    );
  }
  return profilesByDisorder;
}

export function getGaps(): EvidenceGap[] {
  if (!gaps) gaps = detectGaps(getProfilesByDisorder());
  return gaps;
}
