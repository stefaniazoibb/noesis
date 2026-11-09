"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useVizStore, type ViewPresetName } from "@/state/vizStore";
import { CortexHemisphere } from "./CortexHemisphere";
import { Subcortex } from "./Subcortex";
import { getCentroid } from "./regionGeometry";

/** fsaverage bbox center after the RAS→y-up rotation applied to the group */
const CENTER: [number, number, number] = [0.6, 15.6, 17.8];
const DIST = 260;

const VIEW_POSITIONS: Record<Exclude<ViewPresetName, "reset">, [number, number, number]> = {
  left: [CENTER[0] - DIST, CENTER[1], CENTER[2]],
  right: [CENTER[0] + DIST, CENTER[1], CENTER[2]],
  anterior: [CENTER[0], CENTER[1], CENTER[2] - DIST],
  posterior: [CENTER[0], CENTER[1], CENTER[2] + DIST],
  superior: [CENTER[0], CENTER[1] + DIST, CENTER[2]],
  inferior: [CENTER[0], CENTER[1] - DIST, CENTER[2]],
};

const HOME_POSITION: [number, number, number] = [-215, 105, -195];

/** Home camera, pulled back on narrow (portrait) canvases so the whole
 *  brain fits the width. */
function homePosition(aspect: number): [number, number, number] {
  const f = aspect < 0.75 ? 1.8 : aspect < 1.1 ? 1.35 : 1;
  return [
    CENTER[0] + (HOME_POSITION[0] - CENTER[0]) * f,
    CENTER[1] + (HOME_POSITION[1] - CENTER[1]) * f,
    CENTER[2] + (HOME_POSITION[2] - CENTER[2]) * f,
  ];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Camera presets, reset and region fly-to. Moves are eased over ~0.6 s
 * (instant under prefers-reduced-motion); any user drag cancels a move.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const fitted = useRef(false);
  const viewRequest = useVizStore((s) => s.viewRequest);
  const focusRequest = useVizStore((s) => s.focusRequest);
  const anim = useRef<{
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
  } | null>(null);
  const pendingFocus = useRef<{ region: string; frames: number } | null>(null);

  const start = (pos: [number, number, number], target: [number, number, number]) => {
    if (!controls) return;
    if (prefersReducedMotion()) {
      camera.position.set(...pos);
      controls.target.set(...target);
      controls.update();
      return;
    }
    anim.current = {
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...pos),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...target),
      t: 0,
    };
    invalidate();
  };

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      anim.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  // first frame on a portrait screen: step back so the brain fits
  useEffect(() => {
    if (fitted.current || !controls || size.width === 0) return;
    fitted.current = true;
    const aspect = size.width / size.height;
    if (aspect < 1.1) {
      camera.position.set(...homePosition(aspect));
      controls.update();
    }
  }, [controls, size, camera]);

  useEffect(() => {
    if (!viewRequest || !controls) return;
    if (viewRequest.name === "reset") start(homePosition(size.width / size.height), CENTER);
    else start(VIEW_POSITIONS[viewRequest.name], CENTER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRequest, controls]);

  useEffect(() => {
    if (!focusRequest) return;
    pendingFocus.current = { region: focusRequest.region, frames: 0 };
    invalidate();
  }, [focusRequest, invalidate]);

  useFrame((_, delta) => {
    // resolve a pending fly-to once the region's mesh has registered
    const pf = pendingFocus.current;
    if (pf && controls) {
      const c = getCentroid(pf.region);
      if (c) {
        pendingFocus.current = null;
        const center = new THREE.Vector3(...CENTER);
        const target = new THREE.Vector3(...c);
        let dir = target.clone().sub(center);
        if (dir.length() < 1e-3) dir = new THREE.Vector3(-1, 0.4, -0.6);
        dir.normalize();
        // subcortical structures sit deep: view them from further out
        const dist = pf.region.startsWith("sub_") ? 230 : 190;
        const pos = target.clone().add(dir.multiplyScalar(dist));
        pos.y += 25;
        start([pos.x, pos.y, pos.z], [target.x, target.y, target.z]);
      } else if (++pf.frames > 600) {
        pendingFocus.current = null;
      }
    }
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + delta / 0.6);
    const k = 1 - Math.pow(1 - a.t, 3); // ease-out cubic
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
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
      <div className="w-56 rounded-lg border border-line bg-ink-2/85 px-4 py-3 backdrop-blur">
        <p className="font-mono text-[11px] text-text-3">
          Loading fsaverage atlas
        </p>
        <div className="mt-2 h-px w-full bg-line">
          <div
            className="h-px bg-amber transition-[width] duration-300"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-[10px] tabular-nums text-text-3">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}

export function BrainViewer() {
  const left = useVizStore((s) => s.hemispheres.left);
  const right = useVizStore((s) => s.hemispheres.right);
  const selectRegion = useVizStore((s) => s.selectRegion);
  // adaptive resolution: drop to 1x device pixels if the frame rate declines
  const [dpr, setDpr] = useState<number | [number, number]>([1, 2]);

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
        camera={{ position: HOME_POSITION, fov: 40, near: 1, far: 3000 }}
        dpr={dpr}
        onPointerMissed={() => selectRegion(null)}
      >
      <PerformanceMonitor onDecline={() => setDpr(1)} flipflops={1} />
      <color attach="background" args={["#ecebe6"]} />
      <hemisphereLight args={["#ffffff", "#8c8a84", 1.15]} />
      <directionalLight position={[-220, 260, -180]} intensity={1.7} />
      <directionalLight
        position={[200, -40, 220]}
        intensity={0.45}
        color="#dfe6ec"
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
        <CameraRig />
      </Canvas>
    </div>
  );
}
