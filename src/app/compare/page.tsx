"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDisorders } from "@/lib/repo/entities";
import { getRegion } from "@/lib/repo/atlas";
import { getEvidenceIndex } from "@/lib/repo/evidence";
import { getModalities } from "@/lib/repo/entities";
import { compareDisorders } from "@/lib/evidence/compare";
import { EVIDENCE_LEVEL_LABEL } from "@/lib/evidence/metrics";
import { loadEmbeddingSet } from "@/lib/ml/embeddings";
import { cosineSimilarity, rowSlice } from "@/lib/ml/similarity";
import { PersonalExperienceNote } from "@/components/PersonalExperienceNote";

const HEMI = { left: "L", right: "R", midline: "" };

function regionLabel(id: string): string {
  const r = getRegion(id);
  return r
    ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}`
    : id;
}

function DisorderSelect({
  value,
  exclude,
  onChange,
  label,
}: {
  value: string;
  exclude: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
    >
      <option value="">{label}</option>
      {getDisorders()
        .filter((d) => d.id !== exclude)
        .map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
    </select>
  );
}

function RegionList({
  title,
  rows,
}: {
  title: string;
  rows: { region: string; text: string }[];
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-xs text-zinc-500">None in the indexed corpus.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.slice(0, 10).map((r) => (
            <li
              key={r.region}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="text-zinc-300">{regionLabel(r.region)}</span>
              <span className="shrink-0 text-zinc-500">{r.text}</span>
            </li>
          ))}
          {rows.length > 10 && (
            <li className="text-[11px] text-zinc-600">
              …and {rows.length - 10} more.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function ComparePage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [similarity, setSimilarity] = useState<number | null | "missing">(null);

  const comparison = useMemo(
    () => (a && b ? compareDisorders(getEvidenceIndex(), a, b) : null),
    [a, b],
  );

  useEffect(() => {
    let alive = true;
    if (!a || !b) return;
    loadEmbeddingSet("disorder").then(
      (set) => {
        if (!alive) return;
        const ia = set.manifest.ids.indexOf(a);
        const ib = set.manifest.ids.indexOf(b);
        if (ia === -1 || ib === -1) {
          setSimilarity("missing");
          return;
        }
        setSimilarity(
          cosineSimilarity(
            rowSlice(set.vectors, set.manifest.dim, ia),
            rowSlice(set.vectors, set.manifest.dim, ib),
          ),
        );
      },
      () => alive && setSimilarity("missing"),
    );
    return () => {
      alive = false;
    };
  }, [a, b]);

  const disorderName = (id: string) =>
    getDisorders().find((d) => d.id === id)?.name ?? id;
  const modalityAbbrev = new Map(
    getModalities().map((m) => [m.id, m.abbreviation]),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-light tracking-wide text-zinc-100">
        Compare disorders
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Shared and disorder-specific evidence, modality overlap, direction
        differences, and computational similarity — all over the indexed
        corpus.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <DisorderSelect value={a} exclude={b} onChange={setA} label="First disorder…" />
        <span className="text-zinc-600">vs</span>
        <DisorderSelect value={b} exclude={a} onChange={setB} label="Second disorder…" />
        {a && b && (
          <Link
            href={`/brain?mode=compare&disorder=${a}&disorder2=${b}`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:bg-zinc-900"
          >
            View overlap on the 3D brain →
          </Link>
        )}
      </div>

      {!comparison && (
        <p className="mt-8 text-sm text-zinc-500">
          Select two disorders to compare.
        </p>
      )}

      {comparison && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Computational similarity
            </h3>
            <p className="mt-1.5 text-sm text-zinc-300">
              {similarity === null && "Computing…"}
              {similarity === "missing" &&
                "Not available — one of the disorders has no embedding (no indexed evidence)."}
              {typeof similarity === "number" &&
                `cosine ${similarity.toFixed(2)} between the evidence-derived embeddings`}
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Computational similarity based on the indexed evidence and the
              learned representation — not clinical equivalence. Sparse
              corpora can resemble each other in evidence structure alone.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Shared regions ({comparison.shared.length})
            </h3>
            {comparison.shared.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">
                No regions with indexed evidence for both disorders.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {comparison.shared.map((s) => (
                  <li
                    key={s.region}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"
                  >
                    <span className="text-zinc-300">{regionLabel(s.region)}</span>
                    <span className="text-zinc-500">
                      {disorderName(a)}: {s.a.studyCount}{" "}
                      {s.a.studyCount === 1 ? "study" : "studies"} (
                      {EVIDENCE_LEVEL_LABEL[s.a.level]}) ·{" "}
                      {disorderName(b)}: {s.b.studyCount} (
                      {EVIDENCE_LEVEL_LABEL[s.b.level]})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-zinc-600">
              Shared evidence does not imply shared mechanisms.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RegionList
              title={`Only ${disorderName(a)}`}
              rows={comparison.aOnly.map((r) => ({
                region: r.region,
                text: `${r.cell.studyCount} ${r.cell.studyCount === 1 ? "study" : "studies"}`,
              }))}
            />
            <RegionList
              title={`Only ${disorderName(b)}`}
              rows={comparison.bOnly.map((r) => ({
                region: r.region,
                text: `${r.cell.studyCount} ${r.cell.studyCount === 1 ? "study" : "studies"}`,
              }))}
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Modality overlap (distinct studies)
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              {comparison.modalityOverlap.map((m) => (
                <li key={m.modality} className="text-zinc-400">
                  {modalityAbbrev.get(m.modality) ?? m.modality}:{" "}
                  <span className="text-zinc-300">{m.aCount}</span> vs{" "}
                  <span className="text-zinc-300">{m.bCount}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Cross-disorder direction differences
            </h3>
            {comparison.directionDifferences.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">
                No shared region shows opposite majority directions for the
                same finding type in the indexed corpus.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {comparison.directionDifferences.map((d) => (
                  <li key={`${d.region}-${d.findingType}`} className="text-xs text-zinc-400">
                    <span className="text-zinc-300">{regionLabel(d.region)}</span>{" "}
                    — {d.findingType.replace(/_/g, " ")}:{" "}
                    {disorderName(a)} {d.aDirection} vs {disorderName(b)}{" "}
                    {d.bDirection}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            All comparisons are over the indexed corpus (curated, not a
            systematic review) after any filters; levels are rule-based
            labels (docs/METRICS.md).
          </p>
        </div>
      )}
      <PersonalExperienceNote compact />
    </main>
  );
}
