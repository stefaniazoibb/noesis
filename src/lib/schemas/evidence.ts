import { z } from "zod";

export const FindingTypeSchema = z.enum([
  "activation",
  "functional_connectivity",
  "structural_difference",
  "volumetric",
  "electrophysiological",
  "stimulation_response",
  "metabolic",
  "other",
]);

export const DirectionSchema = z.enum(["increased", "decreased", "mixed"]);

export const CurationSchema = z.object({
  method: z.enum(["manual", "ai_extracted"]),
  verifiedByHuman: z.boolean(),
  /** where title/authors/year were checked (e.g. "pubmed", "openalex") */
  metadataVerifiedAgainst: z.string().nullable(),
  curatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * One record per real publication. DOI or PMID is REQUIRED — a study without
 * an external identifier cannot enter the corpus (no-fabrication rule).
 */
export const StudySchema = z
  .object({
    id: z.string().regex(/^study_[a-z0-9_]+$/),
    title: z.string().min(1),
    authors: z.array(z.string()).min(1),
    year: z.number().int().min(1900).max(2100),
    journal: z.string().nullable(),
    doi: z.string().nullable(),
    pmid: z.string().nullable(),
    disorders: z.array(z.string()),
    regions: z.array(z.string()),
    networks: z.array(z.string()),
    modalities: z.array(z.string()).min(1),
    findingType: FindingTypeSchema,
    /** faithful one-sentence summary of the reported result — not a quote */
    finding: z.string().min(1),
    direction: DirectionSchema.nullable(),
    sampleSize: z.number().int().positive().nullable(),
    population: z.string().nullable(),
    /** reported stereotactic coordinates, if any, with their space */
    coordinates: z.array(
      z.object({
        space: z.string(),
        xyz: z.tuple([z.number(), z.number(), z.number()]),
      }),
    ),
    effectSize: z
      .object({ metric: z.string(), value: z.number() })
      .nullable(),
    source: z.string().min(1),
    curation: CurationSchema,
  })
  .refine((s) => s.doi !== null || s.pmid !== null, {
    message: "study requires a DOI or PMID",
  });

/**
 * Atomic evidence unit: disorder–region–modality–finding, always bound to a
 * study. Never a bare disorder→region link.
 */
export const EvidenceAssertionSchema = z.object({
  id: z.string().regex(/^ev_[a-z0-9_]+$/),
  disorder: z.string().min(1),
  region: z.string().min(1),
  network: z.string().nullable(),
  modality: z.string().min(1),
  findingType: FindingTypeSchema,
  direction: DirectionSchema.nullable(),
  /** faithful summary of what the study reported for this relationship */
  statement: z.string().min(1),
  studyId: z.string().regex(/^study_[a-z0-9_]+$/),
  causalSupport: z.enum(["none", "correlational", "interventional"]),
  /** only for ai_extracted assertions; manual curation leaves this null */
  confidence: z.number().min(0).max(1).nullable(),
});

export type Study = z.infer<typeof StudySchema>;
export type EvidenceAssertion = z.infer<typeof EvidenceAssertionSchema>;
