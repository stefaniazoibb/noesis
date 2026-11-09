"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { search, type SearchResult } from "@/search/searchIndex";

const TYPE_LABEL = {
  region: "Region",
  disorder: "Disorder",
  modality: "Modality",
  study: "Study",
} as const;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere (unless already typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const r = search(query);
      setResults(r);
      setActive(0);
      setOpen(r.length > 0);
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(r.href as Parameters<typeof router.push>[0]);
  };

  return (
    <div ref={rootRef} className="relative w-full md:w-56 xl:w-72">
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search regions, disorders, DOI/PMID…  /"
        aria-label="Global search"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(results.length > 0)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && results[active]) {
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-md border border-line bg-surface/70 px-3 py-1.5 text-xs text-text placeholder:text-text-3 focus:border-amber/60 focus:outline-none"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/95 py-1 shadow-xl backdrop-blur">
          {results.map((r, i) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left ${
                  i === active ? "bg-zinc-800/70" : ""
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="line-clamp-2 text-xs text-zinc-200">
                    {r.title}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
                    {TYPE_LABEL[r.type]}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  {r.subtitle}
                  {r.type === "study" && r.pmid && ` · PMID ${r.pmid}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
