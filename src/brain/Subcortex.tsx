"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useVizStore } from "@/state/vizStore";
import { subcorticalRegions } from "@/lib/repo/atlas";
import type { Region } from "@/lib/schemas";

function Structure({ region }: { region: Region }) {
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
        color={region.color}
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
