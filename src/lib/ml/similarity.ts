/**
 * Pure vector math over row-major Float32Array embedding matrices.
 * Kept dependency-free so it is unit-testable and usable client-side.
 */

export function rowSlice(
  vectors: Float32Array,
  dim: number,
  row: number,
): Float32Array {
  return vectors.subarray(row * dim, (row + 1) * dim);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface Neighbor {
  id: string;
  similarity: number;
}

/** k nearest neighbors of `id` by cosine similarity (excluding itself). */
export function nearestNeighbors(
  ids: string[],
  vectors: Float32Array,
  dim: number,
  id: string,
  k: number,
): Neighbor[] {
  const row = ids.indexOf(id);
  if (row === -1) return [];
  const target = rowSlice(vectors, dim, row);
  return ids
    .map((otherId, i) =>
      i === row
        ? null
        : {
            id: otherId,
            similarity: cosineSimilarity(target, rowSlice(vectors, dim, i)),
          },
    )
    .filter((n): n is Neighbor => n !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
