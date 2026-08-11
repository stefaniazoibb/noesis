"use client";

import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useVizStore, type ViewPresetName } from "@/state/vizStore";
import { CortexHemisphere } from "./CortexHemisphere";
import { Subcortex } from "./Subcortex";

/** fsaverage bbox center after the RAS→y-up rotation applied to the group */
const CENTER: [number, number, number] = [0.6, 15.6, 17.8];
const DIST = 260;

const VIEW_POSITIONS: Record<ViewPresetName, [number, number, number]> = {
  left: [CENTER[0] - DIST, CENTER[1], CENTER[2]],
  right: [CENTER[0] + DIST, CENTER[1], CENTER[2]],
  anterior: [CENTER[0], CENTER[1], CENTER[2] - DIST],
  posterior: [CENTER[0], CENTER[1], CENTER[2] + DIST],
  superior: [CENTER[0], CENTER[1] + DIST, CENTER[2]],
  inferior: [CENTER[0], CENTER[1] - DIST, CENTER[2]],
};

function CameraPresets() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const viewRequest = useVizStore((s) => s.viewRequest);

  useEffect(() => {
    if (!viewRequest || !controls) return;
    camera.position.set(...VIEW_POSITIONS[viewRequest.name]);
    controls.target.set(...CENTER);
    controls.update();
  }, [viewRequest, camera, controls]);
  return null;
}

/** Loading overlay while GLB assets stream in (rendered outside the canvas). */
function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <p className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur">
        Loading brain atlas… {Math.round(progress)}%
      </p>
    </div>
  );
}

export function BrainViewer() {
  const left = useVizStore((s) => s.hemispheres.left);
  const right = useVizStore((s) => s.hemispheres.right);
  const selectRegion = useVizStore((s) => s.selectRegion);

  // pointer cursor while hovering a region
  useEffect(
    () =>
      useVizStore.subscribe((s) => {
        document.body.style.cursor = s.hoverRegion ? "pointer" : "auto";
      }),
    [],
  );

  return (
    <div
      className="relative h-full w-full"
      role="img"
      aria-label="Interactive 3D human brain atlas. Use the mode and view controls to change the visualization; click a region to inspect its evidence."
    >
      <LoadingOverlay />
      <Canvas
        camera={{ position: [-215, 105, -195], fov: 40, near: 1, far: 3000 }}
        dpr={[1, 2]}
        onPointerMissed={() => selectRegion(null)}
      >
      <color attach="background" args={["#0b0d10"]} />
      <hemisphereLight args={["#cdd6e0", "#26292e", 1.1]} />
      <directionalLight position={[-220, 260, -180]} intensity={1.7} />
      <directionalLight
        position={[200, -40, 220]}
        intensity={0.45}
        color="#8fa8bd"
      />
      {/* FreeSurfer surface RAS (z superior) → three.js y-up */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Suspense fallback={null}>
          {left && <CortexHemisphere hemi="lh" />}
          {right && <CortexHemisphere hemi="rh" />}
          <Subcortex />
        </Suspense>
      </group>
        <OrbitControls
          makeDefault
          target={CENTER}
          enableDamping
          dampingFactor={0.12}
          minDistance={70}
          maxDistance={700}
        />
        <CameraPresets />
      </Canvas>
    </div>
  );
}
