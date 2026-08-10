import { z } from "zod";

export const HemisphereSchema = z.enum(["left", "right", "midline"]);

export const RegionSchema = z.object({
  id: z.string().min(1),
  atlas: z.string().min(1),
  /** name in the source atlas file (annot / aseg label) */
  sourceName: z.string().min(1),
  name: z.string().min(1),
  hemisphere: HemisphereSchema,
  kind: z.enum(["cortical", "subcortical"]),
  system: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
});

export const AtlasSchema = z.object({
  atlas: z.string().min(1),
  name: z.string().min(1),
  space: z.string().min(1),
  source: z.string().min(1),
  regions: z.array(RegionSchema).min(1),
});

/** Sidecar mapping GLB vertices to atlas regions (public/meshes/*.regions.json) */
export const RegionSidecarSchema = z.object({
  atlas: z.string(),
  hemi: z.enum(["lh", "rh"]),
  /** index 0 is always "none" (background vertices) */
  regionIndexToId: z.array(z.string()).min(1),
  vertexRegion: z.array(z.number().int().nonnegative()),
});

export type Region = z.infer<typeof RegionSchema>;
export type Atlas = z.infer<typeof AtlasSchema>;
export type RegionSidecar = z.infer<typeof RegionSidecarSchema>;
