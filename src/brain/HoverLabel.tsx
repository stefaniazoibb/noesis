"use client";

import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";

export function HoverLabel() {
  const hoverId = useVizStore((s) => s.hoverRegion);
  const region = hoverId ? getRegion(hoverId) : undefined;
  if (!region) return null;
  return (
    <div className="pointer-events-none rounded border border-zinc-800 bg-zinc-950/85 px-3 py-1.5 text-sm text-zinc-200 backdrop-blur">
      {region.name}
      <span className="ml-2 text-xs text-zinc-500">
        {region.hemisphere === "midline" ? "midline" : `${region.hemisphere} hemisphere`}
      </span>
    </div>
  );
}
