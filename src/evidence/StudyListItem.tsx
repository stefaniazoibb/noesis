import Link from "next/link";
import type { Study } from "@/lib/schemas";

const DIRECTION_GLYPH: Record<string, string> = {
  increased: "↑",
  decreased: "↓",
  mixed: "±",
};

/** Compact study citation with provenance links. Server- and client-safe. */
export function StudyListItem({
  study,
  statements,
  detailHref,
}: {
  study: Study;
  statements?: string[];
  /** internal study-detail link; when set, the title becomes a link */
  detailHref?: string;
}) {
  const firstAuthor = study.authors[0]?.split(" ")[0] ?? "Unknown";
  return (
    <li className="rounded border border-zinc-800/70 bg-zinc-900/40 p-2.5">
      {detailHref ? (
        <Link
          href={detailHref as Parameters<typeof Link>[0]["href"]}
          className="text-xs leading-snug text-zinc-200 hover:text-white"
        >
          {study.title}
        </Link>
      ) : (
        <p className="text-xs leading-snug text-zinc-200">{study.title}</p>
      )}
      <p className="mt-1 text-[11px] text-zinc-500">
        {firstAuthor}
        {study.authors.length > 1 ? " et al." : ""} · {study.journal} ·{" "}
        {study.year} · {study.modalities.join(", ").toUpperCase()}
        {study.direction && ` · ${DIRECTION_GLYPH[study.direction]}`}
        {study.sampleSize !== null && ` · n=${study.sampleSize}`}
      </p>
      {statements?.map((s) => (
        <p key={s} className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
          {s}
        </p>
      ))}
      <p className="mt-1.5 flex gap-3 text-[11px]">
        {study.doi && (
          <a
            href={`https://doi.org/${study.doi}`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200"
          >
            DOI
          </a>
        )}
        {study.pmid && (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline decoration-zinc-700 hover:text-zinc-200"
          >
            PMID {study.pmid}
          </a>
        )}
      </p>
    </li>
  );
}
