"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useVizStore } from "@/state/vizStore";
import { subcorticalRegions } from "@/lib/repo/atlas";
import type { Region } from "@/lib/schemas";
import { useOverlayResult } from "./useOverlay";
import { rasToWorld, registerCentroid } from "./regionGeometry";

function Structure({ region }: { region: Region }) {
  const overlay = useOverlayResult();
  const { scene } = useGLTF(`/meshes/${region.id}.glb`);
  const setHover = useVizStore((s) => s.setHover);
  const selectRegion = useVizStore((s) => s.selectRegion);
  const hovered = useVizStore((s) => s.hoverRegion === region.id);
  const selected = useVizStore((s) => s.selectedRegion === region.id);

  const geometry = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse((o) => {
      if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
    });
    return g;
  }, [scene]);

  useEffect(() => {
    if (!geometry) return;
    const g = geometry as THREE.BufferGeometry;
    g.computeBoundingBox();
    const c = new THREE.Vector3();
    g.boundingBox?.getCenter(c);
    registerCentroid(region.id, rasToWorld(c.x, c.y, c.z));
  }, [geometry, region.id]);

  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(region.id);
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        selectRegion(region.id);
      }}
    >
      <meshStandardMaterial
        color={
          overlay.kind === null || overlay.kind === "network"
            ? region.color // Yeo networks are cortical-only: keep anatomy
            : (overlay.colors.get(region.id) ?? "#cfccc5")
        }
        roughness={0.55}
        emissive={selected ? "#c58f3c" : hovered ? "#39678c" : "#000000"}
        emissiveIntensity={selected || hovered ? 0.6 : 0}
      />
    </mesh>
  );
}

export function Subcortex() {
  const show = useVizStore((s) => s.showSubcortical);
  const regions = subcorticalRegions(); // module-level cached
  if (!show) return null;
  return (
    <group>
      {regions.map((r) => (
        <Structure key={r.id} region={r} />
      ))}
    </group>
  );
}
