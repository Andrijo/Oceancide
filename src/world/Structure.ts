// src/world/Structure.ts

import * as THREE from "three"
import type { Debris } from "@entities/Debris"
import type { StructureConfig } from "./StructureConfig"

/** Una estructura colocada en el agua: aspecto, usos restantes y desechos en camino. */
export class Structure {
  public readonly config: StructureConfig
  public readonly group = new THREE.Group()
  public remaining: number
  public timer = 0
  public inFlight: Debris[] = []

  private core: THREE.Mesh
  private coreMaterial: THREE.MeshStandardMaterial
  private rings: THREE.Mesh[] = []
  private ringGeometry: THREE.TorusGeometry
  private ringMaterial: THREE.MeshBasicMaterial
  private areaGeometry: THREE.SphereGeometry
  private areaMaterial: THREE.MeshBasicMaterial
  private phase: number

  // Animación de aparición
  private spawnTime = 0
  private readonly spawnDuration = 0.3

  // Pulso de absorción (decae exponencialmente)
  private absorbPulse = 0

  constructor(config: StructureConfig, position: THREE.Vector3, phase: number) {
    this.config = config
    this.remaining = config.capacity
    this.group.position.copy(position)
    this.phase = phase

    // Empieza pequeño, la animación de spawn lo lleva a 1
    this.group.scale.setScalar(0.1)

    this.coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a3a40,
      emissive: config.color,
      emissiveIntensity: 1,
      roughness: 0.5,
      flatShading: true,
    })
    this.core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 1.6, 6),
      this.coreMaterial,
    )
    this.group.add(this.core)

    this.ringMaterial = new THREE.MeshBasicMaterial({ color: config.color })
    this.ringGeometry = new THREE.TorusGeometry(0.95, 0.07, 6, 16)
    for (const y of [-0.45, 0.45]) {
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      this.group.add(ring)
      this.rings.push(ring)
    }

    this.areaMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })
    this.areaGeometry = new THREE.SphereGeometry(config.radius, 14, 10)
    const area = new THREE.Mesh(this.areaGeometry, this.areaMaterial)
    this.group.add(area)
  }

  public get position(): THREE.Vector3 {
    return this.group.position
  }

  public isExhausted(): boolean {
    return this.remaining <= 0 && this.inFlight.length === 0
  }

  /** Pulso visual cuando absorbe un desecho. */
  public triggerAbsorb(): void {
    this.absorbPulse = 1
  }

  public update(time: number, deltaTime: number): void {
    // --- Animación de aparición ---
    let spawnFlash = 0
    if (this.spawnTime < this.spawnDuration) {
      this.spawnTime += deltaTime
      const t = Math.min(1, this.spawnTime / this.spawnDuration)
      const eased = 1 - Math.pow(1 - t, 3)
      this.group.scale.setScalar(0.1 + 0.9 * eased)
      spawnFlash = 1 - eased
    }

    // --- Decaimiento del pulso de absorción ---
    if (this.absorbPulse > 0) {
      this.absorbPulse *= Math.exp(-6 * deltaTime)
      if (this.absorbPulse < 0.01) this.absorbPulse = 0
    }

    // --- Flotación del núcleo ---
    this.core.position.y = Math.sin(time * 1.2 + this.phase) * 0.15

    // --- Giro de los anillos ---
    this.rings[0].rotation.z += 1.2 * deltaTime
    this.rings[1].rotation.z -= 1.8 * deltaTime

    // --- Escala de los anillos por pulso ---
    const ringScale = 1 + this.absorbPulse * 0.5
    this.rings[0].scale.setScalar(ringScale)
    this.rings[1].scale.setScalar(ringScale)

    // --- Emisivo: saturación + pulso + spawn + absorb ---
    const left = this.remaining / this.config.capacity
    const pulse = Math.sin(time * 4 + this.phase) * 0.15
    this.coreMaterial.emissiveIntensity =
      0.25 + 0.75 * left + pulse + spawnFlash * 3 + this.absorbPulse * 1.8
  }

  public dispose(): void {
    this.core.geometry.dispose()
    this.coreMaterial.dispose()
    this.ringGeometry.dispose()
    this.ringMaterial.dispose()
    this.areaGeometry.dispose()
    this.areaMaterial.dispose()
  }
}
