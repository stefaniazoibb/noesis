import "server-only";
import MiniSearch from "minisearch";
import { getStudies } from "@/lib/repo/evidence";
import { getEvidenceIndex } from "@/lib/repo/evidence";
import { NO_FILTERS, type PairEvidence } from "@/lib/evidence/metrics";
import type { Study } from "@/lib/schemas";
import type { Intent } from "./intent";

/**
 * Retrieval (ARCHITECTURE.md §6): deterministic evidence-graph queries for
 * entity-shaped questions, plus lexical search over study text. The synthesis
 * model only ever sees what this returns.
 */

export interface RetrievalResult {
  studies: Study[];
  pairs: PairEvidence[];
}

const MAX_STUDIES = 12;

type Doc = { id: string; text: string };
let mini: MiniSearch<Doc> | null = null;

function lexicalIndex(): MiniSearch<Doc> {
  if (!mini) {
    mini = new MiniSearch<Doc>({ fields: ["text"] });
    mini.addAll(
      getStudies().map((s) => ({
        id: s.id,
        text: `${s.title} ${s.finding} ${s.authors.join(" ")} ${s.journal} ${s.year} ${s.disorders.join(" ")} ${s.modalities.join(" ")} ${s.population ?? ""}`,
      })),
    );
  }
  return mini;
}

export function retrieve(question: string, intent: Intent): RetrievalResult {
  const index = getEvidenceIndex();
  const byId = new Map(getStudies().map((s) => [s.id, s]));
  const scored = new Map<string, number>();
  let pairs: PairEvidence[] = [];

  // 1. structured graph retrieval — deterministic, highest priority
  const filters = intent.modalities.length
    ? { ...NO_FILTERS, modalities: intent.modalities }
    : NO_FILTERS;

  if (intent.regions.length > 0) {
    for (const region of intent.regions) {
      for (const p of index.byRegion(region, filters)) {
        if (
          intent.disorders.length === 0 ||
          intent.disorders.includes(p.disorder)
        ) {
          pairs.push(p);
          for (const id of p.studyIds) scored.set(id, (scored.get(id) ?? 0) + 10);
        }
      }
    }
  } else if (intent.disorders.length > 0) {
    for (const disorder of intent.disorders) {
      for (const p of index.pairsForDisorder(disorder, filters)) {
        pairs.push(p);
        for (const id of p.studyIds) scored.set(id, (scored.get(id) ?? 0) + 5);
      }
    }
    // disorder-level studies without region assertions (e.g. scalp EEG)
    for (const s of getStudies()) {
      if (s.disorders.some((d) => intent.disorders.includes(d))) {
        if (
          intent.modalities.length === 0 ||
          s.modalities.some((m) => intent.modalities.includes(m))
        ) {
          scored.set(s.id, (scored.get(s.id) ?? 0) + 5);
        }
      }
    }
  } else if (intent.modalities.length > 0) {
    for (const s of getStudies()) {
      if (s.modalities.some((m) => intent.modalities.includes(m)))
        scored.set(s.id, (scored.get(s.id) ?? 0) + 3);
    }
  }

  // 2. lexical retrieval over study text
  for (const hit of lexicalIndex().search(question, { prefix: true, fuzzy: 0.2 })) {
    scored.set(
      hit.id as string,
      (scored.get(hit.id as string) ?? 0) + Math.min(hit.score, 5),
    );
  }

  // rank: score desc, then recency
  const studies = [...scored.entries()]
    .map(([id, score]) => ({ study: byId.get(id)!, score }))
    .filter((x) => x.study)
    .sort((a, b) => b.score - a.score || b.study.year - a.study.year)
    .slice(0, MAX_STUDIES)
    .map((x) => x.study);

  // keep only pairs whose studies made the cut, largest first
  const kept = new Set(studies.map((s) => s.id));
  pairs = pairs
    .filter((p) => p.studyIds.some((id) => kept.has(id)))
    .sort((a, b) => b.studyIds.length - a.studyIds.length)
    .slice(0, 20);

  return { studies, pairs };
}
