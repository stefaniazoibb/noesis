import { getEvidenceIndex } from "@/lib/repo/evidence";
import { getNetworks } from "@/lib/repo/entities";
import type { EvidenceFilters } from "./metrics";
import { computeProfiles, type ConvergenceProfile } from "./convergence";
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

/**
 * Gaps-mode categories, priority-ordered (a region gets the first that
 * applies across its profiles). Colors: three categorical slots + the status
 * red reserved for the conflict state. Definitions in docs/METRICS.md.
 */
export const GAP_CATEGORIES = [
  {
    key: "conflicting",
    value: 4,
    color: "#e66767",
    label: "Conflicting",
    definition: "same finding type reported with opposite directions",
  },
  {
    key: "convergent",
    value: 3,
    color: "#3987e5",
    label: "Convergent",
    definition: "evidence from ≥2 independent modality categories",
  },
  {
    key: "single_category",
    value: 2,
    color: "#d95926",
    label: "Single category",
    definition: "≥2 studies, all in one modality category",
  },
  {
    key: "single_study",
    value: 1,
    color: "#9085e9",
    label: "Single study",
    definition: "exactly one indexed study",
  },
] as const;

function gapCategoryValue(p: ConvergenceProfile): number {
  if (p.conflicts.length > 0) return 4;
  if (p.modalityCategories.length >= 2) return 3;
  if (p.studyIds.length >= 2) return 2;
  return 1;
}

/** Compare-mode categories: three all-pairs-safe categorical slots. */
export const COMPARE_CATEGORIES = [
  { key: "a_only", value: 1, color: "#3987e5" },
  { key: "b_only", value: 2, color: "#d95926" },
  { key: "shared", value: 3, color: "#199e70" },
] as const;

export interface OverlayResult {
  kind:
    | "counts"
    | "convergence"
    | "gaps"
    | "compare"
    | "network"
    | "metamap"
    | null;
  /** region id -> hex color */
  colors: Map<string, string>;
  /** region id -> metric value */
  values: Map<string, number>;
  max: number;
  /** metric definition carried by artifact-backed overlays (metamap) */
  note?: string;
}

/** Build an overlay from a RegionScalarMap artifact (e.g. NeuroQuery maps). */
export function scalarMapOverlay(map: {
  values: Record<string, number>;
  metricDef: string;
}): OverlayResult {
  const values = new Map(
    Object.entries(map.values).map(([r, v]) => [r, Math.max(0, v)]),
  );
  const max = Math.max(0, ...values.values());
  const colors = new Map(
    [...values.entries()]
      .filter(([, v]) => v > 0)
      .map(([r, v]) => [r, sequentialColor(v, max)] as [string, string]),
  );
  return { kind: "metamap", colors, values, max, note: map.metricDef };
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
  disorders: string[],
  filters: EvidenceFilters,
): OverlayResult {
  const index = getEvidenceIndex();
  const disorder = disorders[0] ?? null;
  if (mode === "network") {
    // identity coloring by primary Yeo network (canonical annot colors)
    const colors = new Map<string, string>();
    const values = new Map<string, number>();
    getNetworks().forEach((n, i) => {
      if (!n.color) return;
      for (const region of n.regions) {
        colors.set(region, n.color);
        values.set(region, i + 1);
      }
    });
    return { kind: "network", colors, values, max: getNetworks().length };
  }
  if (mode === "compare") {
    const [a, b] = disorders;
    if (!a || !b) return EMPTY;
    const inA = new Set(index.studyCounts(a, filters).keys());
    const inB = new Set(index.studyCounts(b, filters).keys());
    const values = new Map<string, number>();
    for (const r of inA) values.set(r, inB.has(r) ? 3 : 1);
    for (const r of inB) if (!inA.has(r)) values.set(r, 2);
    const byValue = new Map<number, string>(
      COMPARE_CATEGORIES.map((c) => [c.value, c.color]),
    );
    const colors = new Map(
      [...values.entries()].map(([r, v]) => [r, byValue.get(v)!]),
    );
    return { kind: "compare", colors, values, max: 3 };
  }
  if (mode === "disorder") {
    const values = index.studyCounts(disorder, filters);
    const max = Math.max(0, ...values.values());
    const colors = new Map(
      [...values.entries()].map(([r, v]) => [r, sequentialColor(v, max)]),
    );
    return { kind: "counts", colors, values, max };
  }
  if (mode === "gaps") {
    const values = new Map<string, number>();
    for (const p of computeProfiles(index, disorder, filters)) {
      values.set(
        p.region,
        Math.max(values.get(p.region) ?? 0, gapCategoryValue(p)),
      );
    }
    const byValue = new Map<number, string>(
      GAP_CATEGORIES.map((c) => [c.value, c.color]),
    );
    const colors = new Map(
      [...values.entries()].map(([r, v]) => [r, byValue.get(v)!]),
    );
    return { kind: "gaps", colors, values, max: 4 };
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
