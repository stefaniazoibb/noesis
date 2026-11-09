import "server-only";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder } from "@/lib/repo/entities";
import { EVIDENCE_LEVEL_LABEL } from "@/lib/evidence/metrics";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { getAtlas } from "@/lib/repo/atlas";
import type { CorpusFacts } from "./citations";
import { getStudies } from "@/lib/repo/evidence";
import type { RetrievalResult } from "./retrieval";

export const SYNTHESIS_SYSTEM = `You are the research assistant of NOĒSIS, a scientific brain-evidence atlas. You synthesize ONLY the evidence records provided in the user message — never your own background knowledge, even when you are confident. If the records do not answer the question, say exactly what is and is not covered.

Hard rules:
1. Every scientific claim must cite its source inline as [study_id] (e.g. [study_schmaal_2016]), one id per bracket — write [study_a][study_b], never [study_a, study_b]. Cite only ids present in the provided records. A sentence making a scientific claim without a citation is a violation.
2. Use hedged, association-level language: "implicated in", "associated with", "reported". Never causal language, never diagnostic advice.
3. Distinguish evidence strength using the provided rule-based levels (Strong/Moderate/Emerging/Mixed) and note disagreements between studies explicitly.
4. The corpus is small and curated (not a systematic review) — say so when the user asks about coverage or when evidence is thin.
5. Be concise: a short synthesis of a few sentences to two paragraphs, no headers, no bullet lists unless the user asks for a list.
6. Statements about corpus coverage (how many indexed studies a disorder or modality has) may use ONLY the CORPUS COVERAGE block and must be cited with the literal marker [corpus]. Use [corpus] only on a sentence that states such a count and nothing else — never on a sentence about findings, regions or directions. Say explicitly that coverage reflects the curated corpus, not the literature.
7. When the records show opposite directions for the same finding, present both sides with their citations and do not decide which is right.`;

export function buildEvidenceContext(r: RetrievalResult): string {
  const lines: string[] = ["EVIDENCE RECORDS (the only permitted sources):"];
  for (const s of r.studies) {
    lines.push(
      `[${s.id}] ${s.title} — ${s.authors[0]} et al., ${s.journal}, ${s.year}. ` +
        `Modalities: ${s.modalities.join(",")}. Disorders: ${s.disorders.join(",")}. ` +
        `${s.sampleSize ? `N=${s.sampleSize}. ` : ""}Finding: ${s.finding}`,
    );
  }
  if (r.pairs.length > 0) {
    lines.push(
      "\nDISORDER-REGION EVIDENCE (computed from the records above; levels are rule-based per docs/METRICS.md):",
    );
    for (const p of r.pairs) {
      const region = getRegion(p.region);
      const disorder = getDisorder(p.disorder);
      const dirs = new Map<string, Set<string>>();
      for (const a of p.assertions) {
        if (!a.direction) continue;
        const k = `${a.findingType} ${a.direction}`;
        (dirs.get(k) ?? dirs.set(k, new Set()).get(k)!).add(a.studyId);
      }
      const dirText = [...dirs.entries()]
        .map(([k, ids]) => `${k} [${[...ids].join(", ")}]`)
        .join("; ");
      lines.push(
        `${disorder?.name ?? p.disorder} — ${region?.name ?? p.region} (${region?.hemisphere ?? "?"}): ` +
          `${p.studyIds.length} studies [${p.studyIds.join(", ")}], ` +
          `modality categories: ${p.modalityCategories.join("+")}, level: ${EVIDENCE_LEVEL_LABEL[p.level]}` +
          (dirText ? `, directions: ${dirText}` : ""),
      );
    }
  }
  lines.push("", corpusCoverageBlock());
  return lines.join("\n");
}

/** Deterministic corpus statistics — cite as [corpus] (docs/METRICS.md). */
export function corpusCoverageBlock(): string {
  const studies = getStudies();
  const modalities = getModalities();
  const rows = getDisorders()
    .map((d) => {
      const ds = studies.filter((s) => s.disorders.includes(d.id));
      const byMod = modalities
        .map((m) => `${m.abbreviation} ${ds.filter((s) => s.modalities.includes(m.id)).length}`)
        .join(", ");
      return { name: d.name, n: ds.length, byMod };
    })
    .sort((a, b) => a.n - b.n);
  return [
    `CORPUS COVERAGE (deterministic counts over the curated corpus of ${studies.length} studies; cite as [corpus]):`,
    ...rows.map((r) => `${r.name}: ${r.n} studies (${r.byMod})`),
  ].join("\n");
}

/** The true coverage counts, for validating [corpus] citations. */
export function corpusFacts(): CorpusFacts {
  const studies = getStudies();
  const counts: CorpusFacts["counts"] = [
    ...getDisorders().map((d) => {
      const ds = studies.filter((s) => s.disorders.includes(d.id));
      return {
        names: [d.name, ...d.synonyms],
        values: [ds.length, ...getModalities().map((m) => ds.filter((s) => s.modalities.includes(m.id)).length)],
      };
    }),
    ...getModalities().map((m) => ({
      names: [m.name, m.abbreviation],
      values: [studies.filter((s) => s.modalities.includes(m.id)).length],
    })),
    { names: ["corpus", "studies"], values: [studies.length] },
  ];
  const blockedTerms = [
    ...new Set(getAtlas().regions.map((r) => r.name.toLowerCase())),
    "hippocampal", "amygdalar", "thalamic", "cortical", "cortex", "gyrus", "lobe",
    "increased", "decreased", "reduced", "reduction", "smaller", "larger", "thinner",
    "thicker", "volume", "volumes", "activation", "activity", "connectivity",
    "associated", "association", "implicated", "linked", "effect", "response",
  ];
  return { counts, blockedTerms };
}
