// src/Structure.ts

import * as THREE from "three"
import type { Debris } from "./Debris"
import type { StructureConfig } from "./StructureConfig"

/** Una estructura colocada en el agua: aspecto, usos restantes y desechos en camino. */
export class Structure {
  public readonly config: StructureConfig
  public readonly group = new THREE.Group()
  public remaining: number // desechos que aún puede reservar
  public timer = 0
  public inFlight: Debris[] = [] // desechos atraídos que aún no han llegado

  private core: THREE.Mesh
  private coreMaterial: THREE.MeshStandardMaterial
  private rings: THREE.Mesh[] = []
  private phase = Math.random() * Math.PI * 2

  constructor(config: StructureConfig, position: THREE.Vector3) {
    this.config = config
    this.remaining = config.capacity
    this.group.position.copy(position)

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

    const ringMaterial = new THREE.MeshBasicMaterial({ color: config.color })
    const ringGeometry = new THREE.TorusGeometry(0.95, 0.07, 6, 16)
    for (const y of [-0.45, 0.45]) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      this.group.add(ring)
      this.rings.push(ring)
    }

    // Esfera tenue que muestra el alcance
    const area = new THREE.Mesh(
      new THREE.SphereGeometry(config.radius, 14, 10),
      new THREE.MeshBasicMaterial({
        color: config.color,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    )
    this.group.add(area)
  }

  public get position(): THREE.Vector3 {
    return this.group.position
  }

  /** Sin usos y sin desechos en camino: ya se puede retirar. */
  public isExhausted(): boolean {
    return this.remaining <= 0 && this.inFlight.length === 0
  }

  public update(time: number, deltaTime: number): void {
    this.core.position.y = Math.sin(time * 1.2 + this.phase) * 0.15
    this.rings[0].rotation.z += 1.2 * deltaTime
    this.rings[1].rotation.z -= 1.8 * deltaTime

    // Brilla menos a medida que se va saturando
    const left = this.remaining / this.config.capacity
    const pulse = Math.sin(time * 4 + this.phase) * 0.15
    this.coreMaterial.emissiveIntensity = 0.25 + 0.75 * left + pulse
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
  }
}
