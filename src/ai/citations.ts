/**
 * Deterministic citation validation (ARCHITECTURE.md §6): every [study_id]
 * in the synthesis must exist in the retrieved set; invalid citations are
 * stripped and scientific-looking sentences without citations are counted so
 * the UI can flag them. Pure functions — unit-tested without any model.
 */

const CITATION_RE = /\[(study_[a-z0-9_]+)\]/g;
/** "[study_a, study_b]" or "[study_a; study_b]" — a grouped citation */
const GROUPED_RE = /\[((?:study_[a-z0-9_]+\s*[,;]\s*)+study_[a-z0-9_]+)\]/g;

/**
 * Corpus-level statistics (counts of indexed studies per disorder or
 * modality, from the deterministic CORPUS COVERAGE block) are cited with this
 * marker instead of a study id. The marker is honoured ONLY on sentences
 * that are verifiably coverage statements (see `isCoverageSentence`);
 * anywhere else it is removed and the sentence is treated as uncited, so it
 * cannot launder a scientific claim.
 */
export const CORPUS_MARKER = "[corpus]";

export interface CorpusFacts {
  /** disorder / modality names (and synonyms) with their true counts */
  counts: { names: string[]; values: number[] }[];
  /** vocabulary that marks a scientific finding (regions, directions…) */
  blockedTerms: string[];
}

export interface ValidationResult {
  text: string;
  citedIds: string[];
  strippedIds: string[];
  uncitedScientificSentences: number;
  /** [corpus] markers removed because the sentence was not a coverage fact */
  strippedCorpusMarkers: number;
}

function hasWord(lower: string, term: string): boolean {
  const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(lower);
}

/**
 * A [corpus] sentence is a coverage fact only if it names a disorder or
 * modality from the coverage block, states one of that entity's true counts,
 * and contains no finding vocabulary.
 */
export function isCoverageSentence(sentence: string, facts: CorpusFacts | undefined): boolean {
  if (!facts) return false;
  const lower = sentence.toLowerCase();
  if (facts.blockedTerms.some((t) => hasWord(lower, t))) return false;
  const numbers = new Set((sentence.match(/\b\d+\b/g) ?? []).map(Number));
  if (numbers.size === 0) return false;
  return facts.counts.some(
    (c) => c.names.some((n) => hasWord(lower, n)) && c.values.some((v) => numbers.has(v)),
  );
}

export function validateCitations(
  text: string,
  retrievedIds: Set<string>,
  scientificTerms: string[],
  corpusFacts?: CorpusFacts,
): ValidationResult {
  const cited = new Set<string>();
  const stripped = new Set<string>();

  // 1. ungroup "[study_a, study_b]" so every id is validated individually
  const ungrouped = text.replace(GROUPED_RE, (_m, ids: string) =>
    ids
      .split(/[,;]/)
      .map((id) => `[${id.trim()}]`)
      .join(""),
  );

  // 2. strip ids that were not retrieved
  const cleaned = ungrouped.replace(CITATION_RE, (match, id: string) => {
    if (retrievedIds.has(id)) {
      cited.add(id);
      return match;
    }
    stripped.add(id);
    return "";
  });

  // 3. per sentence: honour [corpus] only on verified coverage facts, and
  //    count scientific sentences that carry no valid citation
  const terms = scientificTerms.map((t) => t.toLowerCase());
  let uncited = 0;
  let strippedCorpus = 0;
  const parts = cleaned.split(/((?<=[.!?])\s+)/);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part; // whitespace separator
    let sentence = part;
    const hasStudy = new RegExp(CITATION_RE.source).test(sentence);
    if (sentence.includes(CORPUS_MARKER)) {
      if (hasStudy || isCoverageSentence(sentence, corpusFacts)) {
        if (!hasStudy) return sentence; // a valid coverage statement
      } else {
        strippedCorpus += sentence.split(CORPUS_MARKER).length - 1;
        sentence = sentence.split(CORPUS_MARKER).join("").replace(/ +([.,;:!?])/g, "$1");
      }
    }
    if (sentence.trim().length >= 20 && !hasStudy) {
      const lower = sentence.toLowerCase();
      if (terms.some((t) => lower.includes(t))) uncited += 1;
    }
    return sentence;
  });

  return {
    text: out.join("").replace(/ {2,}/g, " "),
    citedIds: [...cited],
    strippedIds: [...stripped],
    uncitedScientificSentences: uncited,
    strippedCorpusMarkers: strippedCorpus,
  };
}
