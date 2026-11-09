import * as THREE from "three";

interface CortexUniforms {
  uHover: { value: number };
  uSelected: { value: number };
}

/**
 * Cortex material plus its imperative controls. Region state changes only
 * touch shader uniforms — no recompilation, no React re-render. The mesh
 * geometry must carry a float `aRegion` vertex attribute (region table
 * index, 0 = none).
 */
export interface CortexAssets {
  material: THREE.MeshStandardMaterial;
  setHighlight(hoverIndex: number, selectedIndex: number): void;
  /** subcortex mode: translucent shell */
  setTranslucent(on: boolean): void;
  /**
   * Evidence overlay: rgba per region table index (256 entries × 4 bytes,
   * alpha = per-region mix weight). Pass null to clear.
   */
  setOverlay(rgba: Uint8Array | null): void;
}

const OVERLAY_SIZE = 256;

export function createCortexAssets(): CortexAssets {
  const uniforms: CortexUniforms = {
    uHover: { value: 0 },
    uSelected: { value: 0 },
  };
  const overlayData = new Uint8Array(OVERLAY_SIZE * 4);
  const overlayTex = new THREE.DataTexture(
    overlayData,
    OVERLAY_SIZE,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  overlayTex.magFilter = THREE.NearestFilter;
  overlayTex.minFilter = THREE.NearestFilter;
  overlayTex.needsUpdate = true;

  const material = createCortexMaterial(uniforms, overlayTex);
  return {
    material,
    setHighlight(hoverIndex, selectedIndex) {
      uniforms.uHover.value = hoverIndex;
      uniforms.uSelected.value = selectedIndex;
    },
    setTranslucent(on) {
      material.opacity = on ? 0.18 : 1;
      material.depthWrite = !on;
    },
    setOverlay(rgba) {
      if (rgba === null) {
        overlayData.fill(0);
      } else {
        overlayData.set(rgba.subarray(0, OVERLAY_SIZE * 4));
      }
      overlayTex.needsUpdate = true;
    },
  };
}

function createCortexMaterial(
  uniforms: CortexUniforms,
  overlayTex: THREE.DataTexture,
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: "#b3aca3",
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 1,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHover = uniforms.uHover;
    shader.uniforms.uSelected = uniforms.uSelected;
    shader.uniforms.uOverlayTex = { value: overlayTex };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aRegion;\nflat varying float vRegion;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRegion = aRegion;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uHover;\nuniform float uSelected;\nuniform sampler2D uOverlayTex;\nflat varying float vRegion;",
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
vec4 nmOverlay = texture2D(uOverlayTex, vec2((vRegion + 0.5) / ${OVERLAY_SIZE}.0, 0.5));
gl_FragColor.rgb = mix(gl_FragColor.rgb, nmOverlay.rgb, nmOverlay.a);
if (uSelected > 0.5 && abs(vRegion - uSelected) < 0.5) {
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.66, 0.26), 0.55);
} else if (uHover > 0.5 && abs(vRegion - uHover) < 0.5) {
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.42, 0.65, 0.86), 0.40);
}`,
      );
  };
  m.customProgramCacheKey = () => "cortex-region-highlight-flat";
  return m;
}
