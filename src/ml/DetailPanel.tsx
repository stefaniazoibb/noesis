"use client";

import { useRouter } from "next/navigation";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder } from "@/lib/repo/entities";
import { getStudy } from "@/lib/repo/evidence";
import { useVizStore } from "@/state/vizStore";
import { nearestNeighbors } from "@/lib/ml/similarity";
import type { EmbeddingEntity, EmbeddingSet } from "@/lib/ml/embeddings";
import { entityLabel } from "./labels";

export function DetailPanel({
  entity,
  set,
  selectedId,
  onSelect,
}: {
  entity: EmbeddingEntity;
  set: EmbeddingSet;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const router = useRouter();

  if (!selectedId) {
    return (
      <p className="text-sm text-zinc-500">
        Select a point to inspect its embedding neighborhood, or select a
        region on the 3D brain and return here.
      </p>
    );
  }

  if (!set.manifest.ids.includes(selectedId)) {
    return (
      <p className="text-sm text-zinc-500">
        {entityLabel(entity, selectedId)} has no indexed evidence, so it has
        no position in this evidence-derived representation.
      </p>
    );
  }

  const neighbors = nearestNeighbors(
    set.manifest.ids,
    set.vectors,
    set.manifest.dim,
    selectedId,
    6,
  );

  const region = entity === "region" ? getRegion(selectedId) : undefined;
  const disorder = entity === "disorder" ? getDisorder(selectedId) : undefined;
  const study = entity === "study" ? getStudy(selectedId) : undefined;

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-100">
        {entityLabel(entity, selectedId)}
      </h3>
      {region && (
        <p className="mt-0.5 text-xs capitalize text-zinc-500">
          {region.hemisphere} · {region.kind} ·{" "}
          {region.system.replace(/_/g, " ")}
        </p>
      )}
      {disorder && (
        <p className="mt-0.5 text-xs capitalize text-zinc-500">
          {disorder.category}
        </p>
      )}
      {study && (
        <p className="mt-0.5 text-xs text-zinc-500">
          {study.journal} · {study.year}
          {study.doi && (
            <>
              {" · "}
              <a
                href={`https://doi.org/${study.doi}`}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-zinc-700 hover:text-zinc-300"
              >
                DOI
              </a>
            </>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {region && (
          <button
            type="button"
            onClick={() => {
              const s = useVizStore.getState();
              s.selectRegion(selectedId);
              if (selectedId.startsWith("sub_")) s.setShowSubcortical(true);
              router.push("/brain");
            }}
            className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Highlight on 3D brain
          </button>
        )}
        {disorder && (
          <button
            type="button"
            onClick={() => {
              const s = useVizStore.getState();
              s.applyPatch({ mode: "disorder", disorders: [selectedId] });
              router.push("/brain");
            }}
            className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Show evidence on brain
          </button>
        )}
      </div>

      <h4 className="mt-4 font-mono text-[11px] text-zinc-500">
        Nearest neighbors (cosine)
      </h4>
      <ul className="mt-1.5 space-y-1">
        {neighbors.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-0.5 text-left text-xs text-zinc-300 hover:bg-zinc-800/60"
            >
              <span>{entityLabel(entity, n.id)}</span>
              <span className="shrink-0 text-zinc-500">
                {n.similarity.toFixed(2)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-zinc-800/70 pt-2 text-[10px] leading-relaxed text-zinc-600">
        Computational similarity over the indexed evidence corpus, not
        anatomical proximity, and not clinical equivalence.
      </p>
    </div>
  );
}
