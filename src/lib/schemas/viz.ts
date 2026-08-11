import { z } from "zod";

export const VizModeSchema = z.enum([
  "anatomical",
  "evidence",
  "modality",
  "disorder",
  "convergence",
  "gaps",
  "compare",
  "network",
  "representation",
]);

/**
 * The complete, serializable visualization state. The AI assistant's
 * natural-language viz commands compile to a VizStatePatch against this —
 * never to arbitrary mutations.
 */
export const VizStateSchema = z.object({
  mode: VizModeSchema,
  selectedRegion: z.string().nullable(),
  disorders: z.array(z.string()),
  modalities: z.array(z.string()),
  hemispheres: z.object({ left: z.boolean(), right: z.boolean() }),
  showSubcortical: z.boolean(),
  filters: z.object({
    yearMin: z.number().int().nullable(),
    yearMax: z.number().int().nullable(),
    evidenceLevels: z.array(z.string()).nullable(),
  }),
});

export const VizStatePatchSchema = VizStateSchema.partial();

export const DEFAULT_VIZ_STATE: VizState = {
  mode: "anatomical",
  selectedRegion: null,
  disorders: [],
  modalities: [],
  hemispheres: { left: true, right: true },
  showSubcortical: false,
  filters: { yearMin: null, yearMax: null, evidenceLevels: null },
};

export type VizMode = z.infer<typeof VizModeSchema>;
export type VizState = z.infer<typeof VizStateSchema>;
export type VizStatePatch = z.infer<typeof VizStatePatchSchema>;
