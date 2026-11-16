import type { Metadata } from "next";
import Link from "next/link";
import { getEvidenceIndex, getGaps, getStudies } from "@/lib/repo/evidence";
import { getRegion } from "@/lib/repo/atlas";
import { computeOverlay, sequentialColor } from "@/lib/evidence/overlay";
import { NO_FILTERS, EVIDENCE_LEVEL_LABEL } from "@/lib/evidence/metrics";
import {
  categoryDistribution,
  conflicts,
  convergentPairs,
  corpusCounts,
  disorderCoverage,
  disorderName,
  gapCountsByRule,
  modalityCoverage,
  regionLabel,
  regionStudyCounts,
  studiesByYear,
  studyRef,
} from "@/lib/evidence/summary";
import { rankExplanation, rankScore } from "@/ai/questions";
import { retrieve } from "@/ai/retrieval";
import { GAP_RULES } from "@/lib/evidence/gaps";
import disorderManifest from "../../data/embeddings/disorder.manifest.json";
import disorderLoadings from "../../data/embeddings/disorder.loadings.json";
import { AtlasStory, type RegionEvidence } from "@/landing/AtlasStory";
import { BarList, Columns, Counter, Reveal } from "@/landing/ui";
import { RepresentationPreview, type RepPoint } from "@/landing/RepresentationPreview";
import { getDisorders } from "@/lib/repo/entities";
import { GITHUB_URL } from "@/lib/site";
import { SiteNav } from "@/site/SiteNav";
import { Mark } from "@/site/Mark";
import { AucStrip, Chapter, Display, Fn, Kicker, Lead } from "@/site/ui";
import { DisorderPicker } from "@/site/DisorderPicker";
import { ProvenanceTrace } from "@/site/ProvenanceTrace";
import { NetworksStage } from "@/site/NetworksStage";
import { AskDemo } from "@/site/AskDemo";
import {
  encoderData,
  networkData,
  pairWaffle,
  pickerData,
  recordedAnswer,
  traceFindings,
} from "@/site/data";

export const metadata: Metadata = {
  title: "NOĒSIS · Brain evidence atlas",
  description:
    "A 3D atlas of the human brain linked to a verified evidence corpus: where findings on 19 psychiatric and neurological disorders point, how strong they are, where studies disagree, and which questions remain open.",
  openGraph: {
    title: "NOĒSIS · Brain evidence atlas",
    description:
      "A real fsaverage brain atlas, a DOI/PMID-verified evidence corpus and a citation-checked research assistant.",
    type: "website",
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  imaging: "Imaging",
  electrophysiology: "Electrophysiology",
  stimulation: "Stimulation",
};

const WAFFLE_TONE: Record<number, string> = {
  1: "bg-line-strong",
  2: "bg-cyan",
  3: "bg-text",
};

export default function LandingPage() {
  const counts = corpusCounts();
  const index = getEvidenceIndex();

  // ---- atlas story (unchanged): evidence-derived only ----
  const density = computeOverlay("disorder", [], NO_FILTERS);
  const densityRamp = [0.1, 0.3, 0.5, 0.7, 0.9, 1].map((t) => sequentialColor(t, 1));
  const studyCounts = regionStudyCounts();
  const regionEvidence: RegionEvidence = Object.fromEntries(
    [...studyCounts.entries()].map(([id, n]) => [
      id,
      [
        n,
        index
          .byRegion(id, NO_FILTERS)
          .slice(0, 2)
          .map((p) => [disorderName(p.disorder), p.studyIds.length] as [string, number]),
      ],
    ]),
  );
  const regionTotal = counts.corticalRegions + counts.subcorticalRegions;

  // ---- chapters ----
  const picker = pickerData();
  const findings = traceFindings(5);
  const waffle = pairWaffle();
  const catDist = categoryDistribution();
  const totalPairs = waffle.length;
  const multiPairs = waffle.filter((w) => w.categories >= 2).length;
  const convergent = convergentPairs();
  const strongPairs = index.pairsForDisorder(null, NO_FILTERS).filter((p) => p.level === "strong").length;
  const conflictList = conflicts();
  const conflictCards = Object.values(
    conflictList.reduce<Record<string, (typeof conflictList)[number][]>>((acc, c) => {
      const key = `${c.disorder}|${getRegion(c.region)?.name}|${c.findingType}|${c.increased.map((s) => s.id).join()}|${c.decreased.map((s) => s.id).join()}`;
      (acc[key] ??= []).push(c);
      return acc;
    }, {}),
  );
  const coverage = disorderCoverage();
  const years = studiesByYear();
  const modCov = modalityCoverage();
  const metaCount = getStudies().filter((s) => /meta-?analy|mega-?analy|systematic review/i.test(s.title)).length;
  const nets = networkData();
  const enc = encoderData();
  const gapRules = gapCountsByRule();
  const gaps = getGaps();
  const topGap = [...gaps].sort((a, b) => rankScore(b) - rankScore(a) || a.region.localeCompare(b.region))[0];
  const proj = disorderManifest.projections.pca as [number, number][];
  const disorders = getDisorders();
  const repPoints: RepPoint[] = disorderManifest.ids.map((id, i) => ({
    id,
    label: disorderName(id),
    x: proj[i][0],
    y: proj[i][1],
    category: (disorders.find((d) => d.id === id)?.category ?? "psychiatric") as RepPoint["category"],
    studies: coverage.find((c) => c.id === id)?.studies ?? 0,
  }));
  const pc = disorderLoadings.components;
  const rec = recordedAnswer();
  const retrieval = retrieve(rec.question, {
    intent: "question",
    disorders: ["major_depressive_disorder"],
    regions: [],
    modalities: [],
    vizCommand: null,
  });
  const alphaMax = Math.max(...enc.eeg.alpha.flatMap((a) => [a.AD, a.FTD, a.CN]));
  const dMax = Math.max(...enc.mri.thinning.map((t) => t.d));

  const highlights = [
    { href: "#disorders", k: "Atlas", v: regionTotal, u: "regions", t: "A real brain, region by region" },
    { href: "#evidence", k: "Evidence", v: counts.studies, u: "studies", t: "Every one resolves to a DOI or PMID" },
    { href: "#convergence", k: "Convergence", v: multiPairs, u: "pairs", t: "Supported by more than one kind of method" },
    { href: "#gaps", k: "Gaps", v: gaps.length, u: "gaps", t: "Found by four published rules" },
    { href: "#multimodal", k: "Encoders", v: Object.keys(enc).length, u: "analyses", t: "EEG, MRI and resting-state fMRI" },
    { href: "#ask", k: "Assistant", v: rec.citedIds.length, u: "citations", t: "In one recorded answer, all checked" },
  ];

  return (
    <>
      <SiteNav />
      <main id="top" className="route-fade flex-1">
        {/* ------------- N1 + N3: hero and the atlas story (unchanged) ------------- */}
        <AtlasStory
          densityColors={Object.fromEntries(density.colors)}
          densityMax={density.max}
          densityRamp={densityRamp}
          regionEvidence={regionEvidence}
          counts={{
            assertions: counts.assertions,
            cortical: counts.corticalRegions,
            subcortical: counts.subcorticalRegions,
            regionsWithEvidence: counts.regionsWithEvidence,
            studies: counts.studies,
            disorders: counts.disorders,
          }}
        />

        {/* ------------- N2: highlights ------------- */}
        <Chapter id="highlights" label="Highlights" className="py-20 sm:py-28">
          <Reveal>
            <Kicker>Highlights</Kicker>
            <h2 className="mt-3 text-[32px] font-medium tracking-[-0.025em] text-text sm:text-[44px]">Six ways into the evidence.</h2>
          </Reveal>
          <ul className="snap-strip -mx-5 mt-10 flex gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
            {highlights.map((h, i) => (
              <li key={h.href} className="w-[78vw] max-w-[320px] shrink-0 lg:w-auto lg:max-w-none">
                <Reveal delay={i * 50} className="h-full">
                  <a href={h.href} className="group flex h-full flex-col rounded-[4px] border border-line bg-white p-6 transition-colors hover:border-text">
                    <span className="font-mono text-[11px] text-text-3">{h.k}</span>
                    <span className="mt-6 flex items-baseline gap-2">
                      <Counter value={h.v} className="text-[52px] font-medium leading-none tracking-[-0.03em] text-text" />
                      <span className="text-[14px] text-text-2">{h.u}</span>
                    </span>
                    <span className="mt-3 text-[15px] leading-snug text-text-2">{h.t}</span>
                    <span aria-hidden className="mt-6 text-[13px] text-text-3 group-hover:text-text">
                      Go to chapter →
                    </span>
                  </a>
                </Reveal>
              </li>
            ))}
          </ul>
        </Chapter>

        {/* ------------- N4: region x disorder (graphite) ------------- */}
        <Chapter id="disorders" tone="graphite" label="Region by disorder" bleed>
          <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-24 sm:px-8 sm:pt-32">
            <Reveal>
              <Kicker dark>Region × disorder</Kicker>
              <Display dark>Choose a disorder. Watch the evidence move.</Display>
              <Lead dark>
                Each of the {counts.disorders} disorders recolours the same brain by the number of indexed studies
                that link a region to it.<Fn n={2} /> Every shaded region opens onto the findings and the
                publications behind it.
              </Lead>
            </Reveal>
          </div>
          <div className="border-y border-graphite-line">
            <DisorderPicker
              disorders={picker.disorders}
              sources={picker.sources}
              ramp={picker.ramp}
              regionCount={regionTotal}
            />
          </div>
          <div className="mx-auto max-w-[1280px] px-5 py-6 sm:px-8">
            <p className="max-w-3xl text-[12px] leading-relaxed text-offwhite-3">
              Shading shows research attention in a curated corpus, not effect size and not a cause. Levels are
              rule-based.<Fn n={3} />
            </p>
          </div>
        </Chapter>

        {/* ------------- N5: provenance ------------- */}
        <Chapter id="evidence" label="Provenance" className="py-24 sm:py-32">
          <Reveal>
            <Kicker>Provenance</Kicker>
            <Display>Every finding has an address.</Display>
            <Lead>
              A shaded region is never an opinion. It is a count of assertions, and every assertion points to one
              study with a DOI or PMID that was checked against PubMed and OpenAlex before it was indexed. Pick a
              finding and follow it to its source.
            </Lead>
          </Reveal>

          <Reveal className="mt-14">
            <ProvenanceTrace findings={findings} />
          </Reveal>

          <Reveal className="mt-24">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-10 border-t border-line pt-10 sm:grid-cols-4">
              {[
                { v: counts.studies, l: "verified studies" },
                { v: counts.assertions, l: "assertions" },
                { v: counts.disorders, l: "disorders" },
                { v: counts.regionsWithEvidence, l: `of ${regionTotal} regions with evidence` },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="sr-only">{s.l}</dt>
                  <dd>
                    <Counter value={s.v} className="text-[56px] font-medium leading-none tracking-[-0.03em] text-text sm:text-[72px]" />
                    <p className="mt-2 text-[14px] text-text-2">{s.l}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[12px] text-text-3">
              Publications from {counts.yearMin} to {counts.yearMax}.<Fn n={1} />{" "}
              {counts.humanVerified === 0
                ? `Metadata of all ${counts.studies} studies is machine-verified; human spot-checks of the curated judgements are pending.`
                : `${counts.humanVerified} of ${counts.studies} studies human-verified.`}
            </p>
          </Reveal>

          <details className="site-details mt-10 border-y border-line">
            <summary className="flex items-center justify-between py-4 text-[15px] text-text">
              The corpus in detail: studies per disorder, publication years, methods
              <span className="site-details-sign text-[20px] text-text-3" aria-hidden>+</span>
            </summary>
            <div className="grid gap-12 pb-10 pt-4 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <h3 className="text-[14px] font-medium text-text">Studies per disorder</h3>
                <div className="mt-4">
                  <BarList
                    caption="Distinct indexed studies per disorder; a study about several disorders counts once for each."
                    unit="distinct studies"
                    rows={coverage.map((d) => ({
                      key: d.id,
                      label: d.name,
                      value: d.studies,
                      href: `/disorders/${d.id}`,
                      detail: `${d.regions} implicated ${d.regions === 1 ? "region" : "regions"} · ${d.category}`,
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-12">
                <div>
                  <h3 className="text-[14px] font-medium text-text">Publication years</h3>
                  <div className="mt-4">
                    <Columns
                      data={years.map((y) => ({ x: y.year, y: y.studies }))}
                      caption={`Indexed studies by publication year. ${metaCount} of ${counts.studies} indexed studies are meta- or mega-analyses (by title).`}
                      unit="studies"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-text">Methods</h3>
                  <div className="mt-4">
                    <BarList
                      caption="Studies using each method (a study can use several)."
                      unit="studies"
                      max={counts.studies}
                      rows={modCov.map((m) => ({ key: m.id, label: `${m.abbreviation} · ${m.category}`, value: m.studies }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
          <p className="mt-6">
            <Link href="/evidence" className="text-[14px] font-medium text-text underline underline-offset-4">
              Browse all {counts.studies} studies
            </Link>
          </p>
        </Chapter>

        {/* ------------- N6: agreement and disagreement ------------- */}
        <Chapter id="convergence" tone="white" label="Agreement and disagreement" className="py-24 sm:py-32">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center">
            <Reveal>
              <figure>
                <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`${totalPairs} region–disorder pairs; ${multiPairs} draw on two or more independent method categories.`}>
                  {waffle.map((w) => (
                    <span key={w.key} title={w.label} className={`h-3.5 w-3.5 rounded-[1px] sm:h-4 sm:w-4 ${WAFFLE_TONE[Math.min(w.categories, 3)]}`} />
                  ))}
                </div>
                <figcaption className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-text-2">
                  {catDist.map((d) => (
                    <span key={d.categories} className="inline-flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-[1px] ${WAFFLE_TONE[Math.min(d.categories, 3)]}`} aria-hidden />
                      {d.categories} {d.categories === 1 ? "category" : "categories"} · {d.pairs} pairs
                    </span>
                  ))}
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={80}>
              <Kicker>Where evidence converges</Kicker>
              <h2 className="mt-4 text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-text sm:text-[48px]">
                {multiPairs} of {totalPairs} region–disorder links rest on more than one kind of method.
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-text-2">
                A result seen with structural MRI and again with EEG or brain stimulation rests on methodologically
                independent evidence. NOĒSIS counts independent method <em>categories</em>, so two imaging methods
                count once.<Fn n={4} /> {strongPairs === 1 ? "One pair meets" : `${strongPairs} pairs meet`} the
                rule-based &ldquo;Strong&rdquo; label.
              </p>
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {convergent.slice(0, 6).map((p) => (
                  <li key={`${p.disorder}-${p.region}`}>
                    <Link href={`/convergence?disorder=${p.disorder}&region=${p.region}`} className="flex items-baseline justify-between gap-3 py-2.5 text-[14px] hover:bg-ink">
                      <span className="text-text">
                        {p.regionName} <span className="text-text-3">· {p.disorderName}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-text-3">
                        {Object.keys(p.categories)
                          .filter((c) => p.categories[c] > 0)
                          .map((c) => CATEGORY_LABEL[c] ?? c)
                          .join(" + ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-text-3">
                This may reflect how the corpus was curated rather than the literature. Agreement between methods does
                not establish causation.
              </p>
              <Link href="/convergence" className="mt-5 inline-block text-[14px] font-medium text-text underline underline-offset-4">
                Open the convergence explorer
              </Link>
            </Reveal>
          </div>

          {conflictCards.length > 0 && (
            <div className="mt-28 grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center">
              <Reveal>
                <Kicker>Where science disagrees</Kicker>
                <h2 className="mt-4 text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-text sm:text-[48px]">
                  When studies point in opposite directions, both stay on the page.
                </h2>
                <p className="mt-6 text-[17px] leading-relaxed text-text-2">
                  NOĒSIS does not decide between them. Each side is listed with its year, population and journal, and
                  the region is marked as a conflict on the atlas.
                </p>
              </Reveal>
              <Reveal delay={80}>
                {conflictCards.map((group) => {
                  const c = group[0];
                  return (
                    <article key={group.map((g) => g.region).join()} className="rounded-[4px] border border-conflict/40 bg-white">
                      <header className="border-b border-line px-6 py-5">
                        <p className="font-mono text-[11px] text-conflict">Directional conflict</p>
                        <h3 className="mt-2 text-[22px] font-medium text-text">
                          {group.map((g) => g.regionName).join(" and ")} · {c.disorderName}
                        </h3>
                        <p className="mt-1 text-[13px] text-text-3">
                          {c.findingType.replace(/_/g, " ")} findings, {c.years[0]}–{c.years[1]}
                        </p>
                      </header>
                      <div className="grid sm:grid-cols-2">
                        {(["increased", "decreased"] as const).map((side) => (
                          <div key={side} className={`p-6 ${side === "decreased" ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
                            <p className="text-[15px] text-text">
                              <span aria-hidden className="mr-2 text-conflict">{side === "increased" ? "▲" : "▼"}</span>
                              Reported {side}
                            </p>
                            <ul className="mt-4 space-y-4">
                              {c[side].map((s) => (
                                <li key={s.id}>
                                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[14px] text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text">
                                    {s.label}
                                  </a>
                                  <p className="mt-1 text-[12px] leading-snug text-text-3">
                                    {s.journal} · {s.population ?? "population not stated"}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </Reveal>
            </div>
          )}
        </Chapter>

        {/* ------------- N7: networks (graphite) ------------- */}
        <Chapter id="networks" tone="graphite" label="Brain networks" bleed>
          <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-24 sm:px-8 sm:pt-32">
            <Reveal>
              <Kicker dark>Large-scale networks</Kicker>
              <Display dark>Regions work in networks.</Display>
              <Lead dark>
                The {nets.corticalTotal} cortical regions are grouped into the seven resting-state networks of Yeo and
                colleagues, by how much of each region a network covers on the same fsaverage surface.<Fn n={5} /> These
                are published anatomical memberships. NOĒSIS draws no fibre tracts and no connections that are not in
                its data.
              </Lead>
            </Reveal>
          </div>
          <div className="border-t border-graphite-line">
            <NetworksStage networks={nets.networks} colors={nets.colors} />
          </div>
        </Chapter>

        {/* ------------- N8: multimodal ------------- */}
        <Chapter id="multimodal" label="Multimodal analysis" className="py-24 sm:py-32">
          <Reveal>
            <Kicker>Beyond the literature</Kicker>
            <Display>Three open datasets, three ways of measuring a brain.</Display>
            <Lead>
              Alongside the curated corpus, NOĒSIS runs small, fully documented analyses on public data. Each reports
              its uncertainty and a permutation test. These are group-level research results on single datasets, not
              diagnostic tools.
            </Lead>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            <Reveal className="h-full">
              <article className="flex h-full flex-col rounded-[4px] border border-line bg-white p-6">
                <p className="font-mono text-[11px] text-text-3">EEG · resting state</p>
                <h3 className="mt-3 text-[22px] font-medium leading-tight text-text">Less alpha power in Alzheimer&rsquo;s disease</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                  Relative alpha power by scalp zone, {enc.eeg.n} people with Alzheimer&rsquo;s disease, frontotemporal
                  dementia or no dementia.<Fn n={6} />
                </p>
                <figure className="mt-5">
                  <ul className="space-y-2.5" aria-label="Relative alpha power by scalp zone and group">
                    {enc.eeg.alpha.map((a) => (
                      <li key={a.site} className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
                        <span className="capitalize text-text-2">{a.site}</span>
                        <span className="relative h-3">
                          <span className="absolute inset-y-1/2 left-0 right-0 h-px bg-line" />
                          {(["CN", "FTD", "AD"] as const).map((g) => (
                            <span
                              key={g}
                              title={`${g}: ${a[g].toFixed(3)}`}
                              className={`absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full border-2 ${g === "CN" ? "border-text bg-white" : g === "AD" ? "border-cyan bg-cyan" : "border-amber-400 bg-amber-400"}`}
                              style={{ left: `${(a[g] / alphaMax) * 100}%` }}
                            />
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-3">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-text" />no dementia</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan" />Alzheimer&rsquo;s</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />FTD</span>
                    <span>share of 0.5–45 Hz power</span>
                  </figcaption>
                </figure>
                <div className="mt-auto pt-6">
                  <AucStrip label="Alzheimer’s vs controls" auc={enc.eeg.auc} lo={enc.eeg.lo} hi={enc.eeg.hi} p={enc.eeg.p} />
                </div>
              </article>
            </Reveal>

            <Reveal delay={60} className="h-full">
              <article className="flex h-full flex-col rounded-[4px] border border-line bg-white p-6">
                <p className="font-mono text-[11px] text-text-3">Structural MRI · cortical thickness</p>
                <h3 className="mt-3 text-[22px] font-medium leading-tight text-text">Thinner temporal cortex in schizophrenia</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                  Largest group differences in thickness, {enc.mri.nPatients} patients and {enc.mri.nControls} controls,
                  age and sex removed.<Fn n={7} />
                </p>
                <figure className="mt-5">
                  <ul className="space-y-2" aria-label="Cohen's d by region">
                    {enc.mri.thinning.map((t) => (
                      <li key={t.region} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[11px]">
                        <span className="truncate text-text-2">{t.region}</span>
                        <span className="font-mono text-text">d {t.d.toFixed(2)}</span>
                        <span className="col-span-2 mt-0.5 block h-1.5 bg-line">
                          <span className="block h-full bg-text-2" style={{ width: `${(t.d / dMax) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <figcaption className="mt-3 text-[11px] text-text-3">Cohen&rsquo;s d, controls minus patients; positive means thinner in patients.</figcaption>
                </figure>
                <div className="mt-auto pt-6">
                  <AucStrip label="Schizophrenia vs controls, per person" auc={enc.mri.auc} lo={enc.mri.lo} hi={enc.mri.hi} p={enc.mri.p} />
                  <p className="mt-2 text-[11px] leading-snug text-text-3">
                    The group pattern is visible, but it does not separate individuals better than chance.
                  </p>
                </div>
              </article>
            </Reveal>

            <Reveal delay={120} className="h-full">
              <article className="flex h-full flex-col rounded-[4px] border border-line bg-white p-6">
                <p className="font-mono text-[11px] text-text-3">Resting-state fMRI · connectivity</p>
                <h3 className="mt-3 text-[22px] font-medium leading-tight text-text">Resting connectivity in schizophrenia and ADHD</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                  Region-to-region correlations of the resting BOLD signal on the same atlas, {enc.conn.n} people from the
                  same cohort as the MRI card.<Fn n={8} />
                </p>
                <div className="mt-auto space-y-4 pt-6">
                  <AucStrip label="Schizophrenia vs controls" auc={enc.conn.auc} lo={enc.conn.lo} hi={enc.conn.hi} p={enc.conn.p} />
                  <AucStrip label="ADHD vs controls" auc={enc.conn.adhdAuc} lo={enc.conn.adhdLo} hi={enc.conn.adhdHi} p={enc.conn.adhdP} />
                  <p className="text-[11px] leading-snug text-text-3">
                    No signal for ADHD. Motion exclusions differ by group, so residual motion may contribute.
                  </p>
                </div>
              </article>
            </Reveal>
          </div>

          <div className="mt-24 grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
            <Reveal>
              <Kicker>Representations</Kicker>
              <h3 className="mt-4 text-[32px] font-medium leading-[1.08] tracking-[-0.025em] text-text sm:text-[40px]">
                Disorders placed by their evidence profiles.
              </h3>
              <p className="mt-5 text-[16px] leading-relaxed text-text-2">
                Each disorder is described by the regions, methods and findings the corpus links it to. A principal
                component projection puts similar profiles close together. Proximity here is not anatomical distance,
                shared biology or clinical similarity, and sparsely studied disorders can sit together simply because
                little is indexed for them.
              </p>
              <Link href="/ml" className="mt-5 inline-block text-[14px] font-medium text-text underline underline-offset-4">
                Explore the representation space
              </Link>
            </Reveal>
            <Reveal delay={80}>
              <RepresentationPreview points={repPoints} pc1={pc[0]?.explainedVarianceRatio ?? 0} pc2={pc[1]?.explainedVarianceRatio ?? 0} />
            </Reveal>
          </div>
        </Chapter>

        {/* ------------- N9: gaps to questions ------------- */}
        <Chapter id="gaps" tone="white" label="Research gaps" className="py-24 sm:py-32">
          <Reveal>
            <Kicker>Research gaps</Kicker>
            <Display>What is missing is a result too.</Display>
            <Lead>
              Four published rules scan the corpus for evidence that should exist but does not: a region studied
              repeatedly with imaging but never with electrophysiology, or an association never tested by intervention.
              {" "}{gaps.length} gaps are open today.<Fn n={9} />
            </Lead>
          </Reveal>

          <ol className="mt-16 grid gap-px overflow-hidden rounded-[4px] border border-line bg-line md:grid-cols-4">
            {[
              { tag: "Observed evidence", bar: "bg-text-2", d: "Assertions extracted from verified studies. The only layer that is evidence." },
              { tag: "Rule-based gap", bar: "bg-cyan", d: "A deterministic rule fires on the corpus. Reproducible and auditable." },
              { tag: "AI interpretation", bar: "bg-amber-400", d: "A model writes prose about one gap, citing only that gap’s studies. Labelled as AI." },
              { tag: "Proposed hypothesis", bar: "border border-dashed border-text-3 bg-transparent", d: "A question to test. Never a finding, never written back into the data." },
            ].map((t, i) => (
              <li key={t.tag} className="bg-white p-6 sm:p-7">
                <Reveal delay={i * 90}>
                  <span className={`block h-1 w-12 rounded-full ${t.bar}`} aria-hidden />
                  <p className="mt-6 font-mono text-[11px] text-text-3">Layer {i + 1}</p>
                  <p className="mt-1 text-[20px] font-medium text-text">{t.tag}</p>
                  <p className="mt-3 text-[14px] leading-relaxed text-text-2">{t.d}</p>
                </Reveal>
              </li>
            ))}
          </ol>

          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <Reveal>
              <h3 className="text-[15px] font-medium text-text">The four rules</h3>
              <ul className="mt-5 space-y-5">
                {gapRules.map((r) => (
                  <li key={r.ruleId} className="grid grid-cols-[1fr_auto] gap-x-4 border-l-2 border-cyan/60 pl-4">
                    <span className="text-[16px] text-text">{r.name}</span>
                    <span className="text-[28px] font-medium leading-none tracking-[-0.02em] text-cyan">{r.count}</span>
                    <span className="col-span-2 mt-1 text-[13px] leading-relaxed text-text-3">{r.definition}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            {topGap && (
              <Reveal delay={80}>
                <article className="rounded-[4px] border border-line bg-ink p-6 sm:p-7">
                  <p className="font-mono text-[11px] text-cyan">Highest-ranked gap · {GAP_RULES[topGap.ruleId].name}</p>
                  <h3 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.015em] text-text">
                    {regionLabel(topGap.region)} in {disorderName(topGap.disorder)}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-text-2">
                    {topGap.ruleId === "GAP-ATTENTION"
                      ? `${topGap.magnitude} indexed studies link this region to ${disorderName(topGap.referenceDisorder!)}, a disorder with an overlapping evidence footprint, but none link it to ${disorderName(topGap.disorder)}.`
                      : topGap.ruleId === "GAP-IMG-EP"
                        ? `${topGap.magnitude} imaging studies, no electrophysiology study for this pair.`
                        : topGap.ruleId === "GAP-OBS-INT"
                          ? `${topGap.magnitude} correlational studies, no interventional study for this pair.`
                          : "Independent studies report opposite directions."}
                  </p>
                  <p className="mt-3 text-[12px] text-text-3">Ranking: {rankExplanation(topGap)}.</p>
                  <p className="mt-5 font-mono text-[11px] text-text-3">Defined by</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {topGap.supportingStudyIds.slice(0, 6).map((id) => {
                      const s = studyRef(id);
                      return (
                        <li key={id}>
                          <a href={s.url} target="_blank" rel="noreferrer" title={s.title} className="block rounded-[3px] border border-line bg-white px-2 py-1 text-[12px] text-text-2 hover:border-text hover:text-text">
                            {s.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-5 text-[12px] leading-relaxed text-text-3">
                    On the Research Gaps page the assistant turns a gap into a question, rationale and method, citing only
                    these studies. A detected gap may be a gap in curation rather than in the literature.
                  </p>
                  <Link href="/gaps" className="mt-5 inline-block text-[14px] font-medium text-text underline underline-offset-4">
                    Explore all research gaps
                  </Link>
                </article>
              </Reveal>
            )}
          </div>
        </Chapter>

        {/* ------------- N10: ask ------------- */}
        <Chapter id="ask" label="Research assistant" className="py-24 sm:py-32">
          <Reveal>
            <Kicker>Ask NOĒSIS</Kicker>
            <Display>An assistant that can only cite what it was given.</Display>
            <Lead>
              The model sees a fixed set of retrieved records and nothing else. Citations outside that set are removed
              before an answer is shown. Below is one real answer, recorded once and kept verbatim.<Fn n={10} />
            </Lead>
          </Reveal>
          <Reveal className="mt-14">
            <AskDemo
              recorded={rec}
              retrievedCount={retrieval.studies.length}
              retrieval={retrieval.pairs.slice(0, 6).map((p) => ({
                region: p.region,
                regionName: regionLabel(p.region),
                studies: p.studyIds.length,
                level: EVIDENCE_LEVEL_LABEL[p.level],
              }))}
            />
          </Reveal>
        </Chapter>

        {/* ------------- N11: method and trust ------------- */}
        <Chapter id="method" tone="white" label="Method" className="py-24 sm:py-32">
          <Reveal>
            <Kicker>Method</Kicker>
            <Display>Built to be checked.</Display>
          </Reveal>
          <ol className="mt-14 divide-y divide-line border-y border-line">
            {[
              ["No invented science.", "Studies enter only through a curation pipeline that checks every DOI and PMID. When evidence is missing, the page says so."],
              ["The AI never writes data.", "It reads retrieved records and writes labelled interpretation. Nothing it says enters the evidence store."],
              ["Association is not cause.", "Every statement is hedged: implicated in, associated with. No diagnostic or causal claims."],
              ["Every number is defined.", "Each metric on this site has a published definition, shown in its legend and in docs/METRICS.md."],
              ["No demo data.", "Everything on this page is computed from the real corpus and the real meshes at build time."],
            ].map(([t, d], i) => (
              <li key={t}>
                <Reveal className="grid gap-2 py-7 sm:grid-cols-[64px_minmax(0,5fr)_minmax(0,6fr)] sm:gap-6">
                  <span className="font-mono text-[13px] text-text-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[24px] font-medium leading-tight tracking-[-0.015em] text-text sm:text-[28px]">{t}</span>
                  <span className="text-[16px] leading-relaxed text-text-2">{d}</span>
                </Reveal>
              </li>
            ))}
          </ol>
          <nav aria-label="Method documents" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
            {[
              ["/about#methodology", "Methodology"],
              ["/about#metrics", "Metric definitions"],
              ["/about#data-sources", "Data sources"],
              ["/about#limitations", "Limitations"],
            ].map(([href, label]) => (
              <Link key={href} href={href as never} className="font-medium text-text underline underline-offset-4">
                {label}
              </Link>
            ))}
            {GITHUB_URL && (
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="font-medium text-text underline underline-offset-4">
                Source code ↗
              </a>
            )}
          </nav>
        </Chapter>

        {/* ------------- N12: questions ------------- */}
        <Chapter id="faq" label="Questions and answers" className="py-24 sm:py-32">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <Reveal>
              <Kicker>Questions</Kicker>
              <h2 className="mt-4 text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-text sm:text-[48px]">Questions and answers.</h2>
            </Reveal>
            <div className="border-t border-line">
              {[
                ["Can NOĒSIS diagnose anything?", "No. It is a research visualisation tool. Findings are group-level averages from a curated corpus and often cannot describe one person’s experience. Anything personal belongs with a licensed clinician."],
                ["Where do the studies come from?", `Each of the ${counts.studies} studies is curated from its PubMed record and its metadata is verified against PubMed and OpenAlex by DOI or PMID before it is indexed. The corpus is curated, not a systematic review.`],
                ["Why are some regions unshaded?", `${regionTotal - counts.regionsWithEvidence} of ${regionTotal} regions carry no indexed finding yet. In a curated corpus, absence of evidence is not evidence of absence.`],
                ["Is the brain a real brain?", "It is FreeSurfer’s fsaverage template surface, divided by the Desikan-Killiany atlas, with subcortical structures from fsaverage’s own segmentation. Every click resolves to an atlas label."],
                ["What does the assistant do without an API key?", "It returns the records retrieved for the question, with no synthesis. With a key, a model writes a short synthesis from those records only, and a validator removes any citation outside them."],
                ["How are gaps found?", "Four deterministic rules, each with a published definition. They run on the corpus, so a gap may reflect what has been curated so far rather than the literature."],
              ].map(([q, a]) => (
                <details key={q} className="site-details border-b border-line">
                  <summary className="flex items-center justify-between gap-4 py-5 text-[18px] text-text">
                    {q}
                    <span className="site-details-sign text-[22px] text-text-3" aria-hidden>+</span>
                  </summary>
                  <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-text-2">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Chapter>

        {/* ------------- N13: close (graphite) ------------- */}
        <section id="enter" className="bg-graphite px-5 py-28 text-offwhite sm:px-8 sm:py-36">
          <div className="mx-auto grid max-w-[1280px] gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
            <Reveal>
              <Mark size={56} className="text-offwhite" />
              <h2 className="mt-8 text-[44px] font-medium leading-[1.02] tracking-[-0.03em] sm:text-[72px]">
                Explore the evidence.
              </h2>
              <Link href="/brain" className="mt-10 inline-block rounded-[3px] bg-offwhite px-6 py-3.5 text-[15px] font-medium text-graphite transition-colors hover:bg-white">
                Open the atlas
              </Link>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-[14px] leading-relaxed text-offwhite-2">
                This platform visualises research evidence and computational models. Associations shown here do not
                establish causation and should not be used for individual diagnosis.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ------------- notes ------------- */}
        <section aria-label="Notes" className="border-t border-line bg-ink px-5 py-14 sm:px-8">
          <ol className="mx-auto max-w-[1280px] columns-1 gap-10 text-[12px] leading-relaxed text-text-3 md:columns-2">
            {[
              `Counted at build time from data/studies/studies.json and data/evidence/assertions.json, validated by Zod schemas.`,
              `Distinct indexed studies per region for the chosen disorder, the same computation as the atlas's disorder mode (docs/METRICS.md).`,
              `Strong: at least 3 studies and 2 independent method categories. Moderate: at least 2 studies. Emerging: 1 study. Mixed: opposite directions for the same finding type.`,
              `Method categories: imaging, electrophysiology, stimulation. Convergence counts distinct categories per region–disorder pair (docs/METRICS.md).`,
              nets.source,
              `ModelRun ${enc.eeg.runId}. ${enc.eeg.dataset}. Leave-one-subject-out, bootstrap 95% CI, label-permutation test.`,
              `ModelRun ${enc.mri.runId}. ${enc.mri.dataset}. FreeSurfer stats tables only; age and sex regressed out within each fold.`,
              `ModelRun ${enc.conn.runId}. ${enc.conn.dataset}. Intervals as reported in the run's uncertainty block.`,
              `Gap rules and ranking: src/lib/evidence/gaps.ts and src/ai/questions.ts; definitions in docs/METRICS.md.`,
              `Recorded with scripts/record-demo-answer.ts through the same retrieval, prompt and citation validator as /api/assistant. Model, response id and date are copied from the API response; the record is src/site/recorded/answer.json, kept outside /data.`,
            ].map((t, i) => (
              <li key={i} id={`fn-${i + 1}`} className="mb-3 break-inside-avoid">
                <a href={`#fnref-${i + 1}`} className="mr-1.5 font-mono text-text-2 hover:underline">
                  {i + 1}.
                </a>
                {t}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
