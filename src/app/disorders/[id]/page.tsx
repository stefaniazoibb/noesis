import Link from "next/link";
import { notFound } from "next/navigation";
import { getDisorder, getDisorders } from "@/lib/repo/entities";

export function generateStaticParams() {
  return getDisorders().map((d) => ({ id: d.id }));
}

export async function generateMetadata(props: PageProps<"/disorders/[id]">) {
  const { id } = await props.params;
  const disorder = getDisorder(id);
  return { title: disorder ? `${disorder.name} — NOĒSIS` : "NOĒSIS" };
}

function EmptyEvidence({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </h2>
      <p className="mt-1.5 text-sm text-zinc-500">
        Evidence unavailable — the curated study corpus is ingested in a later
        phase.
      </p>
    </section>
  );
}

export default async function DisorderPage(props: PageProps<"/disorders/[id]">) {
  const { id } = await props.params;
  const disorder = getDisorder(id);
  if (!disorder) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/disorders" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Disorder library
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-light tracking-wide text-zinc-100">
          {disorder.name}
        </h1>
        <span className="shrink-0 rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] capitalize text-zinc-400">
          {disorder.category}
        </span>
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

      <div className="mt-8 space-y-3">
        <EmptyEvidence label="Implicated regions" />
        <EmptyEvidence label="Implicated networks" />
        <EmptyEvidence label="Cross-modal evidence" />
        <EmptyEvidence label="Indexed studies" />
      </div>

      <div className="mt-8">
        <Link
          href="/brain"
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-900"
        >
          Explore on the 3D brain
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-zinc-600">
        Descriptions summarize established clinical characterizations.
        Region-level associations appear only when backed by indexed studies
        with DOI/PMID provenance.
      </p>
    </main>
  );
}
