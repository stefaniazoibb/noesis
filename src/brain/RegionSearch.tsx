"use client";

import { useId, useMemo, useState } from "react";
import { getAtlas } from "@/lib/repo/atlas";
import { useVizStore } from "@/state/vizStore";

const HEMI = { left: "L", right: "R", midline: "" } as const;

/** Anatomical-name search: select a region and fly the camera to it. */
export function RegionSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return getAtlas()
      .regions.filter(
        (r) =>
          r.name.toLowerCase().includes(t) ||
          r.sourceName.toLowerCase().includes(t) ||
          r.system.replace(/_/g, " ").includes(t),
      )
      .slice(0, 10);
  }, [q]);

  const choose = (id: string) => {
    const s = useVizStore.getState();
    if (id.startsWith("sub_")) s.setShowSubcortical(true);
    s.selectRegion(id);
    s.requestFocus(id);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="pointer-events-auto relative w-full sm:w-64">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Find a brain region by anatomical name"
        placeholder="Find a region — e.g. insula, amygdala"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-line bg-ink-2/85 px-3 py-2 text-xs text-text placeholder:text-text-3 backdrop-blur focus:border-amber/60 focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-ink-2/95 py-1 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r.id);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-xs ${
                i === active ? "bg-surface text-text" : "text-text-2"
              }`}
            >
              <span>
                {r.name}
                {r.hemisphere !== "midline" && (
                  <span className="text-text-3"> ({HEMI[r.hemisphere]})</span>
                )}
              </span>
              <span className="shrink-0 text-[10px] capitalize text-text-3">
                {r.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
