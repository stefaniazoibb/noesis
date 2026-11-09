import Link from "next/link";
import { getRegion } from "@/lib/repo/atlas";
import { getModalities } from "@/lib/repo/entities";
import { getEvidenceIndex, getGaps, getStudies } from "@/lib/repo/evidence";
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
  provenanceExample,
  regionLabel,
  regionStudyCounts,
  studiesByYear,
  studyRef,
  surname,
} from "@/lib/evidence/summary";
import { rankExplanation, rankScore } from "@/ai/questions";
import { retrieve } from "@/ai/retrieval";
import { GAP_RULES } from "@/lib/evidence/gaps";
import disorderManifest from "../../data/embeddings/disorder.manifest.json";
import disorderLoadings from "../../data/embeddings/disorder.loadings.json";
import { AtlasStory, type RegionEvidence } from "@/landing/AtlasStory";
import {
  BarList,
  Columns,
  Counter,
  Eyebrow,
  Lede,
  Reveal,
  SectionTitle,
  TextLink,
} from "@/landing/ui";
import { RepresentationPreview, type RepPoint } from "@/landing/RepresentationPreview";
import { getDisorders } from "@/lib/repo/entities";
import { GITHUB_URL } from "@/lib/site";


const CATEGORY_LABEL: Record<string, string> = {
  imaging: "Imaging",
  electrophysiology: "Electrophysiology",
  stimulation: "Stimulation",
};

function Section({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative border-t border-line/70 px-5 py-24 sm:px-8 sm:py-32 ${className}`}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  const counts = corpusCounts();
  const index = getEvidenceIndex();

  // ---- section 1+2 data (atlas story): evidence-derived only ----
  const density = computeOverlay("disorder", [], NO_FILTERS);
  const densityColors = Object.fromEntries(density.colors);
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

  // ---- section 3 ----
  const metaCount = getStudies().filter((s) => /meta-?analy|mega-?analy|systematic review/i.test(s.title)).length;
  const coverage = disorderCoverage();
  const years = studiesByYear();
  const modCov = modalityCoverage();
  const chain = provenanceExample();

  // ---- section 4 ----
  const convergent = convergentPairs();
  const catDist = categoryDistribution();
  const totalPairs = catDist.reduce((n, d) => n + d.pairs, 0);
  const strongPairs = index
    .pairsForDisorder(null, NO_FILTERS)
    .filter((p) => p.level === "strong").length;

  // ---- section 5 ----
  const conflictList = conflicts();
  // group L/R homologs reporting the same conflict into one card
  const conflictCards = Object.values(
    conflictList.reduce<Record<string, (typeof conflictList)[number][]>>((acc, c) => {
      const key = `${c.disorder}|${getRegion(c.region)?.name}|${c.findingType}|${c.increased.map((s) => s.id).join()}|${c.decreased.map((s) => s.id).join()}`;
      (acc[key] ??= []).push(c);
      return acc;
    }, {}),
  );
  const sparse = [...coverage].sort((a, b) => a.studies - b.studies).slice(0, 5);
  const modTotal = counts.studies;

  // ---- section 6 ----
  const gapRules = gapCountsByRule();
  const gaps = getGaps();
  const topGap = [...gaps].sort(
    (a, b) => rankScore(b) - rankScore(a) || a.region.localeCompare(b.region),
  )[0];

  // ---- section 7 ----
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

  // ---- section 8: the real deterministic retrieval for one example ----
  const exampleQuestion =
    "Which brain regions are most consistently associated with major depressive disorder?";
  const retrieval = retrieve(exampleQuestion, {
    intent: "question",
    disorders: ["major_depressive_disorder"],
    regions: [],
    modalities: [],
    vizCommand: null,
  });
  const exampleSources = retrieval.studies.slice(0, 4);
  const examplePairs = retrieval.pairs.slice(0, 4);
  const modAbbrev = new Map(getModalities().map((m) => [m.id, m.abbreviation]));

  return (
    <main className="route-fade flex-1">
      <AtlasStory
        densityColors={densityColors}
        densityMax={density.max}
        densityRamp={densityRamp}
        regionEvidence={regionEvidence}
        counts={{
          cortical: counts.corticalRegions,
          subcortical: counts.subcorticalRegions,
          regionsWithEvidence: counts.regionsWithEvidence,
          studies: counts.studies,
          disorders: counts.disorders,
        }}
      />

      {/* ---------------- 03 EVIDENCE AT SCALE ---------------- */}
      <Section id="evidence" className="bg-ink">
        <Reveal>
          <Eyebrow index="03">Evidence at scale</Eyebrow>
          <SectionTitle>A curated corpus where every claim has an address.</SectionTitle>
          <Lede>
            Each study enters from its cached PubMed record and is verified
            against PubMed and OpenAlex before it can be indexed. Where an
            abstract names an atlas region, its findings are broken into
            assertions — one disorder, one region, one modality, one
            direction — so every coloured region traces back to a paper.
          </Lede>
        </Reveal>

        <Reveal className="mt-14">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {[
              { v: counts.studies, l: "studies", d: "DOI/PMID-verified publications" },
              { v: counts.assertions, l: "assertions", d: "disorder · region · modality · finding" },
              { v: counts.disorders, l: "disorders", d: "psychiatric and neurodegenerative" },
              { v: counts.corticalRegions, l: "cortical regions", d: "Desikan-Killiany on fsaverage" },
              { v: counts.subcorticalRegions, l: "subcortical structures", d: "fsaverage aseg segmentation" },
            ].map((s) => (
              <div key={s.l} className="bg-ink-2 p-5 sm:p-6">
                <dt className="sr-only">{s.l}</dt>
                <dd>
                  <Counter value={s.v} className="font-serif text-[44px] leading-none text-text" />
                  <p className="mt-2 text-[13px] text-text">{s.l}</p>
                  <p className="mt-1 text-[11px] leading-snug text-text-3">{s.d}</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-text-3">
            Counted from the validated data files at build time ({counts.yearMin}–{counts.yearMax} publications).
            {" "}
            {counts.humanVerified === 0
              ? `Metadata of all ${counts.studies} studies is machine-verified; human spot-checks of the curated judgments are still pending.`
              : `${counts.humanVerified} of ${counts.studies} studies human-verified.`}
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1.25fr_1fr]">
          <Reveal>
            <h3 className="text-[13px] text-text">Studies per disorder</h3>
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
          </Reveal>
          <div className="space-y-12">
            <Reveal delay={80}>
              <h3 className="text-[13px] text-text">Publication years</h3>
              <div className="mt-4">
                <Columns
                  data={years.map((y) => ({ x: y.year, y: y.studies }))}
                  caption={`Indexed studies by publication year. ${metaCount} of ${counts.studies} indexed studies are meta- or mega-analyses (by title).`}
                  unit="studies"
                />
              </div>
            </Reveal>
            <Reveal delay={140}>
              <h3 className="text-[13px] text-text">Modalities</h3>
              <div className="mt-4">
                <BarList
                  caption="Studies using each modality (a study can use several)."
                  unit="studies"
                  max={modTotal}
                  rows={modCov.map((m) => ({
                    key: m.id,
                    label: `${m.abbreviation} · ${m.category}`,
                    value: m.studies,
                  }))}
                />
              </div>
            </Reveal>
          </div>
        </div>

        {/* provenance chain */}
        <Reveal className="mt-20">
          <h3 className="text-[13px] text-text">The provenance chain — one real example</h3>
          <p className="mt-1 text-[12px] text-text-3">
            The most-studied region–disorder pair in the corpus, traced to its source.
          </p>
          <ol className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              {
                k: "Brain region",
                t: chain.region.name,
                s: `linked to ${chain.disorder.name}`,
                href: `/brain?region=${chain.region.id}&disorder=${chain.disorder.id}&mode=disorder`,
              },
              {
                k: "Assertion",
                t: chain.assertion.statement,
                s: `${chain.assertion.modality} · ${chain.assertion.findingType.replace(/_/g, " ")}${chain.assertion.direction ? ` · ${chain.assertion.direction}` : ""}`,
              },
              {
                k: "Study",
                t: chain.study.title,
                s: `${surname(chain.study.firstAuthor)} et al. · ${chain.study.journal} · ${chain.study.year}`,
                href: `/evidence/${chain.study.id}`,
              },
              {
                k: "Identifier",
                t: [chain.study.doi && `DOI ${chain.study.doi}`, chain.study.pmid && `PMID ${chain.study.pmid}`]
                  .filter(Boolean)
                  .join("\n"),
                s: "resolves to the original publication",
                href: chain.study.doi
                  ? `https://doi.org/${chain.study.doi}`
                  : `https://pubmed.ncbi.nlm.nih.gov/${chain.study.pmid}/`,
                external: true,
              },
            ].map((c, i) => {
              const body = (
                <>
                  <p className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-text-3">
                    <span>
                      <span className="text-amber tabular-nums">{i + 1}</span> · {c.k}
                    </span>
                    {i < 3 && (
                      <span aria-hidden className="hidden text-text-3 md:inline">
                        →
                      </span>
                    )}
                  </p>
                  <p className="mt-3 line-clamp-4 whitespace-pre-line text-[13px] leading-snug text-text">
                    {c.t}
                  </p>
                  <p className="mt-2 text-[11px] text-text-3">{c.s}</p>
                </>
              );
              return (
                <li key={c.k}>
                  {c.href ? (
                    c.external ? (
                      <a
                        href={c.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-full rounded-xl border border-line bg-ink-2 p-4 transition-colors hover:border-amber/50"
                      >
                        {body}
                      </a>
                    ) : (
                      <Link
                        href={c.href as never}
                        className="block h-full rounded-xl border border-line bg-ink-2 p-4 transition-colors hover:border-amber/50"
                      >
                        {body}
                      </Link>
                    )
                  ) : (
                    <div className="h-full rounded-xl border border-line bg-ink-2 p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-8">
            <TextLink href="/evidence">Browse all {counts.studies} studies</TextLink>
          </div>
        </Reveal>
      </Section>

      {/* ---------------- 04 CONVERGENCE ---------------- */}
      <Section id="convergence" className="bg-ink-2/40">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <Eyebrow index="04">Where evidence converges</Eyebrow>
            <SectionTitle>Agreement across methods, not just more papers.</SectionTitle>
            <Lede>
              A finding reported with structural MRI and again with EEG or
              brain stimulation rests on methodologically independent
              evidence, which is why NOĒSIS counts independent modality{" "}
              <em>categories</em> — two imaging methods count once.
            </Lede>
            <div className="mt-10 rounded-xl border border-line bg-ink p-5">
              <h3 className="text-[13px] text-text">
                Region–disorder pairs by number of independent categories
              </h3>
              <ul className="mt-4 space-y-2">
                {catDist.map((d) => (
                  <li key={d.categories} className="flex items-center gap-3 text-[12px]">
                    <span className="w-28 shrink-0 text-text-2">
                      {d.categories} {d.categories === 1 ? "category" : "categories"}
                    </span>
                    <span className="relative h-3.5 flex-1">
                      <span
                        className={`absolute inset-y-0 left-0 rounded-r-[4px] ${d.categories >= 2 ? "bg-cyan/80" : "bg-line-strong"}`}
                        style={{ width: `${(d.pairs / totalPairs) * 100}%`, minWidth: 3 }}
                      />
                    </span>
                    <span className="w-10 text-right tabular-nums text-text">{d.pairs}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-text-3">
                Of {totalPairs} indexed region–disorder pairs, {convergent.length} draw on two or
                more independent categories, and {strongPairs} meets the rule-based
                &ldquo;Strong&rdquo; label (≥3 studies and ≥2 categories). Convergence is rare in
                this corpus; this may reflect how the corpus was curated rather than the
                literature.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="overflow-hidden rounded-xl border border-line bg-ink">
              <table className="w-full text-left text-[12px]">
                <caption className="border-b border-line px-5 py-4 text-left">
                  <span className="block text-[13px] text-text">Every multi-category pair in the corpus</span>
                  <span className="mt-1 block text-[11px] text-text-3">
                    Distinct studies per modality category. Click a row to inspect its profile.
                  </span>
                </caption>
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.14em] text-text-3">
                    <th className="px-5 py-2.5 font-normal">Region · disorder</th>
                    {["imaging", "electrophysiology", "stimulation"].map((c) => (
                      <th key={c} className="px-2 py-2.5 text-center font-normal">
                        <span className="hidden sm:inline">{CATEGORY_LABEL[c]}</span>
                        <span className="sm:hidden">{CATEGORY_LABEL[c].slice(0, 3)}</span>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-normal">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {convergent.map((p) => (
                    <tr key={`${p.disorder}-${p.region}`} className="group border-t border-line/70 hover:bg-surface/60">
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/convergence?disorder=${p.disorder}&region=${p.region}`}
                          className="block"
                        >
                          <span className="text-text group-hover:text-amber">{p.regionName}</span>
                          <span className="block text-[11px] text-text-3">{p.disorderName}</span>
                        </Link>
                      </td>
                      {["imaging", "electrophysiology", "stimulation"].map((c) => {
                        const n = p.categories[c] ?? 0;
                        return (
                          <td key={c} className="px-2 py-2.5 text-center">
                            {n > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="inline-block rounded-full bg-cyan"
                                  style={{ width: 6 + n * 2.5, height: 6 + n * 2.5 }}
                                  aria-hidden
                                />
                                <span className="tabular-nums text-text-2">{n}</span>
                              </span>
                            ) : (
                              <span className="text-text-3" aria-label="none">
                                ·
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right text-[11px] text-text-2">
                        {EVIDENCE_LEVEL_LABEL[p.level as keyof typeof EVIDENCE_LEVEL_LABEL]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 rounded-lg border-l-2 border-amber/60 bg-surface/40 px-4 py-3 text-[12px] leading-relaxed text-text-2">
              Convergence profiles are rule-based summaries of the indexed corpus. Agreement
              between methods is reported separately; it does not establish causation, and
              its dimensions (studies, categories, direction consistency, conflicts,
              interventions) are reported separately, never collapsed into one score.
            </p>
            <div className="mt-6">
              <TextLink href="/convergence">Open the convergence explorer</TextLink>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ---------------- 05 DISAGREEMENT ---------------- */}
      <Section id="disagreement" className="bg-ink">
        <Reveal>
          <Eyebrow index="05">Where science disagrees</Eyebrow>
          <SectionTitle>Disagreement is shown, not smoothed over.</SectionTitle>
          <Lede>
            When studies report opposite directions for the same finding,
            NOĒSIS puts both sides next to each other with what differs between
            them — year, population, design. It never decides who is right.
          </Lede>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <Reveal>
            {conflictCards.length === 0 ? (
              <p className="text-[13px] text-text-2">
                No directional conflicts in the current corpus.
              </p>
            ) : (
              conflictCards.map((group) => {
                const c = group[0];
                return (
                  <article key={group.map((g) => g.region).join()} className="rounded-xl border border-conflict/40 bg-ink-2">
                    <header className="border-b border-line px-5 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-conflict">
                        Directional conflict
                      </p>
                      <h3 className="mt-1.5 text-[16px] text-text">
                        {group.map((g) => g.regionName).join(" and ")} · {c.disorderName}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-text-3">
                        {c.findingType.replace(/_/g, " ")} findings, {c.years[0]}–{c.years[1]}
                      </p>
                    </header>
                    <div className="grid sm:grid-cols-2">
                      {(["increased", "decreased"] as const).map((side) => (
                        <div
                          key={side}
                          className={`p-5 ${side === "decreased" ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}
                        >
                          <p className="text-[12px] text-text">
                            <span aria-hidden className="mr-1.5 text-conflict">
                              {side === "increased" ? "▲" : "▼"}
                            </span>
                            Reported {side}
                          </p>
                          <ul className="mt-3 space-y-3">
                            {c[side].map((s) => (
                              <li key={s.id}>
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[12px] text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text"
                                >
                                  {s.label}
                                </a>
                                <p className="mt-1 text-[11px] leading-snug text-text-3">
                                  {s.journal} · {s.population ?? "population not stated"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <p className="border-t border-line px-5 py-3 text-[11px] text-text-3">
                      Possible reasons — design, age range, sample definition — are for the
                      researcher to judge. Shown on the atlas as a conflict overlay.
                    </p>
                  </article>
                );
              })
            )}
          </Reveal>

          <div className="space-y-8">
            <Reveal delay={80}>
              <h3 className="text-[13px] text-text">Modalities with fewest indexed studies</h3>
              <p className="mt-1 text-[12px] text-text-3">
                Share of the {modTotal} indexed studies using each method — may reflect curation.
              </p>
              <ul className="mt-4 space-y-2">
                {modCov.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-[12px]">
                    <span className="w-12 shrink-0 text-text-2">{m.abbreviation}</span>
                    <span className="relative h-2 flex-1 rounded-full bg-line">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-text-2/70"
                        style={{ width: `${(m.studies / modTotal) * 100}%`, minWidth: 3 }}
                      />
                    </span>
                    <span className="w-16 text-right tabular-nums text-text">
                      {Math.round((m.studies / modTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={140}>
              <h3 className="text-[13px] text-text">Sparse evidence</h3>
              <p className="mt-1 text-[12px] text-text-3">Disorders with the fewest indexed studies.</p>
              <ul className="mt-3 divide-y divide-line/70 border-y border-line/70">
                {sparse.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/disorders/${d.id}`}
                      className="flex items-baseline justify-between gap-3 py-2 text-[12px] text-text-2 hover:text-text"
                    >
                      <span>{d.name}</span>
                      <span className="tabular-nums text-text-3">
                        {d.studies} {d.studies === 1 ? "study" : "studies"} · {d.regions} regions
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ---------------- 06 GAPS ---------------- */}
      <Section id="gaps" className="bg-ink-2/40">
        <Reveal>
          <Eyebrow index="06">Discover what we don&rsquo;t know</Eyebrow>
          <SectionTitle>From documented gaps to testable questions.</SectionTitle>
          <Lede>
            Four published rules scan the corpus for structural holes — a
            region studied heavily with imaging but never with
            electrophysiology, or associations never tested by intervention.
            Each gap carries the studies that define it.
          </Lede>
        </Reveal>

        <Reveal className="mt-14">
          <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
            {[
              {
                tag: "Observed evidence",
                tone: "text-text",
                bar: "bg-text-2",
                d: "Assertions extracted from verified studies. The only layer that is evidence.",
              },
              {
                tag: "Rule-based gap",
                tone: "text-cyan",
                bar: "bg-cyan",
                d: "A deterministic rule fires on the corpus. Reproducible, auditable, corpus-relative.",
              },
              {
                tag: "AI interpretation",
                tone: "text-amber",
                bar: "bg-amber",
                d: "A model writes prose about one gap, citing only that gap's studies. Labelled AI-generated.",
              },
              {
                tag: "Proposed hypothesis",
                tone: "text-text-2",
                bar: "border border-dashed border-text-3 bg-transparent",
                d: "A question to test empirically. Not a finding, never written back into the data.",
              },
            ].map((t, i) => (
              <li key={t.tag} className="bg-ink p-5">
                <span className={`block h-1 w-10 rounded-full ${t.bar}`} aria-hidden />
                <p className={`mt-4 text-[13px] ${t.tone}`}>
                  <span className="tabular-nums text-text-3">{i + 1}.</span> {t.tag}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-text-3">{t.d}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h3 className="text-[13px] text-text">{gaps.length} gaps detected by four rules</h3>
            <ul className="mt-4 space-y-4">
              {gapRules.map((r) => (
                <li key={r.ruleId} className="border-l border-line-strong pl-4">
                  <p className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-text">{r.name}</span>
                    <span className="tabular-nums text-cyan">{r.count}</span>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-3">{r.definition}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          {topGap && (
            <Reveal delay={100}>
              <article className="rounded-xl border border-line bg-ink p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan">
                  Highest-ranked gap · {GAP_RULES[topGap.ruleId].name}
                </p>
                <h3 className="mt-2 text-[16px] text-text">
                  {regionLabel(topGap.region)} in {disorderName(topGap.disorder)}
                </h3>
                <p className="mt-2 text-[12px] leading-relaxed text-text-2">
                  {topGap.ruleId === "GAP-ATTENTION"
                    ? `${topGap.magnitude} indexed studies link this region to ${disorderName(topGap.referenceDisorder!)}, a disorder with an overlapping evidence footprint, but none link it to ${disorderName(topGap.disorder)}.`
                    : topGap.ruleId === "GAP-IMG-EP"
                      ? `${topGap.magnitude} imaging studies, no electrophysiology study for this pair.`
                      : topGap.ruleId === "GAP-OBS-INT"
                        ? `${topGap.magnitude} correlational studies, no interventional study for this pair.`
                        : "Independent studies report opposite directions."}
                </p>
                <p className="mt-3 text-[11px] text-text-3">Ranking: {rankExplanation(topGap)}.</p>
                <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-text-3">Defined by</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {topGap.supportingStudyIds.slice(0, 6).map((id) => {
                    const s = studyRef(id);
                    return (
                      <li key={id}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          title={s.title}
                          className="block rounded border border-line px-2 py-1 text-[11px] text-text-2 hover:border-cyan/50 hover:text-text"
                        >
                          {s.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 rounded-lg border border-dashed border-line-strong p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-amber">
                    AI interpretation · generated on request
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-3">
                    On the Research Gaps page the assistant turns this gap into a question,
                    rationale, hypothesis and methodology — citing only the studies above. The
                    question type ({topGap.ruleId === "GAP-ATTENTION" ? "comparative" : topGap.ruleId === "GAP-IMG-EP" ? "cross-modal" : topGap.ruleId === "GAP-OBS-INT" ? "interventional" : "methodological"}),
                    the ranking and the candidate region are fixed by the rule, not chosen by the model.
                  </p>
                </div>
                <p className="mt-4 text-[11px] text-text-3">
                  A detected gap may be a curation gap rather than a gap in the literature.
                </p>
              </article>
            </Reveal>
          )}
        </div>
        <Reveal className="mt-8">
          <TextLink href="/gaps">Explore all research gaps</TextLink>
        </Reveal>
      </Section>

      {/* ---------------- 07 REPRESENTATIONS ---------------- */}
      <Section id="representations" className="bg-ink">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.35fr] lg:items-center">
          <Reveal>
            <Eyebrow index="07">Explore the representations</Eyebrow>
            <SectionTitle>A shared space built from evidence.</SectionTitle>
            <Lede>
              Regions, disorders and studies are each described by their
              evidence profile — which modalities, regions and findings the
              corpus links them to — and projected with PCA and UMAP. Entities
              with similar evidence profiles land close together.
            </Lede>
            <ul className="mt-8 space-y-3 text-[13px] leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" aria-hidden />
                <span className="text-text-2">
                  <span className="text-text">What the axes are:</span> principal components of
                  log-scaled, standardised evidence counts. Their loadings are published, so each
                  axis can be read.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-conflict" aria-hidden />
                <span className="text-text-2">
                  <span className="text-text">What proximity is not:</span> anatomical distance,
                  shared biology or clinical similarity. Disorders with sparse evidence can sit
                  together simply because little is indexed for them.
                </span>
              </li>
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <RepresentationPreview
              points={repPoints}
              pc1={pc[0]?.explainedVarianceRatio ?? 0}
              pc2={pc[1]?.explainedVarianceRatio ?? 0}
            />
          </Reveal>
        </div>
      </Section>

      {/* ---------------- 08 ASK ---------------- */}
      <Section id="ask" className="bg-ink-2/40">
        <Reveal>
          <Eyebrow index="08">Ask NOĒSIS</Eyebrow>
          <SectionTitle>Answers that show their sources.</SectionTitle>
          <Lede>
            The assistant answers only from records it retrieves from the
            corpus. Citations outside the retrieved set are removed and
            uncited scientific statements are flagged. Below is the real
            retrieval step for one question — the evidence the model is allowed
            to see.
          </Lede>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <div className="rounded-xl border border-line bg-ink">
              <div className="border-b border-line px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-text-3">Question</p>
                <p className="mt-1.5 font-serif text-[22px] leading-snug text-text">
                  &ldquo;{exampleQuestion}&rdquo;
                </p>
              </div>
              <ol className="divide-y divide-line/70">
                <li className="px-5 py-4">
                  <p className="text-[11px] text-text">
                    <span className="tabular-nums text-amber">1</span> · Entity linking
                  </p>
                  <p className="mt-1.5 text-[12px] text-text-3">
                    The question maps to the catalogue entry{" "}
                    <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-text-2">
                      major_depressive_disorder
                    </code>
                    . Live parsing is done by a model constrained to the catalogue; unknown ids are
                    dropped.
                  </p>
                </li>
                <li className="px-5 py-4">
                  <p className="text-[11px] text-text">
                    <span className="tabular-nums text-amber">2</span> · Deterministic retrieval ·{" "}
                    {retrieval.studies.length} records
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {examplePairs.map((p) => (
                      <li key={p.region} className="flex items-baseline justify-between gap-3 text-[12px]">
                        <Link
                          href={`/brain?region=${p.region}&disorder=${p.disorder}&mode=disorder`}
                          className="text-text-2 underline decoration-line-strong underline-offset-4 hover:text-amber"
                        >
                          {regionLabel(p.region)}
                        </Link>
                        <span className="shrink-0 text-text-3">
                          {p.studyIds.length} studies · {EVIDENCE_LEVEL_LABEL[p.level]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
                <li className="px-5 py-4">
                  <p className="text-[11px] text-text">
                    <span className="tabular-nums text-amber">3</span> · Synthesis + citation check
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-3">
                    The model writes a short, hedged synthesis citing these records inline. A
                    validator strips any citation outside the retrieved set and flags uncited
                    scientific sentences before the answer is shown.
                  </p>
                </li>
              </ol>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
                <Link
                  href={`/assistant?q=${encodeURIComponent(exampleQuestion)}`}
                  className="rounded-full bg-amber px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-ink hover:bg-[#e6bb7d]"
                >
                  Ask this question
                </Link>
                <span className="text-[11px] text-text-3">
                  Live answers need an API key; without one the assistant still returns the
                  retrieved records.
                </span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-3">
              Source cards · retrieved evidence
            </p>
            <ul className="mt-3 space-y-3">
              {exampleSources.map((s) => (
                <li key={s.id} className="rounded-xl border border-line bg-ink p-4">
                  <Link href={`/evidence/${s.id}`} className="text-[13px] leading-snug text-text hover:text-amber">
                    {s.title}
                  </Link>
                  <p className="mt-1.5 text-[11px] text-text-3">
                    {surname(s.authors[0])} et al. · {s.journal} · {s.year} ·{" "}
                    {s.modalities.map((m) => modAbbrev.get(m) ?? m).join(", ")}
                    {s.sampleSize ? ` · n = ${s.sampleSize.toLocaleString("en")}` : ""}
                  </p>
                  <p className="mt-2 flex gap-3 text-[11px]">
                    {s.doi && (
                      <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text">
                        DOI
                      </a>
                    )}
                    {s.pmid && (
                      <a href={`https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`} target="_blank" rel="noreferrer" className="text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text">
                        PMID {s.pmid}
                      </a>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-line bg-ink p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-3">
                Language drives the atlas
              </p>
              <p className="mt-2 text-[13px] text-text">&ldquo;Show schizophrenia evidence, fMRI only&rdquo;</p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-surface px-3 py-2 text-[11px] leading-relaxed text-text-2">
{`{ "mode": "disorder",
  "disorders": ["schizophrenia"],
  "modalities": ["fmri"] }`}
              </pre>
              <p className="mt-2 text-[11px] text-text-3">
                Commands compile to a validated view-state patch — never to free-form actions.
              </p>
              <div className="mt-3">
                <TextLink href="/brain?disorder=schizophrenia&mode=disorder&modality=fmri">
                  See the resulting view
                </TextLink>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ---------------- 09 CLOSING ---------------- */}
      <section id="enter" className="relative overflow-hidden border-t border-line/70 px-5 py-28 sm:px-8 sm:py-40">
        <div aria-hidden className="hairline-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.3em] text-text-3">09</p>
            <h2 className="mt-6 text-balance font-serif text-5xl leading-[1.05] text-text sm:text-7xl">
              Explore the evidence.
              <br />
              <span className="italic text-amber">Understand the unknown.</span>
            </h2>
            <div className="mt-12">
              <Link
                href="/brain"
                className="inline-block rounded-full bg-amber px-8 py-3.5 text-[12px] font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-[#e6bb7d]"
              >
                Enter the atlas
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <nav aria-label="Project resources" className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[13px]">
              <Link href="/about#methodology" className="text-text-2 hover:text-text">Methodology</Link>
              <Link href="/about#metrics" className="text-text-2 hover:text-text">Metric definitions</Link>
              <Link href="/about#data-sources" className="text-text-2 hover:text-text">Data sources</Link>
              <Link href="/about#limitations" className="text-text-2 hover:text-text">Limitations</Link>
              {GITHUB_URL && (
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-text-2 hover:text-text">
                  GitHub
                </a>
              )}
            </nav>
            <p className="mx-auto mt-10 max-w-xl text-[12px] leading-relaxed text-text-3">
              NOĒSIS is a research visualization tool, not a diagnostic system. Findings are
              group-level averages from a curated corpus and often cannot describe any one
              person&rsquo;s experience; anything personal belongs with a licensed clinician.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
