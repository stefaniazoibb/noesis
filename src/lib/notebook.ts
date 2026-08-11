"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Research notebook (roadmap #7): a client-side persistent workspace.
 * Human-in-the-loop rule: AI outputs (answers, research questions) exist
 * here ONLY because a researcher explicitly saved them; nothing is saved
 * automatically, and nothing here ever feeds back into /data.
 *
 * Storage: localStorage v1 (per-browser). The shape is versioned so a
 * future backend can import it.
 */

export type NotebookEntryType =
  | "region"
  | "disorder"
  | "study"
  | "gap"
  | "answer"
  | "question"
  | "note";

export interface NotebookEntry {
  /** stable dedupe key, e.g. "region:dk_lh_insula" or "answer:<timestamp>" */
  key: string;
  type: NotebookEntryType;
  title: string;
  subtitle?: string;
  /** internal app link for saved entities */
  href?: string;
  /** preserved content for AI outputs (text + citation list) */
  body?: string;
  citations?: { id: string; title: string; url: string }[];
  /** researcher's own annotation */
  note: string;
  savedAt: number;
  /** true for AI-generated content — rendered with the unvalidated label */
  aiGenerated: boolean;
}

export type NewNotebookEntry = Omit<NotebookEntry, "note" | "savedAt">;

interface NotebookState {
  entries: NotebookEntry[];
  add: (entry: NewNotebookEntry) => void;
  remove: (key: string) => void;
  setNote: (key: string, note: string) => void;
  clearAll: () => void;
}

export const useNotebook = create<NotebookState>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) =>
        set((s) =>
          s.entries.some((e) => e.key === entry.key)
            ? s
            : {
                entries: [
                  { ...entry, note: "", savedAt: Date.now() },
                  ...s.entries,
                ],
              },
        ),
      remove: (key) =>
        set((s) => ({ entries: s.entries.filter((e) => e.key !== key) })),
      setNote: (key, note) =>
        set((s) => ({
          entries: s.entries.map((e) => (e.key === key ? { ...e, note } : e)),
        })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: "noesis-notebook-v1",
      // no-op storage outside the browser (SSR prerender, tests)
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : localStorage,
      ),
    },
  ),
);

export const TYPE_LABELS: Record<NotebookEntryType, string> = {
  region: "Brain regions",
  disorder: "Disorders",
  study: "Studies",
  gap: "Evidence gaps",
  answer: "AI answers",
  question: "Research questions",
  note: "Notes",
};

/** Markdown export — pure so it is unit-testable. */
export function toMarkdown(entries: NotebookEntry[]): string {
  const lines: string[] = [
    "# NOĒSIS research notebook",
    "",
    `Exported ${new Date().toISOString().slice(0, 10)}. AI-generated entries are labeled and are not validated research conclusions. Evidence derives from the indexed corpus (curated, not a systematic review).`,
  ];
  const order: NotebookEntryType[] = [
    "question",
    "answer",
    "gap",
    "region",
    "disorder",
    "study",
    "note",
  ];
  for (const type of order) {
    const group = entries.filter((e) => e.type === type);
    if (group.length === 0) continue;
    lines.push("", `## ${TYPE_LABELS[type]}`);
    for (const e of group) {
      lines.push("", `### ${e.title}`);
      if (e.subtitle) lines.push(e.subtitle);
      if (e.aiGenerated)
        lines.push(
          "_AI-generated from the indexed evidence — not experimentally validated._",
        );
      if (e.body) lines.push("", e.body);
      if (e.citations?.length) {
        lines.push("", "References:");
        for (const c of e.citations) lines.push(`- ${c.title} — ${c.url}`);
      }
      if (e.note) lines.push("", `> Note: ${e.note}`);
    }
  }
  return lines.join("\n") + "\n";
}
