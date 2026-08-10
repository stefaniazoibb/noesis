import { z } from "zod";
import disordersJson from "../../../data/disorders/disorders.json";
import modalitiesJson from "../../../data/modalities/modalities.json";
import networksJson from "../../../data/networks/networks.json";
import {
  DisorderSchema,
  ModalitySchema,
  NetworkSchema,
  type Disorder,
  type Modality,
  type Network,
} from "@/lib/schemas";

let disorders: Disorder[] | null = null;
let modalities: Modality[] | null = null;
let networks: Network[] | null = null;

export function getDisorders(): Disorder[] {
  if (!disorders) disorders = z.array(DisorderSchema).parse(disordersJson);
  return disorders;
}

export function getDisorder(id: string): Disorder | undefined {
  return getDisorders().find((d) => d.id === id);
}

export function getModalities(): Modality[] {
  if (!modalities) modalities = z.array(ModalitySchema).parse(modalitiesJson);
  return modalities;
}

export function getModality(id: string): Modality | undefined {
  return getModalities().find((m) => m.id === id);
}

export function getNetworks(): Network[] {
  if (!networks) networks = z.array(NetworkSchema).parse(networksJson);
  return networks;
}
