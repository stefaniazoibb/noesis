import Link from "next/link";

const PLANNED = ["Disorders", "Evidence", "Assistant", "ML Lab"];

export function TopNav() {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-5 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <Link
          href="/"
          className="text-base font-light uppercase tracking-[0.35em] text-zinc-100"
        >
          NOĒSIS
        </Link>
        <span className="hidden text-[11px] text-zinc-500 sm:inline">
          An AI atlas of brain, behavior &amp; evidence
        </span>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/brain" className="text-zinc-200 hover:text-white">
          Brain
        </Link>
        {PLANNED.map((label) => (
          <span
            key={label}
            title="In development"
            className="cursor-default text-zinc-600"
          >
            {label}
          </span>
        ))}
      </nav>
    </header>
  );
}

export function DisclaimerBar() {
  return (
    <footer className="z-20 shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 px-5 py-1.5 text-center text-[11px] text-zinc-500">
      This platform visualizes research evidence and computational models.
      Associations shown here do not establish causation and should not be used
      for individual diagnosis.
    </footer>
  );
}
