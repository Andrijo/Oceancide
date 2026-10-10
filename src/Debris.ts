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
import type { BiomeKey } from "./types"
import type { Rng } from "./rng"

const ECO_BASE = 5
const ECO_PER_TOXICITY = 25
const PULL_SPEED = 6 // unidades/s con las que un filtro atrae un desecho
const pullDelta = new THREE.Vector3()

// --- Generadores procedurales de alta definición ---

/** Genera una botella con cuerpo, hombros cónicos y cuello */
function createBottleGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12)
  body.translate(0, -0.05, 0)

  const shoulder = new THREE.ConeGeometry(0.12, 0.1, 12)
  shoulder.rotateX(Math.PI)
  shoulder.translate(0, 0.175, 0)

  const neck = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12)
  neck.translate(0, 0.28, 0)

  return mergeGeometries([body, shoulder, neck])
}

/** Genera un bidón/barril con anillos de relieve en los extremos y al centro */
function createDrumGeometry(): THREE.BufferGeometry {
  const body = new THREE.CylinderGeometry(0.26, 0.26, 0.55, 16)
  const ring1 = new THREE.TorusGeometry(0.27, 0.015, 8, 16)
  ring1.rotateX(Math.PI / 2)
  ring1.translate(0, 0.18, 0)

  const ring2 = ring1.clone()
  ring2.translate(0, -0.36, 0)

  const ring3 = ring1.clone()
  ring3.translate(0, -0.18, 0)

  return mergeGeometries([body, ring1, ring2, ring3])
}

/** Genera una masa orgánica o fragmento irregular aplicando deformación a los vértices */
function createDeformedBlobGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.3, 2)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    // Factor de deformación pseudoaleatorio basado en posición
    const factor =
      1 +
      Math.sin(x * 5) * 0.12 +
      Math.cos(y * 5) * 0.12 +
      Math.sin(z * 5) * 0.12
    pos.setXYZ(i, x * factor, y * factor, z * factor)
  }

  geo.computeVertexNormals()
  return geo
}

/** Genera un fragmento o cristal afilado con vértices perturbados */
function createShardGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.2, 0.6, 6)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    pos.setXYZ(
      i,
      x * (0.8 + Math.random() * 0.4),
      y,
      z * (0.8 + Math.random() * 0.4),
    )
  }

  geo.computeVertexNormals()
  return geo
}

/** Genera una lámina levemente curvada */
function createSheetGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(0.6, 0.02, 0.45, 4, 1, 4)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const curve = Math.sin(x * 3) * 0.05 + Math.cos(z * 3) * 0.05
    pos.setY(i, pos.getY(i) + curve)
  }

  geo.computeVertexNormals()
  return geo
}

const SHAPE_FACTORIES: Record<DebrisShape, () => THREE.BufferGeometry> = {
  bottle: createBottleGeometry,
  drum: createDrumGeometry,
  sheet: createSheetGeometry,
  blob: createDeformedBlobGeometry,
  ring: () => new THREE.TorusGeometry(0.28, 0.08, 12, 24),
  shard: createShardGeometry,
  cloud: () => new THREE.IcosahedronGeometry(0.35, 1),
  bar: () => new THREE.BoxGeometry(0.18, 0.18, 0.8),
}

const geometries = new Map<DebrisShape, THREE.BufferGeometry>()
const materials = new Map<string, THREE.Material>()
const warned = new Set<string>()

function getVisual(id: string): DebrisVisual {
  const visual = DEBRIS_VISUALS[id]
  if (visual) return visual
  if (!warned.has(id)) {
    warned.add(id)
    console.warn(`[Debris] Sin aspecto visual para "${id}" en debrisVisuals.ts`)
  }
  return FALLBACK_VISUAL
}

function getGeometry(shape: DebrisShape): THREE.BufferGeometry {
  let geometry = geometries.get(shape)
  if (!geometry) {
    geometry = SHAPE_FACTORIES[shape]()
    geometries.set(shape, geometry)
  }
  return geometry
}

function getMaterial(id: string, v: DebrisVisual): THREE.Material {
  let material = materials.get(id)
  if (!material) {
    const opacity = v.opacity ?? 1

    material = new THREE.MeshPhysicalMaterial({
      color: v.color,
      roughness: v.roughness ?? 0.5,
      metalness: v.metalness ?? 0,
      emissive: v.emissive ?? 0x000000,
      emissiveIntensity: v.emissive !== undefined ? (v.glow ?? 0.4) : 0,
      transparent: opacity < 1 || (v.transmission ?? 0) > 0,
      opacity,
      wireframe: v.wireframe ?? false,
      side: THREE.DoubleSide,

      // Propiedades físicas avanzadas
      transmission: v.transmission ?? 0,
      ior: v.ior ?? 1.5,
      clearcoat: v.clearcoat ?? 0,
      clearcoatRoughness: v.clearcoatRoughness ?? 0.1,
    })

    materials.set(id, material)
  }
  return material
}

export class Debris {
  public mesh: THREE.Mesh
  public readonly id: string
  public readonly name: string
  public readonly description: string
  public readonly ecoValue: number
  public readonly pollution: number

  private baseY: number
  private phase: number
  private baseScale: number

  public removed = false // ya fuera del agua (recogido o absorbido)
  public claimed = false // un filtro lo ha reservado
  public pullArrived = false // ha llegado al filtro que lo atrae
  private pullTarget: THREE.Vector3 | null = null

  constructor(position: THREE.Vector3, definition: OceanDebrisType, rng: Rng) {
    this.id = definition.id
    this.name = definition.name
    this.description = definition.description
    this.ecoValue = Math.round(
      ECO_BASE + definition.toxicityImpact * ECO_PER_TOXICITY,
    )
    this.pollution = definition.toxicityImpact

    const visual = getVisual(definition.id)
    this.mesh = new THREE.Mesh(
      getGeometry(visual.shape),
      getMaterial(definition.id, visual),
    )
    this.mesh.position.copy(position)
    this.baseScale = (visual.scale ?? 1) * rng.range(0.85, 1.15)
    this.mesh.scale.setScalar(this.baseScale)
    this.baseY = position.y
    this.phase = rng.range(0, Math.PI * 2)

    this.mesh.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
    )
  }

  public static pickDefinition(biome: BiomeKey, rng: Rng): OceanDebrisType {
    return rng.pick(BIOME_DEBRIS[biome])
  }

  /** Un filtro reserva este desecho: se desplaza hacia él hasta llegar. */
  public pull(target: THREE.Vector3): void {
    this.claimed = true
    this.pullTarget = target.clone()
  }

  public animate(time: number, deltaTime: number): void {
    if (this.pullTarget) {
      pullDelta.copy(this.pullTarget).sub(this.mesh.position)
      const dist = pullDelta.length()
      const step = PULL_SPEED * deltaTime
      if (dist <= Math.max(step, 0.4)) {
        this.pullArrived = true
        return
      }
      this.mesh.position.addScaledVector(pullDelta, step / dist)
      this.mesh.rotation.y += 4 * deltaTime
      this.mesh.scale.setScalar(
        this.baseScale * Math.min(1, Math.max(0.25, dist / 3)),
      )
      return
    }

    this.mesh.rotation.y += 0.6 * deltaTime
    this.mesh.rotation.x += 0.2 * deltaTime
    this.mesh.position.y = this.baseY + Math.sin(time * 1.5 + this.phase) * 0.3
  }
}
