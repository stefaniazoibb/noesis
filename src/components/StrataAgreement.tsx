"use client";

import { useMemo } from "react";
import { getAssertions } from "@/lib/repo/evidence";
import { getRegion } from "@/lib/repo/atlas";
import { useScalarMap } from "@/lib/ml/metamaps";

/**
 * Cross-strata agreement for one disorder: does the curated corpus, the
 * NeuroQuery text-mining map, and (where available) the CNP MRI morphometry
 * map point at the same regions? Agreement is reported as Spearman rank
 * correlation over all atlas regions — a consistency check between evidence
 * streams, NOT validation of any of them (the corpus and NeuroQuery both
 * derive from the literature; the MRI map is one dataset).
 */

function spearman(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const rank = (v: number[]) => {
    const order = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[order[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let k = 0; k < n; k++) {
    num += (ra[k] - ma) * (rb[k] - mb);
    da += (ra[k] - ma) ** 2;
    db += (rb[k] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : null;
}

function topRegions(values: Map<string, number>, n = 3): string {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => getRegion(id)?.name ?? id)
    .join(", ");
}

export function StrataAgreement({ disorderId }: { disorderId: string }) {
  const metamap = useScalarMap("metamaps", disorderId);
  const morphomap = useScalarMap("morphomaps", disorderId);

  const corpus = useMemo(() => {
    const byRegion = new Map<string, Set<string>>();
    for (const a of getAssertions()) {
      if (a.disorder !== disorderId) continue;
      const set = byRegion.get(a.region) ?? new Set<string>();
      set.add(a.studyId);
      byRegion.set(a.region, set);
    }
    return new Map([...byRegion.entries()].map(([r, s]) => [r, s.size]));
  }, [disorderId]);

  const rows = useMemo(() => {
    if (!metamap) return [];
    const regions = Object.keys(metamap.values);
    const corpusV = regions.map((r) => corpus.get(r) ?? 0);
    const metaV = regions.map((r) => Math.max(0, metamap.values[r]));
    const out: {
      pair: string;
      rho: number | null;
      note: string;
    }[] = [
      {
        pair: "Curated corpus × NeuroQuery",
        rho: spearman(corpusV, metaV),
        note: "distinct-study counts vs meta-analytic z — both literature-derived, so agreement here is curation/mining consistency",
      },
    ];
    if (morphomap) {
      const morphoV = regions.map((r) => Math.abs(morphomap.values[r] ?? 0));
      out.push(
        {
          pair: "Curated corpus × MRI morphometry",
          rho: spearman(corpusV, morphoV),
          note: "study counts vs |Cohen's d| (single dataset) — literature attention vs one cohort's group anatomy",
        },
        {
          pair: "NeuroQuery × MRI morphometry",
          rho: spearman(metaV, morphoV),
          note: "meta-analytic z vs |Cohen's d| — automated literature mining vs one cohort's group anatomy",
        },
      );
    }
    return out;
  }, [metamap, morphomap, corpus]);

  if (!metamap) return null;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <h2 className="text-sm font-medium text-zinc-200">
        Evidence-strata agreement
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Do independent evidence streams point at the same regions? Spearman
        rank correlation across all atlas regions. A consistency check
        between strata — not validation of any single stream.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.pair}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-zinc-300">{row.pair}</span>
              <span className="tabular-nums text-[11px] text-zinc-200">
                ρ = {row.rho === null ? "—" : row.rho.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-600">
              {row.note}
            </p>
          </div>
        ))}
      </div>
      <dl className="mt-3 space-y-1 border-t border-zinc-800/70 pt-2 text-[10px] leading-relaxed text-zinc-600">
        <div>
          <dt className="inline text-zinc-500">Corpus top regions: </dt>
          <dd className="inline">
            {corpus.size > 0 ? topRegions(corpus) : "no indexed evidence"}
          </dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">NeuroQuery top regions: </dt>
          <dd className="inline">
            {topRegions(new Map(Object.entries(metamap.values)))}
          </dd>
        </div>
        {morphomap && (
          <div>
            <dt className="inline text-zinc-500">
              MRI |effect| top regions:{" "}
            </dt>
            <dd className="inline">
              {topRegions(
                new Map(
                  Object.entries(morphomap.values).map(([r, v]) => [
                    r,
                    Math.abs(v),
                  ]),
                ),
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
