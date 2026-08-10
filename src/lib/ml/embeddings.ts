"use client";

import { z } from "zod";
import {
  EmbeddingSetManifestSchema,
  type EmbeddingSetManifest,
} from "@/lib/schemas";

/** Client-side loader for EmbeddingSet artifacts served from /embeddings. */

export const LoadingsSchema = z.object({
  artifactId: z.string(),
  components: z.array(
    z.object({
      index: z.number().int(),
      explainedVarianceRatio: z.number(),
      topFeatures: z.array(
        z.object({ feature: z.string(), loading: z.number() }),
      ),
    }),
  ),
});

export type Loadings = z.infer<typeof LoadingsSchema>;

export interface EmbeddingSet {
  manifest: EmbeddingSetManifest;
  vectors: Float32Array;
  loadings: Loadings | null;
}

export type EmbeddingEntity = "region" | "disorder" | "study";

const cache = new Map<EmbeddingEntity, Promise<EmbeddingSet>>();

async function fetchSet(entity: EmbeddingEntity): Promise<EmbeddingSet> {
  const manifestRes = await fetch(`/embeddings/${entity}.manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`embedding manifest ${entity}: HTTP ${manifestRes.status}`);
  }
  const manifest = EmbeddingSetManifestSchema.parse(await manifestRes.json());

  const vecRes = await fetch(`/embeddings/${manifest.vectorsFile}`);
  if (!vecRes.ok) {
    throw new Error(`embedding vectors ${entity}: HTTP ${vecRes.status}`);
  }
  const vectors = new Float32Array(await vecRes.arrayBuffer());
  if (vectors.length !== manifest.ids.length * manifest.dim) {
    throw new Error(
      `embedding vectors ${entity}: expected ${manifest.ids.length * manifest.dim} floats, got ${vectors.length}`,
    );
  }

  let loadings: Loadings | null = null;
  const loadRes = await fetch(`/embeddings/${entity}.loadings.json`);
  if (loadRes.ok) {
    const parsed = LoadingsSchema.safeParse(await loadRes.json());
    loadings = parsed.success ? parsed.data : null;
  }

  return { manifest, vectors, loadings };
}

export function loadEmbeddingSet(entity: EmbeddingEntity): Promise<EmbeddingSet> {
  let p = cache.get(entity);
  if (!p) {
    p = fetchSet(entity).catch((err) => {
      cache.delete(entity);
      throw err;
    });
    cache.set(entity, p);
  }
  return p;
}
