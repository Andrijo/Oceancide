// src/Debris.ts
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import {
  BIOME_DEBRIS,
  MICROFRAGMENT,
  type DebrisHazard,
  type DebrisMotion,
  type OceanDebrisType,
} from "./debrisCatalog"
import {
  DEBRIS_VISUALS,
  FALLBACK_VISUAL,
  type DebrisShape,
  type DebrisVisual,
} from "./DebrisVisuals"
import type { BiomeKey, WorldBounds } from "@core/types"
import { Rng } from "@core/rng"

const ECO_BASE = 5
const ECO_PER_TOXICITY = 25
const PULL_SPEED = 6

// Comportamientos de movimiento (eje A del catálogo).
const DRIFT_RANGE = 3.5 // amplitud horizontal de la deriva (unidades)
const DRIFT_SPEED = 0.35 // velocidad angular de la deriva
const VERTICAL_SPEED = 1.1 // u/s de hundimiento y flotación

// El emisivo del catálogo viene expresado como una intensidad relativa muy baja
// (0.12–0.4); sin esta ganancia el glow no se ve ni llega al umbral del bloom.
const GLOW_GAIN = 5

// Rim light compartido (una sola uniform para todos los materiales de desecho).
// Separa la silueta del fondo en las zonas oscuras y con niebla densa.
const rimUniforms = {
  uRimStrength: { value: 0.42 },
  uRimPower: { value: 2.2 },
}

/** Añade un contorno fresnel barato (misma draw call) al material. */
function applyRim(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimStrength = rimUniforms.uRimStrength
    shader.uniforms.uRimPower = rimUniforms.uRimPower

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uRimStrength;
        uniform float uRimPower;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimFactor = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
        rimFactor = pow( rimFactor, uRimPower );
        totalEmissiveRadiance += mix( diffuseColor.rgb, vec3( 1.0 ), 0.55 ) * rimFactor * uRimStrength;`,
      )
  }
}

const pullDelta = new THREE.Vector3()

// ---------------------------------------------------------------------------
// Marcador de fugas (hazard "lixivia")
// ---------------------------------------------------------------------------
// Sin pista visual el jugador no puede saber qué desecho mantiene el agua
// contaminada, y eso convierte el suelo de contaminación en un castigo injusto.
// Los materiales de fuga laten el emisivo, así que se identifican de un vistazo.
const pulsingMaterials: { material: THREE.Material; base: number }[] = []

function registerPulse(material: THREE.Material, base: number): void {
  if (base > 0) pulsingMaterials.push({ material, base })
}

/** Late el emisivo de los materiales de fuga. Llamar una vez por frame. */
export function updateLeakPulse(time: number): void {
  const wave = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 2.6))
  for (const { material, base } of pulsingMaterials) {
    ;(material as THREE.MeshPhysicalMaterial).emissiveIntensity = base * wave
  }
}

// ---------------------------------------------------------------------------
// Contraste automático contra el agua del bioma
// ---------------------------------------------------------------------------
// En varios biomas el agua es marrón/oliva oscuro y algunos desechos caían en el
// mismo rango de luminosidad (camuflaje). Aquí garantizamos una separación mínima
// de luminosidad respecto al agua. Se calcula SIEMPRE desde el color base del
// catálogo, así que aplicarlo varias veces (bucles del modo sin fin) no acumula.
export const CONTRAST_MIN_LIGHT_DELTA = 0.22

const contrastHsl = { h: 0, s: 0, l: 0 }
const waterHsl = { h: 0, s: 0, l: 0 }

/** Material con color base (MeshPhysicalMaterial de los desechos). */
type ColorMaterial = THREE.Material & { color: THREE.Color }

/** Separa la luminosidad del material de la del agua manteniendo tono y saturación. */
export function adaptMaterialToWater(
  material: ColorMaterial,
  waterColor: THREE.Color,
): void {
  const base = material.userData.baseColor as THREE.Color | undefined
  if (!base) return

  waterColor.getHSL(waterHsl)
  base.getHSL(contrastHsl)

  const delta = contrastHsl.l - waterHsl.l
  if (Math.abs(delta) >= CONTRAST_MIN_LIGHT_DELTA) {
    material.color.copy(base)
    return
  }

  // Mantiene la dirección (lo oscuro sigue oscuro, lo claro sigue claro) y, si el
  // ajuste se saldría de rango, empuja hacia el lado contrario.
  const direction = delta >= 0 ? 1 : -1
  let target = waterHsl.l + direction * CONTRAST_MIN_LIGHT_DELTA
  if (target > 0.95 || target < 0.05) {
    target = waterHsl.l - direction * CONTRAST_MIN_LIGHT_DELTA
  }
  target = THREE.MathUtils.clamp(target, 0.05, 0.95)

  material.color.setHSL(contrastHsl.h, contrastHsl.s, target)
}

// Utilidades de deformación

function deformGeometry(
  geometry: THREE.BufferGeometry,
  intensity: number,
  frequency = 4,
): THREE.BufferGeometry {
  if (intensity <= 0) return geometry

  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)

    const noise =
      Math.sin(vertex.x * frequency) * 0.5 +
      Math.cos(vertex.y * frequency * 1.3) * 0.3 +
      Math.sin(vertex.z * frequency * 0.8) * 0.4

    const factor = 1 + noise * intensity * 0.25

    vertex.multiplyScalar(factor)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  geometry.computeVertexNormals()
  return geometry
}

// Geometrías

function createBottleGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.12, 0.13, 0.34, 16, 1)
  body.translate(0, -0.06, 0)

  const shoulder = new THREE.CylinderGeometry(0.04, 0.12, 0.1, 16, 1)
  shoulder.translate(0, 0.16, 0)

  const neck = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12)
  neck.translate(0, 0.26, 0)

  const cap = new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12)
  cap.translate(0, 0.325, 0)

  return mergeGeometries([body, shoulder, neck, cap])
}

function createDrumGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.26, 0.26, 0.55, 20, 1)
  const top = new THREE.CylinderGeometry(0.265, 0.265, 0.02, 20)
  top.translate(0, 0.285, 0)

  const bottom = new THREE.CylinderGeometry(0.265, 0.265, 0.02, 20)
  bottom.translate(0, -0.285, 0)

  const ringGeometry = new THREE.TorusGeometry(0.27, 0.016, 8, 24)
  ringGeometry.rotateX(Math.PI / 2)

  const ring1 = ringGeometry.clone()
  ring1.translate(0, 0.18, 0)

  const ring2 = ringGeometry.clone()
  ring2.translate(0, -0.18, 0)

  return mergeGeometries([body, top, bottom, ring1, ring2])
}

function createSheetGeometry(deformation: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(0.62, 0.018, 0.46, 8, 1, 6)
  const position = geometry.attributes.position

  // La "deformación" del ítem modula la ondulación de la lámina.
  const amplitude = 0.5 + deformation

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)

    const curve =
      Math.sin(x * 4) * 0.045 * amplitude +
      Math.cos(z * 5) * 0.03 * amplitude +
      Math.sin((x + z) * 7) * 0.015 * amplitude

    position.setY(i, position.getY(i) + curve)
  }

  geometry.computeVertexNormals()
  return geometry
}

function createBlobGeometry(deformation: number): THREE.BufferGeometry {
  // Subdivisión 2 (320 tris) en vez de 3: misma lectura de "grumo" con menos coste
  // y facetas más marcadas.
  return deformGeometry(
    new THREE.IcosahedronGeometry(0.3, 2),
    0.35 + deformation * 0.85,
    5,
  )
}

function createShardGeometry(
  rng: Rng,
  deformation: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.18, 0.62, 7, 1)
  const position = geometry.attributes.position

  // Irregularidad dirigida por la deformación del ítem (antes era fija).
  const spread = 0.12 + deformation * 0.55

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)

    const irregularity = 1 - spread + rng.next() * spread * 2
    position.setX(i, x * irregularity)
    position.setZ(i, z * irregularity)
  }

  geometry.computeVertexNormals()
  return geometry
}

function createBarGeometry(deformation: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(0.16, 0.16, 0.82, 2, 2, 6)
  return deformGeometry(geometry, deformation * 0.9, 6)
}

/** Semilla estable por id: la geometría de un ítem no depende del orden de aparición. */
function idSeed(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function createCloudObject(rng: Rng): {
  object: THREE.Group
  geometry: THREE.BufferGeometry
} {
  const group = new THREE.Group()
  const count = 26

  const geometry = new THREE.IcosahedronGeometry(0.045, 1)

  for (let i = 0; i < count; i++) {
    const particle = new THREE.Mesh(geometry)
    particle.position.set(
      rng.range(-0.275, 0.275),
      rng.range(-0.225, 0.225),
      rng.range(-0.275, 0.275),
    )

    const particleScale = 0.45 + rng.next() * 1.1
    particle.scale.setScalar(particleScale)

    particle.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
    )

    group.add(particle)
  }

  return { object: group, geometry }
}

type ShapeFactory = (rng: Rng, deformation: number) => THREE.BufferGeometry

const SHAPE_FACTORIES: Record<DebrisShape, ShapeFactory> = {
  bottle: (_rng, d) => deformGeometry(createBottleGeometry(), d * 0.4, 6),
  drum: (_rng, d) => deformGeometry(createDrumGeometry(), d * 0.45, 4),
  sheet: (_rng, d) => createSheetGeometry(d),
  blob: (_rng, d) => createBlobGeometry(d),
  ring: (_rng, d) =>
    deformGeometry(new THREE.TorusGeometry(0.28, 0.085, 14, 32), d * 0.55, 6),
  shard: (rng, d) => createShardGeometry(rng, d),
  // La nube varía por instancia (partículas); la deformación ajusta el grano base.
  cloud: (_rng, d) => new THREE.IcosahedronGeometry(0.035 + d * 0.02, 1),
  bar: (_rng, d) => createBarGeometry(d),
}

// Caché de geometrías por id de ítem: cada desecho tiene su propia silueta.
// (Antes la clave era `shape`, así que los 6 barriles o los 14 blob compartían
// exactamente la misma malla y solo se distinguían por color.)
const geometries = new Map<string, THREE.BufferGeometry>()
const materials = new Map<string, THREE.Material>()
const warned = new Set<string>()

// Visual / material

function getVisual(id: string): DebrisVisual {
  const visual = DEBRIS_VISUALS[id]

  if (visual) return visual

  if (!warned.has(id)) {
    warned.add(id)
    console.warn(`[Debris] Sin aspecto visual para "${id}"`)
  }

  return FALLBACK_VISUAL
}

function getGeometry(id: string, visual: DebrisVisual): THREE.BufferGeometry {
  let geometry = geometries.get(id)

  if (!geometry) {
    const deformation = visual.deformation ?? 0.5
    geometry = SHAPE_FACTORIES[visual.shape](new Rng(idSeed(id)), deformation)
    geometries.set(id, geometry)
  }

  return geometry
}

function getMaterial(
  id: string,
  visual: DebrisVisual,
  leaking: boolean,
): THREE.Material {
  const cached = materials.get(id)
  if (cached) return cached

  const opacity = visual.opacity ?? 1
  const weathering = visual.weathering ?? 0
  const biofouling = visual.biofouling ?? 0
  const rust = visual.rust ?? 0
  const wetness = visual.wetness ?? 0

  const roughness = THREE.MathUtils.clamp(
    (visual.roughness ?? 0.6) + weathering * 0.18 + biofouling * 0.12,
    0.02,
    1,
  )

  const metalness = THREE.MathUtils.clamp(
    (visual.metalness ?? 0) * (1 - rust * 0.35),
    0,
    1,
  )

  const material = new THREE.MeshPhysicalMaterial({
    color: visual.color,
    roughness,
    metalness,
    transparent: opacity < 1 || (visual.transmission ?? 0) > 0,
    opacity,
    wireframe: visual.wireframe ?? false,
    side: THREE.DoubleSide,

    transmission: visual.transmission ?? 0,
    ior: visual.ior ?? 1.45,
    thickness: visual.thickness ?? 0.2,
    clearcoat: Math.max(visual.clearcoat ?? 0, wetness * 0.6),
    clearcoatRoughness: visual.clearcoatRoughness ?? 0.25,

    emissive: visual.emissive ?? 0x000000,
    emissiveIntensity:
      visual.emissive !== undefined ? (visual.glow ?? 0.3) * GLOW_GAIN : 0,
  })

  applyRim(material)

  if (leaking) {
    registerPulse(material, material.emissiveIntensity)
  }

  material.userData.baseColor = material.color.clone()

  materials.set(id, material)
  return material
}

// Principal

export class Debris {
  public static pickDefinition(biome: BiomeKey, rng: Rng): OceanDebrisType {
    // Reparto ponderado: los tipos comunes llenan el bioma y los raros
    // (trampas, fugas) aparecen de verdad como excepción.
    return rng.pickWeighted(BIOME_DEBRIS[biome], (item) => item.weight ?? 1)
  }

  /** Fábrica del microfragmento que sueltan las trampas y desechos frágiles. */
  public static createFragment(
    position: THREE.Vector3,
    rng: Rng,
    bounds: WorldBounds,
  ): Debris {
    return new Debris(position, MICROFRAGMENT, rng, bounds, true)
  }

  public object: THREE.Object3D
  public readonly ecoValue: number
  public readonly pollution: number
  /** Entrada del catálogo: da acceso a `name`/`description` para el registro. */
  public readonly definition: OceanDebrisType
  /** Movimiento antes de tocarlo (eje A); `null` = inerte. */
  public readonly motion: DebrisMotion | null
  /** Consecuencia al tocarlo (eje B). */
  public readonly hazard: DebrisHazard | null
  /**
   * `true` en los microfragmentos que sueltan trampas y desechos frágiles: no
   * cuentan para el objetivo de la zona ni aparecen en el registro de desechos.
   */
  public readonly isFragment: boolean

  public removed = false
  public claimed = false
  public pullArrived = false
  /** Marcado por `shatter()`: tocado en boost siendo frágil (no da eco). */
  public shattered = false

  private readonly minY: number
  private readonly maxY: number
  private baseX: number
  private baseY: number
  private baseZ: number
  private phase: number
  private baseScale = new THREE.Vector3()
  private pullTarget: THREE.Vector3 | null = null
  private cloudMaterial: THREE.Material | null = null
  private cloudGeometry: THREE.BufferGeometry | null = null

  constructor(
    position: THREE.Vector3,
    definition: OceanDebrisType,
    rng: Rng,
    bounds: WorldBounds,
    isFragment = false,
  ) {
    this.ecoValue = Math.round(
      ECO_BASE + definition.toxicityImpact * ECO_PER_TOXICITY,
    )
    this.pollution = definition.toxicityImpact
    this.definition = definition
    this.motion = definition.motion ?? null
    this.hazard = definition.hazard ?? null
    this.isFragment = isFragment
    this.minY = bounds.minY
    this.maxY = bounds.maxY

    const visual = getVisual(definition.id)

    if (visual.shape === "cloud") {
      const cloud = createCloudObject(rng)
      this.object = cloud.object
      this.cloudGeometry = cloud.geometry
      this.cloudMaterial = this.applyCloudMaterial(
        this.object,
        visual,
        definition.hazard === "lixivia",
      )
    } else {
      const geometry = getGeometry(definition.id, visual)
      const material = getMaterial(
        definition.id,
        visual,
        definition.hazard === "lixivia",
      )

      const mesh = new THREE.Mesh(geometry, material)
      this.object = mesh
    }

    this.object.position.copy(position)

    // Escala no uniforme: rompe la silueta entre instancias del mismo tipo.
    const variance = rng.range(0.85, 1.18)
    this.baseScale
      .set(
        variance * rng.range(0.9, 1.12),
        variance * rng.range(0.85, 1.15),
        variance * rng.range(0.9, 1.12),
      )
      .multiplyScalar(visual.scale ?? 1)

    this.object.scale.copy(this.baseScale)

    this.baseY = position.y
    this.baseX = position.x
    this.baseZ = position.z
    this.phase = rng.range(0, Math.PI * 2)

    this.object.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
    )

    // Un desecho "reposa" no debe caer en escena: nace ya en el borde inferior.
    if (this.motion === "reposa") {
      this.baseY = this.minY
      this.object.position.y = this.minY
    }
  }

  public get mesh(): THREE.Object3D {
    return this.object
  }

  /** Separa el desecho del color del agua del bioma actual (contra el camuflaje). */
  public adaptToWater(waterColor: THREE.Color): void {
    if (this.object instanceof THREE.Mesh) {
      const material = this.object.material
      if (Array.isArray(material)) {
        material.forEach((m) =>
          adaptMaterialToWater(m as ColorMaterial, waterColor),
        )
      } else {
        adaptMaterialToWater(material as ColorMaterial, waterColor)
      }
      return
    }

    if (this.cloudMaterial) {
      adaptMaterialToWater(this.cloudMaterial as ColorMaterial, waterColor)
    }
  }

  public pull(target: THREE.Vector3): void {
    this.claimed = true
    this.pullTarget = target.clone()
  }

  /** Marca el desecho como fragmentado (tocado en boost siendo frágil). */
  public shatter(): void {
    this.shattered = true
  }

  /** Altura de flotación inerte: bob suave alrededor de la posición de origen. */
  private bobY(time: number): number {
    return (
      this.baseY +
      Math.sin(time * 1.4 + this.phase) * 0.28 +
      Math.cos(time * 0.6 + this.phase) * 0.05
    )
  }

  public animate(time: number, deltaTime: number): void {
    if (this.pullTarget) {
      pullDelta.copy(this.pullTarget).sub(this.object.position)

      const distance = pullDelta.length()
      const step = PULL_SPEED * deltaTime

      if (distance <= Math.max(step, 0.4)) {
        this.pullArrived = true
        return
      }

      this.object.position.addScaledVector(pullDelta, step / distance)
      this.object.rotation.y += 4 * deltaTime

      const shrink = THREE.MathUtils.clamp(distance / 3, 0.25, 1)
      this.object.scale.copy(this.baseScale).multiplyScalar(shrink)

      return
    }

    this.object.rotation.y += 0.55 * deltaTime
    this.object.rotation.x += 0.18 * deltaTime
    this.object.rotation.z +=
      Math.sin(time * 0.7 + this.phase) * 0.12 * deltaTime

    switch (this.motion) {
      case "deriva":
        // Se desplaza en horizontal con la corriente y mantiene el bob.
        this.object.position.x =
          this.baseX + Math.sin(time * DRIFT_SPEED + this.phase) * DRIFT_RANGE
        this.object.position.z =
          this.baseZ +
          Math.cos(time * DRIFT_SPEED * 0.8 + this.phase * 1.4) * DRIFT_RANGE
        this.object.position.y = this.bobY(time)
        break

      case "hunde":
        this.object.position.y = Math.max(
          this.minY,
          this.object.position.y - VERTICAL_SPEED * deltaTime,
        )
        break

      case "flota":
        this.object.position.y = Math.min(
          this.maxY,
          this.object.position.y + VERTICAL_SPEED * deltaTime,
        )
        break

      case "reposa":
        this.object.position.y = this.minY
        break

      default:
        this.object.position.y = this.bobY(time)
    }
  }

  /** Libera los recursos propios de la instancia (nube). Las geometrías y materiales normales son compartidos. */
  public dispose(): void {
    if (this.cloudGeometry) {
      this.cloudGeometry.dispose()
      this.cloudGeometry = null
    }

    if (this.cloudMaterial) {
      this.cloudMaterial.dispose()
      this.cloudMaterial = null
    }
  }

  /** Deshace una reclamación (p. ej. si la estructura que lo reclamó desaparece). */
  public release(): void {
    this.claimed = false
    this.pullTarget = null
    this.pullArrived = false
  }

  /** Asigna un material compartido a todos los hijos de la nube. */
  private applyCloudMaterial(
    group: THREE.Object3D,
    visual: DebrisVisual,
    leaking: boolean,
  ): THREE.Material {
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      transparent: true,
      opacity: visual.opacity ?? 0.6,
      roughness: 0.9,
      metalness: visual.metalness ?? 0,
      emissive: visual.emissive ?? 0x000000,
      emissiveIntensity:
        visual.emissive !== undefined ? (visual.glow ?? 0.3) * GLOW_GAIN : 0,
    })

    applyRim(material)

    if (leaking) {
      registerPulse(material, material.emissiveIntensity)
    }

    material.userData.baseColor = material.color.clone()

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material
      }
    })

    return material
  }
}
