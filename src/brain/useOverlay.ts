"use client";

import { useMemo } from "react";
import { useVizStore } from "@/state/vizStore";
import {
  computeOverlay,
  scalarMapOverlay,
  type OverlayResult,
} from "@/lib/evidence/overlay";
import { useMetamap } from "@/lib/ml/metamaps";
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

/** Shared overlay result — cortex shader, subcortex meshes and legend all use this. */
export function useOverlayResult(): OverlayResult {
  const mode = useVizStore((s) => s.mode);
  const disorders = useVizStore((s) => s.disorders);
  const filters = useEvidenceFilters();
  // metamap overlays come from fetched RegionScalarMap artifacts
  const metamap = useMetamap(
    mode === "metamap" ? (disorders[0] ?? null) : null,
  );
  return useMemo(() => {
    if (mode === "metamap") {
      return metamap
        ? scalarMapOverlay(metamap)
        : { kind: null, colors: new Map(), values: new Map(), max: 0 };
    }
    return computeOverlay(mode, disorders, filters);
  }, [mode, disorders, filters, metamap]);
}
