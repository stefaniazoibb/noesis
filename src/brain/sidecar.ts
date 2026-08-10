"use client";

import { useEffect, useState } from "react";

/** Parsed vertex→region map for one cortical hemisphere GLB. */
export interface SidecarData {
  regionIndexToId: string[];
  vertexRegion: Uint16Array;
  indexOf: Map<string, number>;
}

const cache = new Map<string, Promise<SidecarData>>();

function load(hemi: "lh" | "rh"): Promise<SidecarData> {
  let p = cache.get(hemi);
  if (!p) {
    p = fetch(`/meshes/cortex_${hemi}.regions.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`sidecar ${hemi}: HTTP ${r.status}`);
        return r.json();
      })
      .then((raw: { regionIndexToId: string[]; vertexRegion: number[] }) => ({
        regionIndexToId: raw.regionIndexToId,
        vertexRegion: Uint16Array.from(raw.vertexRegion),
        indexOf: new Map(raw.regionIndexToId.map((id, i) => [id, i])),
      }));
    cache.set(hemi, p);
  }
  return p;
}

export function useSidecar(hemi: "lh" | "rh"): SidecarData | null {
  const [data, setData] = useState<SidecarData | null>(null);
  useEffect(() => {
    let alive = true;
    load(hemi).then(
      (d) => alive && setData(d),
      (err) => console.error(err),
    );
    return () => {
      alive = false;
    };
  }, [hemi]);
  return data;
}
