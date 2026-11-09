/**
 * Region centroids in three.js world coordinates, registered by the mesh
 * components once their geometry loads (computed from the real fsaverage
 * vertices, never hand-placed). Used only for camera fly-to.
 *
 * World frame: the viewer rotates FreeSurfer surface RAS by -90° about x,
 * so RAS (x, y, z) -> world (x, z, -y).
 */

const centroids = new Map<string, [number, number, number]>();

export function rasToWorld(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

export function registerCentroid(id: string, world: [number, number, number]) {
  centroids.set(id, world);
}

export function getCentroid(id: string): [number, number, number] | undefined {
  return centroids.get(id);
}

/** Per-region mean vertex position (RAS) from a position attribute + vertex→region map. */
export function centroidsFromVertices(
  positions: ArrayLike<number>,
  vertexRegion: ArrayLike<number>,
  regionIndexToId: string[],
): Map<string, [number, number, number]> {
  const n = regionIndexToId.length;
  const sum = new Float64Array(n * 3);
  const count = new Uint32Array(n);
  const vcount = Math.min(vertexRegion.length, positions.length / 3);
  for (let v = 0; v < vcount; v++) {
    const r = vertexRegion[v];
    if (r <= 0 || r >= n) continue;
    sum[r * 3] += positions[v * 3];
    sum[r * 3 + 1] += positions[v * 3 + 1];
    sum[r * 3 + 2] += positions[v * 3 + 2];
    count[r] += 1;
  }
  const out = new Map<string, [number, number, number]>();
  for (let r = 1; r < n; r++) {
    if (count[r] === 0) continue;
    out.set(regionIndexToId[r], [
      sum[r * 3] / count[r],
      sum[r * 3 + 1] / count[r],
      sum[r * 3 + 2] / count[r],
    ]);
  }
  return out;
}
