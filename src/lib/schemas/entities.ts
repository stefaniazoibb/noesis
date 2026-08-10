import { z } from "zod";

export const DisorderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["psychiatric", "neurodegenerative", "neurological"]),
  /** short, hedged scientific overview; never causal claims */
  overview: z.string().nullable(),
  synonyms: z.array(z.string()),
});

export const ModalityCategorySchema = z.enum([
  "imaging",
  "electrophysiology",
  "stimulation",
  "hemodynamic",
]);

export const ModalitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  category: ModalityCategorySchema,
  description: z.string().nullable(),
  /** qualitative descriptors, e.g. "millimetre-scale" / "milliseconds" */
  spatialResolution: z.string().nullable(),
  temporalResolution: z.string().nullable(),
  invasive: z.boolean(),
  synonyms: z.array(z.string()),
});

export const NetworkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  /** atlas region ids; membership requires a documented source */
  regions: z.array(z.string()),
  membershipSource: z.string().nullable(),
  synonyms: z.array(z.string()),
});

export type Disorder = z.infer<typeof DisorderSchema>;
export type Modality = z.infer<typeof ModalitySchema>;
export type Network = z.infer<typeof NetworkSchema>;
