"use client";

import { useMemo } from "react";
import { useVizStore } from "@/state/vizStore";
import { computeOverlay, type OverlayResult } from "@/lib/evidence/overlay";
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
  const disorder = useVizStore((s) => s.disorders[0] ?? null);
  const filters = useEvidenceFilters();
  return useMemo(
    () => computeOverlay(mode, disorder, filters),
    [mode, disorder, filters],
  );
}
