"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { SourceRef } from "./data";

interface Recorded {
  question: string;
  answer: string;
  model: string;
  requestedModel: string;
  recordedAt: string;
  responseId: string;
  citedIds: string[];
  strippedIds: string[];
  uncitedScientificSentences: number;
  retrievedStudyIds: string[];
  corpusChanged: boolean;
  sources: SourceRef[];
}

interface RetrievalRow {
  region: string;
  regionName: string;
  studies: number;
  level: string;
}

const TABS = [
  { id: "answer", label: "Recorded answer" },
  { id: "retrieval", label: "What the model may see" },
  { id: "command", label: "Language drives the atlas" },
] as const;

/** Renders the validated answer with numbered citation markers that link to the source list. */
function AnswerText({ text, order }: { text: string; order: Map<string, number> }) {
  return (
    <>
      {text.split(/\n\n+/).map((para, pi) => {
        const parts: ReactNode[] = [];
        let last = 0;
        for (const m of para.matchAll(/\[(study_[a-z0-9_]+|corpus)\]/g)) {
          parts.push(para.slice(last, m.index).replace(/\s+$/, ""));
          const id = m[1];
          if (id === "corpus") {
            parts.push(
              <sup key={`${pi}-${m.index}`} className="ml-0.5 font-mono text-[10px] text-text-3" title="Coverage count from the corpus, checked by the validator">
                corpus
              </sup>,
            );
          } else {
            const n = order.get(id);
            parts.push(
              <a key={`${pi}-${m.index}`} href={`#src-${id}`} className="ml-0.5 align-super font-mono text-[10px] text-cyan underline-offset-2 hover:underline">
                {n}
              </a>,
            );
          }
          last = (m.index ?? 0) + m[0].length;
        }
        parts.push(para.slice(last));
        return (
          <p key={pi} className="mt-4 first:mt-0">
            {parts}
          </p>
        );
      })}
    </>
  );
}

export function AskDemo({
  recorded,
  retrieval,
  retrievedCount,
}: {
  recorded: Recorded;
  retrieval: RetrievalRow[];
  retrievedCount: number;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("answer");
  const order = new Map(recorded.citedIds.map((id, i) => [id, i + 1]));
  const date = new Date(recorded.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-white">
      <div className="border-b border-line px-5 py-5 sm:px-8 sm:py-6">
        <p className="font-mono text-[11px] text-text-3">Question</p>
        <p className="mt-2 text-[22px] font-medium leading-snug tracking-[-0.01em] text-text sm:text-[26px]">{recorded.question}</p>
      </div>
      <div role="tablist" aria-label="Assistant demonstration" className="snap-strip flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`ask-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`ask-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 px-3 py-3 text-[13px] transition-colors ${tab === t.id ? "text-text" : "text-text-3 hover:text-text"}`}
          >
            {t.label}
            {tab === t.id && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] bg-text" />}
          </button>
        ))}
      </div>

      {tab === "answer" && (
        <div id="ask-panel-answer" role="tabpanel" aria-labelledby="ask-tab-answer" className="grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="px-5 py-6 sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-[3px] border border-amber-400/40 bg-amber-950 px-2.5 py-1 font-mono text-[11px] text-amber-400">
              Recorded demonstration, not a live response
            </p>
            <div className="mt-5 text-[16px] leading-[1.7] text-text-2">
              <AnswerText text={recorded.answer} order={order} />
            </div>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-4 font-mono text-[11px] text-text-3">
              <dt>Model</dt>
              <dd className="text-text-2">{recorded.model} (as returned by the API)</dd>
              <dt>Recorded</dt>
              <dd className="text-text-2">{date}</dd>
              <dt>Response id</dt>
              <dd className="break-all text-text-2">{recorded.responseId}</dd>
              <dt>Citation check</dt>
              <dd className="text-text-2">
                {recorded.citedIds.length} citations kept, {recorded.strippedIds.length} removed,{" "}
                {recorded.uncitedScientificSentences} uncited claims flagged
              </dd>
            </dl>
            <p className="mt-4 border-l-2 border-line-strong pl-3 text-[12px] leading-relaxed text-text-3">
              <span className="text-text-2">Editor&rsquo;s note, not part of the recorded answer:</span> the rTMS
              estimate (Hedges g −0.73) comes from a meta-analysis across several neuropsychiatric disorders, not
              from studies of depression alone (source {order.get("study_kan_2023") ?? "list"}).
            </p>
            {recorded.corpusChanged && (
              <p className="mt-3 text-[12px] text-amber-400">
                The corpus has changed since this answer was recorded. A live answer may differ.
              </p>
            )}
          </div>
          <div className="border-t border-line bg-ink px-5 py-6 sm:px-8 lg:border-l lg:border-t-0">
            <p className="font-mono text-[11px] text-text-3">Sources cited in the answer</p>
            <ol className="mt-3 space-y-3">
              {recorded.sources.map((s, i) => (
                <li key={s.id} id={`src-${s.id}`} className="flex gap-3 scroll-mt-24">
                  <span className="w-4 shrink-0 font-mono text-[11px] text-cyan">{i + 1}</span>
                  <div className="min-w-0">
                    <Link href={`/evidence/${s.id}`} className="text-[13px] leading-snug text-text hover:underline">
                      {s.title}
                    </Link>
                    <p className="mt-1 text-[11px] text-text-3">
                      {s.label} · {s.journal}
                      {s.sampleSize ? ` · n = ${s.sampleSize.toLocaleString("en")}` : ""}
                    </p>
                    <a href={s.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block font-mono text-[11px] text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text">
                      {s.doi ? `DOI ${s.doi}` : `PMID ${s.pmid}`}
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {tab === "retrieval" && (
        <div id="ask-panel-retrieval" role="tabpanel" aria-labelledby="ask-tab-retrieval" className="px-5 py-6 sm:px-8">
          <ol className="grid gap-6 md:grid-cols-3">
            <li>
              <p className="font-mono text-[11px] text-text-3">1 · Entity linking</p>
              <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                The question maps to the catalogue entry{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-[12px] text-text">major_depressive_disorder</code>. Ids outside the
                catalogue are dropped.
              </p>
            </li>
            <li>
              <p className="font-mono text-[11px] text-text-3">2 · Deterministic retrieval</p>
              <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                {retrievedCount} study records are retrieved by rule, not by the model. These are the only sources it may cite.
              </p>
            </li>
            <li>
              <p className="font-mono text-[11px] text-text-3">3 · Citation validation</p>
              <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                Any citation outside the retrieved set is removed and uncited scientific sentences are flagged before the answer is shown.
              </p>
            </li>
          </ol>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {retrieval.map((p) => (
              <li key={p.region} className="flex items-baseline justify-between gap-3 py-2.5 text-[14px]">
                <Link href={`/brain?region=${p.region}&disorder=major_depressive_disorder&mode=disorder`} className="text-text hover:underline">
                  {p.regionName}
                </Link>
                <span className="shrink-0 font-mono text-[12px] text-text-3">
                  {p.studies} {p.studies === 1 ? "study" : "studies"} · {p.level}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "command" && (
        <div id="ask-panel-command" role="tabpanel" aria-labelledby="ask-tab-command" className="grid gap-6 px-5 py-6 sm:px-8 md:grid-cols-2">
          <div>
            <p className="text-[20px] font-medium text-text">&ldquo;Show schizophrenia evidence, fMRI only&rdquo;</p>
            <p className="mt-3 text-[14px] leading-relaxed text-text-2">
              Commands compile to a validated view-state patch for the 3D atlas, never to free-form actions.
            </p>
            <Link href="/brain?disorder=schizophrenia&mode=disorder&modality=fmri" className="mt-4 inline-block text-[13px] font-medium text-text underline underline-offset-4">
              See the resulting view
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-[4px] bg-surface px-4 py-3 text-[13px] leading-relaxed text-text-2">
{`{ "mode": "disorder",
  "disorders": ["schizophrenia"],
  "modalities": ["fmri"] }`}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-8">
        <Link
          href={`/assistant?q=${encodeURIComponent(recorded.question)}`}
          className="rounded-[3px] bg-text px-5 py-3 text-[14px] font-medium text-white transition-colors hover:bg-[#3a3a35]"
        >
          Ask it live
        </Link>
        <span className="text-[12px] text-text-3">
          Without a configured API key the live assistant returns the retrieved records only, with no synthesis.
        </span>
      </div>
    </div>
  );
}
