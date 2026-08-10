"use client";

import { useVizStore } from "@/state/vizStore";
import { getDisorder } from "@/lib/repo/entities";
import { useOverlayResult } from "./useOverlay";
import {
  sequentialColor,
  CONVERGENCE_COLORS,
  GAP_CATEGORIES,
} from "@/lib/evidence/overlay";

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[11px] text-zinc-400">{label}</span>
    </span>
  );
}

export function Legend() {
  const mode = useVizStore((s) => s.mode);
  const disorderId = useVizStore((s) => s.disorders[0] ?? null);
  const overlay = useOverlayResult();

  if (mode === "anatomical") {
    return (
      <span className="pointer-events-none rounded bg-zinc-950/60 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-600">
        Anatomical mode · Desikan-Killiany (fsaverage)
      </span>
    );
  }

  const scope = disorderId
    ? (getDisorder(disorderId)?.name ?? disorderId)
    : "all indexed disorders";

  return (
    <div className="pointer-events-auto max-w-sm rounded-lg border border-zinc-800 bg-zinc-950/85 p-3 backdrop-blur">
      {overlay.kind === "counts" && (
        <>
          <h3 className="text-xs font-medium text-zinc-200">
            Evidence density — {scope}
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Number of distinct indexed studies with at least one finding
            linking the region to {scope}, after active filters (definition:
            docs/METRICS.md).
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {overlay.max > 0 ? (
              Array.from({ length: Math.min(overlay.max, 6) }, (_, i) => {
                const v =
                  overlay.max <= 6
                    ? i + 1
                    : Math.round(((i + 1) / 6) * overlay.max);
                return (
                  <Swatch
                    key={v}
                    color={sequentialColor(v, overlay.max)}
                    label={`${v}`}
                  />
                );
              })
            ) : (
              <span className="text-[11px] text-zinc-500">
                No indexed evidence matches the current filters.
              </span>
            )}
          </div>
        </>
      )}
      {overlay.kind === "convergence" && (
        <>
          <h3 className="text-xs font-medium text-zinc-200">
            Cross-modal convergence — {scope}
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Number of independent modality categories (imaging,
            electrophysiology, stimulation) with indexed evidence for the
            region. Two imaging modalities count once (definition:
            docs/METRICS.md).
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {overlay.max > 0 ? (
              Array.from({ length: Math.min(overlay.max, 4) }, (_, i) => (
                <Swatch
                  key={i + 1}
                  color={CONVERGENCE_COLORS[i + 1]}
                  label={`${i + 1} ${i === 0 ? "category" : "categories"}`}
                />
              ))
            ) : (
              <span className="text-[11px] text-zinc-500">
                No indexed evidence matches the current filters.
              </span>
            )}
          </div>
        </>
      )}
      {overlay.kind === "gaps" && (
        <>
          <h3 className="text-xs font-medium text-zinc-200">
            Evidence structure — {scope}
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Each region is classified by the structure of its indexed
            evidence, highest-priority category first (definitions:
            docs/METRICS.md).
          </p>
          <div className="mt-2 space-y-1">
            {GAP_CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-baseline gap-1.5">
                <span
                  className="inline-block h-3 w-3 shrink-0 self-center rounded-sm"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <span className="text-[11px] text-zinc-400">
                  {c.label}
                  <span className="text-zinc-600"> — {c.definition}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-2 border-t border-zinc-800/70 pt-1.5 text-[10px] text-zinc-600">
        Indexed corpus only ({overlay.values.size} regions with evidence) —
        curated, not a systematic review.
        {overlay.kind === "gaps" &&
          " A gap here may be a curation gap, not a gap in the literature."}
      </p>
    </div>
  );
}
