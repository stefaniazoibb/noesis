"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getGaps } from "@/lib/repo/evidence";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { GAP_RULES, type EvidenceGap, type GapRuleId } from "@/lib/evidence/gaps";
import {
  conflicts,
  disorderCoverage,
  disorderName,
  regionLabel,
  regionsWithoutEvidence,
  studyRef,
} from "@/lib/evidence/summary";
import { ResearchOpportunities } from "@/components/ResearchOpportunities";
import { SaveToNotebook } from "@/components/SaveToNotebook";
import { PageHeader, Panel, PanelTitle, selectClass } from "@/components/PageHeader";

/** Same deterministic ranking as src/ai/questions.ts (docs/METRICS.md). */
const RULE_WEIGHT: Record<GapRuleId, number> = {
  "GAP-CONFLICT": 3,
  "GAP-IMG-EP": 2,
  "GAP-OBS-INT": 2,
  "GAP-ATTENTION": 1,
};
const score = (g: EvidenceGap) => g.magnitude * RULE_WEIGHT[g.ruleId];

function gapSentence(g: EvidenceGap): string {
  switch (g.ruleId) {
    case "GAP-IMG-EP":
      return `${g.magnitude} imaging studies link this pair, but no electrophysiology study does.`;
    case "GAP-OBS-INT":
      return `${g.magnitude} correlational studies, but no interventional study tests this pair.`;
    case "GAP-CONFLICT":
      return `Studies of the same finding type report opposite directions (${g.supportingStudyIds.length} vs ${g.conflictingStudyIds?.length ?? 0}).`;
    case "GAP-ATTENTION":
      return `${g.magnitude} studies link this region to ${disorderName(g.referenceDisorder!)}, a disorder with an overlapping evidence footprint, but none link it here.`;
  }
}

function GapCard({ g }: { g: EvidenceGap }) {
  const ids = [...g.supportingStudyIds, ...(g.conflictingStudyIds ?? [])];
  return (
    <li className="rounded-lg border border-line bg-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] text-cyan">{GAP_RULES[g.ruleId].name}</p>
          <h3 className="mt-1 text-[14px] text-text">
            {regionLabel(g.region)} <span className="text-text-3">·</span> {disorderName(g.disorder)}
          </h3>
        </div>
        <span
          className="rounded-full border border-line px-2 py-0.5 text-[11px] tabular-nums text-text-2"
          title={`rank score = magnitude ${g.magnitude} × rule weight ${RULE_WEIGHT[g.ruleId]}`}
        >
          score {score(g)}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-text-2">{gapSentence(g)}</p>
      <p className="mt-3 font-mono text-[10px] text-text-3">Evidence behind the gap</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {ids.slice(0, 8).map((id) => {
          const s = studyRef(id);
          return (
            <li key={id}>
              <Link
                href={`/evidence/${id}`}
                title={s.title}
                className="block rounded border border-line px-1.5 py-0.5 text-[11px] text-text-2 hover:border-text hover:text-text"
              >
                {s.label}
              </Link>
            </li>
          );
        })}
        {ids.length > 8 && <li className="text-[11px] text-text-3">+{ids.length - 8} more</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <Link href={`/brain?disorder=${g.disorder}&region=${g.region}&mode=gaps`} className="text-text underline decoration-line-strong underline-offset-4">
          On the brain
        </Link>
        <Link href={`/convergence?disorder=${g.referenceDisorder ?? g.disorder}&region=${g.region}`} className="text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text">
          Convergence profile
        </Link>
        <SaveToNotebook
          compact
          entry={{
            key: `gap:${g.ruleId}:${g.disorder}:${g.region}:${g.referenceDisorder ?? ""}`,
            type: "gap",
            title: `${regionLabel(g.region)} · ${disorderName(g.disorder)}`,
            subtitle: GAP_RULES[g.ruleId].name,
            body: gapSentence(g),
            href: `/gaps?rule=${g.ruleId}&disorder=${g.disorder}`,
            citations: ids.map((id) => {
              const s = studyRef(id);
              return { id, title: s.title, url: s.url };
            }),
            aiGenerated: false,
          }}
        />
      </div>
    </li>
  );
}

export function GapsExplorer() {
  const params = useSearchParams();
  const ruleParam = params.get("rule");
  const disorderParam = params.get("disorder");
  const [rule, setRule] = useState<string>(ruleParam && ruleParam in GAP_RULES ? ruleParam : "");
  const [disorder, setDisorder] = useState<string>(
    disorderParam && getDisorders().some((d) => d.id === disorderParam) ? disorderParam : "",
  );
  const [limit, setLimit] = useState(12);
  const [qDisorder, setQDisorder] = useState<string>(disorderParam ?? "schizophrenia");

  const allGaps = useMemo(() => getGaps(), []);
  const gaps = useMemo(
    () =>
      allGaps
        .filter((g) => (!rule || g.ruleId === rule) && (!disorder || g.disorder === disorder))
        .sort((a, b) => score(b) - score(a) || a.region.localeCompare(b.region)),
    [allGaps, rule, disorder],
  );
  const coverage = useMemo(() => disorderCoverage(), []);
  const modalities = getModalities();
  const noEvidence = useMemo(() => regionsWithoutEvidence(), []);
  const conflictList = useMemo(() => conflicts(), []);
  const maxStudies = Math.max(...coverage.map((c) => c.studies));
  const gapsPerDisorder = (id: string) => allGaps.filter((g) => g.disorder === id).length;

  return (
    <div>
      <PageHeader eyebrow="Research gaps" title="What the corpus doesn’t know">
        <p>
          Four documented rules scan the indexed corpus for structural holes. Every gap carries the
          studies that define it, and every AI-generated question links back to its gap. A gap here
          may be a <span className="text-text">curation gap</span> rather than a gap in the literature.
        </p>
      </PageHeader>

      {/* rule summary */}
      <ul className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(GAP_RULES) as GapRuleId[]).map((id) => {
          const n = allGaps.filter((g) => g.ruleId === id).length;
          const active = rule === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setRule(active ? "" : id)}
                className={`flex h-full w-full flex-col p-4 text-left transition-colors ${active ? "bg-surface" : "bg-ink-2 hover:bg-surface/60"}`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-text">{GAP_RULES[id].name}</span>
                  <span className="font-serif text-[28px] leading-none tabular-nums text-cyan">{n}</span>
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-text-3">{GAP_RULES[id].definition}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_24rem]">
        {/* gap list */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="Gap rule" className={selectClass}>
              <option value="">All rules</option>
              {(Object.keys(GAP_RULES) as GapRuleId[]).map((id) => (
                <option key={id} value={id}>{GAP_RULES[id].name}</option>
              ))}
            </select>
            <select value={disorder} onChange={(e) => setDisorder(e.target.value)} aria-label="Disorder" className={selectClass}>
              <option value="">All disorders</option>
              {getDisorders().map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({gapsPerDisorder(d.id)})</option>
              ))}
            </select>
            <span className="ml-auto text-[12px] tabular-nums text-text-3">
              {gaps.length} gaps · ranked by magnitude × rule weight
            </span>
          </div>
          {gaps.length === 0 ? (
            <p className="mt-6 rounded-lg border border-line px-4 py-8 text-center text-[13px] text-text-3">
              No gaps detected by these rules for this selection.
              {rule === "GAP-CONFLICT" && conflictList.length > 0 && ` The conflict rule needs ≥2 studies on each side; the ${conflictList.length} directional ${conflictList.length === 1 ? "conflict" : "conflicts"} currently indexed (listed below) have fewer.`}
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {gaps.slice(0, limit).map((g) => (
                <GapCard key={`${g.ruleId}-${g.disorder}-${g.region}-${g.referenceDisorder ?? ""}`} g={g} />
              ))}
            </ul>
          )}
          {gaps.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 12)}
              className="mt-4 rounded-md border border-line px-3 py-1.5 text-[12px] text-text-2 hover:text-text"
            >
              Show more ({gaps.length - limit} remaining)
            </button>
          )}
        </div>

        {/* AI questions */}
        <div className="space-y-4">
          <Panel>
            <PanelTitle note="The model writes prose only. Gap choice, ranking, question type and candidate region are deterministic; citations are validated against the gap's own studies.">
              AI-generated research questions
            </PanelTitle>
            <div className="px-4 pt-4">
              <select value={qDisorder} onChange={(e) => setQDisorder(e.target.value)} aria-label="Disorder for research questions" className={`${selectClass} w-full`}>
                {getDisorders().map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {gapsPerDisorder(d.id)} gaps</option>
                ))}
              </select>
            </div>
            <div className="px-4 pb-4 [&>section]:mt-3 [&>section]:border-line [&>section]:bg-ink">
              <ResearchOpportunities key={qDisorder} disorderId={qDisorder} />
            </div>
          </Panel>
          <p className="rounded-lg border-l-2 border-amber/60 bg-surface/40 px-4 py-3 text-[12px] leading-relaxed text-text-2">
            Observed evidence → rule-based gap → AI interpretation → proposed hypothesis. Only the
            first is evidence. Generated questions are hypotheses requiring investigation and are
            never written back into the data.
          </p>
        </div>
      </div>

      {/* coverage + modality matrix */}
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <Panel>
          <PanelTitle note="Distinct indexed studies per disorder, fewest first.">
            <span id="coverage">Disorders with sparse coverage</span>
          </PanelTitle>
          <ul className="space-y-1 px-5 py-4">
            {[...coverage].sort((a, b) => a.studies - b.studies).map((d) => (
              <li key={d.id} className="flex items-center gap-3 text-[12px]">
                <Link href={`/disorders/${d.id}`} className="w-48 shrink-0 truncate text-text-2 hover:text-text">{d.name}</Link>
                <span className="relative h-3 flex-1">
                  <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-amber/75" style={{ width: `${(d.studies / maxStudies) * 100}%`, minWidth: 3 }} />
                </span>
                <span className="w-24 text-right tabular-nums text-text-3">
                  {d.studies} st · {d.regions} reg
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle note="Distinct studies per disorder × modality. Empty cells are modality combinations with no indexed study.">
            Missing modality combinations
          </PanelTitle>
          <div className="overflow-x-auto px-2 py-3">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="font-mono text-[10px] text-text-3">
                  <th className="px-3 py-1.5 text-left font-normal">Disorder</th>
                  {modalities.map((m) => (
                    <th key={m.id} className="px-2 py-1.5 text-center font-normal">{m.abbreviation}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map((d) => (
                  <tr key={d.id} className="border-t border-line/60">
                    <td className="px-3 py-1.5 text-text-2">{d.name}</td>
                    {modalities.map((m) => {
                      const n = d.byModality[m.id] ?? 0;
                      return (
                        <td key={m.id} className="px-2 py-1.5 text-center tabular-nums">
                          {n > 0 ? (
                            <span className="text-text">{n}</span>
                          ) : (
                            <span className="inline-block rounded border border-dashed border-text-3/50 px-1.5 text-[10px] text-text-3" aria-label="no study">
                              none
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Panel>
          <PanelTitle note="Same finding type, opposite directions. Both sides shown; never adjudicated.">
            Contradictory findings ({conflictList.length})
          </PanelTitle>
          <ul className="divide-y divide-line/70">
            {conflictList.length === 0 && <li className="px-5 py-4 text-[12px] text-text-3">None in the corpus.</li>}
            {conflictList.map((c) => (
              <li key={`${c.disorder}-${c.region}-${c.findingType}`} className="px-5 py-3 text-[12px]">
                <p className="text-text">
                  {c.regionName} · {c.disorderName} <span className="text-conflict">· {c.findingType.replace(/_/g, " ")}</span>
                </p>
                <p className="mt-1 text-text-3">
                  ▲ increased:{" "}
                  {c.increased.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">{s.label}</a>
                  ))}
                  {"  "}▼ decreased:{" "}
                  {c.decreased.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">{s.label}</a>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelTitle note="Atlas regions with no indexed assertion for any disorder.">
            Regions with no indexed evidence ({noEvidence.length})
          </PanelTitle>
          <ul className="flex flex-wrap gap-1.5 px-5 py-4">
            {noEvidence.map((id) => (
              <li key={id}>
                <Link href={`/brain?region=${id}`} className="block rounded border border-line px-2 py-0.5 text-[11px] text-text-2 hover:border-text hover:text-text">
                  {regionLabel(id)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[11px] text-text-3">
            Absence of indexed evidence is not evidence of absence: these regions may be studied
            in the wider literature without yet being curated here.
          </p>
        </Panel>
      </div>
    </div>
  );
}
