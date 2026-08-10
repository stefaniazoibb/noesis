"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useVizStore } from "@/state/vizStore";
import { useSidecar, type SidecarData } from "./sidecar";
import { createCortexAssets } from "./cortexMaterial";

function firstGeometry(scene: THREE.Object3D): THREE.BufferGeometry | null {
  let g: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
  });
  return g;
}

function regionAt(
  sidecar: SidecarData,
  e: ThreeEvent<PointerEvent | MouseEvent>,
): string | null {
  const v = e.face?.a;
  if (v === undefined) return null;
  const idx = sidecar.vertexRegion[v];
  return idx > 0 ? sidecar.regionIndexToId[idx] : null;
}

export function CortexHemisphere({ hemi }: { hemi: "lh" | "rh" }) {
  const { scene } = useGLTF(`/meshes/cortex_${hemi}.glb`);
  const sidecar = useSidecar(hemi);
  const setHover = useVizStore((s) => s.setHover);
  const selectRegion = useVizStore((s) => s.selectRegion);
  const showSub = useVizStore((s) => s.showSubcortical);

  const geometry = useMemo(() => firstGeometry(scene), [scene]);
  const assets = useMemo(() => createCortexAssets(), []);

  useEffect(() => {
    if (geometry && sidecar && !geometry.getAttribute("aRegion")) {
      geometry.setAttribute(
        "aRegion",
        new THREE.BufferAttribute(Float32Array.from(sidecar.vertexRegion), 1),
      );
    }
  }, [geometry, sidecar]);

  // hover/selection drive shader uniforms directly — no React re-render
  useEffect(() => {
    if (!sidecar) return;
    const apply = (hover: string | null, selected: string | null) =>
      assets.setHighlight(
        hover ? (sidecar.indexOf.get(hover) ?? 0) : 0,
        selected ? (sidecar.indexOf.get(selected) ?? 0) : 0,
      );
    const s = useVizStore.getState();
    apply(s.hoverRegion, s.selectedRegion);
    return useVizStore.subscribe((s) => apply(s.hoverRegion, s.selectedRegion));
  }, [sidecar, assets]);

  // subcortex mode: cortex becomes a translucent shell and stops catching rays
  useEffect(() => {
    assets.setTranslucent(showSub);
  }, [showSub, assets]);

  if (!geometry || !sidecar) return null;
  return (
    <mesh
      geometry={geometry}
      material={assets.material}
      raycast={showSub ? () => null : undefined}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(regionAt(sidecar, e));
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        selectRegion(regionAt(sidecar, e));
      }}
    />
  );
}

useGLTF.preload("/meshes/cortex_lh.glb");
useGLTF.preload("/meshes/cortex_rh.glb");
