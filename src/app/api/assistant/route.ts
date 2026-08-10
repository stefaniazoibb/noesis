import { NextRequest, NextResponse } from "next/server";
import {
  complete,
  isAuthError,
  ProviderRefusalError,
} from "@/ai/provider";
import { parseIntent, type Intent } from "@/ai/intent";
import { retrieve } from "@/ai/retrieval";
import { SYNTHESIS_SYSTEM, buildEvidenceContext } from "@/ai/prompts";
import { validateCitations } from "@/ai/citations";
import { getAtlas } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { getStudies } from "@/lib/repo/evidence";
import { VizStatePatchSchema } from "@/lib/schemas";
import { generateQuestion, rankedGapsFor } from "@/ai/questions";

const DISCLAIMER =
  "AI-generated synthesis based on indexed evidence. Verify against the original publications.";

function scientificTerms(): string[] {
  return [
    ...getDisorders().flatMap((d) => [d.name, ...d.synonyms]),
    ...getModalities().flatMap((m) => [m.name, m.abbreviation]),
    ...getAtlas().regions.map((r) => r.name),
  ];
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
    );
    const byId = new Map(retrieval.studies.map((s) => [s.id, s]));
    const citations = validated.citedIds.map((id) => {
      const s = byId.get(id)!;
      return {
        id,
        title: s.title,
        journal: s.journal,
        year: s.year,
        doi: s.doi,
        pmid: s.pmid,
      };
    });

    return NextResponse.json({
      type: "answer",
      answer: validated.text,
      citations,
      flags: {
        strippedCitations: validated.strippedIds.length,
        uncitedSentences: validated.uncitedScientificSentences,
      },
      retrieved: retrieval.studies.length,
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
    if (isAuthError(err)) {
      return NextResponse.json(
        {
          error: "no_credentials",
          message:
            "The AI assistant needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
        },
        { status: 503 },
      );
    }
    console.error("assistant route error:", err);
    return NextResponse.json({ error: "assistant_failed" }, { status: 500 });
  }
}
