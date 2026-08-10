import atlasJson from "../../../data/atlases/atlas.dk.json";
import { AtlasSchema, type Atlas, type Region } from "@/lib/schemas";

let cached: Atlas | null = null;
let byId: Map<string, Region> | null = null;

export function getAtlas(): Atlas {
  if (!cached) cached = AtlasSchema.parse(atlasJson);
  return cached;
}

export function getRegion(id: string): Region | undefined {
  if (!byId) byId = new Map(getAtlas().regions.map((r) => [r.id, r]));
  return byId.get(id);
}

export function subcorticalRegions(): Region[] {
  return getAtlas().regions.filter((r) => r.kind === "subcortical");
}
