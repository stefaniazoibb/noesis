"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder } from "@/lib/repo/entities";
import { getStudy } from "@/lib/repo/evidence";
import {
  loadEmbeddingSet,
  type EmbeddingEntity,
  type EmbeddingSet,
} from "@/lib/ml/embeddings";
import { getAssertions } from "@/lib/repo/evidence";
import { useVizStore } from "@/state/vizStore";
import { Scatter, type ScatterCategory, type ScatterPoint } from "@/ml/Scatter";
import { DetailPanel } from "@/ml/DetailPanel";
import { LoadingsPanel } from "@/ml/LoadingsPanel";
import { entityLabel, modalityCategoryOf } from "@/ml/labels";
import { PageHeader, Panel, Segmented } from "@/components/PageHeader";

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
  const [query, setQuery] = useState("");
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

  // per-point evidence-count cue: sparse-evidence entities cluster by
  // evidence structure, so point size shows how much indexed evidence
  // backs each position (distinct studies; radius ∝ sqrt(count))
  const studyCounts = useMemo(() => {
    const byDisorder = new Map<string, Set<string>>();
    const byRegion = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, key: string, study: string) => {
      const set = map.get(key) ?? new Set<string>();
      set.add(study);
      map.set(key, set);
    };
    for (const a of getAssertions()) {
      add(byDisorder, a.disorder, a.studyId);
      add(byRegion, a.region, a.studyId);
    }
    return { byDisorder, byRegion };
  }, []);

  const points: ScatterPoint[] = useMemo(() => {
    if (!set) return [];
    const proj = set.manifest.projections[projection];
    if (!proj) return [];
    const countOf = (id: string) =>
      entity === "disorder"
        ? (studyCounts.byDisorder.get(id)?.size ?? 0)
        : entity === "region"
          ? (studyCounts.byRegion.get(id)?.size ?? 0)
          : null;
    return set.manifest.ids.map((id, i) => {
      const n = countOf(id);
      return {
        id,
        label:
          n === null
            ? entityLabel(entity, id)
            : `${entityLabel(entity, id)} — ${n} indexed ${n === 1 ? "study" : "studies"}`,
        x: proj[i][0],
        y: proj[i][1],
        category: categoryOf(entity, id),
        r: n === null ? 5 : 3 + Math.sqrt(n) * 1.1,
      };
    });
  }, [set, projection, entity, studyCounts]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return new Set(points.filter((p) => p.label.toLowerCase().includes(q)).map((p) => p.id));
  }, [query, points]);

  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <PageHeader
        eyebrow="Research application · Representations"
        title="Representation space"
        actions={
          <Link
            href="/ml/lab"
            className="rounded-md border border-line px-3 py-1.5 text-[12px] text-text-2 hover:border-amber/50 hover:text-text"
          >
            Validated model runs →
          </Link>
        }
      >
        <p>
          Regions, disorders and studies embedded by their evidence profiles — which modalities,
          regions and findings the corpus links them to. Nearby points have similar{" "}
          <em>evidence profiles</em>; that is computational similarity over a curated corpus, not
          anatomical distance, shared biology or clinical equivalence.
        </p>
      </PageHeader>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="Entity type"
          value={entity}
          onChange={(v) => {
            setEntity(v);
            setSelected(null);
            setQuery("");
          }}
          options={ENTITIES.map((e) => ({ value: e.key, label: e.label }))}
        />
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
        <div className="relative ml-auto w-full sm:w-72">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches && matches.size > 0) {
                setSelected([...matches][0]);
              }
            }}
            placeholder={`Find a ${entity}…`}
            aria-label={`Find a ${entity} in the plot`}
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] text-text placeholder:text-text-3 focus:border-amber/60 focus:outline-none"
          />
          {matches && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-text-3">
              {matches.size} match{matches.size === 1 ? "" : "es"}
            </span>
          )}
        </div>
      </div>
      {matches && matches.size > 0 && matches.size <= 8 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {[...matches].map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setSelected(id)}
                className="rounded border border-line px-2 py-0.5 text-[11px] text-text-2 hover:border-cyan/50 hover:text-text"
              >
                {entityLabel(entity, id)}
              </button>
            </li>
          ))}
        </ul>
      )}

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
              highlightIds={matches}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              {set.manifest.method} · corpus {set.manifest.corpusVersion} ·
              built {set.manifest.created}. Positions derive from the indexed
              evidence corpus (curated, not a systematic review); 2D
              projections can distort distances.
              {entity !== "study" &&
                " Point size = distinct indexed studies — small points sit where they do on thin evidence."}
            </p>
          </div>
          <aside className="w-full shrink-0 space-y-3 lg:w-80">
            <Panel className="p-4">
              <h2 className="text-[13px] text-text">Reading this plot</h2>
              <dl className="mt-2 space-y-2 text-[11px] leading-relaxed">
                <div>
                  <dt className="text-text-2">What a point is</dt>
                  <dd className="text-text-3">
                    One {entity}, described by log-scaled, standardised counts of its indexed
                    evidence per modality category, region or disorder.
                  </dd>
                </div>
                <div>
                  <dt className="text-text-2">{projection === "pca" ? "What the axes are" : "What UMAP preserves"}</dt>
                  <dd className="text-text-3">
                    {projection === "pca"
                      ? "Principal components — linear axes with published loadings (below)."
                      : "Local neighbourhoods only. Axis values, cluster sizes and between-cluster distances carry no meaning."}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-2">What proximity is not</dt>
                  <dd className="text-text-3">
                    Anatomical distance, shared mechanism, or clinical similarity. Entities with
                    little indexed evidence can sit together simply because they are sparse.
                  </dd>
                </div>
              </dl>
            </Panel>
            <div className="rounded-xl border border-line bg-ink-2/70 p-4">
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
