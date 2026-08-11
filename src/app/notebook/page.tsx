"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  TYPE_LABELS,
  toMarkdown,
  useNotebook,
  type NotebookEntryType,
} from "@/lib/notebook";

const ORDER: NotebookEntryType[] = [
  "question",
  "answer",
  "gap",
  "region",
  "disorder",
  "study",
  "note",
];

function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useNotebook.persist.onFinishHydration(cb),
    () => useNotebook.persist.hasHydrated(),
    () => false,
  );
}

export default function NotebookPage() {
  const hydrated = useHydrated();
  const entries = useNotebook((s) => s.entries);
  const remove = useNotebook((s) => s.remove);
  const setNote = useNotebook((s) => s.setNote);
  const clearAll = useNotebook((s) => s.clearAll);

  function exportMarkdown() {
    const blob = new Blob([toMarkdown(entries)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "noesis-notebook.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-light tracking-wide text-zinc-100">
          Research notebook
        </h1>
        {entries.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportMarkdown}
              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Delete all notebook entries?")) clearAll();
              }}
              className="rounded border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        Your saved regions, disorders, studies, AI answers and research
        questions — stored in this browser only. AI proposes, you validate:
        nothing lands here unless you saved it, and nothing here feeds back
        into the evidence database.
      </p>

      {!hydrated ? (
        <p className="mt-8 text-sm text-zinc-500">Loading notebook…</p>
      ) : entries.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          Nothing saved yet. Use the &ldquo;Save&rdquo; buttons on brain
          regions, <Link href="/disorders" className="underline decoration-zinc-700 hover:text-zinc-300">disorder pages</Link>,{" "}
          <Link href="/evidence" className="underline decoration-zinc-700 hover:text-zinc-300">studies</Link>, assistant
          answers, and generated research questions.
        </p>
      ) : (
        ORDER.filter((t) => entries.some((e) => e.type === t)).map((type) => (
          <section key={type} className="mt-6">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {TYPE_LABELS[type]} ({entries.filter((e) => e.type === type).length})
            </h2>
            <ul className="mt-2 space-y-2">
              {entries
                .filter((e) => e.type === type)
                .map((e) => (
                  <li
                    key={e.key}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {e.href ? (
                          <Link
                            href={e.href as never}
                            className="text-sm text-zinc-200 hover:text-white"
                          >
                            {e.title}
                          </Link>
                        ) : (
                          <p className="text-sm text-zinc-200">{e.title}</p>
                        )}
                        {e.subtitle && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {e.subtitle}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(e.key)}
                        className="shrink-0 text-xs text-zinc-600 hover:text-zinc-300"
                        title="Remove entry"
                      >
                        remove
                      </button>
                    </div>
                    {e.aiGenerated && (
                      <p className="mt-1 text-[10px] text-amber-600/80">
                        AI-generated from the indexed evidence — not
                        experimentally validated.
                      </p>
                    )}
                    {e.body && (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                        {e.body}
                      </p>
                    )}
                    {e.citations && e.citations.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.citations.map((c) => (
                          <a
                            key={c.id}
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            title={c.title}
                            className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          >
                            {c.title.slice(0, 40)}…
                          </a>
                        ))}
                      </p>
                    )}
                    <textarea
                      defaultValue={e.note}
                      onBlur={(ev) => setNote(e.key, ev.target.value)}
                      placeholder="Your notes…"
                      rows={e.note ? 2 : 1}
                      className="mt-2 w-full resize-y rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
