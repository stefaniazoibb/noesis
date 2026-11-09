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
  | "inferior"
  | "reset";

interface VizStore extends VizState {
  /** transient hover state — not part of the serializable VizState */
  hoverRegion: string | null;
  /** camera preset request; nonce forces re-application of the same preset */
  viewRequest: { name: ViewPresetName; nonce: number } | null;
  /** camera fly-to request for one region (centroid from the mesh) */
  focusRequest: { region: string; nonce: number } | null;
  setHover: (id: string | null) => void;
  selectRegion: (id: string | null) => void;
  toggleHemisphere: (side: "left" | "right") => void;
  setShowSubcortical: (v: boolean) => void;
  setMode: (mode: VizState["mode"]) => void;
  setActiveDisorder: (id: string | null) => void;
  toggleModality: (id: string) => void;
  requestView: (name: ViewPresetName) => void;
  requestFocus: (region: string) => void;
  /** clear selection + overlays' region focus and return the camera home */
  resetView: () => void;
  /** the only mutation path the AI assistant is allowed to use */
  applyPatch: (patch: VizStatePatch) => void;
}

export const useVizStore = create<VizStore>((set) => ({
  ...DEFAULT_VIZ_STATE,
  hoverRegion: null,
  viewRequest: null,
  focusRequest: null,
  setHover: (id) =>
    set((s) => (s.hoverRegion === id ? s : { hoverRegion: id })),
  selectRegion: (id) => set({ selectedRegion: id }),
  toggleHemisphere: (side) =>
    set((s) => ({
      hemispheres: { ...s.hemispheres, [side]: !s.hemispheres[side] },
    })),
  setShowSubcortical: (v) => set({ showSubcortical: v }),
  setMode: (mode) => set({ mode }),
  setActiveDisorder: (id) => set({ disorders: id ? [id] : [] }),
  toggleModality: (id) =>
    set((s) => ({
      modalities: s.modalities.includes(id)
        ? s.modalities.filter((m) => m !== id)
        : [...s.modalities, id],
    })),
  requestView: (name) =>
    set((s) => ({
      viewRequest: { name, nonce: (s.viewRequest?.nonce ?? 0) + 1 },
    })),
  requestFocus: (region) =>
    set((s) => ({
      focusRequest: { region, nonce: (s.focusRequest?.nonce ?? 0) + 1 },
    })),
  resetView: () =>
    set((s) => ({
      selectedRegion: null,
      viewRequest: { name: "reset", nonce: (s.viewRequest?.nonce ?? 0) + 1 },
    })),
  applyPatch: (patch) => set(patch),
}));
