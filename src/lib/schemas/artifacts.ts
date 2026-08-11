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

/** ML Lab run manifest. A run without a declared split strategy /
 *  validation protocol must not render (docs/METRICS.md defines each). */
export const ModelRunSchema = z.object({
  runId: z.string().min(1),
  task: z.enum([
    "classification",
    "regression",
    "clustering",
    "representation",
    "alignment",
    "link_prediction",
  ]),
  datasetDef: z.string().min(1),
  /** grouped_pair_level: disorder-region pairs held out whole (subject-level
   *  analog for corpus graphs); permutation_test: refit-under-permutation
   *  significance for small-n in-sample fits */
  splitStrategy: z.enum([
    "subject_level",
    "site_aware",
    "nested_cv",
    "grouped_pair_level",
    "permutation_test",
  ]),
  preprocessing: z.string().min(1),
  model: z.string().min(1),
  /** exact reproduction config (seed included) */
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  metrics: z.record(z.string(), z.number()),
  uncertainty: z.record(z.string(), z.number()).nullable(),
  modelVersion: z.string(),
  created: z.string(),
  /** task-specific payload files, name -> filename in the same directory */
  outputs: z.record(z.string(), z.string()),
});

export type RegionScalarMap = z.infer<typeof RegionScalarMapSchema>;
export type EmbeddingSetManifest = z.infer<typeof EmbeddingSetManifestSchema>;
export type ModelRun = z.infer<typeof ModelRunSchema>;
