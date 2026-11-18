import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { Creature, CreatureContext, CreatureEffects } from "./Creature"
import { addFresnelRim } from "./fresnelRim"
import { edgeAvoidance, turnToward } from "./steering"

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

  private readonly body: THREE.Mesh
  private readonly lure: THREE.Mesh
  private readonly bodyGeometry: THREE.SphereGeometry
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly stalkGeometry: THREE.CylinderGeometry
  private readonly lureGeometry: THREE.SphereGeometry
  private readonly lureMaterial: THREE.MeshStandardMaterial
  private readonly finGeometry: THREE.ConeGeometry
  private readonly tail: THREE.Mesh

  private readonly pull = new THREE.Vector3()
  private readonly phase: number
  private heading: number
  private cooldown = 0
  private luring = false

  constructor(position: THREE.Vector3, rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)

    this.mesh.name = "lanternfish"
    this.mesh.userData.kind = "lanternfish"
    this.mesh.position.copy(position)
    this.mesh.scale.setScalar(rng.range(0.9, 1.15))

    this.bodyGeometry = new THREE.SphereGeometry(0.6, 14, 10)
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x22283a,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0x3a4f9a,
      emissiveIntensity: 0.25,
    })
    addFresnelRim(this.bodyMaterial, 0.6, 2.5)
    this.body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial)
    this.body.scale.set(0.8, 0.85, 1.25)
    this.mesh.add(this.body)

    this.finGeometry = new THREE.ConeGeometry(0.35, 0.6, 6)
    this.tail = new THREE.Mesh(this.finGeometry, this.bodyMaterial)
    this.tail.rotation.x = -Math.PI / 2
    this.tail.position.z = -0.85
    this.mesh.add(this.tail)

    // Antena que sale de la frente y se curva hacia delante.
    this.stalkGeometry = new THREE.CylinderGeometry(0.02, 0.035, 0.9, 5)
    const stalk = new THREE.Mesh(this.stalkGeometry, this.bodyMaterial)
    stalk.position.set(0, 0.6, 0.45)
    stalk.rotation.x = 0.7
    this.mesh.add(stalk)

    this.lureGeometry = new THREE.SphereGeometry(0.16, 10, 8)
    this.lureMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff3b0,
      emissive: 0xffe066,
      emissiveIntensity: LURE_GLOW,
      roughness: 0.3,
    })
    this.lure = new THREE.Mesh(this.lureGeometry, this.lureMaterial)
    this.lure.position.set(0, 0.95, 0.85)
    this.mesh.add(this.lure)
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

    this.mesh.rotation.y = this.heading
    this.tail.rotation.y = Math.sin(time * 5 + this.phase) * 0.35
    const glowTarget = this.cooldown > 0 ? DIM_GLOW : LURE_GLOW
    const blend = 1 - Math.exp(-4 * deltaTime)
    this.lureMaterial.emissiveIntensity +=
      (glowTarget - this.lureMaterial.emissiveIntensity) * blend
    this.lure.scale.setScalar(1 + Math.sin(time * 3 + this.phase) * 0.12)

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
    this.bodyGeometry.dispose()
    this.bodyMaterial.dispose()
    this.stalkGeometry.dispose()
    this.lureGeometry.dispose()
    this.lureMaterial.dispose()
    this.finGeometry.dispose()
  }
}
