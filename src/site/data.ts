import "server-only";
import { createHash } from "node:crypto";
import { getAtlas, getRegion } from "@/lib/repo/atlas";
import { getDisorders, getModalities, getNetworks } from "@/lib/repo/entities";
import { getEvidenceIndex, getStudy } from "@/lib/repo/evidence";
import { computeOverlay, sequentialColor } from "@/lib/evidence/overlay";
import { NO_FILTERS, type EvidenceLevel } from "@/lib/evidence/metrics";
import { disorderName, regionLabel, surname } from "@/lib/evidence/summary";
import eegRun from "../../data/ml_runs/eeg_spectral_dementia_v1.run.json";
import eegSpectra from "../../data/ml_runs/eeg_spectral_dementia_v1.groupSpectra.json";
import mriRun from "../../data/ml_runs/mri_morphometry_cnp_v1.run.json";
import mriEffects from "../../data/ml_runs/mri_morphometry_cnp_v1.effectSizes.json";
import connRun from "../../data/ml_runs/conn_fc_cnp_v1.run.json";
import recorded from "./recorded/answer.json";
import studiesJson from "../../data/studies/studies.json";
import assertionsJson from "../../data/evidence/assertions.json";

/**
 * Build-time selectors for the public landing page. Read-only views over the
 * same repo seam the application uses (src/lib/repo); nothing here computes a
 * new metric. Every number shown on the page comes from these functions.
 */

export interface SourceRef {
  id: string;
  label: string; // "Schmaal et al. 2016"
  title: string;
  journal: string | null;
  year: number;
  population: string | null;
  sampleSize: number | null;
  doi: string | null;
  pmid: string | null;
  url: string;
  verifiedAgainst: string | null;
  curatedDate: string | null;
  verifiedByHuman: boolean;
}

export function sourceRef(id: string): SourceRef {
  const s = getStudy(id);
  if (!s) throw new Error(`unknown study ${id}`);
  return {
    id: s.id,
    label: `${surname(s.authors[0])} et al. ${s.year}`,
    title: s.title,
    journal: s.journal,
    year: s.year,
    population: s.population ?? null,
    sampleSize: s.sampleSize ?? null,
    doi: s.doi,
    pmid: s.pmid,
    url: s.doi ? `https://doi.org/${s.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/`,
    verifiedAgainst: s.curation?.metadataVerifiedAgainst ?? null,
    curatedDate: s.curation?.curatedDate ?? null,
    verifiedByHuman: Boolean(s.curation?.verifiedByHuman),
  };
}

const MOD_ABBR = () => new Map(getModalities().map((m) => [m.id, m.abbreviation]));

// ---------------------------------------------------------------- picker --

export interface PickerAssertion {
  statement: string;
  modality: string;
  direction: string | null;
  findingType: string;
  studyId: string;
}

export interface PickerPair {
  region: string;
  regionName: string;
  studies: number;
  level: EvidenceLevel;
  categories: string[];
  modalities: string[];
  assertions: PickerAssertion[];
  studyIds: string[];
}

export interface PickerDisorder {
  id: string;
  name: string;
  category: string;
  studies: number;
  max: number;
  colors: Record<string, string>;
  pairs: PickerPair[];
}

/** Per-disorder study-density overlay + ranked region evidence (the Explore view's "disorder" mode). */
export function pickerData(): { disorders: PickerDisorder[]; sources: Record<string, SourceRef>; ramp: string[] } {
  const index = getEvidenceIndex();
  const abbr = MOD_ABBR();
  const sourceIds = new Set<string>();
  const disorders = getDisorders()
    .map((d) => {
      const overlay = computeOverlay("disorder", [d.id], NO_FILTERS);
      const pairs = index
        .pairsForDisorder(d.id, NO_FILTERS)
        .sort((a, b) => b.studyIds.length - a.studyIds.length || a.region.localeCompare(b.region))
        .map((p) => {
          p.studyIds.forEach((id) => sourceIds.add(id));
          return {
            region: p.region,
            regionName: regionLabel(p.region),
            studies: p.studyIds.length,
            level: p.level,
            categories: p.modalityCategories,
            modalities: p.modalities.map((m) => abbr.get(m) ?? m),
            studyIds: p.studyIds,
            assertions: [...p.assertions]
              .sort((x, y) => x.id.localeCompare(y.id))
              .map((a) => ({
                statement: a.statement,
                modality: abbr.get(a.modality) ?? a.modality,
                direction: a.direction,
                findingType: a.findingType,
                studyId: a.studyId,
              })),
          };
        });
      const studies = new Set(pairs.flatMap((p) => p.studyIds)).size;
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        studies,
        max: overlay.max,
        colors: Object.fromEntries(overlay.colors),
        pairs,
      };
    })
    .sort((a, b) => b.studies - a.studies || a.name.localeCompare(b.name));
  return {
    disorders,
    sources: Object.fromEntries([...sourceIds].map((id) => [id, sourceRef(id)])),
    ramp: [0.1, 0.3, 0.5, 0.7, 0.9, 1].map((t) => sequentialColor(t, 1)),
  };
}

// ------------------------------------------------------------ provenance --

export interface TraceFinding {
  key: string;
  disorder: { id: string; name: string };
  region: { id: string; name: string; kind: string; hemisphere: string };
  pair: { studies: number; level: EvidenceLevel; categories: string[] };
  assertion: {
    id: string;
    statement: string;
    modality: string;
    modalityName: string;
    findingType: string;
    direction: string | null;
    causalSupport: string;
  };
  source: SourceRef;
  otherSources: SourceRef[];
}

/**
 * Real provenance chains: the best-supported region–disorder pair of each of
 * the most-studied disorders (one chain per disorder, deterministic order).
 */
export function traceFindings(limit = 5): TraceFinding[] {
  const index = getEvidenceIndex();
  const mods = new Map(getModalities().map((m) => [m.id, m]));
  const best = new Map<string, ReturnType<typeof index.pairsForDisorder>[number]>();
  for (const p of index
    .pairsForDisorder(null, NO_FILTERS)
    .sort(
      (a, b) =>
        b.studyIds.length - a.studyIds.length ||
        `${a.disorder}${a.region}`.localeCompare(`${b.disorder}${b.region}`),
    )) {
    if (!best.has(p.disorder)) best.set(p.disorder, p);
  }
  return [...best.values()].slice(0, limit).map((p) => {
    const a = [...p.assertions].sort((x, y) => x.id.localeCompare(y.id))[0];
    const r = getRegion(p.region)!;
    return {
      key: `${p.disorder}|${p.region}`,
      disorder: { id: p.disorder, name: disorderName(p.disorder) },
      region: { id: p.region, name: regionLabel(p.region), kind: r.kind, hemisphere: r.hemisphere },
      pair: { studies: p.studyIds.length, level: p.level, categories: p.modalityCategories },
      assertion: {
        id: a.id,
        statement: a.statement,
        modality: mods.get(a.modality)?.abbreviation ?? a.modality,
        modalityName: mods.get(a.modality)?.name ?? a.modality,
        findingType: a.findingType,
        direction: a.direction,
        causalSupport: a.causalSupport,
      },
      source: sourceRef(a.studyId),
      otherSources: p.studyIds.filter((id) => id !== a.studyId).map(sourceRef),
    };
  });
}

// ------------------------------------------------------------ convergence --

/** Every indexed region–disorder pair as one cell: number of independent modality categories. */
export function pairWaffle(): { key: string; label: string; categories: number; level: EvidenceLevel }[] {
  return getEvidenceIndex()
    .pairsForDisorder(null, NO_FILTERS)
    .map((p) => ({
      key: `${p.disorder}|${p.region}`,
      label: `${regionLabel(p.region)} · ${disorderName(p.disorder)} · ${p.studyIds.length} ${p.studyIds.length === 1 ? "study" : "studies"}`,
      categories: p.modalityCategories.length,
      level: p.level,
    }))
    .sort((a, b) => b.categories - a.categories || a.key.localeCompare(b.key));
}

// -------------------------------------------------------------- networks --

export function networkData() {
  const overlay = computeOverlay("network", [], NO_FILTERS);
  const networks = getNetworks().map((n) => ({
    id: n.id,
    name: n.name,
    color: n.color ?? "#7a7f88",
    regions: n.regions,
    regionNames: n.regions.map(regionLabel),
    description: n.description,
  }));
  return {
    networks,
    colors: Object.fromEntries(overlay.colors) as Record<string, string>,
    source: getNetworks()[0]?.membershipSource ?? "",
    corticalTotal: getAtlas().regions.filter((r) => r.kind === "cortical").length,
  };
}

// ------------------------------------------------------------ multimodal --

type Run = {
  runId: string;
  datasetDef: string;
  metrics: Record<string, number>;
  uncertainty: Record<string, number>;
  created: string;
};

function firstSentence(s: string): string {
  const i = s.indexOf(":");
  return i > 0 ? s.slice(0, i) : s;
}

export function encoderData() {
  const eeg = eegRun as unknown as Run;
  const mri = mriRun as unknown as Run;
  const conn = connRun as unknown as Run;
  const spectra = eegSpectra as { feature: string; AD: number; FTD: number; CN: number }[];
  const alpha = spectra
    .filter((r) => r.feature.endsWith("_alpha"))
    .map((r) => ({ site: r.feature.replace("_alpha", ""), AD: r.AD, FTD: r.FTD, CN: r.CN }));
  const scz = (mriEffects as { disorder: string; nPatients: number; nControls: number; d_control_minus_patient: Record<string, number> }[]).find(
    (e) => e.disorder === "schizophrenia",
  )!;
  const thinning = Object.entries(scz.d_control_minus_patient)
    .filter(([region]) => region.startsWith("dk_")) // cortical thickness only (aseg entries are volumes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([region, d]) => ({ region: regionLabel(region), d }));
  return {
    eeg: {
      runId: eeg.runId,
      dataset: firstSentence(eeg.datasetDef),
      n: eeg.metrics.n_subjects,
      auc: eeg.metrics.ad_vs_cn_auc,
      lo: eeg.uncertainty.ad_vs_cn_auc_ci95_low,
      hi: eeg.uncertainty.ad_vs_cn_auc_ci95_high,
      p: eeg.metrics.ad_vs_cn_perm_p,
      alpha,
    },
    mri: {
      runId: mri.runId,
      dataset: firstSentence(mri.datasetDef),
      n: mri.metrics.n_subjects,
      nPatients: scz.nPatients,
      nControls: scz.nControls,
      auc: mri.metrics.schz_vs_cn_auc,
      lo: mri.uncertainty.schz_vs_cn_auc_ci95_low,
      hi: mri.uncertainty.schz_vs_cn_auc_ci95_high,
      p: mri.metrics.schz_vs_cn_perm_p,
      thinning,
    },
    conn: {
      runId: conn.runId,
      dataset: firstSentence(conn.datasetDef),
      n: conn.metrics.n_subjects,
      auc: conn.metrics.schz_vs_cn_auc,
      lo: conn.uncertainty.schz_vs_cn_auc_ci95_low,
      hi: conn.uncertainty.schz_vs_cn_auc_ci95_high,
      p: conn.metrics.schz_vs_cn_perm_p,
      adhdAuc: conn.metrics.adhd_vs_cn_auc,
      adhdLo: conn.uncertainty.adhd_vs_cn_auc_ci95_low,
      adhdHi: conn.uncertainty.adhd_vs_cn_auc_ci95_high,
      adhdP: conn.metrics.adhd_vs_cn_perm_p,
    },
  };
}

// -------------------------------------------------------- recorded answer --

/** Same fingerprint as scripts/record-demo-answer.ts: tells the page whether the corpus changed since recording. */
export function corpusFingerprint(): string {
  return createHash("sha256")
    .update(JSON.stringify([studiesJson, assertionsJson]))
    .digest("hex")
    .slice(0, 16);
}

export function recordedAnswer() {
  const r = recorded as typeof recorded;
  return {
    question: r.question,
    answer: r.answer,
    model: r.model,
    requestedModel: r.requestedModel,
    recordedAt: r.recordedAt,
    responseId: r.responseId,
    citedIds: r.citedIds,
    strippedIds: r.strippedIds,
    uncitedScientificSentences: r.uncitedScientificSentences,
    retrievedStudyIds: r.retrievedStudyIds,
    corpusChanged: r.corpusFingerprint !== corpusFingerprint(),
    sources: r.citedIds.map(sourceRef),
  };
}
