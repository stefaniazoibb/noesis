"use client";

import { useMemo } from "react";
import { useVizStore } from "@/state/vizStore";
import {
  computeOverlay,
  scalarMapOverlay,
  divergingScalarMapOverlay,
  type OverlayResult,
} from "@/lib/evidence/overlay";
import { useScalarMap } from "@/lib/ml/metamaps";
import type { EvidenceFilters } from "@/lib/evidence/metrics";

export function useEvidenceFilters(): EvidenceFilters {
  const modalities = useVizStore((s) => s.modalities);
  const yearMin = useVizStore((s) => s.filters.yearMin);
  const yearMax = useVizStore((s) => s.filters.yearMax);
  return useMemo(
    () => ({ modalities, yearMin, yearMax }),
    [modalities, yearMin, yearMax],
  );
}

const EMPTY: OverlayResult = {
  kind: null,
  colors: new Map(),
  values: new Map(),
  max: 0,
};

/** Shared overlay result — cortex shader, subcortex meshes and legend all use this. */
export function useOverlayResult(): OverlayResult {
  const mode = useVizStore((s) => s.mode);
  const disorders = useVizStore((s) => s.disorders);
  const filters = useEvidenceFilters();
  // artifact-backed overlays come from fetched RegionScalarMap files
  const metamap = useScalarMap(
    "metamaps",
    mode === "metamap" ? (disorders[0] ?? null) : null,
  );
  const morphomap = useScalarMap(
    "morphomaps",
    mode === "morphomap" ? (disorders[0] ?? null) : null,
  );
  return useMemo(() => {
    if (mode === "metamap") {
      return metamap ? scalarMapOverlay(metamap) : EMPTY;
    }
    if (mode === "morphomap") {
      return morphomap ? divergingScalarMapOverlay(morphomap) : EMPTY;
    }
    return computeOverlay(mode, disorders, filters);
  }, [mode, disorders, filters, metamap, morphomap]);
}
