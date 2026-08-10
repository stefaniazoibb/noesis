import "server-only";
import { z } from "zod";
import { structured } from "./provider";
import { validateCitations } from "./citations";
import { getGaps, getStudy } from "@/lib/repo/evidence";
import { getDisorder, getModalities } from "@/lib/repo/entities";
import { getRegion } from "@/lib/repo/atlas";
import { GAP_RULES, type EvidenceGap, type GapRuleId } from "@/lib/evidence/gaps";

/**
 * Research-question generation (Intelligence layer E).
 *
 * Deterministic parts: gap selection, ranking, question type, candidate
 * regions/modalities, and the provenance chain — all derived from the gap
 * rules, never from the model. The LLM only writes the prose (question,
 * rationale, hypothesis, methodology, limitations) from a grounded package,
 * and its citations are validated against that package.
 */

// ---- deterministic ranking (documented in docs/METRICS.md) ----

const RULE_WEIGHT: Record<GapRuleId, number> = {
  "GAP-CONFLICT": 3,
  "GAP-IMG-EP": 2,
  "GAP-OBS-INT": 2,
  "GAP-ATTENTION": 1,
};

const RULE_QUESTION_TYPE: Record<GapRuleId, string> = {
  "GAP-CONFLICT": "methodological",
  "GAP-IMG-EP": "cross_modal",
  "GAP-OBS-INT": "interventional",
  "GAP-ATTENTION": "comparative",
};

export function rankScore(gap: EvidenceGap): number {
  return gap.magnitude * RULE_WEIGHT[gap.ruleId];
}

export function rankExplanation(gap: EvidenceGap): string {
  return (
    `score ${rankScore(gap)} = ${gap.magnitude} supporting studies × ` +
    `rule weight ${RULE_WEIGHT[gap.ruleId]} (${GAP_RULES[gap.ruleId].name}); ` +
    `weights favour contradiction resolution (3) over missing-modality (2) ` +
    `and attention-asymmetry (1) gaps`
  );
}

export function rankedGapsFor(disorder: string): EvidenceGap[] {
  return getGaps()
    .filter((g) => g.disorder === disorder)
    .sort((a, b) => rankScore(b) - rankScore(a));
}

// ---- grounded package ----

export interface GapPackage {
  gap: EvidenceGap;
  questionType: string;
  candidateRegions: string[];
  candidateModalities: string[];
  studyIds: string[];
  contextText: string;
}

function citeLine(id: string): string {
  const s = getStudy(id);
  if (!s) return "";
  return `[${s.id}] ${s.title} — ${s.authors[0]} et al., ${s.journal}, ${s.year}. Finding: ${s.finding}`;
}

export function buildGapPackage(gap: EvidenceGap): GapPackage {
  const disorder = getDisorder(gap.disorder);
  const region = getRegion(gap.region);
  const refDisorder = gap.referenceDisorder
    ? getDisorder(gap.referenceDisorder)
    : undefined;

  const presentModalities = [
    ...new Set(
      gap.supportingStudyIds.flatMap((id) => getStudy(id)?.modalities ?? []),
    ),
  ];
  const abbrev = new Map(getModalities().map((m) => [m.id, m.abbreviation]));
  const candidateModalities = [
    ...presentModalities.map((m) => abbrev.get(m) ?? m),
    ...(gap.ruleId === "GAP-IMG-EP" ? ["EEG"] : []),
    ...(gap.ruleId === "GAP-OBS-INT" ? ["TMS"] : []),
  ];

  const studyIds = [
    ...gap.supportingStudyIds,
    ...(gap.conflictingStudyIds ?? []),
  ];

  const lines = [
    `GAP TYPE: ${GAP_RULES[gap.ruleId].name} — ${GAP_RULES[gap.ruleId].definition}`,
    `DISORDER: ${disorder?.name ?? gap.disorder}`,
    `BRAIN REGION: ${region?.name ?? gap.region} (${region?.hemisphere ?? "?"} hemisphere)`,
    `GAP: ${gap.description}`,
    ...(refDisorder
      ? [`REFERENCE DISORDER (where the region IS studied): ${refDisorder.name}`]
      : []),
    "SUPPORTING STUDIES:",
    ...gap.supportingStudyIds.map(citeLine),
    ...(gap.conflictingStudyIds?.length
      ? ["CONFLICTING STUDIES:", ...gap.conflictingStudyIds.map(citeLine)]
      : []),
  ];

  return {
    gap,
    questionType: RULE_QUESTION_TYPE[gap.ruleId],
    candidateRegions: [gap.region],
    candidateModalities,
    studyIds,
    contextText: lines.filter(Boolean).join("\n"),
  };
}

// ---- LLM generation ----

const GeneratedProseSchema = z.object({
  question: z.string(),
  rationale: z.string(),
  hypothesis: z.string(),
  methodologyNotes: z.string(),
  limitations: z.string(),
});

const SYSTEM = `You write ONE research question for NOĒSIS, grounded ONLY in the evidence-gap package provided. Rules:
1. The question must address exactly this gap — never a generic neuroscience question.
2. Cite supporting studies inline as [study_id] in the rationale (only ids present in the package).
3. Hedged, association-level language. The hypothesis must be framed as requiring empirical validation.
4. methodologyNotes: 1-2 sentences of practical study-design considerations. limitations: 1-2 sentences, including that the gap is derived from a small curated corpus.
5. Be concise: one sentence for the question; 2-3 sentences each for the rest.`;

export interface ResearchQuestion {
  question: string;
  questionType: string;
  rationale: string;
  hypothesis: string;
  methodologyNotes: string;
  limitations: string;
  candidateRegions: { id: string; name: string }[];
  candidateModalities: string[];
  rank: { score: number; explanation: string };
  provenance: {
    ruleId: GapRuleId;
    ruleName: string;
    gapDescription: string;
    magnitude: number;
    referenceDisorder: string | null;
    studies: {
      id: string;
      title: string;
      journal: string | null;
      year: number;
      doi: string | null;
      pmid: string | null;
    }[];
  };
  flags: { strippedCitations: number };
}

export async function generateQuestion(
  gap: EvidenceGap,
): Promise<ResearchQuestion | null> {
  const pkg = buildGapPackage(gap);
  const prose = await structured({
    schema: GeneratedProseSchema,
    system: SYSTEM,
    user: pkg.contextText,
    maxTokens: 1200,
  });
  if (!prose) return null;

  const retrieved = new Set(pkg.studyIds);
  const rationale = validateCitations(prose.rationale, retrieved, []);
  const hypothesis = validateCitations(prose.hypothesis, retrieved, []);

  return {
    question: prose.question,
    questionType: pkg.questionType,
    rationale: rationale.text,
    hypothesis: hypothesis.text,
    methodologyNotes: prose.methodologyNotes,
    limitations: prose.limitations,
    candidateRegions: pkg.candidateRegions.map((id) => ({
      id,
      name: getRegion(id)?.name ?? id,
    })),
    candidateModalities: pkg.candidateModalities,
    rank: { score: rankScore(gap), explanation: rankExplanation(gap) },
    provenance: {
      ruleId: gap.ruleId,
      ruleName: GAP_RULES[gap.ruleId].name,
      gapDescription: gap.description,
      magnitude: gap.magnitude,
      referenceDisorder: gap.referenceDisorder
        ? (getDisorder(gap.referenceDisorder)?.name ?? gap.referenceDisorder)
        : null,
      studies: pkg.studyIds.map((id) => {
        const s = getStudy(id)!;
        return {
          id,
          title: s.title,
          journal: s.journal,
          year: s.year,
          doi: s.doi,
          pmid: s.pmid,
        };
      }),
    },
    flags: {
      strippedCitations:
        rationale.strippedIds.length + hypothesis.strippedIds.length,
    },
  };
}
