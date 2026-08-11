"use client";

import { useEffect, useState } from "react";
import { RegionScalarMapSchema, type RegionScalarMap } from "@/lib/schemas";

/**
 * Loader for NeuroQuery meta-analytic RegionScalarMap artifacts
 * (pipeline/metamaps). These are MODEL-GENERATED maps — a separate,
 * explicitly labeled evidence stratum from the curated corpus.
 */

const cache = new Map<string, Promise<RegionScalarMap | null>>();

function load(disorderId: string): Promise<RegionScalarMap | null> {
  let p = cache.get(disorderId);
  if (!p) {
    p = fetch(`/metamaps/${disorderId}.metamap.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => (raw ? RegionScalarMapSchema.parse(raw) : null))
      .catch(() => null);
    cache.set(disorderId, p);
  }
  return p;
}

export function useMetamap(disorderId: string | null): RegionScalarMap | null {
  const [state, setState] = useState<{
    id: string;
    map: RegionScalarMap | null;
  } | null>(null);

  useEffect(() => {
    if (!disorderId) return;
    let alive = true;
    load(disorderId).then((map) => {
      if (alive) setState({ id: disorderId, map });
    });
    return () => {
      alive = false;
    };
  }, [disorderId]);

  return state?.id === disorderId ? state.map : null;
}
