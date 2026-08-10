/**
 * Deterministic citation validation (ARCHITECTURE.md §6): every [study_id]
 * in the synthesis must exist in the retrieved set; invalid citations are
 * stripped and scientific-looking sentences without citations are counted so
 * the UI can flag them. Pure functions — unit-tested without any model.
 */

const CITATION_RE = /\[(study_[a-z0-9_]+)\]/g;

export interface ValidationResult {
  text: string;
  citedIds: string[];
  strippedIds: string[];
  uncitedScientificSentences: number;
}

export function validateCitations(
  text: string,
  retrievedIds: Set<string>,
  scientificTerms: string[],
): ValidationResult {
  const cited = new Set<string>();
  const stripped = new Set<string>();

  const cleaned = text.replace(CITATION_RE, (match, id: string) => {
    if (retrievedIds.has(id)) {
      cited.add(id);
      return match;
    }
    stripped.add(id);
    return "";
  });

  const terms = scientificTerms.map((t) => t.toLowerCase());
  let uncited = 0;
  for (const sentence of cleaned.split(/(?<=[.!?])\s+/)) {
    if (sentence.trim().length < 20) continue;
    if (CITATION_RE.test(sentence)) {
      CITATION_RE.lastIndex = 0;
      continue;
    }
    CITATION_RE.lastIndex = 0;
    const lower = sentence.toLowerCase();
    if (terms.some((t) => lower.includes(t))) uncited += 1;
  }

  return {
    text: cleaned.replace(/ {2,}/g, " "),
    citedIds: [...cited],
    strippedIds: [...stripped],
    uncitedScientificSentences: uncited,
  };
}
