// src/Debris.ts

import * as THREE from "three"

export type DebrisType = "plastic" | "metal" | "chemical" | "organic"

interface DebrisConfig {
  ecoValue: number
  toxicity: number
  weight: number // probabilidad relativa de aparecer
  createGeometry: () => THREE.BufferGeometry
  createMaterial: () => THREE.Material
}

const CONFIGS: Record<DebrisType, DebrisConfig> = {
  plastic: {
    ecoValue: 10,
    toxicity: 5,
    weight: 0.4,
    createGeometry: () => new THREE.BoxGeometry(0.3, 0.1, 0.5),
    createMaterial: () =>
      new THREE.MeshStandardMaterial({
        color: 0xff6b6b,
        roughness: 0.6,
        transparent: true,
        opacity: 0.9,
      }),
  },
  metal: {
    ecoValue: 15,
    toxicity: 8,
    weight: 0.3,
    createGeometry: () => new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8),
    createMaterial: () =>
      new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.3,
        metalness: 0.8,
      }),
  },
  chemical: {
    ecoValue: 25,
    toxicity: 20,
    weight: 0.2,
    createGeometry: () => new THREE.SphereGeometry(0.25, 8, 8),
    createMaterial: () =>
      new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        roughness: 0.4,
        transparent: true,
        opacity: 0.7,
        emissive: 0x00ff88,
        emissiveIntensity: 0.3,
      }),
  },
  organic: {
    ecoValue: 5,
    toxicity: 2,
    weight: 0.1,
    createGeometry: () => new THREE.DodecahedronGeometry(0.3, 0),
    createMaterial: () =>
      new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }),
  },
}

// Geometrías y materiales compartidos por tipo (se crean una sola vez)
const shared = new Map<
  DebrisType,
  { geometry: THREE.BufferGeometry; material: THREE.Material }
>()

function getShared(type: DebrisType) {
  let entry = shared.get(type)
  if (!entry) {
    entry = {
      geometry: CONFIGS[type].createGeometry(),
      material: CONFIGS[type].createMaterial(),
    }
    shared.set(type, entry)
  }
  return entry
}

export class Debris {
  public mesh: THREE.Mesh
  public readonly type: DebrisType
  public readonly ecoValue: number
  public readonly toxicity: number

  private baseY: number
  private phase = Math.random() * Math.PI * 2

  constructor(position: THREE.Vector3, type: DebrisType = Debris.randomType()) {
    this.type = type
    this.ecoValue = CONFIGS[type].ecoValue
    this.toxicity = CONFIGS[type].toxicity

    const { geometry, material } = getShared(type)
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.copy(position)
    this.baseY = position.y

    this.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    )
  }

  public static randomType(): DebrisType {
    let r = Math.random()
    for (const type of Object.keys(CONFIGS) as DebrisType[]) {
      r -= CONFIGS[type].weight
      if (r <= 0) return type
    }
    return "organic"
  }

  /** @param time segundos totales, @param deltaTime segundos del frame */
  public animate(time: number, deltaTime: number): void {
    this.mesh.rotation.y += 0.6 * deltaTime
    this.mesh.position.y = this.baseY + Math.sin(time * 1.5 + this.phase) * 0.3
  }

  public getType(): DebrisType {
    return this.type
  }
}
