/**
 * Validates everything under /data against the Zod schemas and enforces
 * referential integrity (ARCHITECTURE.md §4). Run: npm run validate:data
 * The build must fail on any violation — this is the no-fabrication backstop.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  AtlasSchema,
  DisorderSchema,
  ModalitySchema,
  NetworkSchema,
  StudySchema,
  EvidenceAssertionSchema,
} from "../src/lib/schemas";

const DATA = join(import.meta.dirname, "..", "data");
const errors: string[] = [];

function load<T>(rel: string, schema: z.ZodType<T>, optional = false): T | null {
  const path = join(DATA, rel);
  if (!existsSync(path)) {
    if (!optional) errors.push(`missing file: data/${rel}`);
    return null;
  }
  const parsed = schema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    errors.push(`data/${rel}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    return null;
  }
  return parsed.data;
}

const atlas = load("atlases/atlas.dk.json", AtlasSchema, true);
const disorders = load("disorders/disorders.json", z.array(DisorderSchema)) ?? [];
const modalities = load("modalities/modalities.json", z.array(ModalitySchema)) ?? [];
const networks = load("networks/networks.json", z.array(NetworkSchema)) ?? [];
const studies = load("studies/studies.json", z.array(StudySchema)) ?? [];
const assertions = load("evidence/assertions.json", z.array(EvidenceAssertionSchema)) ?? [];

const regionIds = new Set(atlas?.regions.map((r) => r.id) ?? []);
const disorderIds = new Set(disorders.map((d) => d.id));
const modalityIds = new Set(modalities.map((m) => m.id));
const networkIds = new Set(networks.map((n) => n.id));
const studyIds = new Set(studies.map((s) => s.id));

function checkDup(name: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate ${name} id: ${id}`);
    seen.add(id);
  }
}
checkDup("disorder", disorders.map((d) => d.id));
checkDup("modality", modalities.map((m) => m.id));
checkDup("study", studies.map((s) => s.id));
checkDup("assertion", assertions.map((a) => a.id));

for (const s of studies) {
  for (const d of s.disorders) if (!disorderIds.has(d)) errors.push(`${s.id}: unknown disorder ${d}`);
  for (const m of s.modalities) if (!modalityIds.has(m)) errors.push(`${s.id}: unknown modality ${m}`);
  for (const n of s.networks) if (!networkIds.has(n)) errors.push(`${s.id}: unknown network ${n}`);
  if (atlas) for (const r of s.regions) if (!regionIds.has(r)) errors.push(`${s.id}: unknown region ${r}`);
}

for (const a of assertions) {
  if (!studyIds.has(a.studyId)) errors.push(`${a.id}: orphan assertion — unknown study ${a.studyId}`);
  if (!disorderIds.has(a.disorder)) errors.push(`${a.id}: unknown disorder ${a.disorder}`);
  if (!modalityIds.has(a.modality)) errors.push(`${a.id}: unknown modality ${a.modality}`);
  if (a.network && !networkIds.has(a.network)) errors.push(`${a.id}: unknown network ${a.network}`);
  if (atlas && !regionIds.has(a.region)) errors.push(`${a.id}: unknown region ${a.region}`);
  const study = studies.find((s) => s.id === a.studyId);
  if (study && !study.disorders.includes(a.disorder))
    errors.push(`${a.id}: disorder ${a.disorder} not listed in ${a.studyId}`);
}

if (errors.length > 0) {
  console.error(`data validation FAILED (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `data validation OK — regions: ${regionIds.size}, disorders: ${disorders.length}, ` +
    `modalities: ${modalities.length}, networks: ${networks.length}, ` +
    `studies: ${studies.length}, assertions: ${assertions.length}`,
);
