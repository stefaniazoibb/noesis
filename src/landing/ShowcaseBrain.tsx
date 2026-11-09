"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { useSidecar, type SidecarData } from "@/brain/sidecar";
import { createCortexAssets } from "@/brain/cortexMaterial";
import { hexToRgb } from "@/lib/evidence/overlay";
import { subcorticalRegions } from "@/lib/repo/atlas";
import type { Region } from "@/lib/schemas";

/**
 * Landing-page rendering of the SAME fsaverage/Desikan-Killiany assets the
 * Explore view uses (GLB meshes, vertex->region sidecars, cortex shader).
 * It keeps its own overlay state so scrolling the landing page never
 * mutates the Explore view state. Colors cross-fade between story steps.
 */

const CENTER: [number, number, number] = [0.6, 15.6, 17.8];
const HOME: [number, number, number] = [-215, 105, -195];

export interface ShowcaseBrainProps {
  /** region id -> hex; null/empty = plain anatomy */
  colors: Record<string, string> | null;
  showSubcortex?: boolean;
  selected?: string | null;
  onPick?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  /** horizontal projection shift as a fraction of width (desktop hero) */
  shiftX?: number;
  /** downward projection shift as a fraction of height (mobile hero) */
  shiftY?: number;
  /** distance multiplier relative to the Explore home view */
  distance?: number;
}

function firstGeometry(scene: THREE.Object3D): THREE.BufferGeometry | null {
  let g: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    if (!g && (o as THREE.Mesh).isMesh) g = (o as THREE.Mesh).geometry;
  });
  return g;
}

function regionAt(sidecar: SidecarData, e: ThreeEvent<PointerEvent | MouseEvent>) {
  const v = e.face?.a;
  if (v === undefined) return null;
  const idx = sidecar.vertexRegion[v];
  return idx > 0 ? sidecar.regionIndexToId[idx] : null;
}

function ShowcaseCortex({
  hemi,
  colors,
  translucent,
  selected,
  hover,
  setHover,
  onPick,
}: {
  hemi: "lh" | "rh";
  colors: Record<string, string> | null;
  translucent: boolean;
  selected: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  onPick?: (id: string | null) => void;
}) {
  const { scene } = useGLTF(`/meshes/cortex_${hemi}.glb`);
  const sidecar = useSidecar(hemi);
  const geometry = useMemo(() => firstGeometry(scene), [scene]);
  const assets = useMemo(() => createCortexAssets(), []);
  const current = useRef(new Float32Array(256 * 4));
  const target = useRef(new Float32Array(256 * 4));
  const out = useRef(new Uint8Array(256 * 4));
  const settled = useRef(false);

  useEffect(() => {
    if (geometry && sidecar && !geometry.getAttribute("aRegion")) {
      geometry.setAttribute(
        "aRegion",
        new THREE.BufferAttribute(Float32Array.from(sidecar.vertexRegion), 1),
      );
    }
  }, [geometry, sidecar]);

  useEffect(() => {
    if (!sidecar) return;
    const t = target.current;
    t.fill(0);
    sidecar.regionIndexToId.forEach((id, i) => {
      const hex = colors?.[id];
      if (!hex) return;
      const [r, g, b] = hexToRgb(hex);
      t[i * 4] = r;
      t[i * 4 + 1] = g;
      t[i * 4 + 2] = b;
      t[i * 4 + 3] = 225;
    });
    // keep the hue when fading a region out (only alpha goes to 0)
    for (let i = 0; i < 256; i++) {
      if (t[i * 4 + 3] === 0) {
        t[i * 4] = current.current[i * 4];
        t[i * 4 + 1] = current.current[i * 4 + 1];
        t[i * 4 + 2] = current.current[i * 4 + 2];
      }
    }
    settled.current = false;
  }, [colors, sidecar]);

  useEffect(() => assets.setTranslucent(translucent), [translucent, assets]);

  useEffect(() => {
    if (!sidecar) return;
    assets.setHighlight(
      hover ? (sidecar.indexOf.get(hover) ?? 0) : 0,
      selected ? (sidecar.indexOf.get(selected) ?? 0) : 0,
    );
  }, [hover, selected, sidecar, assets]);

  useFrame((_, delta) => {
    if (settled.current) return;
    const c = current.current;
    const t = target.current;
    const k = Math.min(1, delta * 4);
    let maxDiff = 0;
    for (let i = 0; i < c.length; i++) {
      const d = t[i] - c[i];
      c[i] += d * k;
      if (Math.abs(d) > maxDiff) maxDiff = Math.abs(d);
      out.current[i] = c[i];
    }
    if (maxDiff < 0.5) {
      c.set(t);
      out.current.set(t);
      settled.current = true;
    }
    assets.setOverlay(out.current);
  });

  if (!geometry || !sidecar) return null;
  return (
    <mesh
      geometry={geometry}
      material={assets.material}
      raycast={translucent ? () => null : undefined}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHover(regionAt(sidecar, e));
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onPick?.(regionAt(sidecar, e));
      }}
    />
  );
}

function ShowcaseStructure({
  region,
  color,
  selected,
  hovered,
  setHover,
  onPick,
}: {
  region: Region;
  color: string;
  selected: boolean;
  hovered: boolean;
  setHover: (id: string | null) => void;
  onPick?: (id: string | null) => void;
}) {
  const { scene } = useGLTF(`/meshes/${region.id}.glb`);
  const geometry = useMemo(() => firstGeometry(scene), [scene]);
  const tone = useMemo(
    () => "#" + new THREE.Color(color).lerp(new THREE.Color("#b3aca3"), 0.3).getHexString(),
    [color],
  );
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
        onPick?.(region.id);
      }}
    >
      <meshStandardMaterial
        color={tone}
        roughness={0.55}
        emissive={selected ? "#c58f3c" : hovered ? "#39678c" : "#000000"}
        emissiveIntensity={selected || hovered ? 0.6 : 0}
      />
    </mesh>
  );
}

/** Restrained ambient dust — decorative only, not anatomical, not data. */
let dotTexture: THREE.CanvasTexture | null = null;
function getDotTexture(): THREE.CanvasTexture {
  if (!dotTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    dotTexture = new THREE.CanvasTexture(c);
  }
  return dotTexture;
}

function Dust({ count = 220 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const r = 165 + rand() * 70;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      p[i * 3] = CENTER[0] + r * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = CENTER[1] + r * Math.cos(ph) * 0.7;
      p[i * 3 + 2] = CENTER[2] + r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.012;
  });
  return (
    <points ref={ref} geometry={geometry} raycast={() => null}>
      <pointsMaterial
        color="#d9a45b"
        map={getDotTexture()}
        alphaTest={0.01}
        size={2.2}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </points>
  );
}

/** Touch devices: no orbit controls (they would capture page scrolling);
 *  the camera slowly circles the brain instead. */
function AutoSpin({ spin }: { spin: boolean }) {
  useFrame((state, dt) => {
    const camera = state.camera;
    if (!spin) {
      camera.lookAt(...CENTER);
      return;
    }
    const dx = camera.position.x - CENTER[0];
    const dz = camera.position.z - CENTER[2];
    const a = dt * 0.06;
    camera.position.x = CENTER[0] + dx * Math.cos(a) - dz * Math.sin(a);
    camera.position.z = CENTER[2] + dx * Math.sin(a) + dz * Math.cos(a);
    camera.lookAt(...CENTER);
  });
  return null;
}

function ViewShift({ shiftX, shiftY }: { shiftX: number; shiftY: number }) {
  const cur = useRef({ x: shiftX, y: shiftY, w: 0, h: 0 });
  // eased projection offset: story steps can move the brain without a jump
  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const { width, height } = state.size;
    const c = cur.current;
    const k = Math.min(1, dt * 3);
    const dx = shiftX - c.x;
    const dy = shiftY - c.y;
    const moving = Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4;
    if (!moving && c.w === width && c.h === height) return;
    c.x = moving ? c.x + dx * k : shiftX;
    c.y = moving ? c.y + dy * k : shiftY;
    c.w = width;
    c.h = height;
    if (c.x === 0 && c.y === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, -c.x * width, -c.y * height, width, height);
    camera.updateProjectionMatrix();
  });
  return null;
}

function useMedia(query: string, fallback = false): boolean {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setV(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return v;
}

export default function ShowcaseBrain({
  colors,
  showSubcortex = false,
  selected = null,
  onPick,
  onHover,
  shiftX = 0,
  shiftY = 0,
  distance = 1,
}: ShowcaseBrainProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hover, setHoverState] = useState<string | null>(null);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const coarse = useMedia("(pointer: coarse)");
  const subs = subcorticalRegions();
  // adaptive quality: low-core devices start at 1x pixels; any device whose
  // frame rate declines drops to 1x (never back up, so no oscillation)
  const [dpr, setDpr] = useState<number | [number, number]>(() =>
    typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4 ? 1 : [1, 1.75],
  );
  const lowEnd = dpr === 1;

  const setHover = (id: string | null) => {
    setHoverState(id);
    onHover?.(id);
  };

  // stop rendering entirely while the canvas is off-screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  const pos: [number, number, number] = [
    CENTER[0] + (HOME[0] - CENTER[0]) * distance,
    CENTER[1] + (HOME[1] - CENTER[1]) * distance,
    CENTER[2] + (HOME[2] - CENTER[2]) * distance,
  ];

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        frameloop={visible ? "always" : "never"}
        camera={{ position: pos, fov: 36, near: 1, far: 3000 }}
        dpr={dpr}
        gl={{ antialias: !lowEnd, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => onPick?.(null)}
        style={{ touchAction: "pan-y" }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} flipflops={1} />
        <hemisphereLight args={["#e6dccb", "#1a2029", 1.05]} />
        <directionalLight position={[-220, 260, -180]} intensity={1.6} color="#fff4e2" />
        <directionalLight position={[200, -40, 220]} intensity={0.55} color="#6fc6d2" />
        <ViewShift shiftX={shiftX} shiftY={shiftY} />
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <Suspense fallback={null}>
            {(["lh", "rh"] as const).map((h) => (
              <ShowcaseCortex
                key={h}
                hemi={h}
                colors={colors}
                translucent={showSubcortex}
                selected={selected}
                hover={hover}
                setHover={setHover}
                onPick={onPick}
              />
            ))}
            {showSubcortex &&
              subs.map((r) => (
                <ShowcaseStructure
                  key={r.id}
                  region={r}
                  color={colors?.[r.id] ?? r.color}
                  selected={selected === r.id}
                  hovered={hover === r.id}
                  setHover={setHover}
                  onPick={onPick}
                />
              ))}
          </Suspense>
        </group>
        {!reduced && !lowEnd && <Dust />}
        {coarse ? (
          <AutoSpin spin={!reduced} />
        ) : (
        <OrbitControls
          makeDefault
          target={CENTER}
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          autoRotate={!reduced}
          autoRotateSpeed={0.55}
          rotateSpeed={0.6}
        />
        )}
      </Canvas>
    </div>
  );
}
