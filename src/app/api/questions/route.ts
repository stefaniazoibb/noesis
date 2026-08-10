import { NextRequest, NextResponse } from "next/server";
import { isAuthError, ProviderRefusalError } from "@/ai/provider";
import {
  generateQuestion,
  rankedGapsFor,
  type ResearchQuestion,
} from "@/ai/questions";
import { getDisorder } from "@/lib/repo/entities";

const DISCLAIMER =
  "AI-generated research opportunity based on the indexed evidence. This is not a validated research conclusion; the underlying gap is computed over a small curated corpus and may reflect curation choices.";

const MAX_QUESTIONS = 3;

// per-process cache: questions are deterministic-ish per corpus, and
// generation is expensive; regenerate only per server restart
const cache = new Map<string, ResearchQuestion[]>();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const disorderId = typeof body?.disorder === "string" ? body.disorder : "";
  if (!getDisorder(disorderId)) {
    return NextResponse.json({ error: "unknown_disorder" }, { status: 400 });
  }

  const gaps = rankedGapsFor(disorderId).slice(0, MAX_QUESTIONS);
  if (gaps.length === 0) {
    return NextResponse.json({
      questions: [],
      disclaimer: DISCLAIMER,
      note: "No evidence gaps detected for this disorder by the current rules, so no questions were generated.",
    });
  }

  const cached = cache.get(disorderId);
  if (cached) {
    return NextResponse.json({ questions: cached, disclaimer: DISCLAIMER });
  }

  try {
    const questions = (
      await Promise.all(gaps.map((g) => generateQuestion(g)))
    ).filter((q): q is ResearchQuestion => q !== null);
    cache.set(disorderId, questions);
    return NextResponse.json({ questions, disclaimer: DISCLAIMER });
  } catch (err) {
    if (err instanceof ProviderRefusalError) {
      return NextResponse.json({ error: "refused" }, { status: 502 });
    }
    if (isAuthError(err)) {
      return NextResponse.json(
        {
          error: "no_credentials",
          message:
            "Research-question generation needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.",
        },
        { status: 503 },
      );
    }
    console.error("questions route error:", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
