"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PickerDisorder, SourceRef } from "./data";
import { useNear } from "./useNear";

const ShowcaseBrain = dynamic(() => import("@/landing/ShowcaseBrain"), {
  ssr: false,
  loading: () => null,
});

const LEVEL_TEXT: Record<string, { label: string; rule: string }> = {
  strong: { label: "Strong", rule: "3 or more studies and 2 or more independent method categories" },
  moderate: { label: "Moderate", rule: "2 or more studies" },
  emerging: { label: "Emerging", rule: "a single study" },
  mixed: { label: "Mixed", rule: "studies report opposite directions for the same finding" },
};

const DIR: Record<string, string> = { increased: "▲ increased", decreased: "▼ decreased" };

function LevelBar({ level }: { level: string }) {
  const n = { emerging: 1, moderate: 2, strong: 3, mixed: 0 }[level] ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-1.5 ${level === "mixed" ? "bg-conflict-light/80" : i <= n ? "bg-offwhite" : "bg-graphite-line"}`}
        />
      ))}
    </span>
  );
}

export function DisorderPicker({
  disorders,
  sources,
  ramp,
  regionCount,
}: {
  disorders: PickerDisorder[];
  sources: Record<string, SourceRef>;
  ramp: string[];
  regionCount: number;
}) {
  const [id, setId] = useState(disorders[0]?.id);
  const [region, setRegion] = useState<string | null>(null);
  const [stageRef, near] = useNear<HTMLDivElement>();
  const d = disorders.find((x) => x.id === id) ?? disorders[0];
  const pair = useMemo(() => d.pairs.find((p) => p.region === region) ?? null, [d, region]);
  const pickedName = region && !pair ? region : null;

  const choose = (next: string) => {
    setId(next);
    setRegion(null);
  };

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* stage */}
      <div ref={stageRef} className="relative h-[52vh] min-h-[340px] border-b border-graphite-line lg:h-[min(78vh,760px)] lg:border-b-0 lg:border-r">
        <div
          className="absolute inset-0"
          role="img"
          aria-label={`3D brain shaded by the number of indexed studies linking each region to ${d.name}. ${d.pairs.length} of ${regionCount} regions carry at least one finding.`}
        >
          {near && (
            <ShowcaseBrain
              colors={d.colors}
              selected={region}
              onPick={(r) => setRegion(r)}
              distance={1.15}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-5 bottom-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-offwhite-3">
          <span>Indexed studies per region, {d.name}</span>
          <span className="inline-flex items-center gap-1">
            {ramp.map((c) => (
              <span key={c} className="inline-block h-2 w-4" style={{ backgroundColor: c }} aria-hidden />
            ))}
            <span className="ml-1">1 to {d.max}</span>
          </span>
          <span>Unshaded: no indexed finding</span>
        </div>
      </div>

      {/* reading panel */}
      <div className="flex min-w-0 flex-col px-5 py-8 sm:px-8 lg:max-h-[min(78vh,760px)] lg:overflow-y-auto lg:py-10">
        <label htmlFor="disorder-select" className="font-mono text-[11px] text-offwhite-3">
          Disorder
        </label>
        <div
          role="radiogroup"
          aria-label="Choose a disorder"
          className="snap-strip -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
        >
          {disorders.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={x.id === d.id}
              onClick={() => choose(x.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                x.id === d.id
                  ? "border-offwhite bg-offwhite text-graphite"
                  : "border-graphite-line text-offwhite-2 hover:border-offwhite-3 hover:text-offwhite"
              }`}
            >
              {x.name}
            </button>
          ))}
        </div>
        {/* native select mirrors the chips for keyboard and screen-reader users */}
        <select
          id="disorder-select"
          value={d.id}
          onChange={(e) => choose(e.target.value)}
          className="sr-only"
        >
          {disorders.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>

        <h3 className="mt-8 text-[30px] font-medium leading-tight tracking-[-0.02em] text-offwhite sm:text-[36px]">{d.name}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-offwhite-2">
          {d.studies} indexed {d.studies === 1 ? "study" : "studies"} implicate {d.pairs.length}{" "}
          {d.pairs.length === 1 ? "region" : "regions"}. Select a region on the brain or in the list.
        </p>

        {pair ? (
          <div className="mt-6 rounded-[4px] border border-graphite-line bg-graphite-2 p-5" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-medium text-offwhite">{pair.regionName}</p>
                <p className="mt-1 flex items-center gap-2 text-[12px] text-offwhite-2">
                  <LevelBar level={pair.level} /> {LEVEL_TEXT[pair.level].label}: {LEVEL_TEXT[pair.level].rule}
                </p>
              </div>
              <button type="button" onClick={() => setRegion(null)} className="text-[12px] text-offwhite-3 hover:text-offwhite" aria-label="Back to the region list">
                ✕
              </button>
            </div>
            <ul className="mt-4 space-y-4">
              {pair.assertions.map((a, i) => {
                const s = sources[a.studyId];
                return (
                  <li key={i} className="border-l border-graphite-line pl-3">
                    <p className="text-[14px] leading-snug text-offwhite">{a.statement}</p>
                    <p className="mt-1.5 font-mono text-[11px] text-offwhite-3">
                      {a.modality} · {a.findingType.replace(/_/g, " ")}
                      {a.direction && DIR[a.direction] ? ` · ${DIR[a.direction]}` : ""}
                    </p>
                    <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-offwhite-2 underline decoration-graphite-line underline-offset-4 hover:text-offwhite">
                      {s.label}, {s.journal}
                      {s.doi ? ` · DOI ${s.doi}` : s.pmid ? ` · PMID ${s.pmid}` : ""}
                    </a>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/brain?region=${pair.region}&disorder=${d.id}&mode=disorder`}
              className="mt-5 inline-block text-[13px] font-medium text-offwhite underline underline-offset-4"
            >
              Open this region in the atlas
            </Link>
          </div>
        ) : (
          <>
            {pickedName && (
              <p className="mt-6 text-[13px] text-offwhite-2" aria-live="polite">
                No indexed finding links this region to {d.name}. Absence in a curated corpus is not evidence of absence.
              </p>
            )}
            <ol className="mt-6 divide-y divide-graphite-line border-y border-graphite-line">
              {d.pairs.slice(0, 10).map((p) => (
                <li key={p.region}>
                  <button
                    type="button"
                    onClick={() => setRegion(p.region)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-graphite-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] text-offwhite">{p.regionName}</span>
                    <span className="shrink-0 font-mono text-[11px] text-offwhite-3">{p.modalities.join(", ")}</span>
                    <LevelBar level={p.level} />
                    <span className="w-16 shrink-0 text-right font-mono text-[12px] text-offwhite-2">
                      {p.studies} {p.studies === 1 ? "study" : "studies"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {d.pairs.length > 10 && (
              <p className="mt-2 text-[12px] text-offwhite-3">
                {d.pairs.length - 10} more on the brain and in the{" "}
                <Link href={`/disorders/${d.id}`} className="underline underline-offset-4 hover:text-offwhite">
                  {d.name} page
                </Link>
                .
              </p>
            )}
          </>
        )}

        <details className="site-details mt-8 border-t border-graphite-line pt-4">
          <summary className="flex items-center justify-between text-[13px] text-offwhite-2 hover:text-offwhite">
            How to read the evidence levels
            <span className="site-details-sign text-[16px]" aria-hidden>+</span>
          </summary>
          <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-offwhite-3">
            {Object.entries(LEVEL_TEXT).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <LevelBar level={k} />
                <span>
                  <span className="text-offwhite-2">{v.label}:</span> {v.rule}.
                </span>
              </li>
            ))}
            <li>
              Levels are rule-based summaries of the indexed corpus (docs/METRICS.md). They describe how much
              evidence is indexed, not effect size, and an association is not a cause.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
