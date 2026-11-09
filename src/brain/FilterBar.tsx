"use client";

import { useVizStore } from "@/state/vizStore";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import type { VizMode } from "@/lib/schemas";

const MODES: { mode: VizMode; label: string }[] = [
  { mode: "anatomical", label: "Anatomy" },
  { mode: "disorder", label: "Evidence" },
  { mode: "convergence", label: "Convergence" },
  { mode: "gaps", label: "Gaps" },
  { mode: "compare", label: "Compare" },
  { mode: "metamap", label: "Meta-map" },
  { mode: "morphomap", label: "Morphometry" },
  { mode: "network", label: "Networks" },
];

export function FilterBar() {
  const mode = useVizStore((s) => s.mode);
  const setMode = useVizStore((s) => s.setMode);
  const activeDisorder = useVizStore((s) => s.disorders[0] ?? "");
  const secondDisorder = useVizStore((s) => s.disorders[1] ?? "");
  const setActiveDisorder = useVizStore((s) => s.setActiveDisorder);
  const applyPatch = useVizStore((s) => s.applyPatch);
  const selectedModalities = useVizStore((s) => s.modalities);
  const toggleModality = useVizStore((s) => s.toggleModality);

  const evidenceMode =
    mode === "disorder" ||
    mode === "convergence" ||
    mode === "gaps" ||
    mode === "compare" ||
    mode === "metamap" ||
    mode === "morphomap";
  // modality/year filters act on the curated corpus, not on model- or
  // data-derived maps
  const corpusFilters =
    evidenceMode && mode !== "metamap" && mode !== "morphomap";

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 p-1.5 backdrop-blur">
      <span className="px-1 font-mono text-[10px] text-zinc-500">
        Mode
      </span>
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          aria-pressed={mode === m.mode}
          onClick={() => setMode(m.mode)}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            mode === m.mode
              ? "bg-zinc-700/80 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
          }`}
        >
          {m.label}
        </button>
      ))}
      {evidenceMode && (
        <>
          <span className="mx-1 h-4 w-px bg-zinc-800" aria-hidden />
          <select
            value={activeDisorder}
            onChange={(e) =>
              mode === "compare"
                ? applyPatch({
                    disorders: [e.target.value, secondDisorder].filter(Boolean),
                  })
                : setActiveDisorder(e.target.value || null)
            }
            aria-label="Disorder"
            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
          >
            <option value="">
              {mode === "compare" ? "First disorder…" : "All indexed disorders"}
            </option>
            {getDisorders().map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {mode === "compare" && (
            <select
              value={secondDisorder}
              onChange={(e) =>
                applyPatch({
                  disorders: [activeDisorder, e.target.value].filter(Boolean),
                })
              }
              aria-label="Second disorder"
              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            >
              <option value="">Second disorder…</option>
              {getDisorders()
                .filter((d) => d.id !== activeDisorder)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          )}
          {corpusFilters && (
            <span className="mx-1 h-4 w-px bg-zinc-800" aria-hidden />
          )}
          {corpusFilters &&
            getModalities().map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-1 px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              title={`${m.name}. Leave all unchecked to include every modality`}
            >
              <input
                type="checkbox"
                checked={selectedModalities.includes(m.id)}
                onChange={() => toggleModality(m.id)}
                className="accent-zinc-400"
              />
              {m.abbreviation}
            </label>
          ))}
        </>
      )}
    </div>
  );
}
