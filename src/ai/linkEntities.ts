import { getAtlas } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";

/**
 * Deterministic, model-free entity linking used when the language model is
 * unavailable (no API key). Matches catalogue names, synonyms and
 * abbreviations as whole words; a small allowlist maps adjectives to
 * regions ("hippocampal" -> Hippocampus). It can only return ids
 * that exist in the catalogues, so it can never invent an entity.
 */

export interface LinkedEntities {
  disorders: string[];
  regions: string[];
  modalities: string[];
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t.length < 2) return false;
  // short all-caps abbreviations (MDD, EEG) must match case-sensitively
  const caseSensitive = /^[A-Z0-9-]{2,5}$/.test(term.trim());
  // case-sensitive abbreviations need an UPPER-case-aware boundary, or
  // "AD" would match inside "ADHD"
  const re = caseSensitive
    ? new RegExp(`(^|[^A-Za-z0-9])${escape(term.trim())}([^A-Za-z0-9]|$)`)
    : new RegExp(`(^|[^a-z0-9])${escape(t)}([^a-z0-9]|$)`);
  return re.test(caseSensitive ? text : text.toLowerCase());
}

/**
 * Adjectival forms of region names, as an explicit allowlist — a generic
 * stemmer turned "brains" into Brainstem. Maps the adjective to the region
 * name it refers to (both hemispheres unless one is named).
 */
const ADJECTIVES: Record<string, string> = {
  hippocampal: "hippocampus",
  amygdalar: "amygdala",
  amygdaloid: "amygdala",
  thalamic: "thalamus",
  insular: "insula",
  putaminal: "putamen",
  pallidal: "pallidum",
  precuneal: "precuneus",
};

function adjectiveMention(text: string, regionName: string): boolean {
  const lower = text.toLowerCase();
  return Object.entries(ADJECTIVES).some(
    ([adj, name]) => regionName.toLowerCase() === name && new RegExp(`(^|[^a-z])${adj}([^a-z]|$)`).test(lower),
  );
}

export function linkEntities(question: string): LinkedEntities {
  const disorders = getDisorders()
    .filter((d) => [d.name, ...d.synonyms].some((t) => mentions(question, t)))
    .map((d) => d.id);

  const modalities = getModalities()
    .filter((m) => [m.abbreviation, m.name, ...m.synonyms].some((t) => mentions(question, t)))
    .map((m) => m.id);

  const lower = question.toLowerCase();
  const wantsLeft = /\bleft\b/.test(lower);
  const wantsRight = /\bright\b/.test(lower);
  const regions = getAtlas()
    .regions.filter((r) => mentions(question, r.name) || adjectiveMention(question, r.name))
    .filter((r) =>
      wantsLeft && !wantsRight
        ? r.hemisphere !== "right"
        : wantsRight && !wantsLeft
          ? r.hemisphere !== "left"
          : true,
    )
    .map((r) => r.id);

  return { disorders, regions, modalities };
}
