"use client";

import Link from "next/link";
import { surname } from "@/lib/evidence/summary";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getEvidenceIndex, getStudy } from "@/lib/repo/evidence";
import { getDisorders } from "@/lib/repo/entities";
import { getAtlas, getRegion } from "@/lib/repo/atlas";
import {
  computeProfiles,
  NOT_ASSESSED_DIMENSIONS,
  type ConvergenceProfile,
} from "@/lib/evidence/convergence";
import { EVIDENCE_LEVEL_LABEL, NO_FILTERS } from "@/lib/evidence/metrics";
import { PageHeader, Panel, PanelTitle, Segmented, selectClass } from "@/components/PageHeader";

const CATS = ["imaging", "electrophysiology", "stimulation"] as const;
const CAT_LABEL: Record<string, string> = {
  imaging: "Imaging",
  electrophysiology: "Electrophys.",
  stimulation: "Stimulation",
};
const HEMI = { left: "L", right: "R", midline: "" } as const;

function regionLabel(id: string) {
  const r = getRegion(id);
  return r ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}` : id;
}
function disorderName(id: string) {
  return getDisorders().find((d) => d.id === id)?.name ?? id;
}
const keyOf = (p: ConvergenceProfile) => `${p.disorder}|${p.region}`;

function StudyChip({ id }: { id: string }) {
  const s = getStudy(id);
  if (!s) return null;
  return (
    <Link
      href={`/evidence/${id}`}
      title={s.title}
      className="rounded border border-line px-1.5 py-0.5 text-[11px] text-text-2 hover:border-amber/50 hover:text-text"
    >
      {surname(s.authors[0])} {s.year}
    </Link>
  );
}

function CategoryDots({ p }: { p: ConvergenceProfile }) {
  return (
    <>
      {CATS.map((c) => {
        const n = p.categoryStudies[c]?.length ?? 0;
        return (
          <td key={c} className="px-2 py-2.5 text-center">
            {n > 0 ? (
              <span className="inline-flex items-center gap-1.5" title={`${n} ${CAT_LABEL[c]} ${n === 1 ? "study" : "studies"}`}>
                <span
                  aria-hidden
                  className="inline-block rounded-full bg-cyan"
                  style={{ width: 5 + Math.min(n, 8) * 1.6, height: 5 + Math.min(n, 8) * 1.6 }}
                />
                <span className="tabular-nums text-text-2">{n}</span>
              </span>
            ) : (
              <span className="text-text-3" aria-label="none">·</span>
            )}
          </td>
        );
      })}
    </>
  );
}

function Direction({ p }: { p: ConvergenceProfile }) {
  if (!p.direction.assessed) return <span className="text-text-3">not assessed</span>;
  return (
    <span className="tabular-nums text-text-2">
      {Math.round(p.direction.ratio! * 100)}%
      <span className="text-text-3"> ({p.direction.agreeing}/{p.direction.total})</span>
    </span>
  );
}

function ProfileDetail({ p }: { p: ConvergenceProfile }) {
  return (
    <div className="grid gap-5 px-5 pb-5 pt-1 md:grid-cols-2">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">Studies by modality category</p>
        <ul className="mt-2 space-y-2">
          {CATS.map((c) => (
            <li key={c} className="text-[12px]">
              <span className="text-text-2">{CAT_LABEL[c]}: </span>
              {(p.categoryStudies[c] ?? []).length === 0 ? (
                <span className="text-text-3">none indexed</span>
              ) : (
                <span className="inline-flex flex-wrap gap-1 align-middle">
                  {p.categoryStudies[c].map((id) => (
                    <StudyChip key={id} id={id} />
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3 text-[12px]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">Conflicts</p>
          {p.conflicts.length === 0 ? (
            <p className="mt-1 text-text-3">No directional conflict among indexed studies.</p>
          ) : (
            p.conflicts.map((c) => (
              <p key={c.findingType} className="mt-1 text-text-2">
                <span className="text-conflict">{c.findingType.replace(/_/g, " ")}</span>: increased{" "}
                {c.increased.map((id) => <StudyChip key={id} id={id} />)} vs decreased{" "}
                {c.decreased.map((id) => <StudyChip key={id} id={id} />)} · {c.differences.years[0]}–
                {c.differences.years[1]}. Not adjudicated.
              </p>
            ))
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-3">Intervention coverage</p>
          <p className="mt-1 text-text-2">
            {p.interventionalStudyIds.length} interventional · {p.correlationalStudyIds.length} correlational
            {p.interventionalStudyIds.length > 0 && (
              <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                {p.interventionalStudyIds.map((id) => <StudyChip key={id} id={id} />)}
              </span>
            )}
          </p>
        </div>
        <p className="text-[11px] text-text-3">
          Not assessed (schema cannot support): {p.notAssessed.map((d) => d.replace(/_/g, " ")).join(", ")}.
        </p>
        <Link
          href={`/brain?disorder=${p.disorder}&region=${p.region}&mode=convergence`}
          className="inline-block text-[12px] text-amber underline decoration-amber/30 underline-offset-4"
        >
          View on the 3D brain →
        </Link>
      </div>
    </div>
  );
}

export function ConvergenceExplorer() {
  const params = useSearchParams();
  const atlasIds = useMemo(() => new Set(getAtlas().regions.map((r) => r.id)), []);
  const initRegion = params.get("region");
  const initDisorder = params.get("disorder");
  const [view, setView] = useState<"disorder" | "region">(
    initRegion && !initDisorder ? "region" : "disorder",
  );
  const [disorder, setDisorder] = useState<string>(
    initDisorder && getDisorders().some((d) => d.id === initDisorder) ? initDisorder : "",
  );
  const [region, setRegion] = useState<string>(
    initRegion && atlasIds.has(initRegion) ? initRegion : "",
  );
  const [minCats, setMinCats] = useState<"1" | "2">("1");
  const [sort, setSort] = useState<"studies" | "categories" | "consistency">("categories");
  const [open, setOpen] = useState<string | null>(
    initRegion && initDisorder ? `${initDisorder}|${initRegion}` : null,
  );
  const [pinned, setPinned] = useState<string[]>([]);

  const all = useMemo(() => computeProfiles(getEvidenceIndex(), null, NO_FILTERS), []);
  const regionsWithEvidence = useMemo(
    () =>
      [...new Set(all.map((p) => p.region))]
        .map((id) => ({ id, label: regionLabel(id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [all],
  );

  const rows = useMemo(() => {
    let r = all;
    if (view === "disorder" && disorder) r = r.filter((p) => p.disorder === disorder);
    if (view === "region") r = region ? r.filter((p) => p.region === region) : [];
    if (minCats === "2") r = r.filter((p) => p.modalityCategories.length >= 2);
    const by = {
      studies: (a: ConvergenceProfile, b: ConvergenceProfile) => b.studyIds.length - a.studyIds.length,
      categories: (a: ConvergenceProfile, b: ConvergenceProfile) =>
        b.modalityCategories.length - a.modalityCategories.length || b.studyIds.length - a.studyIds.length,
      consistency: (a: ConvergenceProfile, b: ConvergenceProfile) =>
        (b.direction.ratio ?? -1) - (a.direction.ratio ?? -1) || b.studyIds.length - a.studyIds.length,
    }[sort];
    return [...r].sort(by);
  }, [all, view, disorder, region, minCats, sort]);

  const pinnedProfiles = pinned
    .map((k) => all.find((p) => keyOf(p) === k))
    .filter((p): p is ConvergenceProfile => !!p);

  const togglePin = (k: string) =>
    setPinned((ps) => (ps.includes(k) ? ps.filter((x) => x !== k) : [...ps, k].slice(-3)));

  return (
    <div>
      <PageHeader eyebrow="Research application · Convergence" title="Convergence explorer">
        <p>
          Every indexed region–disorder pair has a profile: how many studies, how many{" "}
          <em>independent</em> modality categories, whether directions agree, whether any study
          intervened. The dimensions are reported side by side and never collapsed into one score.
        </p>
      </PageHeader>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="Explore by"
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { value: "disorder", label: "By disorder" },
            { value: "region", label: "Region across disorders" },
          ]}
        />
        {view === "disorder" ? (
          <select value={disorder} onChange={(e) => setDisorder(e.target.value)} aria-label="Disorder" className={selectClass}>
            <option value="">All indexed disorders</option>
            {getDisorders().map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        ) : (
          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region" className={selectClass}>
            <option value="">Choose a region…</option>
            {regionsWithEvidence.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}
        <Segmented
          label="Minimum modality categories"
          value={minCats}
          onChange={setMinCats}
          options={[
            { value: "1", label: "All pairs" },
            { value: "2", label: "≥2 categories" },
          ]}
        />
        <label className="flex items-center gap-2 text-[12px] text-text-3">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectClass}>
            <option value="categories">Modality categories</option>
            <option value="studies">Study count</option>
            <option value="consistency">Direction consistency</option>
          </select>
        </label>
        <span className="ml-auto text-[12px] tabular-nums text-text-3">{rows.length} profiles</span>
      </div>

      {pinnedProfiles.length > 0 && (
        <Panel className="mt-6">
          <PanelTitle note="Pinned profiles, dimension by dimension. Pin up to three rows with the ☆ control.">
            Compare profiles
          </PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                  <th className="px-5 py-2 font-normal">Dimension</th>
                  {pinnedProfiles.map((p) => (
                    <th key={keyOf(p)} className="px-4 py-2 font-normal normal-case tracking-normal">
                      <span className="block text-[12px] text-text">{regionLabel(p.region)}</span>
                      <span className="block text-[11px] text-text-3">{disorderName(p.disorder)}</span>
                      <button type="button" onClick={() => togglePin(keyOf(p))} className="mt-1 text-[10px] text-text-3 hover:text-text">
                        unpin
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {[
                  { k: "Distinct studies", f: (p: ConvergenceProfile) => p.studyIds.length },
                  { k: "Modality categories", f: (p: ConvergenceProfile) => p.modalityCategories.join(" + ") || "—" },
                  ...CATS.map((c) => ({ k: `· ${CAT_LABEL[c]} studies`, f: (p: ConvergenceProfile) => p.categoryStudies[c]?.length ?? 0 })),
                  { k: "Direction consistency", f: (p: ConvergenceProfile) => (p.direction.assessed ? `${Math.round(p.direction.ratio! * 100)}% (${p.direction.agreeing}/${p.direction.total})` : "not assessed") },
                  { k: "Conflicts", f: (p: ConvergenceProfile) => p.conflicts.length },
                  { k: "Interventional studies", f: (p: ConvergenceProfile) => p.interventionalStudyIds.length },
                  { k: "Rule-based level", f: (p: ConvergenceProfile) => EVIDENCE_LEVEL_LABEL[p.level] },
                ].map((row) => (
                  <tr key={row.k}>
                    <td className="px-5 py-2 text-text-3">{row.k}</td>
                    {pinnedProfiles.map((p) => (
                      <td key={keyOf(p)} className="px-4 py-2 tabular-nums text-text">{String(row.f(p))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_18rem]">
        <Panel className="overflow-hidden">
          {view === "region" && !region ? (
            <p className="px-5 py-10 text-center text-[13px] text-text-3">
              Choose a region to see its convergence profile for every disorder it is linked to.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-text-3">
              No profiles match. The corpus is curated and small — absence here is not evidence of absence.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-[12px]">
                <thead className="sticky top-0 bg-ink-2">
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                    <th className="w-8 px-3 py-2.5 font-normal"><span className="sr-only">Pin</span></th>
                    <th className="px-2 py-2.5 font-normal">{view === "region" ? "Disorder" : "Region · disorder"}</th>
                    <th className="px-2 py-2.5 text-right font-normal">Studies</th>
                    {CATS.map((c) => (
                      <th key={c} className="px-2 py-2.5 text-center font-normal">{CAT_LABEL[c]}</th>
                    ))}
                    <th className="px-2 py-2.5 font-normal">Direction</th>
                    <th className="px-2 py-2.5 text-center font-normal">Conflicts</th>
                    <th className="px-2 py-2.5 text-center font-normal">Interv.</th>
                    <th className="px-4 py-2.5 text-right font-normal">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const k = keyOf(p);
                    const isOpen = open === k;
                    return (
                      <FragmentRow key={k}>
                        <tr className={`border-t border-line/70 ${isOpen ? "bg-surface/50" : "hover:bg-surface/40"}`}>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              aria-pressed={pinned.includes(k)}
                              aria-label={`Pin ${regionLabel(p.region)} — ${disorderName(p.disorder)} for comparison`}
                              onClick={() => togglePin(k)}
                              className={pinned.includes(k) ? "text-amber" : "text-text-3 hover:text-text"}
                            >
                              {pinned.includes(k) ? "★" : "☆"}
                            </button>
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => setOpen(isOpen ? null : k)}
                              className="text-left"
                            >
                              {view === "region" ? (
                                <span className="text-text">{disorderName(p.disorder)}</span>
                              ) : (
                                <>
                                  <span className="block text-text">{regionLabel(p.region)}</span>
                                  {!disorder && <span className="block text-[11px] text-text-3">{disorderName(p.disorder)}</span>}
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-text">{p.studyIds.length}</td>
                          <CategoryDots p={p} />
                          <td className="px-2 py-2.5"><Direction p={p} /></td>
                          <td className={`px-2 py-2.5 text-center tabular-nums ${p.conflicts.length ? "text-conflict" : "text-text-3"}`}>
                            {p.conflicts.length || "·"}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-text-2">{p.interventionalStudyIds.length || "·"}</td>
                          <td className="px-4 py-2.5 text-right text-[11px] text-text-2">{EVIDENCE_LEVEL_LABEL[p.level]}</td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-surface/50">
                            <td colSpan={10}><ProfileDetail p={p} /></td>
                          </tr>
                        )}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="space-y-4 text-[12px] leading-relaxed">
          <Panel className="p-4">
            <h2 className="text-[13px] text-text">How to read a profile</h2>
            <dl className="mt-3 space-y-2.5 text-text-3">
              <div><dt className="text-text-2">Studies</dt><dd>Distinct studies with ≥1 assertion for the pair.</dd></div>
              <div><dt className="text-text-2">Modality categories</dt><dd>Imaging, electrophysiology, stimulation. fMRI + sMRI count once — convergence measures methodological independence.</dd></div>
              <div><dt className="text-text-2">Direction consistency</dt><dd>Share of (study, finding type, direction) units agreeing with their finding type&rsquo;s majority. Not assessed below 2 units.</dd></div>
              <div><dt className="text-text-2">Conflicts</dt><dd>Same finding type, opposite directions. Listed with both sides, never adjudicated.</dd></div>
              <div><dt className="text-text-2">Level</dt><dd>Mixed → Strong (≥3 studies, ≥2 categories) → Moderate (≥2) → Emerging (1).</dd></div>
            </dl>
          </Panel>
          <p className="rounded-lg border-l-2 border-amber/60 bg-surface/40 px-4 py-3 text-text-2">
            Convergence describes the indexed corpus. It does not establish causation, and evidence
            density is not evidence quality.
          </p>
          <p className="text-[11px] text-text-3">
            Not assessed by the current schema: {NOT_ASSESSED_DIMENSIONS.map((d) => d.replace(/_/g, " ")).join(", ")}. Full
            definitions on the <Link href="/about#metrics" className="underline decoration-line-strong underline-offset-4 hover:text-text">methodology page</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
