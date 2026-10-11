// src/Debris.ts
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { BIOME_DEBRIS, type OceanDebrisType } from "./debrisCatalog"
import {
  DEBRIS_VISUALS,
  FALLBACK_VISUAL,
  type DebrisShape,
  type DebrisVisual,
} from "./DebrisVisuals"
import type { BiomeKey } from "@core/types"
import { Rng } from "@core/rng"

const ECO_BASE = 5
const ECO_PER_TOXICITY = 25
const PULL_SPEED = 6

const pullDelta = new THREE.Vector3()

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

function createSheetGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(0.62, 0.018, 0.46, 8, 1, 6)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)

    const curve =
      Math.sin(x * 4) * 0.045 +
      Math.cos(z * 5) * 0.03 +
      Math.sin((x + z) * 7) * 0.015

    position.setY(i, position.getY(i) + curve)
  }

  geometry.computeVertexNormals()
  return geometry
}

function createBlobGeometry(): THREE.BufferGeometry {
  return deformGeometry(new THREE.IcosahedronGeometry(0.3, 3), 0.85, 5)
}

function createShardGeometry(rng: Rng): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(0.18, 0.62, 7, 1)
  const position = geometry.attributes.position

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)

    const irregularity = 0.78 + rng.next() * 0.45
    position.setX(i, x * irregularity)
    position.setZ(i, z * irregularity)
  }

  geometry.computeVertexNormals()
  return geometry
}

function createBarGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(0.16, 0.16, 0.82, 2, 2, 6)
  return deformGeometry(geometry, 0.18, 6)
}

function createCloudObject(rng: Rng): THREE.Object3D {
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

  return group
}

type ShapeFactory = (rng: Rng) => THREE.BufferGeometry

const SHAPE_FACTORIES: Record<DebrisShape, ShapeFactory> = {
  bottle: () => createBottleGeometry(),
  drum: () => createDrumGeometry(),
  sheet: () => createSheetGeometry(),
  blob: () => createBlobGeometry(),
  ring: () => new THREE.TorusGeometry(0.28, 0.085, 14, 32),
  shard: (rng) => createShardGeometry(rng),
  cloud: () => new THREE.IcosahedronGeometry(0.35, 1),
  bar: () => createBarGeometry(),
}

const geometries = new Map<DebrisShape, THREE.BufferGeometry>()
const materials = new Map<string, THREE.Material>()
const warned = new Set<string>()

// Rng fijo para geometrías que lo requieren (shard). La forma base es
// siempre la misma; cada instancia varía por escala/rotación/posición.
const FIXED_RNG = new Rng(0x9e3779b1)

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

function getGeometry(visual: DebrisVisual): THREE.BufferGeometry {
  let geometry = geometries.get(visual.shape)

  if (!geometry) {
    geometry = SHAPE_FACTORIES[visual.shape](FIXED_RNG)
    geometries.set(visual.shape, geometry)
  }

  return geometry
}

function getMaterial(id: string, visual: DebrisVisual): THREE.Material {
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
    emissiveIntensity: visual.emissive !== undefined ? (visual.glow ?? 0.3) : 0,
  })

  materials.set(id, material)
  return material
}

// Principal

export class Debris {
  public object: THREE.Object3D
  public readonly id: string
  public readonly name: string
  public readonly description: string
  public readonly ecoValue: number
  public readonly pollution: number

  public removed = false
  public claimed = false
  public pullArrived = false

  private baseY: number
  private phase: number
  private baseScale: number
  private pullTarget: THREE.Vector3 | null = null
  private cloudMaterial: THREE.Material | null = null

  constructor(position: THREE.Vector3, definition: OceanDebrisType, rng: Rng) {
    this.id = definition.id
    this.name = definition.name
    this.description = definition.description
    this.ecoValue = Math.round(
      ECO_BASE + definition.toxicityImpact * ECO_PER_TOXICITY,
    )
    this.pollution = definition.toxicityImpact

    const visual = getVisual(definition.id)

    if (visual.shape === "cloud") {
      this.object = createCloudObject(rng)
      this.cloudMaterial = this.applyCloudMaterial(this.object, visual)
    } else {
      const geometry = getGeometry(visual)
      const material = getMaterial(definition.id, visual)

      const mesh = new THREE.Mesh(geometry, material)
      this.object = mesh
    }

    this.object.position.copy(position)

    this.baseScale = (visual.scale ?? 1) * rng.range(0.85, 1.18)
    this.object.scale.setScalar(this.baseScale)

    this.baseY = position.y
    this.phase = rng.range(0, Math.PI * 2)

    this.object.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
    )
  }

  /** Asigna un material compartido a todos los hijos de la nube. */
  private applyCloudMaterial(
    group: THREE.Object3D,
    visual: DebrisVisual,
  ): THREE.Material {
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      transparent: true,
      opacity: visual.opacity ?? 0.6,
      roughness: 0.9,
      metalness: visual.metalness ?? 0,
      emissive: visual.emissive ?? 0x000000,
      emissiveIntensity:
        visual.emissive !== undefined ? (visual.glow ?? 0.3) : 0,
    })

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material
      }
    })

    return material
  }

  public get mesh(): THREE.Object3D {
    return this.object
  }

  public static pickDefinition(biome: BiomeKey, rng: Rng): OceanDebrisType {
    return rng.pick(BIOME_DEBRIS[biome])
  }

  public pull(target: THREE.Vector3): void {
    this.claimed = true
    this.pullTarget = target.clone()
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
      this.object.scale.setScalar(this.baseScale * shrink)

      return
    }

    this.object.rotation.y += 0.55 * deltaTime
    this.object.rotation.x += 0.18 * deltaTime
    this.object.rotation.z +=
      Math.sin(time * 0.7 + this.phase) * 0.12 * deltaTime

    this.object.position.y =
      this.baseY +
      Math.sin(time * 1.4 + this.phase) * 0.28 +
      Math.cos(time * 0.6 + this.phase) * 0.05
  }

  /** Libera el material de nube (si lo hay). Las geometrías y materiales normales son compartidos. */
  public dispose(): void {
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
}
