"use client";

import type { Loadings } from "@/lib/ml/embeddings";
import { featureLabel } from "./labels";

/** Interpretability: what the first PCA axes are made of. */
export function LoadingsPanel({ loadings }: { loadings: Loadings | null }) {
  if (!loadings) return null;
  return (
    <details open className="rounded-[4px] border border-line bg-ink-2/70 p-4">
      <summary className="cursor-pointer text-xs font-medium text-zinc-300">
        What do the PCA axes mean?
      </summary>
      <div className="mt-2 space-y-3">
        {loadings.components.slice(0, 2).map((c) => (
          <div key={c.index}>
            <p className="text-[11px] text-zinc-400">
              PC{c.index + 1}: {(c.explainedVarianceRatio * 100).toFixed(0)}%
              of variance. Strongest features:
            </p>
            <ul className="mt-1 space-y-0.5">
              {c.topFeatures.slice(0, 5).map((f) => (
                <li
                  key={f.feature}
                  className="flex items-baseline justify-between gap-2 text-[11px] text-zinc-500"
                >
                  <span>{featureLabel(f.feature)}</span>
                  <span className="shrink-0 tabular-nums">
                    {f.loading > 0 ? "+" : ""}
                    {f.loading.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[10px] text-zinc-600">
          UMAP axes have no such interpretation; only neighborhood structure
          is meaningful there, and 2D projections can distort distances.
        </p>
      </div>
    </details>
  );
}
