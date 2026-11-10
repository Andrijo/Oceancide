// src/entities/fresnelRim.ts
// Contorno fresnel barato para materiales translúcidos (burbujas, medusas).
// Sustituye a `transmission`, que obliga a three.js a hacer un render pass
// extra de toda la escena opaca en cada frame.

import type * as THREE from "three"

/**
 * Añade al material un brillo de borde (más intenso cuanto más rasante es la
 * vista) sumado al emisivo y a la opacidad. No añade draw calls.
 */
export function addFresnelRim(
  material: THREE.MeshStandardMaterial,
  strength: number,
  power: number,
): void {
  const s = strength.toFixed(3)
  const p = power.toFixed(3)

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimFactor = 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 );
        rimFactor = pow( rimFactor, ${p} );
        totalEmissiveRadiance += mix( diffuseColor.rgb, vec3( 1.0 ), 0.6 ) * rimFactor * ${s};`,
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        gl_FragColor.a = clamp( gl_FragColor.a + rimFactor * 0.35, 0.0, 1.0 );`,
      )
  }
  // La clave distingue este programa del estándar sin rim.
  material.customProgramCacheKey = () => `fresnel-rim-${s}-${p}`
}
