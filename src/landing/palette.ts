import type { Region } from "@/lib/schemas";

/** Sober, ink-like system palette for the landing "systems" step only. */
export const SYSTEM_STYLE: Record<string, { label: string; color: string }> = {
  frontal: { label: "Frontal", color: "#c9a46a" },
  temporal: { label: "Temporal", color: "#6fa9b4" },
  parietal: { label: "Parietal", color: "#8f9fbf" },
  occipital: { label: "Occipital", color: "#8c9a6e" },
  cingulate: { label: "Cingulate", color: "#b07f74" },
  insula: { label: "Insula", color: "#d8c08e" },
  limbic: { label: "Limbic", color: "#9a7fa6" },
  basal_ganglia: { label: "Basal ganglia", color: "#6f8f86" },
  diencephalon: { label: "Diencephalon", color: "#a39274" },
  brainstem: { label: "Brainstem", color: "#7a7f88" },
};

/** Canonical DK hue softened toward the cortex's paper tone (atlas plate, not chart). */
export function soften(hex: string, t = 0.38): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const paper = [0xb3, 0xac, 0xa3];
  const mix = (a: number, p: number) =>
    Math.round(a * (1 - t) + p * t).toString(16).padStart(2, "0");
  return `#${mix(r, paper[0])}${mix(g, paper[1])}${mix(b, paper[2])}`;
}

export function atlasPalettes(regions: Region[]) {
  return {
    dkColors: Object.fromEntries(regions.map((r) => [r.id, soften(r.color)])),
    systemColors: Object.fromEntries(
      regions.map((r) => [r.id, SYSTEM_STYLE[r.system]?.color ?? "#7a7f88"]),
    ),
    systems: Object.entries(SYSTEM_STYLE)
      .map(([key, s]) => ({ key, ...s, count: regions.filter((r) => r.system === key).length }))
      .filter((s) => s.count > 0),
  };
}
