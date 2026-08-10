import MiniSearch from "minisearch";
import { getAtlas } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";
import { getStudies } from "@/lib/repo/evidence";

export interface SearchResult {
  key: string;
  type: "region" | "disorder" | "modality" | "study";
  title: string;
  subtitle: string;
  /** internal navigation target */
  href: string;
  doi?: string | null;
  pmid?: string | null;
}

type Doc = SearchResult & { id: string; text: string };

let mini: MiniSearch<Doc> | null = null;

function buildDocs(): Doc[] {
  const docs: Doc[] = [];
  for (const r of getAtlas().regions) {
    docs.push({
      id: `region:${r.id}`,
      key: `region:${r.id}`,
      type: "region",
      title: r.name,
      subtitle: `${r.hemisphere} · ${r.kind} · ${r.system.replace(/_/g, " ")}`,
      href: `/brain?region=${r.id}`,
      text: `${r.sourceName} ${r.hemisphere} ${r.system}`,
    });
  }
  for (const d of getDisorders()) {
    docs.push({
      id: `disorder:${d.id}`,
      key: `disorder:${d.id}`,
      type: "disorder",
      title: d.name,
      subtitle: d.category,
      href: `/disorders/${d.id}`,
      text: `${d.synonyms.join(" ")} ${d.overview ?? ""}`,
    });
  }
  for (const m of getModalities()) {
    docs.push({
      id: `modality:${m.id}`,
      key: `modality:${m.id}`,
      type: "modality",
      title: m.name,
      subtitle: `${m.abbreviation} · ${m.category}`,
      href: `/brain?modality=${m.id}&mode=disorder`,
      text: `${m.abbreviation} ${m.synonyms.join(" ")} ${m.description ?? ""}`,
    });
  }
  for (const s of getStudies()) {
    docs.push({
      id: `study:${s.id}`,
      key: `study:${s.id}`,
      type: "study",
      title: s.title,
      subtitle: `${s.authors[0]?.split(" ")[0] ?? ""} et al. · ${s.journal} · ${s.year}`,
      href: `/disorders/${s.disorders[0]}`,
      doi: s.doi,
      pmid: s.pmid,
      text: `${s.authors.join(" ")} ${s.journal} ${s.year} ${s.finding} ${s.disorders.join(" ")} ${s.modalities.join(" ")}`,
    });
  }
  return docs;
}

function getIndex(): MiniSearch<Doc> {
  if (!mini) {
    mini = new MiniSearch<Doc>({
      fields: ["title", "text"],
      storeFields: ["key", "type", "title", "subtitle", "href", "doi", "pmid"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 2 },
        // entities outrank studies: a query like "MDD" should surface the
        // disorder page first, with its studies below
        boostDocument: (_id, _term, stored) =>
          stored?.type === "study" ? 1 : 2.5,
      },
    });
    mini.addAll(buildDocs());
  }
  return mini;
}

const DOI_RE = /^10\.\d{4,9}\/\S+$/i;
const PMID_RE = /^\d{6,9}$/;

/** Free-text search plus exact DOI/PMID navigation. */
export function search(query: string, limit = 8): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];

  if (DOI_RE.test(q) || PMID_RE.test(q)) {
    const hit = getStudies().find(
      (s) =>
        (s.doi && s.doi.toLowerCase() === q.toLowerCase()) ||
        (s.pmid && s.pmid === q),
    );
    if (hit) {
      return [
        {
          key: `study:${hit.id}`,
          type: "study",
          title: hit.title,
          subtitle: `${hit.authors[0]?.split(" ")[0]} et al. · ${hit.journal} · ${hit.year}`,
          href: `/disorders/${hit.disorders[0]}`,
          doi: hit.doi,
          pmid: hit.pmid,
        },
      ];
    }
    // fall through to text search if no exact identifier match
  }

  return getIndex()
    .search(q)
    .slice(0, limit) as unknown as SearchResult[];
}
