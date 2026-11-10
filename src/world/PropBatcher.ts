// src/world/PropBatcher.ts
// Fusiona los props decorativos de un bioma en unas pocas mallas.
//
// Cada prop se fabrica igual que antes (un Group de varias mallas con su propio
// material de color aleatorio), pero en vez de añadirse a la escena tal cual
// —una draw call por malla— sus vértices se vuelcan, ya en espacio de mundo, a
// una geometría por "tipo de material". El color de cada prop va en el color
// de vértice, así que el aspecto no cambia y three.js dibuja cada tipo de una
// sola vez.
//
// Los props que se balancean (coral, algas...) también se fusionan: el
// balanceo se hace en el vertex shader, girando cada vértice alrededor del
// origen de su prop con los mismos ángulos que antes se aplicaban en CPU.

import * as THREE from "three"

export type PropSway = {
  amplitude: number
  speed: number
  phase: number
}

export interface PropBatchResult {
  /** Mallas fusionadas listas para añadir a la escena. */
  meshes: THREE.Mesh[]
  /** Props que no se pudieron fusionar; se añaden a la escena tal cual. */
  leftovers: THREE.Object3D[]
}

/** Uniform compartida por todos los materiales con balanceo. */
export const propSwayUniforms = {
  uSwayTime: { value: 0 },
}

type BatchableMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial

type Bucket = {
  key: string
  source: BatchableMaterial
  sway: boolean
  /** Intensidad emisiva distinta por prop: va en un atributo por vértice. */
  glow: boolean
  /** Opacidad distinta por prop: se guarda en el alfa del color de vértice. */
  alpha: boolean
  vertexCount: number
  entries: BucketEntry[]
}

type BucketEntry = {
  geometry: THREE.BufferGeometry
  matrixWorld: THREE.Matrix4
  color: THREE.Color
  opacity: number
  glow: number
  pivot: THREE.Vector3
  axis: THREE.Vector3
  sway: PropSway | null
}

// Versión sin índice de cada geometría compartida (se calcula una sola vez).
const nonIndexedCache = new WeakMap<
  THREE.BufferGeometry,
  THREE.BufferGeometry
>()

function nonIndexed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geometry.index) return geometry
  let flat = nonIndexedCache.get(geometry)
  if (!flat) {
    flat = geometry.toNonIndexed()
    nonIndexedCache.set(geometry, flat)
  }
  return flat
}

function isStandard(m: THREE.Material): m is THREE.MeshStandardMaterial {
  return m.type === "MeshStandardMaterial"
}

function isBatchable(
  material: THREE.Material | THREE.Material[],
): material is BatchableMaterial {
  if (Array.isArray(material)) return false
  if (
    material.type !== "MeshStandardMaterial" &&
    material.type !== "MeshBasicMaterial"
  ) {
    return false
  }
  const m = material as BatchableMaterial
  // Con texturas o shaders a medida no se puede compartir material.
  if (m.map || m.alphaMap || m.wireframe) return false
  if (isStandard(m) && (m.emissiveMap || m.normalMap)) return false
  return m.onBeforeCompile === THREE.Material.prototype.onBeforeCompile
}

/**
 * Todo lo que distingue dos materiales salvo lo que se guarda por vértice
 * (color, opacidad e intensidad del emisivo).
 */
function materialKey(m: BatchableMaterial, sway: boolean): string {
  const parts: (string | number | boolean)[] = [
    m.type,
    sway ? "sway" : "static",
    m.transparent,
    m.side,
    m.depthWrite,
    m.blending,
  ]
  if (isStandard(m)) {
    parts.push(
      m.roughness,
      m.metalness,
      m.flatShading,
      // Un emisivo apagado no distingue materiales, sea cual sea su color.
      m.emissiveIntensity > 0 ? m.emissive.getHex() : 0,
    )
  }
  return parts.join("|")
}

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const tmpVertex = new THREE.Vector3()
const tmpNormal = new THREE.Vector3()
const tmpNormalMatrix = new THREE.Matrix3()
const tmpQuaternion = new THREE.Quaternion()

export function batchProps(props: THREE.Object3D[]): PropBatchResult {
  const buckets = new Map<string, Bucket>()
  const leftovers: THREE.Object3D[] = []

  for (const prop of props) {
    prop.updateMatrixWorld(true)

    const sway = (prop.userData.sway as PropSway | undefined) ?? null

    // Un prop solo se fusiona si TODAS sus mallas son fusionables.
    const meshes: THREE.Mesh[] = []
    let ok = true
    prop.traverse((object) => {
      if (object === prop && !(object instanceof THREE.Mesh)) return
      if (object instanceof THREE.Mesh) {
        if (isBatchable(object.material)) meshes.push(object)
        else ok = false
      } else if (!(object instanceof THREE.Group)) {
        ok = false
      }
    })

    if (!ok || meshes.length === 0) {
      leftovers.push(prop)
      continue
    }

    // Eje local Z del prop en mundo: el balanceo en Z se aplica en espacio
    // local (rotación XYZ de three.js), así que en mundo gira sobre este eje.
    const axis = Z_AXIS.clone().applyQuaternion(
      prop.getWorldQuaternion(tmpQuaternion),
    )
    const pivot = prop.getWorldPosition(new THREE.Vector3())

    for (const mesh of meshes) {
      const material = mesh.material as BatchableMaterial
      const key = materialKey(material, sway !== null)
      const glow = isStandard(material) ? material.emissiveIntensity : 0

      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = {
          key,
          source: material,
          sway: sway !== null,
          glow: false,
          alpha: false,
          vertexCount: 0,
          entries: [],
        }
        buckets.set(key, bucket)
      }

      const geometry = nonIndexed(mesh.geometry)
      if (material.transparent && material.opacity !== bucket.source.opacity) {
        bucket.alpha = true
      }
      if (
        isStandard(bucket.source) &&
        glow !== bucket.source.emissiveIntensity
      ) {
        bucket.glow = true
      }
      bucket.vertexCount += geometry.attributes.position.count
      bucket.entries.push({
        geometry,
        matrixWorld: mesh.matrixWorld,
        color: material.color,
        opacity: material.transparent ? material.opacity : 1,
        glow,
        pivot,
        axis,
        sway,
      })
    }
  }

  const meshes: THREE.Mesh[] = []
  for (const bucket of buckets.values()) meshes.push(buildBucketMesh(bucket))

  return { meshes, leftovers }
}

function buildBucketMesh(bucket: Bucket): THREE.Mesh {
  const count = bucket.vertexCount
  const colorSize = bucket.alpha ? 4 : 3

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * colorSize)
  const pivots = bucket.sway ? new Float32Array(count * 3) : null
  const axes = bucket.sway ? new Float32Array(count * 3) : null
  const sways = bucket.sway ? new Float32Array(count * 3) : null
  const glows = bucket.glow ? new Float32Array(count) : null

  let v = 0
  for (const entry of bucket.entries) {
    const srcPos = entry.geometry.attributes.position
    const srcNormal = entry.geometry.attributes.normal as
      THREE.BufferAttribute | undefined
    tmpNormalMatrix.getNormalMatrix(entry.matrixWorld)

    for (let i = 0; i < srcPos.count; i++, v++) {
      tmpVertex.fromBufferAttribute(srcPos, i).applyMatrix4(entry.matrixWorld)
      positions[v * 3] = tmpVertex.x
      positions[v * 3 + 1] = tmpVertex.y
      positions[v * 3 + 2] = tmpVertex.z

      if (srcNormal) {
        tmpNormal
          .fromBufferAttribute(srcNormal, i)
          .applyMatrix3(tmpNormalMatrix)
          .normalize()
      } else {
        tmpNormal.set(0, 1, 0)
      }
      normals[v * 3] = tmpNormal.x
      normals[v * 3 + 1] = tmpNormal.y
      normals[v * 3 + 2] = tmpNormal.z

      colors[v * colorSize] = entry.color.r
      colors[v * colorSize + 1] = entry.color.g
      colors[v * colorSize + 2] = entry.color.b
      if (bucket.alpha) colors[v * 4 + 3] = entry.opacity
      if (glows) glows[v] = entry.glow

      if (pivots && axes && sways && entry.sway) {
        pivots[v * 3] = entry.pivot.x
        pivots[v * 3 + 1] = entry.pivot.y
        pivots[v * 3 + 2] = entry.pivot.z
        axes[v * 3] = entry.axis.x
        axes[v * 3 + 1] = entry.axis.y
        axes[v * 3 + 2] = entry.axis.z
        sways[v * 3] = entry.sway.amplitude
        sways[v * 3 + 1] = entry.sway.speed
        sways[v * 3 + 2] = entry.sway.phase
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, colorSize))
  if (pivots && axes && sways) {
    geometry.setAttribute("aPivot", new THREE.BufferAttribute(pivots, 3))
    geometry.setAttribute("aAxis", new THREE.BufferAttribute(axes, 3))
    geometry.setAttribute("aSway", new THREE.BufferAttribute(sways, 3))
  }
  if (glows) geometry.setAttribute("aGlow", new THREE.BufferAttribute(glows, 1))
  geometry.computeBoundingSphere()

  const source = bucket.source
  const shared = {
    color: 0xffffff,
    vertexColors: true,
    transparent: source.transparent,
    // Con opacidad por prop, el alfa va en el color de vértice.
    opacity: bucket.alpha ? 1 : source.opacity,
    side: source.side,
    depthWrite: source.depthWrite,
    blending: source.blending,
  }

  const material = isStandard(source)
    ? new THREE.MeshStandardMaterial({
        ...shared,
        roughness: source.roughness,
        metalness: source.metalness,
        flatShading: source.flatShading,
        emissive: source.emissive.clone(),
        // Con intensidad por prop, el valor real va en el atributo aGlow.
        emissiveIntensity: bucket.glow ? 1 : source.emissiveIntensity,
      })
    : new THREE.MeshBasicMaterial(shared)

  applyBatchShader(material, bucket.sway, bucket.glow)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `props:${bucket.key}`
  // Los props cubren todo el bioma: la esfera envolvente siempre está en vista.
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  return mesh
}

/**
 * Parches de shader de las mallas fusionadas.
 *
 * Balanceo en GPU: reproduce lo que hacía BiomeProps.update en CPU:
 *   rotation.z = base.z + sin(t·speed + phase)·amplitude
 *   rotation.x = base.x + cos(t·speed·0.73 + phase)·amplitude·0.3
 * La rotación base ya está aplicada en los vértices; aquí solo se suma el
 * incremento: Z sobre el eje local del prop y X sobre el eje X del mundo.
 *
 * Brillo por prop: la intensidad del emisivo llega como atributo (aGlow).
 */
function applyBatchShader(
  material: BatchableMaterial,
  sway: boolean,
  glow: boolean,
): void {
  if (!sway && !glow) return

  material.onBeforeCompile = (shader) => {
    let vertexDecl = ""
    let vertexBody = ""

    if (sway) {
      shader.uniforms.uSwayTime = propSwayUniforms.uSwayTime
      vertexDecl += `
        attribute vec3 aPivot;
        attribute vec3 aAxis;
        attribute vec3 aSway;
        uniform float uSwayTime;

        vec3 swayRotate(vec3 v, vec3 axis, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
        }`
      vertexBody += `
        float swayZ = sin(uSwayTime * aSway.y + aSway.z) * aSway.x;
        float swayX = cos(uSwayTime * aSway.y * 0.73 + aSway.z) * aSway.x * 0.3;
        vec3 swayRel = transformed - aPivot;
        swayRel = swayRotate(swayRel, aAxis, swayZ);
        swayRel = swayRotate(swayRel, vec3(1.0, 0.0, 0.0), swayX);
        transformed = aPivot + swayRel;`
    }

    if (glow) {
      vertexDecl += `
        attribute float aGlow;
        varying float vGlow;`
      vertexBody += `
        vGlow = aGlow;`
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        varying float vGlow;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        totalEmissiveRadiance *= vGlow;`,
        )
    }

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${vertexDecl}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>${vertexBody}`,
      )
  }
  material.customProgramCacheKey = () =>
    `prop-batch-${sway ? "sway" : ""}-${glow ? "glow" : ""}`
}
