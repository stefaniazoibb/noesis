"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder, getModality } from "@/lib/repo/entities";
import { VizModeSchema } from "@/lib/schemas";
import { BrainViewer } from "@/brain/BrainViewer";
import { RegionPanel } from "@/brain/RegionPanel";
import { ViewerControls } from "@/brain/ViewerControls";
import { FilterBar } from "@/brain/FilterBar";
import { Legend } from "@/brain/Legend";
import { HoverLabel } from "@/brain/HoverLabel";
import { AssistantPanel } from "@/components/AssistantPanel";

/** Applies ?region= / ?disorder= / ?mode= / ?modality= once on mount, so
 *  search results and disorder pages can deep-link into a viz state. */
function DeepLink() {
  const params = useSearchParams();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const s = useVizStore.getState();
    const region = params.get("region");
    const disorder = params.get("disorder");
    const disorder2 = params.get("disorder2");
    const modality = params.get("modality");
    const mode = VizModeSchema.safeParse(params.get("mode"));

    if (region && getRegion(region)) {
      s.selectRegion(region);
      if (region.startsWith("sub_")) s.setShowSubcortical(true);
    }
    if (disorder && getDisorder(disorder)) {
      if (disorder2 && getDisorder(disorder2)) {
        s.applyPatch({
          disorders: [disorder, disorder2],
          mode: mode.success ? mode.data : "compare",
        });
      } else {
        s.setActiveDisorder(disorder);
        s.setMode(mode.success ? mode.data : "disorder");
      }
    } else if (mode.success) {
      s.setMode(mode.data);
    }
    if (modality && getModality(modality)) {
      s.applyPatch({ modalities: [modality] });
    }
  }, [params]);
  return null;
}

export default function BrainPage() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  return (
    <div className="relative min-h-0 flex-1">
      <Suspense fallback={null}>
        <DeepLink />
      </Suspense>
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
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            {assistantOpen && <AssistantPanel variant="drawer" />}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setAssistantOpen((v) => !v)}
                aria-expanded={assistantOpen}
                className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur transition-colors hover:border-zinc-700 hover:text-zinc-100"
              >
                {assistantOpen ? "Close assistant" : "Assistant"}
              </button>
              <HoverLabel />
            </div>
          </div>
          <Legend />
        </div>
      </div>
    </div>
  );
}
