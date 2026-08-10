/**
 * Synthetic fixtures for unit-testing the evidence engine. Test code only —
 * these objects never enter /data and are never rendered as evidence.
 */
import type { EvidenceAssertion, Modality, Study } from "@/lib/schemas";
import { EvidenceIndex } from "../metrics";

export const MODALITIES: Modality[] = (
  [
    ["fmri", "fMRI", "imaging"],
    ["smri", "sMRI", "imaging"],
    ["eeg", "EEG", "electrophysiology"],
    ["tms", "TMS", "stimulation"],
  ] as const
).map(([id, abbreviation, category]) => ({
  id,
  name: id,
  abbreviation,
  category,
  description: null,
  spatialResolution: null,
  temporalResolution: null,
  invasive: false,
  synonyms: [],
}));

export function study(id: string, over: Partial<Study> = {}): Study {
  return {
    id,
    title: `Test study ${id}`,
    authors: ["Test T"],
    year: 2020,
    journal: "Test Journal",
    doi: `10.0000/${id}`,
    pmid: null,
    disorders: ["dis_a"],
    regions: [],
    networks: [],
    modalities: ["fmri"],
    findingType: "activation",
    finding: "test finding",
    direction: null,
    sampleSize: null,
    population: null,
    coordinates: [],
    effectSize: null,
    source: "test",
    curation: {
      method: "manual",
      verifiedByHuman: false,
      metadataVerifiedAgainst: null,
      curatedDate: "2026-01-01",
    },
    ...over,
  };
}

let n = 0;
export function assertion(
  over: Partial<EvidenceAssertion> & { studyId: string },
): EvidenceAssertion {
  n += 1;
  return {
    id: `ev_test_${n}`,
    disorder: "dis_a",
    region: "region_1",
    network: null,
    modality: "fmri",
    findingType: "activation",
    direction: null,
    statement: "test statement",
    causalSupport: "correlational",
    confidence: null,
    ...over,
  };
}

export function buildIndex(
  studies: Study[],
  assertions: EvidenceAssertion[],
): EvidenceIndex {
  return new EvidenceIndex(
    assertions,
    new Map(studies.map((s) => [s.id, s])),
    new Map(MODALITIES.map((m) => [m.id, m])),
  );
}
