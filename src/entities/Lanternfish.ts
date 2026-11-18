import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { Creature, CreatureContext, CreatureEffects } from "./Creature"
import { animateLook, type CreatureLook } from "./fauna/look"
import { buildModel } from "./fauna/models"
import { angleDelta, edgeAvoidance, turnToward } from "./steering"

/** Radio en el que su luz arrastra a la tortuga. */
export const LURE_RADIUS = 10
/** Velocidad máxima (u/s) del arrastre, muy por debajo de la de la tortuga. */
export const LURE_MAX_PULL = 3.6
const HIT_DISTANCE = 1.5
const HIT_TOXICITY = 8
/** Segundos que pasa con la luz apagada tras morder. */
export const LURE_COOLDOWN = 5

const SWIM_SPEED = 1.1
const EDGE_MARGIN = 8
const LURE_GLOW = 2.6
const DIM_GLOW = 0.15

const scratch = new THREE.Vector3()

/**
 * Pez linterna. Flota despacio con un señuelo luminoso delante de la boca; si
 * la tortuga entra en su luz, la arrastra poco a poco hacia él (más cuanto más
 * cerca) y le da un mordisco tóxico si llega a tocarlo. Después apaga la luz
 * unos segundos. Se escapa nadando en contra, sin más.
 */
export class Lanternfish implements Creature {
  public readonly kind = "lanternfish"
  public readonly mesh = new THREE.Group()

  private readonly look: CreatureLook
  private readonly pull = new THREE.Vector3()
  private readonly phase: number
  private heading: number
  private lastHeading: number
  private cooldown = 0
  private luring = false

  constructor(position: THREE.Vector3, rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)
    this.lastHeading = this.heading

    this.mesh.name = "lanternfish"
    this.mesh.userData.kind = "lanternfish"
    this.mesh.position.copy(position)

    this.look = buildModel("lanternfish", rng)
    this.mesh.add(this.look.root)
  }

  public get coolingDown(): boolean {
    return this.cooldown > 0
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime, time, bounds, target } = ctx
    const position = this.mesh.position

    if (this.cooldown > 0)
      this.cooldown = Math.max(0, this.cooldown - deltaTime)

    const toTarget = scratch.copy(target.position).sub(position)
    const distance = toTarget.length()
    const inLight = this.cooldown === 0 && distance < LURE_RADIUS

    // Encara a la tortuga mientras la atrae; si no, vaga.
    if (inLight) {
      this.heading = turnToward(
        this.heading,
        Math.atan2(toTarget.x, toTarget.z),
        2 * deltaTime,
      )
    } else {
      this.heading += Math.sin(time * 0.35 + this.phase) * 0.5 * deltaTime
      const away = edgeAvoidance(position, bounds, EDGE_MARGIN)
      if (away !== null) {
        this.heading = turnToward(this.heading, away, 1.2 * deltaTime)
      }
      const speed = SWIM_SPEED
      position.x += Math.sin(this.heading) * speed * deltaTime
      position.z += Math.cos(this.heading) * speed * deltaTime
      position.y += Math.sin(time * 0.5 + this.phase) * 0.3 * deltaTime
    }

    this.look.root.rotation.y = this.heading
    const turn =
      deltaTime > 0 ? angleDelta(this.lastHeading, this.heading) / deltaTime : 0
    this.lastHeading = this.heading
    animateLook(this.look, {
      deltaTime,
      time,
      phase: this.phase,
      // Nada con más brío mientras te arrastra hacia su luz.
      effort: inLight ? 1.6 : 1,
      turn,
      mouth: inLight ? Math.min(1, 1.5 - distance / LURE_RADIUS) : 0,
    })
    const lureMaterial = this.look.lureMaterial
    if (lureMaterial) {
      const glowTarget = this.cooldown > 0 ? DIM_GLOW : LURE_GLOW
      const blend = 1 - Math.exp(-4 * deltaTime)
      lureMaterial.emissiveIntensity +=
        (glowTarget - lureMaterial.emissiveIntensity) * blend
    }

    if (!inLight) {
      this.luring = false
      return null
    }

    if (distance < HIT_DISTANCE) {
      this.cooldown = LURE_COOLDOWN
      this.luring = false
      return {
        hit: {
          kind: "lanternfish",
          toxicity: HIT_TOXICITY,
          slowDuration: 0,
          slowMultiplier: 1,
        },
      }
    }

    // Arrastre hacia el pez: más fuerte cerca, nulo en el borde de la luz.
    const strength = LURE_MAX_PULL * Math.sqrt(1 - distance / LURE_RADIUS)
    this.pull.copy(toTarget).multiplyScalar(-strength / distance)
    const effects: CreatureEffects = { pull: this.pull }
    if (!this.luring) effects.notice = "lantern_pull"
    this.luring = true
    return effects
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    this.look.dispose()
  }
}
