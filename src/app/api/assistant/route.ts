import { NextRequest, NextResponse } from "next/server";
import {
  complete,
  isAuthError,
  ProviderRefusalError,
} from "@/ai/provider";
import { parseIntent, type Intent } from "@/ai/intent";
import { retrieve } from "@/ai/retrieval";
import { SYNTHESIS_SYSTEM, buildEvidenceContext, corpusFacts } from "@/ai/prompts";
import { validateCitations } from "@/ai/citations";
import { getAtlas } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { getStudies } from "@/lib/repo/evidence";
import { VizStatePatchSchema } from "@/lib/schemas";
import { generateQuestion, rankedGapsFor } from "@/ai/questions";
import { linkEntities } from "@/ai/linkEntities";
import type { RetrievalResult } from "@/ai/retrieval";
import type { Study } from "@/lib/schemas";

const DISCLAIMER =
  "AI-generated synthesis based on indexed evidence. Verify against the original publications.";

function scientificTerms(): string[] {
  return [
    ...getDisorders().flatMap((d) => [d.name, ...d.synonyms]),
    ...getModalities().flatMap((m) => [m.name, m.abbreviation]),
    ...getAtlas().regions.map((r) => r.name),
  ];
}

function citationOf(s: Study) {
  return {
    id: s.id,
    title: s.title,
    firstAuthor: s.authors[0] ?? null,
    journal: s.journal,
    year: s.year,
    doi: s.doi,
    pmid: s.pmid,
    modalities: s.modalities,
  };
}

/** Regions the answer concerns: named in the question first, then the
 *  best-supported retrieved pairs — lets the UI drive the 3D atlas. */
function answerRegions(intentRegions: string[], r: RetrievalResult): string[] {
  const out: string[] = [...intentRegions];
  for (const p of r.pairs) if (!out.includes(p.region)) out.push(p.region);
  return out.slice(0, 6);
}

function hasCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

/**
 * Graceful degradation without an API key: deterministic entity linking +
 * the same deterministic retrieval, returned as source cards. No model is
 * involved, so nothing is synthesized — the records are shown as-is.
 */
function retrievalOnly(question: string) {
  const entities = linkEntities(question);
  const retrieval = retrieve(question, {
    intent: "question",
    ...entities,
    vizCommand: null,
  });
  const keyNote =
    "Live AI synthesis needs an Anthropic API key (ANTHROPIC_API_KEY), which is not configured on this deployment.";
  if (retrieval.studies.length === 0) {
    return NextResponse.json({
      type: "retrieval",
      answer: `${keyNote} No indexed records in the corpus match this question either — try naming a disorder, region or modality.`,
      citations: [],
      regions: [],
      flags: { strippedCitations: 0, uncitedSentences: 0 },
      disclaimer: null,
    });
  }
  return NextResponse.json({
    type: "retrieval",
    answer:
      `${keyNote} Below are the ${retrieval.studies.length} indexed records the assistant would synthesize from — the evidence itself, without interpretation.` +
      (entities.disorders.length + entities.regions.length + entities.modalities.length === 0
        ? " The question names no disorder, region or modality from the catalogue, so these records were matched by text only and may be loosely related. Corpus-wide coverage counts are on the Research Gaps page."
        : ""),
    citations: retrieval.studies.map(citationOf),
    regions: answerRegions(entities.regions, retrieval),
    flags: { strippedCitations: 0, uncitedSentences: 0 },
    disclaimer:
      "Retrieved by deterministic matching over the curated corpus — not a synthesis. Read the records themselves before drawing conclusions.",
  });
}

function vizResponse(intent: Intent) {
  const patch = VizStatePatchSchema.parse({
    ...(intent.vizCommand?.mode
      ? { mode: intent.vizCommand.mode }
      : intent.disorders.length > 0
        ? { mode: "disorder" as const }
        : {}),
    ...(intent.disorders.length > 0 ? { disorders: [intent.disorders[0]] } : {}),
    ...(intent.modalities.length > 0 ? { modalities: intent.modalities } : {}),
    ...(intent.vizCommand?.showSubcortical !== null &&
    intent.vizCommand?.showSubcortical !== undefined
      ? { showSubcortical: intent.vizCommand.showSubcortical }
      : {}),
  });
  return NextResponse.json({
    type: "viz",
    patch,
    selectRegion: intent.vizCommand?.selectRegion ?? null,
    explanation:
      "Updated the visualization. Overlays show only indexed evidence — see the legend for the metric definition.",
  });
}

function noEvidenceAnswer() {
  const disorders = getDisorders()
    .map((d) => d.name)
    .join(", ");
  return NextResponse.json({
    type: "answer",
    answer:
      `No indexed evidence matches this question, so I can't answer it from the corpus — and I don't answer scientific questions from model memory. ` +
      `The current corpus covers ${getStudies().length} curated studies across ${disorders}, with fMRI, sMRI, EEG and TMS evidence.`,
    citations: [],
    flags: { strippedCitations: 0, uncitedSentences: 0 },
    disclaimer: DISCLAIMER,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 2000) {
    return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  }

  if (!hasCredentials()) return retrievalOnly(question);

  try {
    const intent = (await parseIntent(question)) ?? {
      intent: "question" as const,
      disorders: [],
      regions: [],
      modalities: [],
      vizCommand: null,
    };

    if (intent.intent === "viz_command") return vizResponse(intent);
    if (intent.intent === "research_questions") {
      const disorderId = intent.disorders[0];
      if (!disorderId) {
        return NextResponse.json({
          type: "answer",
          answer:
            "Tell me which disorder to generate research questions for (e.g. \"generate research questions about OCD\") — I derive them from that disorder's detected evidence gaps.",
          citations: [],
          flags: { strippedCitations: 0, uncitedSentences: 0 },
          disclaimer: null,
        });
      }
      const gaps = rankedGapsFor(disorderId).slice(0, 2);
      if (gaps.length === 0) return noEvidenceAnswer();
      const questions = (
        await Promise.all(gaps.map((g) => generateQuestion(g)))
      ).filter((q) => q !== null);
      const answer = questions
        .map(
          (q, i) =>
            `${i + 1}. ${q.question}\n` +
            `Why: ${q.rationale}\n` +
            `Hypothesis: ${q.hypothesis}\n` +
            `Gap: ${q.provenance.ruleName} (${q.rank.explanation}).`,
        )
        .join("\n\n");
      const seen = new Set<string>();
      const citations = questions
        .flatMap((q) => q.provenance.studies)
        .filter((s) => !seen.has(s.id) && seen.add(s.id));
      return NextResponse.json({
        type: "answer",
        answer:
          `AI-generated research opportunities derived from detected evidence gaps:\n\n${answer}`,
        citations,
        flags: {
          strippedCitations: questions.reduce(
            (n, q) => n + q.flags.strippedCitations,
            0,
          ),
          uncitedSentences: 0,
        },
        disclaimer:
          "AI-generated research opportunities based on the indexed evidence — not validated research conclusions.",
      });
    }
    if (intent.intent === "smalltalk") {
      return NextResponse.json({
        type: "answer",
        answer:
          "I answer questions about the evidence indexed in NOĒSIS — brain regions, disorders, modalities and studies — and I can drive the 3D brain (e.g. \"show depression evidence, fMRI only\"). What would you like to explore?",
        citations: [],
        flags: { strippedCitations: 0, uncitedSentences: 0 },
        disclaimer: null,
      });
    }

    const retrieval = retrieve(question, intent);
    if (retrieval.studies.length === 0) return noEvidenceAnswer();

    const raw = await complete({
      system: SYNTHESIS_SYSTEM,
      user: `QUESTION: ${question}\n\n${buildEvidenceContext(retrieval)}`,
      maxTokens: 1500,
    });

    const validated = validateCitations(
      raw,
      new Set(retrieval.studies.map((s) => s.id)),
      scientificTerms(),
      corpusFacts(),
    );
    const byId = new Map(retrieval.studies.map((s) => [s.id, s]));
    const citations = validated.citedIds.map((id) => citationOf(byId.get(id)!));

    return NextResponse.json({
      type: "answer",
      answer: validated.text,
      citations,
      flags: {
        strippedCitations: validated.strippedIds.length + validated.strippedCorpusMarkers,
        uncitedSentences: validated.uncitedScientificSentences,
      },
      retrieved: retrieval.studies.length,
      regions: answerRegions(intent.regions, retrieval),
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    if (err instanceof ProviderRefusalError) {
      return NextResponse.json({
        type: "answer",
        answer: "The model declined this request. Try rephrasing the question.",
        citations: [],
        flags: { strippedCitations: 0, uncitedSentences: 0 },
        disclaimer: null,
      });
    }
    if (isAuthError(err)) return retrievalOnly(question);
    console.error("assistant route error:", err);
    return NextResponse.json({ error: "assistant_failed" }, { status: 500 });
  }
}
