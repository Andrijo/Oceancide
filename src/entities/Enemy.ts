import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { WorldBounds } from "@core/types"
import { addFresnelRim } from "./fresnelRim"

const DOME_RADIUS = 0.9
const TENTACLE_COUNT = 6
const TENTACLE_LENGTH = 1.8

const DOME_OPACITY = 0.6
const TENTACLE_OPACITY = 0.42
const HIT_DOME_OPACITY = 0.08
const HIT_TENTACLE_OPACITY = 0.05
const BASE_EMISSIVE = 1.1
const HIT_EMISSIVE = 0.15

const HIT_COOLDOWN = 3

// Nado a pulsos: la campana se contrae (impulso) y luego se relaja planeando.
const CONTRACT_FRACTION = 0.3 // parte del ciclo en la que empuja
const DRAG = 0.9 // freno del agua (1/s): entre pulsos casi se detiene
const SINK = 0.12 // u/s² que cae cuando no empuja
const CLIMB_BIAS = 0.22 // inclinación media hacia arriba para compensar la caída
const WANDER_TURN = 0.55 // rad/s máximos de cambio de rumbo al vagar
const EDGE_MARGIN = 6 // distancia al borde a la que empieza a dar la vuelta
const EDGE_TURN = 1.6 // rad/s con los que se aleja del borde
const LEAN = 0.32 // rad de inclinación por u/s de velocidad horizontal
const MAX_LEAN = 0.5
const SQUASH = 0.18 // cuánto se estrecha la campana al contraerse
const TENTACLE_SPREAD = 0.16 // apertura de los tentáculos en reposo

/** Diferencia angular más corta entre dos rumbos, en -PI..PI. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/**
 * Medusa errante. Nada a pulsos como una medusa real: contrae la campana para
 * impulsarse en la dirección de su rumbo y luego planea mientras se relaja, con
 * los tentáculos estirándose detrás. El rumbo vaga solo y se aparta de los
 * bordes del bioma. Al golpear se vuelve casi transparente durante su cooldown
 * para comunicar que no puede volver a hacer daño de inmediato.
 */
export class Jellyfish {
  public readonly mesh = new THREE.Group()

  private readonly dome: THREE.Mesh
  private readonly domeMaterial: THREE.MeshStandardMaterial
  private readonly tentacleMaterial: THREE.MeshBasicMaterial
  private readonly tentacles = new THREE.Group()

  private readonly velocity = new THREE.Vector3()
  private readonly phase: number
  /** Duración de un ciclo contracción + relajación (s). */
  private readonly pulsePeriod: number
  /** Aceleración del impulso (u/s²). */
  private readonly thrust: number
  private readonly wanderSpeed: number
  private readonly rotationSpeed: number
  /** Rumbo horizontal (rad) hacia el que empuja cada pulso. */
  private heading: number

  private cooldown = 0
  private disposed = false

  constructor(position: THREE.Vector3, rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.pulsePeriod = rng.range(1.7, 2.6)
    this.thrust = rng.range(3.2, 4.6)
    this.wanderSpeed = rng.range(0.22, 0.4)
    this.heading = rng.range(0, Math.PI * 2)
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
    // Sin `transmission` (render pass extra) ni luz propia (el número de
    // luces cambiaría con cada medusa y recompilaría todos los shaders): la
    // gelatina luminosa sale del emisivo + borde fresnel + bloom.
    this.domeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5fd2,
      transparent: true,
      opacity: DOME_OPACITY,
      roughness: 0.2,
      metalness: 0,
      emissive: 0xff2bb5,
      emissiveIntensity: BASE_EMISSIVE,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    addFresnelRim(this.domeMaterial, 0.8, 2)
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
      tentacle.rotation.z = Math.cos(angle) * TENTACLE_SPREAD
      tentacle.rotation.x = -Math.sin(angle) * TENTACLE_SPREAD
      tentacle.userData.angle = angle
      this.tentacles.add(tentacle)
    }
    this.mesh.add(this.tentacles)
  }

  public get coolingDown(): boolean {
    return this.cooldown > 0
  }

  public update(time: number, deltaTime: number, bounds?: WorldBounds): void {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - deltaTime)
      if (this.cooldown === 0) this.restoreVisuals()
    }

    const t = time + this.phase
    const position = this.mesh.position

    // --- Pulso: 0..1..0 durante la contracción, 0 mientras se relaja ---
    const cycle = (((t / this.pulsePeriod) % 1) + 1) % 1
    const push =
      cycle < CONTRACT_FRACTION
        ? Math.sin((cycle / CONTRACT_FRACTION) * Math.PI)
        : 0
    // Relajación 0..1: la campana se reabre con un pequeño rebote.
    const relax =
      cycle < CONTRACT_FRACTION
        ? 0
        : (cycle - CONTRACT_FRACTION) / (1 - CONTRACT_FRACTION)

    // --- Rumbo: vaga con dos senos y se aparta de los bordes ---
    const wander =
      (Math.sin(t * this.wanderSpeed) +
        Math.sin(t * this.wanderSpeed * 2.3 + this.phase * 2)) *
      0.5
    this.heading += wander * WANDER_TURN * deltaTime

    let pitch = CLIMB_BIAS + Math.sin(t * this.wanderSpeed * 0.8) * 0.5

    if (bounds) {
      const edge = bounds.halfSize - EDGE_MARGIN
      if (Math.abs(position.x) > edge || Math.abs(position.z) > edge) {
        const toCenter = Math.atan2(-position.x, -position.z)
        const turn = angleDelta(this.heading, toCenter)
        const maxTurn = EDGE_TURN * deltaTime
        this.heading += THREE.MathUtils.clamp(turn, -maxTurn, maxTurn)
      }

      const marginY = Math.min(2, (bounds.maxY - bounds.minY) * 0.2)
      if (position.y > bounds.maxY - marginY) pitch = -0.5
      else if (position.y < bounds.minY + marginY) pitch = 0.7
    }

    // --- Impulso, freno del agua y caída lenta ---
    const horizontal = Math.cos(pitch)
    const accel = this.thrust * push * deltaTime
    this.velocity.x += Math.sin(this.heading) * horizontal * accel
    this.velocity.z += Math.cos(this.heading) * horizontal * accel
    this.velocity.y += Math.sin(pitch) * accel - SINK * deltaTime
    this.velocity.multiplyScalar(Math.exp(-DRAG * deltaTime))

    position.addScaledVector(this.velocity, deltaTime)

    // --- Campana: se estrecha y alarga al empujar, rebota al relajarse ---
    const rebound = Math.sin(relax * Math.PI) * 0.06
    const width = 1 - SQUASH * push + rebound
    this.dome.scale.set(width, 0.8 * (1 + 0.14 * push - rebound * 0.5), width)

    // La medusa se inclina hacia donde avanza (suavizado para no dar tirones).
    const blend = 1 - Math.exp(-3 * deltaTime)
    const leanX = THREE.MathUtils.clamp(
      this.velocity.z * LEAN,
      -MAX_LEAN,
      MAX_LEAN,
    )
    const leanZ = THREE.MathUtils.clamp(
      -this.velocity.x * LEAN,
      -MAX_LEAN,
      MAX_LEAN,
    )
    this.mesh.rotation.x += (leanX - this.mesh.rotation.x) * blend
    this.mesh.rotation.z += (leanZ - this.mesh.rotation.z) * blend

    // --- Tentáculos: se recogen y estiran con el impulso y ondean después ---
    this.tentacles.rotation.y += this.rotationSpeed * deltaTime
    this.tentacles.scale.set(width, 1 + 0.2 * push - 0.08 * rebound, width)

    const spread = TENTACLE_SPREAD * (1 - 0.7 * push) + rebound * 1.2
    for (const tentacle of this.tentacles.children) {
      const angle = tentacle.userData.angle as number
      const sway = Math.sin(t * 2.1 + angle * 2) * 0.09
      tentacle.rotation.z = Math.cos(angle) * spread + sway
      tentacle.rotation.x = -Math.sin(angle) * spread + sway * 0.6
    }
  }

  public hit(): void {
    this.cooldown = HIT_COOLDOWN
    this.domeMaterial.opacity = HIT_DOME_OPACITY
    this.tentacleMaterial.opacity = HIT_TENTACLE_OPACITY
    this.domeMaterial.emissiveIntensity = HIT_EMISSIVE
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
    this.domeMaterial.emissiveIntensity = BASE_EMISSIVE
  }
}
