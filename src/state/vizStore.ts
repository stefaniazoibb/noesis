import { create } from "zustand";
import {
  DEFAULT_VIZ_STATE,
  type VizState,
  type VizStatePatch,
} from "@/lib/schemas";

export type ViewPresetName =
  | "left"
  | "right"
  | "anterior"
  | "posterior"
  | "superior"
  | "inferior";

interface VizStore extends VizState {
  /** transient hover state — not part of the serializable VizState */
  hoverRegion: string | null;
  /** camera preset request; nonce forces re-application of the same preset */
  viewRequest: { name: ViewPresetName; nonce: number } | null;
  setHover: (id: string | null) => void;
  selectRegion: (id: string | null) => void;
  toggleHemisphere: (side: "left" | "right") => void;
  setShowSubcortical: (v: boolean) => void;
  requestView: (name: ViewPresetName) => void;
  /** the only mutation path the AI assistant is allowed to use */
  applyPatch: (patch: VizStatePatch) => void;
}

export const useVizStore = create<VizStore>((set) => ({
  ...DEFAULT_VIZ_STATE,
  hoverRegion: null,
  viewRequest: null,
  setHover: (id) =>
    set((s) => (s.hoverRegion === id ? s : { hoverRegion: id })),
  selectRegion: (id) => set({ selectedRegion: id }),
  toggleHemisphere: (side) =>
    set((s) => ({
      hemispheres: { ...s.hemispheres, [side]: !s.hemispheres[side] },
    })),
  setShowSubcortical: (v) => set({ showSubcortical: v }),
  requestView: (name) =>
    set((s) => ({
      viewRequest: { name, nonce: (s.viewRequest?.nonce ?? 0) + 1 },
    })),
  applyPatch: (patch) => set(patch),
}));
