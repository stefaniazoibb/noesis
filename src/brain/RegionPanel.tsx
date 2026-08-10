"use client";

import Link from "next/link";
import { useVizStore } from "@/state/vizStore";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder, getModalities } from "@/lib/repo/entities";
import { getEvidenceIndex, getStudy } from "@/lib/repo/evidence";
import { EVIDENCE_LEVEL_LABEL } from "@/lib/evidence/metrics";
import { StudyListItem } from "@/evidence/StudyListItem";
import { useEvidenceFilters } from "./useOverlay";

const HEMI_LABEL = { left: "Left hemisphere", right: "Right hemisphere", midline: "Midline" };
const KIND_LABEL = { cortical: "Cortical region", subcortical: "Subcortical structure" };

export function RegionPanel() {
  const selectedId = useVizStore((s) => s.selectedRegion);
  const filters = useEvidenceFilters();
  const region = selectedId ? getRegion(selectedId) : undefined;

  if (!region) {
    return (
      <aside className="pointer-events-auto w-80 rounded-lg border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur">
        <p className="text-sm text-zinc-400">
          Rotate, zoom, and hover to explore the atlas. Click a region to
          inspect its evidence.
        </p>
      </aside>
    );
  }

  const groups = getEvidenceIndex().byRegion(region.id, filters);
  const allModalities = getModalities();

  return (
    <aside className="pointer-events-auto flex max-h-[70vh] w-96 flex-col rounded-lg border border-zinc-800 bg-zinc-950/85 backdrop-blur">
      <div className="border-b border-zinc-800/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">{region.name}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {HEMI_LABEL[region.hemisphere]} · {KIND_LABEL[region.kind]} ·{" "}
              <span className="capitalize">{region.system.replace(/_/g, " ")}</span>
            </p>
          </div>
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: region.color }}
            aria-hidden
          />
        </div>
        <Link
          href="/ml"
          className="mt-2 inline-block text-[11px] text-zinc-500 underline decoration-zinc-700 hover:text-zinc-300"
        >
          View in representation space →
        </Link>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {groups.length === 0 && (
          <p className="text-sm text-zinc-500">
            No indexed evidence links this region to a disorder
            {filters.modalities.length > 0 ? " under the active filters" : ""}.
            The corpus is curated and small — absence of evidence here is not
            evidence of absence.
          </p>
        )}
        {groups.map((g) => {
          const disorder = getDisorder(g.disorder);
          const byStudy = new Map<string, string[]>();
          for (const a of g.assertions) {
            const list = byStudy.get(a.studyId) ?? [];
            if (!list.includes(a.statement)) list.push(a.statement);
            byStudy.set(a.studyId, list);
          }
          return (
            <section key={g.disorder}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm text-zinc-100">
                  {disorder?.name ?? g.disorder}
                </h3>
                <span
                  className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
                  title="Rule-based label computed from the indexed corpus — see docs/METRICS.md"
                >
                  {EVIDENCE_LEVEL_LABEL[g.level]}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {g.studyIds.length}{" "}
                {g.studyIds.length === 1 ? "study" : "studies"} ·{" "}
                {allModalities
                  .map((m) =>
                    g.modalities.includes(m.id)
                      ? `${m.abbreviation} ✓`
                      : `${m.abbreviation} —`,
                  )
                  .join("  ")}
              </p>
              <ul className="mt-2 space-y-2">
                {[...byStudy.entries()].map(([studyId, statements]) => {
                  const study = getStudy(studyId);
                  return study ? (
                    <StudyListItem
                      key={studyId}
                      study={study}
                      statements={statements}
                    />
                  ) : null;
                })}
              </ul>
            </section>
          );
        })}
        <p className="border-t border-zinc-800/70 pt-2 text-[10px] leading-relaxed text-zinc-600">
          Associations reflect the indexed studies above (each with DOI/PMID) —
          they do not establish causation or diagnosis.
        </p>
      </div>
    </aside>
  );
}
