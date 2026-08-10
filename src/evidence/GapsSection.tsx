import Link from "next/link";
import { getGaps, getProfilesByDisorder, getStudy } from "@/lib/repo/evidence";
import { getDisorder } from "@/lib/repo/entities";
import { getRegion } from "@/lib/repo/atlas";
import { GAP_RULES, type EvidenceGap } from "@/lib/evidence/gaps";
import { NOT_ASSESSED_DIMENSIONS } from "@/lib/evidence/convergence";

const HEMI = { left: "L", right: "R", midline: "" };

function regionLabel(id: string): string {
  const r = getRegion(id);
  return r
    ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}`
    : id;
}

/** Inline provenance chip: short citation linking to DOI/PubMed. */
function StudyCite({ id }: { id: string }) {
  const s = getStudy(id);
  if (!s) return null;
  const url = s.doi
    ? `https://doi.org/${s.doi}`
    : `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={s.title}
      className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
    >
      {s.authors[0]?.split(" ")[0]} {s.year}
    </a>
  );
}

function gapText(g: EvidenceGap): string {
  if (g.ruleId === "GAP-IMG-EP")
    return `${g.magnitude} imaging studies, no electrophysiology evidence.`;
  if (g.ruleId === "GAP-OBS-INT")
    return `${g.magnitude} correlational studies, no interventional evidence.`;
  if (g.ruleId === "GAP-CONFLICT")
    return `Opposite directions reported by independent studies.`;
  return `${g.magnitude} studies in ${getDisorder(g.referenceDisorder!)?.name ?? g.referenceDisorder}, none here.`;
}

export function GapsSection({ disorderId }: { disorderId: string }) {
  const profiles = getProfilesByDisorder().get(disorderId) ?? [];
  const conflicts = profiles.filter((p) => p.conflicts.length > 0);
  const gaps = getGaps().filter((g) => g.disorder === disorderId);
  const byRule = new Map<string, EvidenceGap[]>();
  for (const g of gaps) {
    (byRule.get(g.ruleId) ?? byRule.set(g.ruleId, []).get(g.ruleId)!).push(g);
  }

  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Evidence conflicts &amp; gaps
        </h2>
        <Link
          href={`/brain?disorder=${disorderId}&mode=gaps`}
          className="text-[11px] text-zinc-500 underline decoration-zinc-700 hover:text-zinc-300"
        >
          View on the 3D brain →
        </Link>
      </div>

      <h3 className="mt-3 text-xs text-zinc-300">Directional conflicts</h3>
      {conflicts.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          No directional conflicts among the indexed studies for this
          disorder (the corpus is built largely from meta-analyses, which
          tend to agree — conflicts would surface with primary-study
          curation).
        </p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {conflicts.map((p) =>
            p.conflicts.map((c) => (
              <li key={`${p.region}-${c.findingType}`} className="text-xs">
                <span className="text-zinc-300">
                  {regionLabel(p.region)} — {c.findingType.replace(/_/g, " ")}:
                </span>{" "}
                <span className="text-zinc-500">
                  increased{" "}
                  {c.increased.map((id) => (
                    <StudyCite key={id} id={id} />
                  ))}{" "}
                  vs decreased{" "}
                  {c.decreased.map((id) => (
                    <StudyCite key={id} id={id} />
                  ))}
                  {" · "}years {c.differences.years[0]}–{c.differences.years[1]}
                  . Possible reasons (population, paradigm, sample size) are
                  for the researcher to judge.
                </span>
              </li>
            )),
          )}
        </ul>
      )}

      <h3 className="mt-4 text-xs text-zinc-300">
        Detected gaps ({gaps.length})
      </h3>
      {gaps.length === 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          No gaps detected by the current rules.
        </p>
      ) : (
        <div className="mt-1.5 space-y-3">
          {[...byRule.entries()].map(([ruleId, ruleGaps]) => (
            <div key={ruleId}>
              <p className="text-[11px] text-zinc-400">
                {GAP_RULES[ruleId as keyof typeof GAP_RULES].name}
                <span className="text-zinc-600"> · {ruleGaps.length}</span>
              </p>
              <ul className="mt-1 space-y-1.5">
                {ruleGaps.slice(0, 5).map((g) => (
                  <li
                    key={`${g.ruleId}-${g.region}-${g.referenceDisorder ?? ""}`}
                    className="text-xs"
                  >
                    <span className="text-zinc-300">{regionLabel(g.region)}</span>{" "}
                    <span className="text-zinc-500">— {gapText(g)}</span>{" "}
                    {g.supportingStudyIds.slice(0, 4).map((id) => (
                      <StudyCite key={id} id={id} />
                    ))}
                    {g.conflictingStudyIds?.map((id) => (
                      <StudyCite key={id} id={id} />
                    ))}
                  </li>
                ))}
                {ruleGaps.length > 5 && (
                  <li className="text-[11px] text-zinc-600">
                    …and {ruleGaps.length - 5} more.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 border-t border-zinc-800/70 pt-2 text-[10px] leading-relaxed text-zinc-600">
        Rule-based detection over the indexed corpus (thresholds in
        docs/METRICS.md) — a gap here may be a curation gap, not a gap in the
        literature. Not assessed by the current schema:{" "}
        {NOT_ASSESSED_DIMENSIONS.map((d) => d.replace(/_/g, " ")).join(", ")}.
      </p>
    </section>
  );
}
