import Link from "next/link";
import { GlobalSearch } from "./GlobalSearch";

export function TopNav() {
  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-5 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-zinc-800 focus:px-3 focus:py-1.5 focus:text-sm focus:text-zinc-100"
      >
        Skip to content
      </a>
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
      <div className="flex flex-1 justify-center px-4">
        <GlobalSearch />
      </div>
      <nav
        aria-label="Primary"
        className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-sm"
      >
        <Link href="/brain" className="text-zinc-200 hover:text-white">
          Brain
        </Link>
        <Link href="/disorders" className="text-zinc-200 hover:text-white">
          Disorders
        </Link>
        <Link href="/assistant" className="text-zinc-200 hover:text-white">
          Assistant
        </Link>
        <Link href="/evidence" className="text-zinc-200 hover:text-white">
          Evidence
        </Link>
        <Link href="/ml" className="text-zinc-200 hover:text-white">
          ML Lab
        </Link>
        <Link href="/notebook" className="text-zinc-200 hover:text-white">
          Notebook
        </Link>
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
