import * as THREE from "three"
import type { Rng } from "@core/rng"

const DOME_RADIUS = 0.9
const TENTACLE_COUNT = 6
const TENTACLE_LENGTH = 1.8

const DOME_OPACITY = 0.6
const TENTACLE_OPACITY = 0.42
const HIT_DOME_OPACITY = 0.08
const HIT_TENTACLE_OPACITY = 0.05
const BASE_LIGHT_INTENSITY = 1.15

const HIT_COOLDOWN = 3

/**
 * Medusa errante. Flota con dos senos desfasados (Y y X/Z) y, al golpear,
 * se vuelve casi transparente durante su cooldown para comunicar que no puede
 * volver a hacer daño de inmediato.
 */
export class Jellyfish {
  public readonly mesh = new THREE.Group()

  private readonly dome: THREE.Mesh
  private readonly domeMaterial: THREE.MeshPhysicalMaterial
  private readonly tentacleMaterial: THREE.MeshBasicMaterial
  private readonly tentacles = new THREE.Group()
  private readonly light: THREE.PointLight

  private readonly basePosition = new THREE.Vector3()
  private readonly phase: number
  private readonly bobSpeed: number
  private readonly bobAmplitude: number
  private readonly driftSpeed: number
  private readonly driftRadius: number
  private readonly rotationSpeed: number

  private cooldown = 0
  private disposed = false

  constructor(position: THREE.Vector3, rng: Rng) {
    this.basePosition.copy(position)
    this.phase = rng.range(0, Math.PI * 2)
    this.bobSpeed = rng.range(0.7, 1.15)
    this.bobAmplitude = rng.range(0.35, 0.8)
    this.driftSpeed = rng.range(0.18, 0.34)
    this.driftRadius = rng.range(1.2, 2.8)
    this.rotationSpeed = rng.range(-0.25, 0.25)

    this.mesh.name = "jellyfish"
    this.mesh.position.copy(position)
    this.mesh.scale.setScalar(rng.range(0.8, 1.2))
    this.mesh.userData.kind = "jellyfish"

    const domeGeometry = new THREE.SphereGeometry(
      DOME_RADIUS,
      18,
      10,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    )
    this.domeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff5fd2,
      transparent: true,
      opacity: DOME_OPACITY,
      transmission: 0.55,
      thickness: 0.4,
      ior: 1.33,
      roughness: 0.2,
      metalness: 0,
      emissive: 0xff2bb5,
      emissiveIntensity: 0.7,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.dome = new THREE.Mesh(domeGeometry, this.domeMaterial)
    this.dome.scale.y = 0.8
    this.mesh.add(this.dome)

    const tentacleGeometry = new THREE.CylinderGeometry(
      0.025,
      0.055,
      TENTACLE_LENGTH,
      5,
      1,
      true,
    )
    this.tentacleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8fe0,
      transparent: true,
      opacity: TENTACLE_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    for (let i = 0; i < TENTACLE_COUNT; i++) {
      const angle = (i / TENTACLE_COUNT) * Math.PI * 2 + this.phase * 0.25
      const radius = DOME_RADIUS * 0.78
      const tentacle = new THREE.Mesh(tentacleGeometry, this.tentacleMaterial)
      tentacle.position.set(
        Math.cos(angle) * radius,
        -TENTACLE_LENGTH * 0.5 - 0.05,
        Math.sin(angle) * radius,
      )
      tentacle.rotation.z = Math.cos(angle) * 0.16
      tentacle.rotation.x = -Math.sin(angle) * 0.16
      this.tentacles.add(tentacle)
    }
    this.mesh.add(this.tentacles)

    this.light = new THREE.PointLight(0xff5fd2, BASE_LIGHT_INTENSITY, 10, 2)
    this.light.position.y = 0.4
    this.mesh.add(this.light)
  }

  public get coolingDown(): boolean {
    return this.cooldown > 0
  }

  public update(time: number, deltaTime: number): void {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - deltaTime)
      if (this.cooldown === 0) this.restoreVisuals()
    }

    const t = time + this.phase

    this.mesh.position.x =
      this.basePosition.x + Math.sin(t * this.driftSpeed) * this.driftRadius
    this.mesh.position.z =
      this.basePosition.z +
      Math.cos(t * this.driftSpeed * 1.3) * this.driftRadius
    this.mesh.position.y =
      this.basePosition.y + Math.sin(t * this.bobSpeed) * this.bobAmplitude

    const pulse = 1 + Math.sin(t * 1.7) * 0.05
    this.dome.scale.set(pulse, 0.8 * pulse, pulse)
    this.mesh.rotation.y += this.rotationSpeed * deltaTime
    this.tentacles.rotation.y = Math.sin(t * 0.6) * 0.12
  }

  public hit(): void {
    this.cooldown = HIT_COOLDOWN
    this.domeMaterial.opacity = HIT_DOME_OPACITY
    this.tentacleMaterial.opacity = HIT_TENTACLE_OPACITY
    this.light.intensity = 0.15
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.mesh.removeFromParent()
    this.dome.geometry.dispose()
    this.domeMaterial.dispose()
    this.tentacleMaterial.dispose()

    // Todas las medusas comparten la geometría de los tentáculos dentro de esta
    // instancia; se libera una sola vez.
    const tentacle = this.tentacles.children[0] as THREE.Mesh | undefined
    tentacle?.geometry.dispose()
  }

  private restoreVisuals(): void {
    this.domeMaterial.opacity = DOME_OPACITY
    this.tentacleMaterial.opacity = TENTACLE_OPACITY
    this.light.intensity = BASE_LIGHT_INTENSITY
  }
}
