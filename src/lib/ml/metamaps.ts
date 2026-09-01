"use client";

import { useEffect, useState } from "react";
import { RegionScalarMapSchema, type RegionScalarMap } from "@/lib/schemas";

/**
 * Loaders for per-disorder RegionScalarMap artifacts:
 * - metamaps: NeuroQuery meta-analytic maps (model-generated stratum)
 * - morphomaps: CNP MRI morphometry effect sizes (data-derived stratum)
 * Both are explicitly labeled strata, separate from the curated corpus.
 */

export type ScalarMapKind = "metamaps" | "morphomaps";

const cache = new Map<string, Promise<RegionScalarMap | null>>();

export function loadScalarMap(
  kind: ScalarMapKind,
  disorderId: string,
): Promise<RegionScalarMap | null> {
  const ext = kind === "metamaps" ? "metamap" : "morphomap";
  const key = `${kind}/${disorderId}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/${kind}/${disorderId}.${ext}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => (raw ? RegionScalarMapSchema.parse(raw) : null))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

export function useScalarMap(
  kind: ScalarMapKind,
  disorderId: string | null,
): RegionScalarMap | null {
  const [state, setState] = useState<{
    key: string;
    map: RegionScalarMap | null;
  } | null>(null);

  const key = disorderId ? `${kind}/${disorderId}` : null;
  useEffect(() => {
    if (!key || !disorderId) return;
    let alive = true;
    loadScalarMap(kind, disorderId).then((map) => {
      if (alive) setState({ key, map });
    });
    return () => {
      alive = false;
    };
  }, [key, kind, disorderId]);

  return state?.key === key ? state.map : null;
}

export function useMetamap(disorderId: string | null): RegionScalarMap | null {
  return useScalarMap("metamaps", disorderId);
}
