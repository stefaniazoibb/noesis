import Link from "next/link";
import { notFound } from "next/navigation";
import { getAssertions, getStudies, getStudy } from "@/lib/repo/evidence";
import { getDisorder, getModalities } from "@/lib/repo/entities";
import { getRegion } from "@/lib/repo/atlas";
import { SaveToNotebook } from "@/components/SaveToNotebook";

export function generateStaticParams() {
  return getStudies().map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/evidence/[id]">) {
  const { id } = await props.params;
  const study = getStudy(id);
  return { title: study ? `${study.title.slice(0, 60)}… — NOĒSIS` : "NOĒSIS" };
}

const HEMI = { left: "L", right: "R", midline: "" };

export default async function StudyPage(props: PageProps<"/evidence/[id]">) {
  const { id } = await props.params;
  const study = getStudy(id);
  if (!study) notFound();

  const assertions = getAssertions().filter((a) => a.studyId === study.id);
  const modalityName = new Map(
    getModalities().map((m) => [m.id, m.abbreviation]),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/evidence" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Evidence browser
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h1 className="text-xl font-light leading-snug text-zinc-100">
          {study.title}
        </h1>
        <SaveToNotebook
          entry={{
            key: `study:${study.id}`,
            type: "study",
            title: study.title,
            subtitle: `${study.authors[0]} et al. · ${study.journal} · ${study.year}`,
            href: `/evidence/${study.id}`,
            aiGenerated: false,
          }}
        />
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {study.authors.join(", ")}
        {study.authors.length >= 6 ? ", et al." : ""} · {study.journal} ·{" "}
        {study.year}
      </p>
      <p className="mt-1.5 flex gap-3 text-xs">
        {study.doi && (
          <a
            href={`https://doi.org/${study.doi}`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200"
          >
            DOI {study.doi}
          </a>
        )}
        {study.pmid && (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200"
          >
            PMID {study.pmid}
          </a>
        )}
      </p>

      <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Indexed finding
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
          {study.finding}
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Disorders</dt>
            <dd className="text-right">
              {study.disorders.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <Link
                    href={`/disorders/${d}`}
                    className="text-zinc-300 underline decoration-zinc-700 hover:text-white"
                  >
                    {getDisorder(d)?.name ?? d}
                  </Link>
                </span>
              ))}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Modalities</dt>
            <dd className="text-zinc-300">
              {study.modalities.map((m) => modalityName.get(m) ?? m).join(", ")}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Finding type</dt>
            <dd className="text-zinc-300">
              {study.findingType.replace(/_/g, " ")}
              {study.direction && ` · ${study.direction}`}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Sample size</dt>
            <dd className="text-zinc-300">
              {study.sampleSize !== null
                ? `n = ${study.sampleSize}`
                : "not reported in abstract"}
            </dd>
          </div>
          {study.population && (
            <div className="flex justify-between gap-2 sm:col-span-2">
              <dt className="shrink-0 text-zinc-500">Population</dt>
              <dd className="text-right text-zinc-300">{study.population}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Region assertions ({assertions.length})
        </h2>
        {assertions.length === 0 ? (
          <p className="mt-1.5 text-xs text-zinc-500">
            This study is indexed at disorder level only — its abstract does
            not name atlas-mappable regions (e.g. scalp-level EEG), so no
            region assertions were created.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {assertions.map((a) => {
              const region = getRegion(a.region);
              return (
                <li key={a.id} className="text-xs">
                  <Link
                    href={`/brain?region=${a.region}`}
                    className="text-zinc-200 underline decoration-zinc-700 hover:text-white"
                  >
                    {region?.name ?? a.region}
                    {region && region.hemisphere !== "midline"
                      ? ` (${HEMI[region.hemisphere]})`
                      : ""}
                  </Link>{" "}
                  <span className="text-zinc-600">
                    · {getDisorder(a.disorder)?.name ?? a.disorder} ·{" "}
                    {a.findingType.replace(/_/g, " ")}
                    {a.direction ? ` · ${a.direction}` : ""} · {a.causalSupport}
                  </span>
                  <p className="mt-0.5 leading-relaxed text-zinc-400">
                    {a.statement}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Curation record
        </h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Method</dt>
            <dd className="text-zinc-300">
              {study.curation.method === "manual"
                ? "manual (from cached PubMed abstract)"
                : "AI-extracted"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Human-verified</dt>
            <dd
              className={
                study.curation.verifiedByHuman
                  ? "text-emerald-500/90"
                  : "text-amber-600/90"
              }
            >
              {study.curation.verifiedByHuman ? "yes" : "pending review"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Metadata verified against</dt>
            <dd className="text-zinc-300">
              {study.curation.metadataVerifiedAgainst ?? "—"} + OpenAlex
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Curated</dt>
            <dd className="text-zinc-300">{study.curation.curatedDate}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-zinc-600">
        The indexed finding is a faithful summary written from the study
        abstract — always verify against the original publication via the
        DOI/PMID links above.
      </p>
    </main>
  );
}
