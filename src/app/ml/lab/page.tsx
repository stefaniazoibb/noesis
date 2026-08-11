"use client";

import Link from "next/link";
import { getDisorder } from "@/lib/repo/entities";
import { getRegion } from "@/lib/repo/atlas";
import { useRuns, type LoadedRun } from "@/lib/ml/runs";
import { Scatter } from "@/ml/Scatter";

const SPLIT_LABELS: Record<string, string> = {
  grouped_pair_level:
    "Grouped pair-level split — every assertion for a disorder-region pair is held out together; study nodes excluded from the graph to prevent study-mediated leakage",
  permutation_test:
    "Permutation test — the model is refit under row-shuffled data; reported p-values compare observed statistics against that null",
  subject_level: "Subject-level split",
  site_aware: "Site-aware split",
  nested_cv: "Nested cross-validation",
};

const TASK_LABELS: Record<string, string> = {
  alignment: "Representation alignment",
  link_prediction: "Graph link prediction",
  classification: "Classification",
  regression: "Regression",
  clustering: "Clustering",
  representation: "Representation",
};

function MetricRow({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 text-[11px]">
      <span className="text-zinc-500">{name}</span>
      <span className="tabular-nums text-zinc-300">{value}</span>
    </div>
  );
}

function AlignmentDetails({ loaded }: { loaded: LoadedRun }) {
  const m = loaded.run.metrics;
  const components = [1, 2, 3]
    .map((k) => ({ k, cc: m[`cc${k}`], p: m[`cc${k}_perm_p`] }))
    .filter((c) => c.cc !== undefined);
  // Bonferroni across the tested components — 3 uncorrected per-component
  // tests would overclaim (docs/METRICS.md)
  const alpha = 0.05 / Math.max(components.length, 1);
  const anySignificant = components.some(
    (c) => c.p !== undefined && c.p < alpha,
  );
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-4">
        {components.map(({ k, cc, p }) => (
          <div key={k} className="text-[11px]">
            <span className="text-zinc-500">canonical corr. {k}: </span>
            <span className="tabular-nums text-zinc-300">{cc}</span>
            <span
              className={
                p !== undefined && p < alpha
                  ? "text-emerald-500/90"
                  : "text-amber-600/90"
              }
            >
              {" "}
              (perm. p = {p})
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-600/90">
        {anySignificant
          ? `In-sample canonical correlations are inflated at n=19 disorders — only permutation-significant components (Bonferroni-corrected p < ${alpha.toFixed(4)}) indicate alignment beyond chance.`
          : "Honest negative: despite high in-sample correlations, no component survives the permutation test with Bonferroni correction at n=19 disorders — no demonstrated alignment between the two representations."}
      </p>
      {loaded.scores && (
        <div className="mt-3 max-w-md">
          <Scatter
            points={loaded.scores.map((s) => ({
              id: s.id,
              label: getDisorder(s.id)?.name ?? s.id,
              x: s.evidenceCV1,
              y: s.metamapCV1,
              category: getDisorder(s.id)?.category ?? "psychiatric",
            }))}
            categories={[
              { key: "psychiatric", label: "Psychiatric", color: "#3987e5" },
              {
                key: "neurodegenerative",
                label: "Neurodegenerative",
                color: "#d95926",
              },
            ]}
            selectedId={null}
            onSelect={() => {}}
            directLabels
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            First canonical variate: evidence-corpus embedding (x) vs
            NeuroQuery meta-map profile (y), per disorder. In-sample fit —
            see the permutation result above before reading structure here.
          </p>
        </div>
      )}
    </div>
  );
}

function LinkPredDetails({ loaded }: { loaded: LoadedRun }) {
  if (!loaded.candidates) return null;
  return (
    <div className="mt-3">
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Top model-suggested candidate links
      </h4>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-600/90">
        Disorder-region pairs ABSENT from the curated corpus that the model
        ranks highly from graph structure alone. These are hypotheses about
        the corpus, not evidence and not biology — a high score may simply
        reflect curation patterns.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-left text-[11px]">
          <thead>
            <tr className="text-zinc-500">
              <th className="py-1 pr-3 font-normal">Disorder</th>
              <th className="py-1 pr-3 font-normal">Region</th>
              <th className="py-1 pr-3 text-right font-normal">Score</th>
              <th className="py-1 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {loaded.candidates.map((c) => (
              <tr
                key={`${c.disorder}-${c.region}`}
                className="border-t border-zinc-800/60"
              >
                <td className="py-1 pr-3 text-zinc-300">
                  {getDisorder(c.disorder)?.name ?? c.disorder}
                </td>
                <td className="py-1 pr-3 text-zinc-300">
                  {getRegion(c.region)?.name ?? c.region}
                  {getRegion(c.region)?.hemisphere === "left" && (
                    <span className="text-zinc-500"> (L)</span>
                  )}
                  {getRegion(c.region)?.hemisphere === "right" && (
                    <span className="text-zinc-500"> (R)</span>
                  )}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums text-zinc-300">
                  {c.score.toFixed(2)}
                </td>
                <td className="py-1 text-[10px] uppercase tracking-wide text-amber-600/80">
                  model-suggested — not evidence
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunCard({ loaded }: { loaded: LoadedRun }) {
  const { run } = loaded;
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="min-w-0 break-words text-sm font-medium text-zinc-100">
          {TASK_LABELS[run.task] ?? run.task}
          <span className="ml-2 font-normal text-zinc-600">
            {run.runId} · {run.modelVersion} · {run.created}
          </span>
        </h2>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
        {run.datasetDef}
      </p>
      <dl className="mt-2 space-y-1 text-[11px] leading-relaxed">
        <div>
          <dt className="inline text-zinc-500">Model: </dt>
          <dd className="inline text-zinc-400">{run.model}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">Preprocessing: </dt>
          <dd className="inline text-zinc-400">{run.preprocessing}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">Validation protocol: </dt>
          <dd className="inline text-zinc-400">
            {SPLIT_LABELS[run.splitStrategy] ?? run.splitStrategy}
          </dd>
        </div>
      </dl>
      <div className="mt-3 grid max-w-xs gap-0.5">
        {Object.entries(run.metrics).map(([k, v]) => (
          <MetricRow key={k} name={k} value={v} />
        ))}
      </div>
      {run.task === "alignment" && <AlignmentDetails loaded={loaded} />}
      {run.task === "link_prediction" && <LinkPredDetails loaded={loaded} />}
    </section>
  );
}

export default function LabPage() {
  const { state, error } = useRuns();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-light tracking-wide text-zinc-100">
          ML Lab — model runs
        </h1>
        <Link
          href="/ml"
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          ← Representation space
        </Link>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">
        Every run below is a schema-validated ModelRun artifact (exact config,
        seed, split protocol, and metric definitions in docs/METRICS.md),
        reproducible via <code className="text-zinc-400">pipeline/mlruns/</code>{" "}
        or the FastAPI service. Model outputs are a separate stratum from the
        curated evidence corpus: ML importance never implies biological
        causality, and a run without a declared validation protocol is not
        rendered.
      </p>

      {error && (
        <p className="mt-6 text-sm text-amber-600/90">
          Model-run artifacts could not be loaded ({error}). Run{" "}
          <code className="text-zinc-400">pipeline/mlruns/build_alignment.py</code>{" "}
          and{" "}
          <code className="text-zinc-400">pipeline/mlruns/build_linkpred.py</code>{" "}
          to generate them.
        </p>
      )}
      {!state && !error && (
        <p className="mt-6 text-sm text-zinc-500">Loading model runs…</p>
      )}

      {state && (
        <div className="mt-5 space-y-4">
          {state.runs.map((r) => (
            <RunCard key={r.run.runId} loaded={r} />
          ))}
          {state.rejected.map((r) => (
            <section
              key={r.file}
              className="rounded-lg border border-amber-900/50 bg-zinc-950/60 p-4"
            >
              <h2 className="text-sm font-medium text-amber-600/90">
                Run not rendered: {r.file}
              </h2>
              <p className="mt-1 text-[11px] text-zinc-500">
                Failed artifact validation ({r.reason}) — runs without a valid
                manifest and declared split strategy are never displayed.
              </p>
            </section>
          ))}
          {state.runs.length === 0 && state.rejected.length === 0 && (
            <p className="text-sm text-zinc-500">
              No model runs yet. Generate them with the pipelines in{" "}
              <code className="text-zinc-400">pipeline/mlruns/</code>.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
