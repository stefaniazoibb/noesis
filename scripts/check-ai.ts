/**
 * One-command live check of the AI layer (roadmap #8). Needs a real key:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run check:ai
 * (or put the key in .env.local and run `npm run check:ai`). Spends a few
 * cents: one intent parse + one synthesis, then one research question.
 */
import { readFileSync, existsSync } from "node:fs";

if (!process.env.ANTHROPIC_API_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("No ANTHROPIC_API_KEY (env or .env.local) — nothing to check.");
  process.exit(1);
}

async function main() {
  const { parseIntent } = await import("../src/ai/intent");
  const { retrieve } = await import("../src/ai/retrieval");
  const { complete } = await import("../src/ai/provider");
  const { SYNTHESIS_SYSTEM, buildEvidenceContext, corpusFacts } = await import("../src/ai/prompts");
  const { validateCitations } = await import("../src/ai/citations");
  const { generateQuestion, rankedGapsFor } = await import("../src/ai/questions");

  const question = "What findings contradict the hippocampal association with depression?";
  console.log(`Q: ${question}\n`);
  const intent = await parseIntent(question);
  console.log("intent:", JSON.stringify(intent));
  if (!intent) throw new Error("intent parse returned nothing");
  const r = retrieve(question, intent);
  console.log(`retrieved ${r.studies.length} studies, ${r.pairs.length} pairs`);
  const raw = await complete({
    system: SYNTHESIS_SYSTEM,
    user: `QUESTION: ${question}\n\n${buildEvidenceContext(r)}`,
    maxTokens: 1500,
  });
  const { getDisorders } = await import("../src/lib/repo/entities");
  const { getAtlas } = await import("../src/lib/repo/atlas");
  const terms = [
    ...getDisorders().flatMap((d) => [d.name, ...d.synonyms]),
    ...getAtlas().regions.map((x) => x.name),
  ];
  const v = validateCitations(raw, new Set(r.studies.map((s) => s.id)), terms, corpusFacts());
  console.log(`\nA: ${v.text}\n`);
  console.log(
    `cited ${v.citedIds.length}, stripped ${v.strippedIds.length}, ` +
      `[corpus] markers stripped ${v.strippedCorpusMarkers}, uncited-claim flags ${v.uncitedScientificSentences}`,
  );

  const gap = rankedGapsFor("schizophrenia")[0];
  const q = gap ? await generateQuestion(gap) : null;
  console.log(`\nResearch question (${gap?.ruleId}): ${q?.question ?? "none"}`);
  console.log(`Methodology: ${q?.methodologyNotes ?? "-"}`);
  console.log(`stripped citations: ${q?.flags.strippedCitations ?? "-"}`);

  const ok = v.citedIds.length > 0 && v.strippedIds.length === 0 && !!q;
  console.log(ok ? "\nLIVE AI CHECK: PASS" : "\nLIVE AI CHECK: REVIEW OUTPUT ABOVE");
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error("LIVE AI CHECK: ERROR —", e?.message ?? e);
  process.exit(1);
});
