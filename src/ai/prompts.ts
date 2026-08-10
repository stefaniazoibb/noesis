import "server-only";
import { getRegion } from "@/lib/repo/atlas";
import { getDisorder } from "@/lib/repo/entities";
import { EVIDENCE_LEVEL_LABEL } from "@/lib/evidence/metrics";
import type { RetrievalResult } from "./retrieval";

export const SYNTHESIS_SYSTEM = `You are the research assistant of NOĒSIS, a scientific brain-evidence atlas. You synthesize ONLY the evidence records provided in the user message — never your own background knowledge, even when you are confident. If the records do not answer the question, say exactly what is and is not covered.

Hard rules:
1. Every scientific claim must cite its source inline as [study_id] (e.g. [study_schmaal_2016]). Cite only ids present in the provided records. A sentence making a scientific claim without a citation is a violation.
2. Use hedged, association-level language: "implicated in", "associated with", "reported". Never causal language, never diagnostic advice.
3. Distinguish evidence strength using the provided rule-based levels (Strong/Moderate/Emerging/Mixed) and note disagreements between studies explicitly.
4. The corpus is small and curated (not a systematic review) — say so when the user asks about coverage or when evidence is thin.
5. Be concise: a short synthesis of a few sentences to two paragraphs, no headers, no bullet lists unless the user asks for a list.`;

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
      lines.push(
        `${disorder?.name ?? p.disorder} — ${region?.name ?? p.region} (${region?.hemisphere ?? "?"}): ` +
          `${p.studyIds.length} studies [${p.studyIds.join(", ")}], ` +
          `modality categories: ${p.modalityCategories.join("+")}, level: ${EVIDENCE_LEVEL_LABEL[p.level]}`,
      );
    }
  }
  return lines.join("\n");
}
