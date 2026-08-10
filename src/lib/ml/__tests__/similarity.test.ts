import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  nearestNeighbors,
  rowSlice,
} from "../similarity";

// 4 rows x 2 dims: a=(1,0), b=(2,0) parallel to a, c=(0,1) orthogonal, d=(-1,0) opposite
const VECTORS = Float32Array.from([1, 0, 2, 0, 0, 1, -1, 0]);
const IDS = ["a", "b", "c", "d"];

describe("similarity", () => {
  it("cosine similarity handles parallel, orthogonal and opposite vectors", () => {
    expect(cosineSimilarity(rowSlice(VECTORS, 2, 0), rowSlice(VECTORS, 2, 1))).toBeCloseTo(1);
    expect(cosineSimilarity(rowSlice(VECTORS, 2, 0), rowSlice(VECTORS, 2, 2))).toBeCloseTo(0);
    expect(cosineSimilarity(rowSlice(VECTORS, 2, 0), rowSlice(VECTORS, 2, 3))).toBeCloseTo(-1);
  });

  it("returns 0 for zero vectors instead of NaN", () => {
    expect(cosineSimilarity(Float32Array.from([0, 0]), Float32Array.from([1, 0]))).toBe(0);
  });

  it("ranks nearest neighbors by cosine similarity, excluding self", () => {
    const nn = nearestNeighbors(IDS, VECTORS, 2, "a", 3);
    expect(nn.map((n) => n.id)).toEqual(["b", "c", "d"]);
    expect(nn[0].similarity).toBeCloseTo(1);
    expect(nn[2].similarity).toBeCloseTo(-1);
  });

  it("returns empty for unknown ids", () => {
    expect(nearestNeighbors(IDS, VECTORS, 2, "nope", 3)).toEqual([]);
  });
});
