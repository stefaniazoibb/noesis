"use client";

import { useSyncExternalStore } from "react";
import { useNotebook, type NewNotebookEntry } from "@/lib/notebook";

function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useNotebook.persist.onFinishHydration(cb),
    () => useNotebook.persist.hasHydrated(),
    () => false,
  );
}

/** Toggle button: save an entry to / remove it from the research notebook. */
export function SaveToNotebook({
  entry,
  compact = false,
}: {
  entry: NewNotebookEntry;
  compact?: boolean;
}) {
  const hydrated = useHydrated();
  const saved = useNotebook((s) =>
    s.entries.some((e) => e.key === entry.key),
  );
  const add = useNotebook((s) => s.add);
  const remove = useNotebook((s) => s.remove);

  const cls = compact
    ? "rounded border border-zinc-800 px-1.5 py-0.5 text-[10px]"
    : "rounded border border-zinc-700 px-2.5 py-1 text-xs";
  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={() => (saved ? remove(entry.key) : add(entry))}
      title={
        saved ? "Remove from research notebook" : "Save to research notebook"
      }
      className={`${cls} transition-colors ${
        saved
          ? "border-emerald-900/70 text-emerald-500/90 hover:text-emerald-400"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      } disabled:opacity-40`}
    >
      {saved ? "✓ In notebook" : "Save"}
    </button>
  );
}
