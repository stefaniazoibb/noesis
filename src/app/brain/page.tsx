"use client";

import { BrainViewer } from "@/brain/BrainViewer";
import { RegionPanel } from "@/brain/RegionPanel";
import { ViewerControls } from "@/brain/ViewerControls";
import { HoverLabel } from "@/brain/HoverLabel";

export default function BrainPage() {
  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0">
        <BrainViewer />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-4">
          <ViewerControls />
          <RegionPanel />
        </div>
        <div className="flex items-end justify-between gap-4">
          <HoverLabel />
          <span className="pointer-events-none rounded bg-zinc-950/60 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-600">
            Anatomical mode · Desikan-Killiany (fsaverage)
          </span>
        </div>
      </div>
    </div>
  );
}
