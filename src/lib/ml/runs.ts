"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { ModelRunSchema, type ModelRun } from "@/lib/schemas";

/** Loader for ML-Lab ModelRun artifacts (public/ml_runs/). Runs that fail
 *  schema validation — e.g. missing split strategy — are surfaced as
 *  rejected, never rendered as results (ARCHITECTURE.md §8). */

export const AlignmentScoreSchema = z.object({
  id: z.string(),
  evidenceCV1: z.number(),
  metamapCV1: z.number(),
});

export const CandidateLinkSchema = z.object({
  disorder: z.string(),
  region: z.string(),
  score: z.number(),
  label: z.string(),
});

export type AlignmentScore = z.infer<typeof AlignmentScoreSchema>;
export type CandidateLink = z.infer<typeof CandidateLinkSchema>;

export interface LoadedRun {
  run: ModelRun;
  /** parsed payloads keyed by output name; unknown shapes stay unparsed */
  scores?: AlignmentScore[];
  candidates?: CandidateLink[];
}

export interface RunsState {
  runs: LoadedRun[];
  /** manifests that failed validation, with the reason (still shown, as rejects) */
  rejected: { file: string; reason: string }[];
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return res.json();
}

export async function loadRuns(): Promise<RunsState> {
  const index = z
    .array(z.string())
    .parse(await fetchJson("/ml_runs/index.json"));
  const runs: LoadedRun[] = [];
  const rejected: RunsState["rejected"] = [];
  for (const file of index) {
    let raw: unknown;
    try {
      raw = await fetchJson(`/ml_runs/${file}`);
    } catch (e) {
      rejected.push({ file, reason: String(e) });
      continue;
    }
    const parsed = ModelRunSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        file,
        reason: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
      continue;
    }
    const loaded: LoadedRun = { run: parsed.data };
    if (parsed.data.outputs.scores) {
      loaded.scores = z
        .array(AlignmentScoreSchema)
        .parse(await fetchJson(`/ml_runs/${parsed.data.outputs.scores}`));
    }
    if (parsed.data.outputs.candidates) {
      loaded.candidates = z
        .array(CandidateLinkSchema)
        .parse(await fetchJson(`/ml_runs/${parsed.data.outputs.candidates}`));
    }
    runs.push(loaded);
  }
  return { runs, rejected };
}

export function useRuns(): {
  state: RunsState | null;
  error: string | null;
} {
  const [result, setResult] = useState<{
    state: RunsState | null;
    error: string | null;
  }>({ state: null, error: null });

  useEffect(() => {
    let alive = true;
    loadRuns().then(
      (state) => alive && setResult({ state, error: null }),
      (e) => alive && setResult({ state: null, error: String(e) }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return result;
}
