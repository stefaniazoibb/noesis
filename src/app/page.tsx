import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-light uppercase tracking-[0.3em] text-zinc-100 sm:text-6xl">
        NOĒSIS
      </h1>
      <p className="mt-4 max-w-xl text-balance text-lg text-zinc-400">
        Mapping the brain through evidence — explore how brain regions,
        disorders, experimental modalities and scientific studies connect.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/brain"
          className="rounded-md border border-zinc-700 bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
        >
          Explore the brain
        </Link>
        <Link
          href="/disorders"
          className="rounded-md border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          Explore disorders
        </Link>
        <Link
          href="/evidence"
          className="rounded-md border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          Explore evidence
        </Link>
        <Link
          href="/assistant"
          className="rounded-md border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          Ask the AI
        </Link>
      </div>
      <p className="mt-14 max-w-lg text-xs leading-relaxed text-zinc-600">
        A research visualization tool built on the FreeSurfer fsaverage atlas.
        Not a diagnostic system.
      </p>
    </main>
  );
}
