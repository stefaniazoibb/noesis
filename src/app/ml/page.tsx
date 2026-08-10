"use client";

import { useEffect, useMemo, useState } from "react";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder } from "@/lib/repo/entities";
import { getStudy } from "@/lib/repo/evidence";
import {
  loadEmbeddingSet,
  type EmbeddingEntity,
  type EmbeddingSet,
} from "@/lib/ml/embeddings";
import { useVizStore } from "@/state/vizStore";
import { Scatter, type ScatterCategory, type ScatterPoint } from "@/ml/Scatter";
import { DetailPanel } from "@/ml/DetailPanel";
import { LoadingsPanel } from "@/ml/LoadingsPanel";
import { entityLabel, modalityCategoryOf } from "@/ml/labels";

const ENTITIES: { key: EmbeddingEntity; label: string }[] = [
  { key: "region", label: "Regions" },
  { key: "disorder", label: "Disorders" },
  { key: "study", label: "Studies" },
];

// dark-mode categorical slots from the validated reference palette
const SLOT = ["#3987e5", "#d95926", "#199e70"];

const CATEGORIES: Record<EmbeddingEntity, ScatterCategory[]> = {
  region: [
    { key: "cortical", label: "Cortical", color: SLOT[0] },
    { key: "subcortical", label: "Subcortical", color: SLOT[1] },
  ],
  disorder: [
    { key: "psychiatric", label: "Psychiatric", color: SLOT[0] },
    { key: "neurodegenerative", label: "Neurodegenerative", color: SLOT[1] },
  ],
  study: [
    { key: "imaging", label: "Imaging", color: SLOT[0] },
    { key: "electrophysiology", label: "Electrophysiology", color: SLOT[1] },
    { key: "stimulation", label: "Stimulation", color: SLOT[2] },
  ],
};

function categoryOf(entity: EmbeddingEntity, id: string): string {
  if (entity === "region") return getRegion(id)?.kind ?? "cortical";
  if (entity === "disorder") return getDisorder(id)?.category ?? "psychiatric";
  const s = getStudy(id);
  return s ? modalityCategoryOf(s.modalities[0]) : "imaging";
}

interface Loaded {
  entity: EmbeddingEntity;
  set: EmbeddingSet | null;
  error: string | null;
}

export default function MlPage() {
  const [entity, setEntity] = useState<EmbeddingEntity>("region");
  const [projectionChoice, setProjectionChoice] = useState<string>("umap");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // brain -> representation-space bridge: arriving from the 3D brain with a
  // selected region opens that region here (navigation remounts this page)
  const [selected, setSelected] = useState<string | null>(
    () => useVizStore.getState().selectedRegion,
  );

  useEffect(() => {
    let alive = true;
    loadEmbeddingSet(entity).then(
      (s) => alive && setLoaded({ entity, set: s, error: null }),
      (e) => alive && setLoaded({ entity, set: null, error: String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [entity]);

  const set = loaded?.entity === entity ? loaded.set : null;
  const error = loaded?.entity === entity ? loaded.error : null;
  const projection =
    set && !set.manifest.projections[projectionChoice] ? "pca" : projectionChoice;

  const points: ScatterPoint[] = useMemo(() => {
    if (!set) return [];
    const proj = set.manifest.projections[projection];
    if (!proj) return [];
    return set.manifest.ids.map((id, i) => ({
      id,
      label: entityLabel(entity, id),
      x: proj[i][0],
      y: proj[i][1],
      category: categoryOf(entity, id),
    }));
  }, [set, projection, entity]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-light tracking-wide text-zinc-100">
          Representation space
        </h1>
        <p className="text-xs text-zinc-500">
          Learned evidence-space representation — not anatomical distance.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            type="button"
            aria-pressed={entity === e.key}
            onClick={() => {
              setEntity(e.key);
              setSelected(null);
            }}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              entity === e.key
                ? "bg-zinc-700/80 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            }`}
          >
            {e.label}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-zinc-800" aria-hidden />
        {["umap", "pca"].map((p) => {
          const available = !!set?.manifest.projections[p];
          return (
            <button
              key={p}
              type="button"
              disabled={!available}
              aria-pressed={projection === p}
              onClick={() => setProjectionChoice(p)}
              title={
                available ? undefined : "Not computed for this entity (too few points)"
              }
              className={`rounded px-2.5 py-1 text-xs uppercase transition-colors ${
                projection === p && available
                  ? "bg-zinc-700/80 text-zinc-100"
                  : available
                    ? "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                    : "cursor-not-allowed text-zinc-700"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-sm text-amber-600/90">
          Embedding artifacts could not be loaded ({error}). Run{" "}
          <code className="text-zinc-400">
            pipeline/embeddings/build_representation.py
          </code>{" "}
          to generate them.
        </p>
      )}
      {!set && !error && (
        <p className="mt-6 text-sm text-zinc-500">Loading embeddings…</p>
      )}

      {set && (
        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <Scatter
              points={points}
              categories={CATEGORIES[entity]}
              selectedId={selected}
              onSelect={setSelected}
              directLabels={entity === "disorder"}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              {set.manifest.method} · corpus {set.manifest.corpusVersion} ·
              built {set.manifest.created}. Positions derive from the indexed
              evidence corpus (curated, not a systematic review); 2D
              projections can distort distances.
            </p>
          </div>
          <aside className="w-full shrink-0 space-y-3 lg:w-80">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <DetailPanel
                entity={entity}
                set={set}
                selectedId={selected}
                onSelect={setSelected}
              />
            </div>
            <LoadingsPanel loadings={set.loadings} />
          </aside>
        </div>
      )}
    </main>
  );
}
