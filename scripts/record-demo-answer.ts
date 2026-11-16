/**
 * Records ONE real assistant answer for the landing page's "Ask NOĒSIS"
 * chapter. Spends a few cents (one synthesis call). Run deliberately:
 *   npx tsx --conditions=react-server scripts/record-demo-answer.ts
 *
 * The pipeline is the /api/assistant "question" path: deterministic
 * retrieval -> synthesis -> citation validation. The intent is the fixed
 * object the landing page already uses for its retrieval example, so the
 * recorded answer and the retrieval shown beside it are the same records.
 * The model id, response id and request id are copied from the API
 * response, never typed by hand. Output: src/site/recorded/answer.json
 * (outside /data: AI output never enters the evidence store).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, "");
  }
}

export const DEMO_QUESTION =
  "Which brain regions are most consistently associated with major depressive disorder?";

function corpusFingerprint(): string {
  // same as src/site/data.ts corpusFingerprint()
  const parse = (f: string) => JSON.parse(readFileSync(f, "utf8"));
  return createHash("sha256")
    .update(JSON.stringify([parse("data/studies/studies.json"), parse("data/evidence/assertions.json")]))
    .digest("hex")
    .slice(0, 16);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("no ANTHROPIC_API_KEY");
  const { retrieve } = await import("../src/ai/retrieval");
  const { SYNTHESIS_SYSTEM, buildEvidenceContext, corpusFacts } = await import("../src/ai/prompts");
  const { validateCitations } = await import("../src/ai/citations");
  const { getDisorders, getModalities } = await import("../src/lib/repo/entities");
  const { getAtlas } = await import("../src/lib/repo/atlas");

  const intent = {
    intent: "question" as const,
    disorders: ["major_depressive_disorder"],
    regions: [],
    modalities: [],
    vizCommand: null,
  };
  const retrieval = retrieve(DEMO_QUESTION, intent);

  // same request as src/ai/provider.ts complete(), kept here so the
  // response metadata (model, ids) can be recorded
  const requestedModel = process.env.NOESIS_SYNTH_MODEL ?? "claude-opus-5";
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: requestedModel,
    max_tokens: 1500,
    system: SYNTHESIS_SYSTEM,
    messages: [{ role: "user", content: `QUESTION: ${DEMO_QUESTION}\n\n${buildEvidenceContext(retrieval)}` }],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") throw new Error("refusal, nothing recorded");
  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  const terms = [
    ...getDisorders().flatMap((d) => [d.name, ...d.synonyms]),
    ...getModalities().flatMap((m) => [m.name, m.abbreviation]),
    ...getAtlas().regions.map((r) => r.name),
  ];
  const v = validateCitations(raw, new Set(retrieval.studies.map((s) => s.id)), terms, corpusFacts());

  const record = {
    kind: "recorded-demonstration",
    question: DEMO_QUESTION,
    intent,
    recordedAt: new Date().toISOString(),
    requestedModel,
    model: response.model,
    responseId: response.id,
    requestId: (response as unknown as { _request_id?: string })._request_id ?? null,
    stopReason: response.stop_reason,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    corpusFingerprint: corpusFingerprint(),
    retrievedStudyIds: retrieval.studies.map((s) => s.id),
    rawAnswer: raw,
    answer: v.text,
    citedIds: v.citedIds,
    strippedIds: v.strippedIds,
    strippedCorpusMarkers: v.strippedCorpusMarkers,
    uncitedScientificSentences: v.uncitedScientificSentences,
  };
  mkdirSync("src/site/recorded", { recursive: true });
  writeFileSync("src/site/recorded/answer.json", JSON.stringify(record, null, 2) + "\n");
  console.log(`model ${record.model} · cited ${v.citedIds.length} · stripped ${v.strippedIds.length} · flags ${v.uncitedScientificSentences}`);
  console.log(v.text);
}

main().catch((e) => {
  console.error("RECORD FAILED:", e?.message ?? e);
  process.exit(1);
});
