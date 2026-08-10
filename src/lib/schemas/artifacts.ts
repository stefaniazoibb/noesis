import { z } from "zod";

/**
 * The three stable ML artifact contracts (ARCHITECTURE.md §8). Everything the
 * ML side ever produces reaches the frontend through one of these, so real
 * neuroimaging/EEG models can be added later without frontend changes.
 */

/** Scalar value per region — evidence density, convergence, model importance… */
export const RegionScalarMapSchema = z.object({
  artifactId: z.string().min(1),
  atlas: z.string().min(1),
  values: z.record(z.string(), z.number()),
  /** human-readable definition of the metric; rendered in the legend */
  metricDef: z.string().min(1),
  provenance: z.object({
    method: z.string(),
    corpusVersion: z.string().nullable(),
    created: z.string(),
  }),
});

export const EmbeddingSetManifestSchema = z.object({
  artifactId: z.string().min(1),
  entityType: z.enum(["region", "disorder", "study"]),
  method: z.string().min(1),
  inputs: z.array(z.string()),
  corpusVersion: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  created: z.string(),
  dim: z.number().int().positive(),
  ids: z.array(z.string()).min(1),
  /** file with float32 vectors, row-major, len(ids) x dim */
  vectorsFile: z.string(),
  /** precomputed 2D projections keyed by method (umap, pca) */
  projections: z.record(
    z.string(),
    z.array(z.tuple([z.number(), z.number()])),
  ),
});

/** Reserved for the ML Lab (post-MVP). A run without a declared split
 *  strategy must not render. */
export const ModelRunSchema = z.object({
  runId: z.string().min(1),
  task: z.enum(["classification", "regression", "clustering", "representation"]),
  datasetDef: z.string().min(1),
  splitStrategy: z.enum(["subject_level", "site_aware", "nested_cv"]),
  preprocessing: z.string().min(1),
  model: z.string().min(1),
  metrics: z.record(z.string(), z.number()),
  uncertainty: z.record(z.string(), z.number()).nullable(),
  modelVersion: z.string(),
  created: z.string(),
});

export type RegionScalarMap = z.infer<typeof RegionScalarMapSchema>;
export type EmbeddingSetManifest = z.infer<typeof EmbeddingSetManifestSchema>;
export type ModelRun = z.infer<typeof ModelRunSchema>;
