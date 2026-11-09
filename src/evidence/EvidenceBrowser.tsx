"use client";

import Link from "next/link";
import { surname } from "@/lib/evidence/summary";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAssertions, getStudies } from "@/lib/repo/evidence";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { getAtlas, getRegion } from "@/lib/repo/atlas";
import type { Study } from "@/lib/schemas";
import { PageHeader, Panel, selectClass } from "@/components/PageHeader";
import { SaveToNotebook } from "@/components/SaveToNotebook";

const HEMI = { left: "L", right: "R", midline: "" } as const;
const DIR_GLYPH: Record<string, string> = { increased: "▲", decreased: "▼", mixed: "±" };

function regionLabel(id: string) {
  const r = getRegion(id);
  return r ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}` : id;
}
function disorderName(id: string) {
  return getDisorders().find((d) => d.id === id)?.name ?? id;
}

function StudyDetail({ study, onClose }: { study: Study; onClose: () => void }) {
  const assertions = getAssertions().filter((a) => a.studyId === study.id);
  const modAbbr = new Map(getModalities().map((m) => [m.id, m.abbreviation]));
  return (
    <div className="flex max-h-[calc(100dvh-7rem)] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-3">Study detail</p>
          <h2 className="mt-1.5 text-[15px] leading-snug text-text">{study.title}</h2>
          <p className="mt-1.5 text-[12px] text-text-3">
            {study.authors.slice(0, 3).join(", ")}
            {study.authors.length > 3 ? " et al." : ""} · {study.journal} · {study.year}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close study detail" className="text-[13px] text-text-3 hover:text-text">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-[12px]">
        <div className="flex flex-wrap gap-2">
          {study.doi && (
            <a href={`https://doi.org/${study.doi}`} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-text-2 hover:border-amber/50 hover:text-text">
              DOI {study.doi}
            </a>
          )}
          {study.pmid && (
            <a href={`https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-text-2 hover:border-amber/50 hover:text-text">
              PubMed {study.pmid}
            </a>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">Indexed finding</p>
          <p className="mt-1.5 leading-relaxed text-text">{study.finding}</p>
          <p className="mt-2 text-text-3">
            {study.modalities.map((m) => modAbbr.get(m) ?? m).join(", ")} · {study.findingType.replace(/_/g, " ")}
            {study.direction && ` · ${study.direction}`}
            {study.sampleSize !== null ? ` · n = ${study.sampleSize.toLocaleString("en")}` : " · n not reported in abstract"}
          </p>
          {study.population && <p className="mt-1 text-text-3">{study.population}</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">
            Traceability · {assertions.length} region {assertions.length === 1 ? "assertion" : "assertions"}
          </p>
          {assertions.length === 0 ? (
            <p className="mt-1.5 text-text-3">
              Indexed at disorder level only — the abstract names no atlas-mappable region (e.g. scalp EEG).
            </p>
          ) : (
            <ul className="mt-2 space-y-2.5">
              {assertions.map((a) => (
                <li key={a.id} className="border-l border-line-strong pl-3">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/brain?region=${a.region}&disorder=${a.disorder}&mode=disorder`} className="text-text underline decoration-line-strong underline-offset-4 hover:text-amber">
                      {regionLabel(a.region)}
                    </Link>
                    <span className="text-text-3">
                      {disorderName(a.disorder)} · {modAbbr.get(a.modality)} · {a.direction ?? "no direction"} · {a.causalSupport}
                    </span>
                  </p>
                  <p className="mt-1 leading-relaxed text-text-2">{a.statement}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-text-3">{a.id}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className={study.curation.verifiedByHuman ? "text-emerald-400/90" : "text-amber/90"}>
            {study.curation.verifiedByHuman ? "Human-verified" : "Metadata verified · human review pending"}
          </span>
          <div className="flex items-center gap-3">
            <SaveToNotebook
              compact
              entry={{
                key: `study:${study.id}`,
                type: "study",
                title: study.title,
                subtitle: `${study.authors[0]} et al. · ${study.journal} · ${study.year}`,
                href: `/evidence/${study.id}`,
                aiGenerated: false,
              }}
            />
            <Link href={`/evidence/${study.id}`} className="text-amber underline decoration-amber/30 underline-offset-4">
              Full record →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvidenceBrowser() {
  const params = useSearchParams();
  const all = getStudies();
  const assertions = getAssertions();
  const years = all.map((s) => s.year);
  const yMin = Math.min(...years);
  const yMax = Math.max(...years);

  const valid = (v: string | null, ok: (x: string) => boolean) => (v && ok(v) ? v : "");
  const [text, setText] = useState(params.get("q") ?? "");
  const [disorder, setDisorder] = useState(valid(params.get("disorder"), (x) => getDisorders().some((d) => d.id === x)));
  const [modality, setModality] = useState(valid(params.get("modality"), (x) => getModalities().some((m) => m.id === x)));
  const [region, setRegion] = useState(valid(params.get("region"), (x) => !!getRegion(x)));
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(yMin);
  const [to, setTo] = useState(yMax);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "largest">("newest");
  const [selected, setSelected] = useState<string | null>(null);

  const studiesByRegion = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assertions) (m.get(a.region) ?? m.set(a.region, new Set()).get(a.region)!).add(a.studyId);
    return m;
  }, [assertions]);
  const regionOptions = useMemo(
    () =>
      getAtlas()
        .regions.filter((r) => studiesByRegion.has(r.id))
        .map((r) => ({ id: r.id, label: regionLabel(r.id), kind: r.kind, n: studiesByRegion.get(r.id)!.size }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [studiesByRegion],
  );

  const studies = useMemo(() => {
    const q = text.trim().toLowerCase();
    const inRegion = region ? studiesByRegion.get(region) : null;
    return all
      .filter((s) => {
        if (disorder && !s.disorders.includes(disorder)) return false;
        if (modality && !s.modalities.includes(modality)) return false;
        if (inRegion && !inRegion.has(s.id)) return false;
        if (direction === "none" ? s.direction !== null : direction && s.direction !== direction) return false;
        if (s.year < from || s.year > to) return false;
        if (verifiedOnly && !s.curation.verifiedByHuman) return false;
        if (q) {
          const hay = `${s.title} ${s.authors.join(" ")} ${s.journal} ${s.finding} ${s.year} ${s.doi ?? ""} ${s.pmid ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sort === "newest"
          ? b.year - a.year || a.title.localeCompare(b.title)
          : sort === "oldest"
            ? a.year - b.year || a.title.localeCompare(b.title)
            : (b.sampleSize ?? -1) - (a.sampleSize ?? -1),
      );
  }, [all, text, disorder, modality, region, direction, from, to, verifiedOnly, sort, studiesByRegion]);

  const active = [disorder, modality, region, direction, verifiedOnly ? "v" : "", text, from !== yMin || to !== yMax ? "y" : ""].filter(Boolean).length;
  const reset = () => {
    setText(""); setDisorder(""); setModality(""); setRegion(""); setDirection("");
    setFrom(yMin); setTo(yMax); setVerifiedOnly(false);
  };
  const selectedStudy = selected ? all.find((s) => s.id === selected) : undefined;
  const modAbbr = new Map(getModalities().map((m) => [m.id, m.abbreviation]));
  const yearOpts = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);

  return (
    <div>
      <PageHeader eyebrow="Research application · Evidence" title="Evidence browser">
        <p>
          The complete indexed corpus. Every study enters from its PubMed record, is verified against
          PubMed and OpenAlex, and, where the abstract names an atlas-mappable region, is broken into
          region-level assertions you can trace back to the paper. Curated, not a systematic review.
        </p>
      </PageHeader>

      <Panel className="mt-8 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search title, author, journal, finding, DOI, PMID…"
            aria-label="Filter studies"
            className="min-w-56 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-text placeholder:text-text-3 focus:border-amber/60 focus:outline-none"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className={selectClass}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="largest">Largest sample</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={disorder} onChange={(e) => setDisorder(e.target.value)} aria-label="Disorder filter" className={selectClass}>
            <option value="">All disorders</option>
            {getDisorders().map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region filter" className={`${selectClass} max-w-56`}>
            <option value="">All regions</option>
            <optgroup label="Cortical">
              {regionOptions.filter((r) => r.kind === "cortical").map((r) => (
                <option key={r.id} value={r.id}>{r.label} · {r.n}</option>
              ))}
            </optgroup>
            <optgroup label="Subcortical">
              {regionOptions.filter((r) => r.kind === "subcortical").map((r) => (
                <option key={r.id} value={r.id}>{r.label} · {r.n}</option>
              ))}
            </optgroup>
          </select>
          <select value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Modality filter" className={selectClass}>
            <option value="">All modalities</option>
            {getModalities().map((m) => (
              <option key={m.id} value={m.id}>{m.abbreviation}</option>
            ))}
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction filter" className={selectClass}>
            <option value="">Any direction</option>
            <option value="increased">Increased</option>
            <option value="decreased">Decreased</option>
            <option value="mixed">Mixed</option>
            <option value="none">No direction</option>
          </select>
          <span className="flex items-center gap-1.5 text-[12px] text-text-3">
            <select value={from} onChange={(e) => setFrom(Math.min(Number(e.target.value), to))} aria-label="From year" className={selectClass}>
              {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            to
            <select value={to} onChange={(e) => setTo(Math.max(Number(e.target.value), from))} aria-label="To year" className={selectClass}>
              {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-text-2">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-amber" />
            human-verified only
          </label>
          {active > 0 && (
            <button type="button" onClick={reset} className="ml-auto text-[12px] text-amber hover:text-amber/80">
              Clear filters ({active})
            </button>
          )}
        </div>
      </Panel>

      <p className="mt-5 text-[12px] text-text-3" aria-live="polite">
        {studies.length} of {all.length} studies
      </p>

      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_26rem]">
        {studies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-[14px] text-text">No indexed studies match these filters.</p>
            <p className="mt-1 text-[12px] text-text-3">The corpus is curated and small — absence here is not evidence of absence.</p>
            <button type="button" onClick={reset} className="mt-4 text-[12px] text-amber">Clear filters</button>
          </div>
        ) : (
          <ul className="space-y-2">
            {studies.map((s) => {
              const isSel = s.id === selected;
              const nReg = new Set(assertions.filter((a) => a.studyId === s.id).map((a) => a.region)).size;
              return (
                <li key={s.id} className={`rounded-lg border p-3.5 transition-colors ${isSel ? "border-amber/50 bg-surface/60" : "border-line bg-ink-2/60 hover:border-line-strong"}`}>
                  <Link href={`/evidence/${s.id}`} className="text-[13px] leading-snug text-text hover:text-amber">
                    {s.title}
                  </Link>
                  <p className="mt-1 text-[11px] text-text-3">
                    {surname(s.authors[0])}{s.authors.length > 1 ? " et al." : ""} · {s.journal} · {s.year} ·{" "}
                    {s.modalities.map((m) => modAbbr.get(m) ?? m).join(", ")}
                    {s.direction && ` · ${DIR_GLYPH[s.direction]} ${s.direction}`}
                    {s.sampleSize !== null && ` · n = ${s.sampleSize.toLocaleString("en")}`}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">{s.finding}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-text-3">{s.disorders.map(disorderName).join(", ")}</span>
                    <span className="text-text-3">· {nReg} {nReg === 1 ? "region" : "regions"}</span>
                    {s.doi && <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">DOI</a>}
                    {s.pmid && <a href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-2 hover:text-text">PMID {s.pmid}</a>}
                    <button type="button" onClick={() => setSelected(isSel ? null : s.id)} aria-pressed={isSel} className="ml-auto text-amber hover:text-amber/80">
                      {isSel ? "Close detail" : "Trace evidence"}
                    </button>
                  </div>
                  {isSel && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-ink-2 lg:hidden">
                      <StudyDetail study={s} onClose={() => setSelected(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {selectedStudy ? (
            <Panel className="hidden overflow-hidden lg:block">
              <StudyDetail study={selectedStudy} onClose={() => setSelected(null)} />
            </Panel>
          ) : (
            <Panel className="hidden p-5 lg:block">
              <p className="text-[10px] uppercase tracking-[0.18em] text-text-3">Traceability</p>
              <p className="mt-2 text-[13px] leading-relaxed text-text-2">
                Choose <span className="text-amber">Trace evidence</span> on any study to see its
                region assertions, the disorders they concern, and links to the 3D atlas and to the
                original publication.
              </p>
              <p className="mt-4 font-mono text-[11px] text-text-3">region → assertion → study → DOI / PMID</p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
