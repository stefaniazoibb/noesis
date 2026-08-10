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
}

export function createCortexAssets(): CortexAssets {
  const uniforms: CortexUniforms = {
    uHover: { value: 0 },
    uSelected: { value: 0 },
  };
  const material = createCortexMaterial(uniforms);
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
  };
}

function createCortexMaterial(
  uniforms: CortexUniforms,
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
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aRegion;\nvarying float vRegion;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRegion = aRegion;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uHover;\nuniform float uSelected;\nvarying float vRegion;",
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
if (uSelected > 0.5 && abs(vRegion - uSelected) < 0.5) {
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.66, 0.26), 0.55);
} else if (uHover > 0.5 && abs(vRegion - uHover) < 0.5) {
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.42, 0.65, 0.86), 0.40);
}`,
      );
  };
  m.customProgramCacheKey = () => "cortex-region-highlight";
  return m;
}
