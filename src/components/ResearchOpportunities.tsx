"use client";

import { useState } from "react";
import { SaveToNotebook } from "@/components/SaveToNotebook";

interface Question {
  question: string;
  questionType: string;
  rationale: string;
  hypothesis: string;
  methodologyNotes: string;
  limitations: string;
  candidateRegions: { id: string; name: string }[];
  candidateModalities: string[];
  rank: { score: number; explanation: string };
  provenance: {
    ruleName: string;
    gapDescription: string;
    magnitude: number;
    referenceDisorder: string | null;
    studies: {
      id: string;
      title: string;
      journal: string | null;
      year: number;
      doi: string | null;
      pmid: string | null;
    }[];
  };
  flags: { strippedCitations: number };
}

function studyUrl(s: Question["provenance"]["studies"][number]): string {
  if (s.doi) return `https://doi.org/${s.doi}`;
  if (s.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`;
  return "#";
}

/** Strip inline [study_id] markers for display; the provenance list carries links. */
function clean(text: string): string {
  return text.replace(/\s*\[study_[a-z0-9_]+\]/g, "").replace(/ {2,}/g, " ");
}

export function ResearchOpportunities({ disorderId }: { disorderId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "done"; questions: Question[]; disclaimer: string; note?: string }
  >({ kind: "idle" });

  async function generate() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disorder: disorderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            data?.message ?? "Generation is unavailable right now. Try again.",
        });
        return;
      }
      setState({
        kind: "done",
        questions: data.questions,
        disclaimer: data.disclaimer,
        note: data.note,
      });
    } catch {
      setState({ kind: "error", message: "Network error." });
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] text-zinc-500">
          Research opportunities
        </h2>
        {state.kind !== "done" && (
          <button
            type="button"
            onClick={generate}
            disabled={state.kind === "loading"}
            className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          >
            {state.kind === "loading"
              ? "Generating from evidence gaps…"
              : "Generate research questions (AI)"}
          </button>
        )}
      </div>

      {state.kind === "idle" && (
        <p className="mt-2 text-xs text-zinc-500">
          Turns this disorder&rsquo;s detected evidence gaps into candidate
          research questions, each grounded in, and cited against, the
          indexed studies behind the gap.
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-2 text-xs text-amber-600/90">{state.message}</p>
      )}
      {state.kind === "done" && state.questions.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500">{state.note}</p>
      )}

      {state.kind === "done" &&
        state.questions.map((q, i) => (
          <article
            key={i}
            className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm leading-snug text-zinc-100">
                {clean(q.question)}
              </h3>
              <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                {q.questionType.replace(/_/g, "-")}
              </span>
            </div>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div>
                <dt className="text-zinc-500">Why NOĒSIS generated it</dt>
                <dd className="text-zinc-300">{clean(q.rationale)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Potential hypothesis</dt>
                <dd className="text-zinc-300">{clean(q.hypothesis)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Potential methodology</dt>
                <dd className="text-zinc-400">{clean(q.methodologyNotes)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Limitations</dt>
                <dd className="text-zinc-400">{clean(q.limitations)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-zinc-500">
              Candidate regions:{" "}
              {q.candidateRegions.map((r) => r.name).join(", ")} · Modalities:{" "}
              {q.candidateModalities.join(", ")}
            </p>
            <div className="mt-2">
              <SaveToNotebook
                compact
                entry={{
                  key: `question:${disorderId}:${q.question.slice(0, 60)}`,
                  type: "question",
                  title: clean(q.question),
                  subtitle: `${q.questionType.replace(/_/g, "-")} · gap: ${q.provenance.ruleName}`,
                  body: `Why: ${clean(q.rationale)}\n\nHypothesis: ${clean(q.hypothesis)}\n\nMethodology: ${clean(q.methodologyNotes)}\n\nLimitations: ${clean(q.limitations)}`,
                  citations: q.provenance.studies.map((s) => ({
                    id: s.id,
                    title: s.title,
                    url: studyUrl(s),
                  })),
                  aiGenerated: true,
                }}
              />
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                Provenance chain &amp; ranking
              </summary>
              <div className="mt-1.5 space-y-1 text-[11px] text-zinc-500">
                <p>
                  Gap: {q.provenance.ruleName} · {q.provenance.gapDescription}
                </p>
                <p>Ranking: {q.rank.explanation}.</p>
                <p className="flex flex-wrap gap-1.5">
                  {q.provenance.studies.map((s) => (
                    <a
                      key={s.id}
                      href={studyUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      title={s.title}
                      className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    >
                      {s.journal} {s.year}
                    </a>
                  ))}
                </p>
              </div>
            </details>
          </article>
        ))}

      {state.kind === "done" && state.questions.length > 0 && (
        <p className="mt-3 border-t border-zinc-800/70 pt-2 text-[10px] leading-relaxed text-zinc-600">
          {state.disclaimer}
        </p>
      )}
    </section>
  );
}
