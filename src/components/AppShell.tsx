"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

type Href = Parameters<typeof Link>[0]["href"];

/** Primary app sections, in the order of the research workflow. */
export const PRIMARY_NAV: { href: string; label: string; match: string[] }[] = [
  { href: "/brain", label: "Explore", match: ["/brain"] },
  { href: "/evidence", label: "Evidence", match: ["/evidence"] },
  { href: "/convergence", label: "Convergence", match: ["/convergence"] },
  { href: "/gaps", label: "Research Gaps", match: ["/gaps"] },
  { href: "/ml", label: "Representations", match: ["/ml"] },
  { href: "/assistant", label: "Ask NOĒSIS", match: ["/assistant"] },
  { href: "/about", label: "About", match: ["/about"] },
];

/** Existing secondary surfaces, kept one click away. */
export const SECONDARY_NAV: { href: string; label: string; note: string }[] = [
  { href: "/disorders", label: "Disorder library", note: "19 indexed disorders" },
  { href: "/compare", label: "Compare disorders", note: "shared vs specific evidence" },
  { href: "/ml/lab", label: "ML Lab", note: "validated model runs" },
  { href: "/notebook", label: "Research notebook", note: "your saved items" },
];

function isActive(pathname: string, match: string[]): boolean {
  return match.some((m) =>
    m === "/ml"
      ? pathname === "/ml"
      : pathname === m || pathname.startsWith(`${m}/`),
  );
}

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const active = SECONDARY_NAV.some((n) => pathname.startsWith(n.href));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
          active ? "text-text" : "text-text-2 hover:text-text"
        }`}
      >
        More
        <span aria-hidden className="ml-1 text-[10px] text-text-3">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-line bg-ink-2/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {SECONDARY_NAV.map((n) => (
            <Link
              key={n.href}
              role="menuitem"
              href={n.href as Href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 hover:bg-surface"
            >
              <span className="block text-[13px] text-text">{n.label}</span>
              <span className="block text-[11px] text-text-3">{n.note}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLanding = pathname === "/";

  // close the mobile menu on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = !isLanding || scrolled || mobileOpen;

  return (
    <header
      className={`sticky top-0 z-40 shrink-0 border-b transition-colors duration-300 ${
        solid
          ? "border-line/80 bg-ink/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-1.5 focus:text-sm focus:text-text"
      >
        Skip to content
      </a>
      <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
        <Link href="/" className="group flex shrink-0 items-baseline gap-3">
          <span className="text-[15px] font-light uppercase tracking-[0.38em] text-text">
            NOĒSIS
          </span>
          <span className="hidden text-[11px] text-text-3 2xl:inline">
            an AI atlas of brain, behavior &amp; evidence
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="ml-2 hidden items-center gap-0.5 lg:flex"
        >
          {PRIMARY_NAV.map((n) => {
            const active = isActive(pathname, n.match);
            return (
              <Link
                key={n.href}
                href={n.href as Href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                  active ? "text-text" : "text-text-2 hover:text-text"
                }`}
              >
                {n.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2.5 -bottom-[11px] h-px bg-amber"
                  />
                )}
              </Link>
            );
          })}
          <MoreMenu pathname={pathname} />
        </nav>

        <div className="ml-auto hidden md:block">
          <GlobalSearch />
        </div>

        <button
          type="button"
          className="ml-auto rounded-md border border-line px-2.5 py-1.5 text-[12px] text-text-2 hover:text-text lg:hidden md:ml-2"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-ink/95 px-4 pb-5 pt-3 lg:hidden"
        >
          <div className="mb-3 md:hidden">
            <GlobalSearch />
          </div>
          <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {PRIMARY_NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href as Href}
                  className={`block rounded-md px-3 py-2.5 text-[15px] ${
                    isActive(pathname, n.match)
                      ? "bg-surface text-text"
                      : "text-text-2 hover:bg-surface hover:text-text"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 px-3 text-[10px] uppercase tracking-[0.18em] text-text-3">
            More
          </p>
          <ul className="mt-1 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {SECONDARY_NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href as Href}
                  className="block rounded-md px-3 py-2 text-[14px] text-text-2 hover:bg-surface hover:text-text"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function DisclaimerBar() {
  return (
    <footer className="z-20 shrink-0 border-t border-line/80 bg-ink px-5 py-2 text-center text-[11px] leading-relaxed text-text-3">
      This platform visualizes research evidence and computational models.
      Associations shown here do not establish causation and should not be used
      for individual diagnosis.
    </footer>
  );
}
