import Link from "next/link";
import type { Metadata } from "next";
import { getDisorders } from "@/lib/repo/entities";
import { PersonalExperienceNote } from "@/components/PersonalExperienceNote";

export const metadata: Metadata = {
  title: "Disorders — NOĒSIS",
};

const CATEGORY_LABEL = {
  psychiatric: "Psychiatric",
  neurodegenerative: "Neurodegenerative",
  neurological: "Neurological",
} as const;

export default function DisordersPage() {
  const disorders = getDisorders();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-light tracking-wide text-zinc-100">
        Disorder library
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        {disorders.length} disorders indexed. Each page summarizes the
        disorder and — once the curated corpus is ingested — its study-level
        evidence.
      </p>
      <PersonalExperienceNote compact />
      <ul className="mt-6 space-y-3">
        {disorders.map((d) => (
          <li key={d.id}>
            <Link
              href={`/disorders/${d.id}`}
              className="block rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/60"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base text-zinc-100">{d.name}</h2>
                <span className="shrink-0 rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400">
                  {CATEGORY_LABEL[d.category]}
                </span>
              </div>
              {d.overview && (
                <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">
                  {d.overview}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
