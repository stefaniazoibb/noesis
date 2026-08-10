"use client";

import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";

const HEMI_LABEL = { left: "Left hemisphere", right: "Right hemisphere", midline: "Midline" };
const KIND_LABEL = { cortical: "Cortical region", subcortical: "Subcortical structure" };

function EvidencePlaceholder({ label }: { label: string }) {
  return (
    <section>
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </h3>
      <p className="mt-1 text-sm text-zinc-500">
        Evidence unavailable — the curated study corpus is ingested in a later
        phase.
      </p>
    </section>
  );
}

export function RegionPanel() {
  const selectedId = useVizStore((s) => s.selectedRegion);
  const region = selectedId ? getRegion(selectedId) : undefined;

  if (!region) {
    return (
      <aside className="pointer-events-auto w-80 rounded-lg border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
        <p className="text-sm text-zinc-400">
          Rotate, zoom, and hover to explore the atlas. Click a region to
          inspect it.
        </p>
      </aside>
    );
  }

  return (
    <aside className="pointer-events-auto w-80 rounded-lg border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">{region.name}</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {HEMI_LABEL[region.hemisphere]} · {KIND_LABEL[region.kind]}
          </p>
        </div>
        <span
          className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: region.color }}
          aria-hidden
        />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Atlas</dt>
          <dd className="text-zinc-300">Desikan-Killiany (fsaverage)</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">System</dt>
          <dd className="capitalize text-zinc-300">
            {region.system.replace(/_/g, " ")}
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-4 border-t border-zinc-800 pt-4">
        <EvidencePlaceholder label="Associated disorders" />
        <EvidencePlaceholder label="Modalities" />
        <EvidencePlaceholder label="Studies" />
      </div>
    </aside>
  );
}
