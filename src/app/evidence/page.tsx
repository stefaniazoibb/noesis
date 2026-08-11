"use client";

import { useMemo, useState } from "react";
import { getStudies } from "@/lib/repo/evidence";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { StudyListItem } from "@/evidence/StudyListItem";

export default function EvidencePage() {
  const [text, setText] = useState("");
  const [disorder, setDisorder] = useState("");
  const [modality, setModality] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const studies = useMemo(() => {
    const q = text.trim().toLowerCase();
    return getStudies()
      .filter((s) => {
        if (disorder && !s.disorders.includes(disorder)) return false;
        if (modality && !s.modalities.includes(modality)) return false;
        if (verifiedOnly && !s.curation.verifiedByHuman) return false;
        if (q) {
          const hay =
            `${s.title} ${s.authors.join(" ")} ${s.journal} ${s.finding} ${s.year}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.year - a.year);
  }, [text, disorder, modality, verifiedOnly]);

  const total = getStudies().length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-light tracking-wide text-zinc-100">
        Evidence browser
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        The complete indexed corpus — every study curated from its PubMed
        record and verified against PubMed and OpenAlex. Curated, not a
        systematic review.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by title, author, journal, finding…"
          aria-label="Filter studies"
          className="min-w-56 flex-1 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <select
          value={disorder}
          onChange={(e) => setDisorder(e.target.value)}
          aria-label="Disorder filter"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        >
          <option value="">All disorders</option>
          {getDisorders().map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          aria-label="Modality filter"
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        >
          <option value="">All modalities</option>
          {getModalities().map((m) => (
            <option key={m.id} value={m.id}>
              {m.abbreviation}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-zinc-400"
          />
          human-verified only
        </label>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        {studies.length} of {total} studies
      </p>
      {studies.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No indexed studies match these filters.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {studies.map((s) => (
            <StudyListItem
              key={s.id}
              study={s}
              statements={[s.finding]}
              detailHref={`/evidence/${s.id}`}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
