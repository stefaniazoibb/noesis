"use client";

import { BrainViewer } from "@/brain/BrainViewer";
import { RegionPanel } from "@/brain/RegionPanel";
import { ViewerControls } from "@/brain/ViewerControls";
import { FilterBar } from "@/brain/FilterBar";
import { Legend } from "@/brain/Legend";
import { HoverLabel } from "@/brain/HoverLabel";

export default function BrainPage() {
  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0">
        <BrainViewer />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex max-w-[60%] flex-col items-start gap-2">
            <FilterBar />
            <ViewerControls />
          </div>
          <RegionPanel />
        </div>
        <div className="flex items-end justify-between gap-4">
          <HoverLabel />
          <Legend />
        </div>
      </div>
    </div>
  );
}
