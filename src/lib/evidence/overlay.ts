import { getEvidenceIndex } from "@/lib/repo/evidence";
import type { EvidenceFilters } from "./metrics";
import type { VizMode } from "@/lib/schemas";

/**
 * Overlay palette: dataviz reference sequential blue ramp. On the dark scene
 * low values recede (dark blue) and high values pop (light blue).
 */
const SEQ = [
  "#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6",
  "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4",
];

/** Ordinal steps for convergence counts 1..4 (dark-surface bounds respected). */
export const CONVERGENCE_COLORS: Record<number, string> = {
  1: "#184f95",
  2: "#2a78d6",
  3: "#6da7ec",
  4: "#b7d3f6",
};

export function sequentialColor(value: number, max: number): string {
  if (max <= 0) return SEQ[0];
  const t = Math.min(1, value / max);
  return SEQ[Math.round(t * (SEQ.length - 1))];
}

export interface OverlayResult {
  kind: "counts" | "convergence" | null;
  /** region id -> hex color */
  colors: Map<string, string>;
  /** region id -> metric value */
  values: Map<string, number>;
  max: number;
}

const EMPTY: OverlayResult = {
  kind: null,
  colors: new Map(),
  values: new Map(),
  max: 0,
};

/**
 * The single source of overlay colors — cortex shader, subcortical meshes and
 * the legend all consume this so they can never disagree.
 */
export function computeOverlay(
  mode: VizMode,
  disorder: string | null,
  filters: EvidenceFilters,
): OverlayResult {
  const index = getEvidenceIndex();
  if (mode === "disorder") {
    const values = index.studyCounts(disorder, filters);
    const max = Math.max(0, ...values.values());
    const colors = new Map(
      [...values.entries()].map(([r, v]) => [r, sequentialColor(v, max)]),
    );
    return { kind: "counts", colors, values, max };
  }
  if (mode === "convergence") {
    const values = index.convergence(disorder, filters);
    const max = Math.max(0, ...values.values());
    const colors = new Map(
      [...values.entries()].map(([r, v]) => [
        r,
        CONVERGENCE_COLORS[Math.min(v, 4)] ?? CONVERGENCE_COLORS[4],
      ]),
    );
    return { kind: "convergence", colors, values, max };
  }
  return EMPTY;
}

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
