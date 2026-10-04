// src/Debris.ts

import * as THREE from "three"
import { BIOME_DEBRIS, type OceanDebrisType } from "./debrisCatalog"
import {
  DEBRIS_VISUALS,
  FALLBACK_VISUAL,
  type DebrisShape,
  type DebrisVisual,
} from "./DebrisVisuals"
import type { BiomeKey } from "./types"

// Conversión de toxicityImpact (0..1) a los valores que usa el juego
const ECO_BASE = 5
const ECO_PER_TOXICITY = 25 // más tóxico = más Conciencia Ecológica
const TOXICITY_SCALE = 20 // 1.0 => 20 (equivale al antiguo "chemical")

const SHAPE_FACTORIES: Record<DebrisShape, () => THREE.BufferGeometry> = {
  bottle: () => new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8),
  drum: () => new THREE.CylinderGeometry(0.28, 0.28, 0.55, 10),
  sheet: () => new THREE.BoxGeometry(0.6, 0.05, 0.45),
  blob: () => new THREE.DodecahedronGeometry(0.3, 0),
  ring: () => new THREE.TorusGeometry(0.28, 0.1, 6, 12),
  shard: () => new THREE.ConeGeometry(0.2, 0.6, 5),
  cloud: () => new THREE.IcosahedronGeometry(0.35, 0),
  bar: () => new THREE.BoxGeometry(0.2, 0.2, 0.8),
}

// Caches compartidas: una geometría por forma, un material por tipo de desecho
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
    material = new THREE.MeshStandardMaterial({
      color: v.color,
      roughness: v.roughness ?? 0.7,
      metalness: v.metalness ?? 0,
      emissive: v.emissive ?? 0x000000,
      emissiveIntensity: v.emissive !== undefined ? (v.glow ?? 0.4) : 0,
      transparent: opacity < 1,
      opacity,
      wireframe: v.wireframe ?? false,
      flatShading: true,
      side: THREE.DoubleSide,
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
  public readonly toxicity: number

  private baseY: number
  private phase = Math.random() * Math.PI * 2

  constructor(position: THREE.Vector3, definition: OceanDebrisType) {
    this.id = definition.id
    this.name = definition.name
    this.description = definition.description
    this.ecoValue = Math.round(
      ECO_BASE + definition.toxicityImpact * ECO_PER_TOXICITY,
    )
    this.toxicity = definition.toxicityImpact * TOXICITY_SCALE

    const visual = getVisual(definition.id)
    this.mesh = new THREE.Mesh(
      getGeometry(visual.shape),
      getMaterial(definition.id, visual),
    )
    this.mesh.position.copy(position)
    this.mesh.scale.setScalar(
      (visual.scale ?? 1) * (0.85 + Math.random() * 0.3),
    )
    this.baseY = position.y

    this.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    )
  }

  /** Elige un desecho al azar de los definidos para el bioma. */
  public static pickDefinition(biome: BiomeKey): OceanDebrisType {
    const list = BIOME_DEBRIS[biome]
    return list[Math.floor(Math.random() * list.length)]
  }

  /** @param time segundos totales, @param deltaTime segundos del frame */
  public animate(time: number, deltaTime: number): void {
    this.mesh.rotation.y += 0.6 * deltaTime
    this.mesh.position.y = this.baseY + Math.sin(time * 1.5 + this.phase) * 0.3
  }
}
