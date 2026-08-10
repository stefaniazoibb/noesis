import { getRegion } from "@/lib/repo/atlas";
import { getDisorder, getModalities } from "@/lib/repo/entities";
import { getStudy } from "@/lib/repo/evidence";
import type { EmbeddingEntity } from "@/lib/ml/embeddings";

const HEMI = { left: "L", right: "R", midline: "" };

export function entityLabel(entity: EmbeddingEntity, id: string): string {
  if (entity === "region") {
    const r = getRegion(id);
    return r ? `${r.name}${r.hemisphere === "midline" ? "" : ` (${HEMI[r.hemisphere]})`}` : id;
  }
  if (entity === "disorder") return getDisorder(id)?.name ?? id;
  const s = getStudy(id);
  return s ? `${s.authors[0]?.split(" ")[0]} et al. ${s.year}` : id;
}

/** Prettify pipeline feature names like "major_depressive_disorder|imaging". */
export function featureLabel(feature: string): string {
  const [head, tail] = feature.split("|");
  if (tail === undefined) {
    if (head === "year") return "publication year";
    if (head === "log_sample_size") return "sample size (log)";
    if (head === "sample_size_missing") return "sample size missing";
    return head.replace(/_/g, " ");
  }
  const headName =
    getDisorder(head)?.name ??
    getRegion(head)?.name ??
    ({ disorder: "", category: "", finding: "", direction: "", region: "" }[
      head
    ] !== undefined
      ? ""
      : head.replace(/_/g, " "));
  if (head === "disorder") return getDisorder(tail)?.name ?? tail;
  if (head === "region") return getRegion(tail)?.name ?? tail;
  if (head === "category") return `${tail} modality`;
  if (head === "finding") return tail.replace(/_/g, " ");
  if (head === "direction") return `direction: ${tail}`;
  if (tail === "direction") return `${headName || head}: direction consensus`;
  return `${headName || head}: ${tail} studies`;
}

export function modalityCategoryOf(modalityId: string): string {
  return getModalities().find((m) => m.id === modalityId)?.category ?? "other";
}
