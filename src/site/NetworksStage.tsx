"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useNear } from "./useNear";

const ShowcaseBrain = dynamic(() => import("@/landing/ShowcaseBrain"), { ssr: false, loading: () => null });

interface Net {
  id: string;
  name: string;
  color: string;
  regions: string[];
  regionNames: string[];
}

export function NetworksStage({ networks, colors }: { networks: Net[]; colors: Record<string, string> }) {
  const [active, setActive] = useState<string | null>(null);
  const [ref, near] = useNear<HTMLDivElement>();
  const net = networks.find((n) => n.id === active) ?? null;
  const shown = useMemo(
    () => (net ? Object.fromEntries(net.regions.map((r) => [r, net.color])) : colors),
    [net, colors],
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="order-2 px-5 py-8 sm:px-8 lg:order-1 lg:py-10">
        <ul className="space-y-1" aria-label="Yeo 7 networks">
          <li>
            <button
              type="button"
              aria-pressed={active === null}
              onClick={() => setActive(null)}
              className={`w-full rounded-[3px] px-3 py-2 text-left text-[14px] transition-colors ${active === null ? "bg-graphite-2 text-offwhite" : "text-offwhite-2 hover:text-offwhite"}`}
            >
              All seven networks
            </button>
          </li>
          {networks.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                aria-pressed={active === n.id}
                onClick={() => setActive(active === n.id ? null : n.id)}
                className={`flex w-full items-center gap-3 rounded-[3px] px-3 py-2 text-left text-[14px] transition-colors ${active === n.id ? "bg-graphite-2 text-offwhite" : "text-offwhite-2 hover:text-offwhite"}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: n.color }} aria-hidden />
                <span className="flex-1">{n.name}</span>
                <span className="font-mono text-[11px] text-offwhite-3">{n.regions.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-5 min-h-[3.5em] text-[13px] leading-relaxed text-offwhite-2" aria-live="polite">
          {net ? `${net.name}: ${net.regionNames.join(", ")}.` : "Each cortical region takes the colour of the network it overlaps most."}
        </p>
      </div>
      <div ref={ref} className="relative order-1 h-[46vh] min-h-[320px] border-b border-graphite-line lg:order-2 lg:h-[min(72vh,680px)] lg:border-b-0 lg:border-l">
        <div className="absolute inset-0" role="img" aria-label={net ? `Brain with the regions of the ${net.name} highlighted` : "Brain coloured by Yeo 7-network membership"}>
          {near && <ShowcaseBrain colors={shown} distance={1.15} />}
        </div>
      </div>
    </div>
  );
}
