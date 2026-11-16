"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mark } from "./Mark";

/** Chapter anchors of the public landing page, in page order. */
export const SITE_NAV: { href: string; label: string }[] = [
  { href: "#atlas", label: "Atlas" },
  { href: "#disorders", label: "Disorders" },
  { href: "#evidence", label: "Evidence" },
  { href: "#convergence", label: "Convergence" },
  { href: "#gaps", label: "Gaps" },
  { href: "#ask", label: "Assistant" },
  { href: "#method", label: "Method" },
];

/**
 * Product-local navigation for the landing page only. The application keeps
 * its own TopNav (src/components/AppShell.tsx), which steps aside on "/".
 * Same height as TopNav (h-14), so the atlas story's sticky offsets hold.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled || open ? "border-line bg-ink/95 backdrop-blur-sm" : "border-transparent bg-ink"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-1.5 focus:text-sm focus:text-text"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 text-text" aria-label="NOĒSIS, back to top">
          <Mark size={26} />
          <span className="text-[16px] font-semibold tracking-[0.04em]">NOĒSIS</span>
        </a>
        <nav aria-label="On this page" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {SITE_NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-text-2 transition-colors hover:text-text"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/brain"
            className="rounded-[3px] bg-text px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#3a3a35]"
          >
            Open the atlas
          </Link>
          <button
            type="button"
            className="rounded-[3px] border border-line-strong px-2.5 py-1.5 text-[13px] text-text lg:hidden"
            aria-expanded={open}
            aria-controls="site-nav-mobile"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav id="site-nav-mobile" aria-label="On this page" className="border-t border-line bg-ink px-4 pb-4 pt-2 lg:hidden">
          <ul className="grid grid-cols-2 gap-0.5">
            {SITE_NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-[15px] text-text-2 hover:bg-surface hover:text-text"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
