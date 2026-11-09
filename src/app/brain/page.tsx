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
import { RegionSearch } from "@/brain/RegionSearch";
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
      s.requestFocus(region);
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
  const [legendOpen, setLegendOpen] = useState(true);
  return (
    <div className="relative min-h-[34rem] flex-1 overflow-hidden">
      <Suspense fallback={null}>
        <DeepLink />
      </Suspense>
      <div className="absolute inset-0">
        <BrainViewer />
      </div>
      {/* overlay chrome: stacks on narrow screens, floats on wide ones */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 sm:p-4">
        <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-2 lg:max-w-[58%]">
            <FilterBar />
            <ViewerControls />
            <RegionSearch />
          </div>
          <RegionPanel />
        </div>
        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            {assistantOpen && <AssistantPanel variant="drawer" />}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setAssistantOpen((v) => !v)}
                aria-expanded={assistantOpen}
                className="rounded-md border border-line bg-ink-2/85 px-3 py-1.5 text-xs text-text-2 backdrop-blur transition-colors hover:border-text hover:text-text"
              >
                {assistantOpen ? "Close assistant" : "Ask NOĒSIS"}
              </button>
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                aria-expanded={legendOpen}
                className="rounded-md border border-line bg-ink-2/85 px-3 py-1.5 text-xs text-text-2 backdrop-blur transition-colors hover:text-text sm:hidden"
              >
                {legendOpen ? "Hide legend" : "Legend"}
              </button>
              <HoverLabel />
            </div>
          </div>
          <div className={legendOpen ? "pointer-events-none flex justify-end" : "hidden sm:flex sm:justify-end"}>
            <Legend />
          </div>
        </div>
      </div>
    </div>
  );
}
