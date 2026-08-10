import "server-only";
import { z } from "zod";
import { structured } from "./provider";
import { getAtlas } from "@/lib/repo/atlas";
import { getDisorders, getModalities } from "@/lib/repo/entities";

/**
 * Query understanding: classify the user's message and link entities to
 * canonical ids. The model chooses ONLY from catalogs we provide; everything
 * it returns is re-validated against the repositories before use.
 */

export const IntentSchema = z.object({
  intent: z.enum(["question", "viz_command", "research_questions", "smalltalk"]),
  disorders: z.array(z.string()),
  regions: z.array(z.string()),
  modalities: z.array(z.string()),
  vizCommand: z
    .object({
      mode: z.enum(["anatomical", "disorder", "convergence"]).nullable(),
      showSubcortical: z.boolean().nullable(),
      selectRegion: z.string().nullable(),
    })
    .nullable(),
});

export type Intent = z.infer<typeof IntentSchema>;

function catalogs(): string {
  const atlas = getAtlas();
  const regions = atlas.regions
    .map((r) => `${r.id} (${r.name}, ${r.hemisphere})`)
    .join("; ");
  const disorders = getDisorders()
    .map((d) => `${d.id} (${d.name}; ${d.synonyms.join(", ")})`)
    .join("; ");
  const modalities = getModalities()
    .map((m) => `${m.id} (${m.abbreviation})`)
    .join("; ");
  return `DISORDERS: ${disorders}\nMODALITIES: ${modalities}\nREGIONS: ${regions}`;
}

const SYSTEM = `You are the query parser for NOĒSIS, a brain-evidence atlas. Classify the user message and link mentioned entities to canonical ids.

- intent "question": the user asks about evidence, regions, disorders, studies, or the literature.
- intent "viz_command": the user asks to change the 3D visualization (switch mode, filter modalities, select a disorder or region, show subcortex). If a message both asks a question and changes the view, prefer "question".
- intent "research_questions": the user asks to generate/propose research questions, research opportunities, or hypotheses (e.g. "generate research questions about OCD").
- intent "smalltalk": greetings or anything else.

Entity linking rules: use ONLY ids from the catalogs below. Map synonyms (e.g. "depression" -> major_depressive_disorder, "DLPFC" -> rostral/caudal middle frontal regions, "hippocampus" -> both hemisphere ids unless one side is named). If nothing matches, leave the list empty — never invent ids.

For viz_command, also fill vizCommand: mode "disorder" shows evidence density, "convergence" shows cross-modal convergence, "anatomical" clears overlays; disorders/modalities lists act as filters; selectRegion for "select/show me the X" on a single region.`;

export async function parseIntent(question: string): Promise<Intent | null> {
  const raw = await structured({
    schema: IntentSchema,
    system: `${SYSTEM}\n\n${catalogs()}`,
    user: question,
    maxTokens: 1024,
  });
  if (!raw) return null;

  // re-validate every id against the repositories; drop anything unknown
  const regionIds = new Set(getAtlas().regions.map((r) => r.id));
  const disorderIds = new Set(getDisorders().map((d) => d.id));
  const modalityIds = new Set(getModalities().map((m) => m.id));
  return {
    ...raw,
    disorders: raw.disorders.filter((d) => disorderIds.has(d)),
    regions: raw.regions.filter((r) => regionIds.has(r)),
    modalities: raw.modalities.filter((m) => modalityIds.has(m)),
    vizCommand: raw.vizCommand
      ? {
          ...raw.vizCommand,
          selectRegion:
            raw.vizCommand.selectRegion &&
            regionIds.has(raw.vizCommand.selectRegion)
              ? raw.vizCommand.selectRegion
              : null,
        }
      : null,
  };
}
