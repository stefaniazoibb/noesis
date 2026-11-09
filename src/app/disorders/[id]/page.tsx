import Link from "next/link";
import { notFound } from "next/navigation";
import { getDisorder, getDisorders, getModalities } from "@/lib/repo/entities";
import { getEvidenceIndex, getStudies } from "@/lib/repo/evidence";
import { getRegion } from "@/lib/repo/atlas";
import { EVIDENCE_LEVEL_LABEL, NO_FILTERS } from "@/lib/evidence/metrics";
import { StudyListItem } from "@/evidence/StudyListItem";
import { GapsSection } from "@/evidence/GapsSection";
import { PersonalExperienceNote } from "@/components/PersonalExperienceNote";
import { ResearchOpportunities } from "@/components/ResearchOpportunities";
import { StrataAgreement } from "@/components/StrataAgreement";
import { SaveToNotebook } from "@/components/SaveToNotebook";

export function generateStaticParams() {
  return getDisorders().map((d) => ({ id: d.id }));
}

export async function generateMetadata(props: PageProps<"/disorders/[id]">) {
  const { id } = await props.params;
  const disorder = getDisorder(id);
  return { title: disorder ? `${disorder.name} · NOĒSIS` : "NOĒSIS" };
}

const HEMI_SHORT = { left: "L", right: "R", midline: "" };

export default async function DisorderPage(props: PageProps<"/disorders/[id]">) {
  const { id } = await props.params;
  const disorder = getDisorder(id);
  if (!disorder) notFound();

  const pairs = getEvidenceIndex()
    .pairsForDisorder(disorder.id, NO_FILTERS)
    .sort((a, b) => b.studyIds.length - a.studyIds.length);
  const studies = getStudies()
    .filter((s) => s.disorders.includes(disorder.id))
    .sort((a, b) => b.year - a.year);
  const modalities = getModalities();
  const modalityCounts = new Map(
    modalities.map((m) => [
      m.id,
      studies.filter((s) => s.modalities.includes(m.id)).length,
    ]),
  );

  return (
    <main className="route-fade mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8">
      <Link href="/disorders" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Disorder library
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words font-serif text-[40px] leading-tight text-zinc-100">
          {disorder.name}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] capitalize text-zinc-400">
            {disorder.category}
          </span>
          <SaveToNotebook
            entry={{
              key: `disorder:${disorder.id}`,
              type: "disorder",
              title: disorder.name,
              subtitle: disorder.category,
              href: `/disorders/${disorder.id}`,
              aiGenerated: false,
            }}
          />
        </div>
      </div>
      {disorder.synonyms.length > 0 && (
        <p className="mt-1 text-xs text-zinc-500">
          Also known as: {disorder.synonyms.join(" · ")}
        </p>
      )}

      {disorder.overview && (
        <p className="mt-6 text-sm leading-relaxed text-zinc-300">
          {disorder.overview}
        </p>
      )}

      <PersonalExperienceNote />

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="font-mono text-[11px] text-zinc-500">
          Cross-modal evidence
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {modalities.map((m) => {
            const n = modalityCounts.get(m.id) ?? 0;
            return (
              <span key={m.id} className={n > 0 ? "text-zinc-200" : "text-zinc-600"}>
                {m.abbreviation} {n > 0 ? `✓ (${n})` : "—"}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">
          Number of indexed studies per modality. Convergence per region is
          shown on the 3D brain (Convergence mode).
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="font-mono text-[11px] text-zinc-500">
          Implicated regions ({pairs.length})
        </h2>
        {pairs.length === 0 ? (
          <p className="mt-1.5 text-sm text-zinc-500">
            No region-level assertions indexed for this disorder yet.
          </p>
        ) : (
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {pairs.map((p) => {
              const r = getRegion(p.region);
              if (!r) return null;
              return (
                <li
                  key={p.region}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-zinc-300">
                    {r.name}
                    {r.hemisphere !== "midline" && (
                      <span className="text-zinc-600"> ({HEMI_SHORT[r.hemisphere]})</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-500">
                    {p.studyIds.length}{" "}
                    {p.studyIds.length === 1 ? "study" : "studies"} ·{" "}
                    {EVIDENCE_LEVEL_LABEL[p.level]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-zinc-600">
          &ldquo;Strong / Moderate / Emerging / Mixed&rdquo; are rule-based
          labels over the indexed corpus (docs/METRICS.md), not clinical
          consensus.
        </p>
      </section>

      <GapsSection disorderId={disorder.id} />

      <StrataAgreement disorderId={disorder.id} />

      <ResearchOpportunities disorderId={disorder.id} />

      <section className="mt-4">
        <h2 className="font-mono text-[11px] text-zinc-500">
          Indexed studies ({studies.length})
        </h2>
        <ul className="mt-2 space-y-2">
          {studies.map((s) => (
            <StudyListItem key={s.id} study={s} statements={[s.finding]} />
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Link
          href={`/brain?disorder=${disorder.id}&mode=disorder`}
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-900"
        >
          Explore on the 3D brain
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-zinc-600">
        The indexed corpus is curated and small; it is not a systematic
        review, and associations shown here do not establish causation or
        support diagnosis.
      </p>
    </main>
  );
}
