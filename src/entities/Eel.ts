import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { Creature, CreatureContext, CreatureEffects } from "./Creature"
import { edgeAvoidance, turnToward } from "./steering"

const SEGMENTS = 11
const SEGMENT_SPACING = 0.42
const HEAD_RADIUS = 0.34

const PROWL_SPEED = 2.6
const PROWL_TURN = 0.7
const EDGE_MARGIN = 8

/** Distancia a la que nota a una tortuga que va con impulso. */
export const EEL_DETECT_RADIUS = 16
/** Segundos de aviso (se encara y brilla) antes de lanzarse. */
export const EEL_WINDUP = 0.8
export const EEL_CHARGE_SPEED = 21
const CHARGE_TIME = 1.1
const RECOVER_TIME = 2.8
const WINDUP_TURN = 6

const HIT_DISTANCE = 1.3
const HIT_TOXICITY = 22

const BASE_GLOW = 0.25
const CHARGE_GLOW = 2.4

export type EelState = "prowl" | "windup" | "charge" | "recover"

const scratch = new THREE.Vector3()

/**
 * Anguila del fondo. Ronda despacio y no hace daño mientras nada tranquila,
 * pero si la tortuga pasa cerca con el impulso o el dash se encara, brilla un
 * momento y se lanza en línea recta hacia donde estaba. La embestida sí
 * intoxica; esquivarla de lado o no ir con impulso cerca de ella la evita.
 */
export class Eel implements Creature {
  public readonly kind = "eel"
  public readonly mesh = new THREE.Group()

  private readonly segments: THREE.Mesh[] = []
  /** Posición de cada segmento en coordenadas del mundo. */
  private readonly trail: THREE.Vector3[] = []
  private readonly geometry: THREE.SphereGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly eyeMaterial: THREE.MeshBasicMaterial
  private readonly eyeGeometry: THREE.SphereGeometry

  private readonly chargeDirection = new THREE.Vector3()
  private readonly phase: number
  private heading: number
  private pitch = 0
  private stateTimer = 0
  private _state: EelState = "prowl"

  constructor(position: THREE.Vector3, rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)

    this.mesh.name = "eel"
    this.mesh.userData.kind = "eel"
    this.mesh.position.copy(position)

    this.geometry = new THREE.SphereGeometry(1, 10, 8)
    this.material = new THREE.MeshStandardMaterial({
      color: 0x2f4a3a,
      roughness: 0.55,
      metalness: 0.1,
      emissive: 0x7dff9b,
      emissiveIntensity: BASE_GLOW,
    })
    this.eyeGeometry = new THREE.SphereGeometry(0.07, 6, 4)
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9ff6b })

    for (let i = 0; i < SEGMENTS; i++) {
      const segment = new THREE.Mesh(this.geometry, this.material)
      const taper = 1 - (i / SEGMENTS) * 0.75
      segment.scale.set(
        HEAD_RADIUS * taper,
        HEAD_RADIUS * taper * 0.85,
        HEAD_RADIUS * taper * 1.5,
      )
      this.segments.push(segment)
      this.mesh.add(segment)
      this.trail.push(
        new THREE.Vector3(
          position.x - Math.sin(this.heading) * SEGMENT_SPACING * i,
          position.y,
          position.z - Math.cos(this.heading) * SEGMENT_SPACING * i,
        ),
      )
    }

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial)
      eye.position.set(side * 0.5, 0.35, 0.72)
      this.segments[0].add(eye)
      // Compensa la escala del segmento para que el ojo no se deforme.
      eye.scale.set(1 / HEAD_RADIUS, 1 / (HEAD_RADIUS * 0.85), 1 / 0.51)
    }

    // La cabeza se orienta con rumbo y cabeceo (el resto mira al anterior).
    this.segments[0].rotation.order = "YXZ"
    this.layoutBody()
  }

  public get state(): EelState {
    return this._state
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime, time, bounds, target } = ctx
    const head = this.mesh.position
    let effects: CreatureEffects | null = null

    this.stateTimer = Math.max(0, this.stateTimer - deltaTime)
    const toTarget = scratch.copy(target.position).sub(head)
    const distance = toTarget.length()

    switch (this._state) {
      case "prowl":
      case "recover": {
        if (this._state === "recover" && this.stateTimer === 0) {
          this._state = "prowl"
        }
        const wander =
          Math.sin(time * 0.45 + this.phase) +
          Math.sin(time * 0.9 + this.phase * 3) * 0.5
        this.heading += wander * PROWL_TURN * deltaTime
        const away = edgeAvoidance(head, bounds, EDGE_MARGIN)
        if (away !== null) {
          this.heading = turnToward(this.heading, away, 1.5 * deltaTime)
        }
        this.pitch = Math.sin(time * 0.3 + this.phase) * 0.25
        const marginY = Math.min(2, (bounds.maxY - bounds.minY) * 0.2)
        if (head.y > bounds.maxY - marginY) this.pitch = -0.4
        else if (head.y < bounds.minY + marginY) this.pitch = 0.4

        const speed =
          this._state === "recover" ? PROWL_SPEED * 0.5 : PROWL_SPEED
        this.swim(speed, deltaTime)

        if (
          this._state === "prowl" &&
          (target.boosting || target.dashing) &&
          distance < EEL_DETECT_RADIUS
        ) {
          this._state = "windup"
          this.stateTimer = EEL_WINDUP
          effects = { notice: "eel_charge" }
        }
        break
      }

      case "windup": {
        // Se encara con la tortuga sin moverse: es el aviso para esquivarla.
        const yaw = Math.atan2(toTarget.x, toTarget.z)
        this.heading = turnToward(this.heading, yaw, WINDUP_TURN * deltaTime)
        if (this.stateTimer === 0) {
          this._state = "charge"
          this.stateTimer = CHARGE_TIME
          if (distance > 0.001) this.chargeDirection.copy(toTarget).normalize()
          else this.chargeDirection.set(Math.sin(yaw), 0, Math.cos(yaw))
          this.heading = Math.atan2(
            this.chargeDirection.x,
            this.chargeDirection.z,
          )
          this.pitch = Math.asin(
            THREE.MathUtils.clamp(this.chargeDirection.y, -1, 1),
          )
        }
        break
      }

      case "charge": {
        head.addScaledVector(this.chargeDirection, EEL_CHARGE_SPEED * deltaTime)
        const outside =
          Math.abs(head.x) > bounds.halfSize - 1 ||
          Math.abs(head.z) > bounds.halfSize - 1 ||
          head.y < bounds.minY ||
          head.y > bounds.maxY
        if (distance < HIT_DISTANCE) {
          effects = {
            hit: {
              kind: "eel",
              toxicity: HIT_TOXICITY,
              slowDuration: 1.5,
              slowMultiplier: 0.4,
            },
          }
          this.startRecover()
        } else if (this.stateTimer === 0 || outside) {
          this.startRecover()
        }
        break
      }
    }

    this.updateGlow(deltaTime)
    this.layoutBody(time)
    return effects
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
    this.eyeGeometry.dispose()
    this.eyeMaterial.dispose()
  }

  private startRecover(): void {
    this._state = "recover"
    this.stateTimer = RECOVER_TIME
    this.pitch = 0
  }

  private swim(speed: number, deltaTime: number): void {
    const horizontal = Math.cos(this.pitch)
    this.mesh.position.x +=
      Math.sin(this.heading) * horizontal * speed * deltaTime
    this.mesh.position.z +=
      Math.cos(this.heading) * horizontal * speed * deltaTime
    this.mesh.position.y += Math.sin(this.pitch) * speed * deltaTime
  }

  private updateGlow(deltaTime: number): void {
    const target =
      this._state === "windup" || this._state === "charge"
        ? CHARGE_GLOW
        : BASE_GLOW
    const blend = 1 - Math.exp(-8 * deltaTime)
    this.material.emissiveIntensity +=
      (target - this.material.emissiveIntensity) * blend
  }

  /**
   * Cada segmento sigue al anterior a distancia fija (como una cadena), con
   * una ondulación lateral que recorre el cuerpo.
   */
  private layoutBody(time = 0): void {
    const head = this.mesh.position
    this.trail[0].copy(head)
    const undulation = this._state === "charge" ? 0.05 : 0.18

    for (let i = 1; i < SEGMENTS; i++) {
      const previous = this.trail[i - 1]
      const current = this.trail[i]
      scratch.copy(current).sub(previous)
      const length = scratch.length()
      if (length < 1e-4) {
        scratch.set(-Math.sin(this.heading), 0, -Math.cos(this.heading))
      } else {
        scratch.divideScalar(length)
      }
      current.copy(previous).addScaledVector(scratch, SEGMENT_SPACING)
    }

    const sideX = Math.cos(this.heading)
    const sideZ = -Math.sin(this.heading)
    for (let i = 0; i < SEGMENTS; i++) {
      const segment = this.segments[i]
      const wave =
        Math.sin(time * 6 - i * 0.7 + this.phase) * undulation * (i / SEGMENTS)
      segment.position
        .copy(this.trail[i])
        .sub(head)
        .add(scratch.set(sideX * wave, 0, sideZ * wave))
      const ahead = i === 0 ? null : this.trail[i - 1]
      if (ahead) segment.lookAt(ahead.x, ahead.y, ahead.z)
      else segment.rotation.set(-this.pitch, this.heading, 0)
    }
  }
}
