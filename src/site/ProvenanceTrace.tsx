"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TraceFinding } from "./data";

const DIR: Record<string, string> = { increased: "▲ increased", decreased: "▼ decreased" };

function Node({
  step,
  kind,
  children,
}: {
  step: number;
  kind: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex min-w-0 flex-col rounded-[4px] border border-line bg-white p-5 sm:p-6">
      <p className="font-mono text-[11px] text-text-3">
        <span className="text-text">{step}</span> · {kind}
      </p>
      <div className="mt-3 flex-1">{children}</div>
    </li>
  );
}

/** Draws the connector once per finding (CSS handles reduced motion). */
function Connector({ drawKey }: { drawKey: string }) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-drawn");
    const id = requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-drawn")));
    return () => cancelAnimationFrame(id);
  }, [drawKey]);
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 top-[34px] hidden h-2 w-full lg:block" preserveAspectRatio="none" viewBox="0 0 1000 8">
      <path ref={ref} d="M60 4H940" className="trace-line" style={{ ["--len" as string]: 880 }} stroke="#141412" strokeWidth="1.2" vectorEffect="non-scaling-stroke" fill="none" />
    </svg>
  );
}

export function ProvenanceTrace({ findings }: { findings: TraceFinding[] }) {
  const [key, setKey] = useState(findings[0]?.key);
  const f = findings.find((x) => x.key === key) ?? findings[0];
  if (!f) return null;
  const s = f.source;

  return (
    <div>
      <div role="tablist" aria-label="Choose a finding to trace" className="snap-strip -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        {findings.map((x) => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={x.key === f.key}
            aria-controls="trace-panel"
            onClick={() => setKey(x.key)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
              x.key === f.key ? "border-text bg-text text-white" : "border-line-strong text-text-2 hover:border-text hover:text-text"
            }`}
          >
            {x.region.name} · {x.disorder.name}
          </button>
        ))}
      </div>

      <div id="trace-panel" role="tabpanel" className="relative mt-8">
        <Connector drawKey={f.key} />
        <ol className="relative grid gap-3 lg:grid-cols-4" aria-live="polite">
          <Node step={1} kind="Brain region">
            <p className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-text">{f.region.name}</p>
            <p className="mt-2 text-[13px] text-text-2">
              {f.region.kind} · {f.region.hemisphere === "midline" ? "midline" : `${f.region.hemisphere} hemisphere`}
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-text-2">
              Linked to <span className="text-text">{f.disorder.name}</span> by {f.pair.studies} indexed{" "}
              {f.pair.studies === 1 ? "study" : "studies"} across {f.pair.categories.length} method{" "}
              {f.pair.categories.length === 1 ? "category" : "categories"} ({f.pair.categories.join(", ")}).
            </p>
            <Link
              href={`/brain?region=${f.region.id}&disorder=${f.disorder.id}&mode=disorder`}
              className="mt-4 inline-block text-[13px] font-medium text-text underline underline-offset-4"
            >
              See it on the atlas
            </Link>
          </Node>
          <Node step={2} kind="Assertion">
            <p className="text-[15px] leading-snug text-text">&ldquo;{f.assertion.statement}&rdquo;</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              <dt className="text-text-3">Method</dt>
              <dd className="text-text-2">{f.assertion.modalityName}</dd>
              <dt className="text-text-3">Finding</dt>
              <dd className="text-text-2">
                {f.assertion.findingType.replace(/_/g, " ")}
                {f.assertion.direction && DIR[f.assertion.direction] ? `, ${DIR[f.assertion.direction]}` : ""}
              </dd>
              <dt className="text-text-3">Design</dt>
              <dd className="text-text-2">{f.assertion.causalSupport}</dd>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-text-3">
              One disorder, one region, one method, one direction: the unit every map on this site counts.
            </p>
          </Node>
          <Node step={3} kind="Study">
            <p className="line-clamp-5 text-[14px] leading-snug text-text">{s.title}</p>
            <p className="mt-2 text-[12px] text-text-2">
              {s.label} · {s.journal}
            </p>
            {s.population && <p className="mt-3 text-[12px] leading-relaxed text-text-3">{s.population}</p>}
            <Link href={`/evidence/${s.id}`} className="mt-4 inline-block text-[13px] font-medium text-text underline underline-offset-4">
              Study record
            </Link>
          </Node>
          <Node step={4} kind="Verified source">
            <p className="font-mono text-[13px] leading-relaxed text-text break-all">
              {s.doi && <>DOI {s.doi}<br /></>}
              {s.pmid && <>PMID {s.pmid}</>}
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-text-2">
              Metadata taken from {s.verifiedAgainst === "pubmed_efetch" ? "PubMed" : (s.verifiedAgainst ?? "its registry")}
              {s.curatedDate ? ` on ${s.curatedDate}` : ""}; DOI and PMID re-checked against PubMed and OpenAlex before indexing.{" "}
              {s.verifiedByHuman ? "Curation spot-checked by a person." : "Human spot-check of the curated judgement pending."}
            </p>
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[13px] font-medium text-text underline underline-offset-4">
              Open the publication ↗
            </a>
          </Node>
        </ol>

        {f.otherSources.length > 0 && (
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <p className="text-[12px] text-text-3">Also supporting this pair:</p>
            {f.otherSources.map((o) => (
              <a
                key={o.id}
                href={o.url}
                target="_blank"
                rel="noreferrer"
                title={o.title}
                className="rounded-[3px] border border-line px-2 py-1 text-[12px] text-text-2 hover:border-text hover:text-text"
              >
                {o.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
