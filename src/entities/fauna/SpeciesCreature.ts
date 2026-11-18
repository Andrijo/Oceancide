import * as THREE from "three"
import type { Rng } from "@core/rng"
import type {
  Creature,
  CreatureContext,
  CreatureEffects,
  CreatureKind,
} from "../Creature"
import { CREATURE_NAMES } from "../Creature"
import { edgeAvoidance, turnToward } from "../steering"
import { animateLook, buildLook, type CreatureLook } from "./look"
import { SPECIES, type GenericKind, type SpeciesSpec } from "./species"

const EDGE_MARGIN = 8
const FLOOR_OFFSET = 0.7

const toTarget = new THREE.Vector3()

/**
 * Criatura montada a partir de su ficha (`SPECIES`): un aspecto hecho de
 * piezas, un estilo de movimiento y un comportamiento. Cada comportamiento es
 * una pequeña máquina de estados con su temporizador.
 */
export class SpeciesCreature implements Creature {
  public readonly kind: GenericKind
  public readonly mesh = new THREE.Group()

  private readonly spec: SpeciesSpec
  private readonly look: CreatureLook
  private readonly phase: number
  private heading: number
  private pitch = 0
  private speedFactor = 1

  /** Enfriamiento del golpe, del regalo o del robo. */
  private cooldown = 0
  /** Tiempo que le queda al estado activo (inflado, caza, tinta...). */
  private active = 0
  /** Progreso de la liberación (tortuga atrapada) o del canto. */
  private progress = 0
  private noticed = false
  private freed = false
  /** Rémora pegada a la tortuga. */
  private attached = false
  private readonly inkCloud: THREE.Mesh | null = null
  private readonly inkWorld = new THREE.Vector3()
  private readonly songRing: THREE.Mesh | null = null

  constructor(kind: GenericKind, position: THREE.Vector3, rng: Rng) {
    this.kind = kind
    this.spec = SPECIES[kind]
    this.phase = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)

    this.mesh.name = kind
    this.mesh.userData.kind = kind
    this.mesh.position.copy(position)

    this.look = buildLook(this.spec.look, rng)
    this.mesh.add(this.look.root)

    const behavior = this.spec.behavior
    if (behavior.type === "ink") {
      this.inkCloud = new THREE.Mesh(
        new THREE.SphereGeometry(behavior.cloud, 14, 10),
        new THREE.MeshBasicMaterial({
          color: 0x120f1f,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      )
      this.inkCloud.visible = false
      this.mesh.add(this.inkCloud)
    }
    if (behavior.type === "song") {
      this.songRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.08, 6, 48),
        new THREE.MeshBasicMaterial({
          color: 0x9fe6ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      )
      this.songRing.rotation.x = Math.PI / 2
      this.songRing.visible = false
      this.mesh.add(this.songRing)
    }
    if (behavior.type === "inflate" && this.look.spikes) {
      this.look.spikes.scale.setScalar(0.35)
    }
  }

  /** Para tests y HUD: estado activo (inflado, cazando, cantando...). */
  public get isActive(): boolean {
    return this.active > 0
  }

  public get isFreed(): boolean {
    return this.freed
  }

  public get isAttached(): boolean {
    return this.attached
  }

  public get coolingDown(): boolean {
    return this.cooldown > 0
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime } = ctx
    this.cooldown = Math.max(0, this.cooldown - deltaTime)
    this.active = Math.max(0, this.active - deltaTime)
    this.speedFactor = 1

    const effects = this.behave(ctx)
    this.move(ctx)
    this.animate(ctx)
    return effects
  }

  public onShieldUsed(): void {
    if (!this.attached) return
    this.attached = false
    const behavior = this.spec.behavior
    if (behavior.type === "boon") this.cooldown = behavior.cooldown
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    this.look.dispose()
    for (const extra of [this.inkCloud, this.songRing]) {
      if (!extra) continue
      extra.geometry.dispose()
      ;(extra.material as THREE.Material).dispose()
    }
  }

  // ------------------------------------------------------------ comportamiento

  private behave(ctx: CreatureContext): CreatureEffects | null {
    const { target, deltaTime } = ctx
    const position = this.mesh.position
    toTarget.copy(target.position).sub(position)
    const distance = toTarget.length()
    const behavior = this.spec.behavior
    const kind: CreatureKind = this.kind

    switch (behavior.type) {
      case "contact": {
        if (this.cooldown === 0 && distance < behavior.radius) {
          this.cooldown = behavior.cooldown
          return {
            hit: {
              kind,
              toxicity: behavior.toxicity,
              slowDuration: behavior.slow?.[0] ?? 0,
              slowMultiplier: behavior.slow?.[1] ?? 1,
            },
          }
        }
        return null
      }

      case "inflate": {
        let effects: CreatureEffects | null = null
        if (this.active === 0 && distance < behavior.trigger) {
          this.active = behavior.duration
          effects = { notice: "puffer_inflate" }
        }
        if (this.active > 0) {
          this.speedFactor = 0.2
          if (distance < behavior.aura) {
            effects = { ...effects, drain: behavior.drain }
          }
          if (this.cooldown === 0 && distance < 1.5) {
            this.cooldown = 2.5
            effects = {
              ...effects,
              hit: {
                kind,
                toxicity: behavior.toxicity,
                slowDuration: 0,
                slowMultiplier: 1,
              },
            }
          }
        }
        return effects
      }

      case "chase": {
        let effects: CreatureEffects | null = null
        if (
          this.active === 0 &&
          this.cooldown === 0 &&
          distance < behavior.detect
        ) {
          this.active = behavior.duration
          effects = {
            notice: behavior.ambush ? "angler_ambush" : "barracuda_chase",
          }
        }
        if (this.active > 0) {
          // Va directa a por la tortuga, en 3D.
          this.heading = turnToward(
            this.heading,
            Math.atan2(toTarget.x, toTarget.z),
            (behavior.ambush ? 8 : 3) * deltaTime,
          )
          this.pitch = Math.atan2(
            toTarget.y,
            Math.hypot(toTarget.x, toTarget.z),
          )
          this.speedFactor =
            behavior.speed / Math.max(0.1, this.spec.move.speed)
          if (distance < 1.4) {
            this.active = 0
            this.cooldown = behavior.rest
            return {
              ...effects,
              hit: {
                kind,
                toxicity: behavior.toxicity,
                slowDuration: 1,
                slowMultiplier: 0.6,
              },
            }
          }
          if (this.active <= deltaTime) this.cooldown = behavior.rest
        }
        return effects
      }

      case "steal": {
        let effects: CreatureEffects | null = null
        // Busca la esfera más cercana para robarle lo que atrae.
        const sphere = this.nearestSphere(ctx, 25)
        if (sphere) {
          this.heading = turnToward(
            this.heading,
            Math.atan2(sphere.x - position.x, sphere.z - position.z),
            1.2 * deltaTime,
          )
        }
        if (this.active === 0) {
          this.active = behavior.interval
          effects = {
            steal: { center: position.clone(), radius: behavior.radius },
          }
        }
        if (this.cooldown === 0 && distance < 1.6) {
          this.cooldown = 3
          effects = {
            ...effects,
            hit: {
              kind,
              toxicity: behavior.toxicity,
              slowDuration: 1,
              slowMultiplier: 0.7,
            },
          }
        }
        return effects
      }

      case "ink": {
        let effects: CreatureEffects | null = null
        const scared =
          (target.boosting || target.dashing) && distance < behavior.trigger
        if (this.cooldown === 0 && (scared || distance < 2)) {
          this.cooldown = behavior.cooldown
          this.active = behavior.duration
          this.inkWorld.copy(position)
          // Huye en dirección contraria a la tortuga.
          this.heading = Math.atan2(-toTarget.x, -toTarget.z)
          effects = { notice: "squid_ink" }
        }
        if (this.active > 0) {
          if (this.active > behavior.duration - 1) this.speedFactor = 4
          if (this.inkWorld.distanceTo(target.position) < behavior.cloud) {
            effects = { ...effects, drain: behavior.drain }
          }
        }
        return effects
      }

      case "boon": {
        if (this.attached) {
          // Pegada a la tortuga: la sigue de cerca bajo el caparazón.
          position.copy(target.position)
          position.y -= 0.55
          return null
        }
        if (this.cooldown > 0 || distance >= behavior.radius) return null
        this.cooldown = behavior.cooldown
        const name = CREATURE_NAMES[kind]
        if (behavior.effect === "heal") {
          return {
            heal: behavior.amount,
            notice: "friendly_help",
            message: `${name}: −${behavior.amount} toxicidad`,
          }
        }
        if (behavior.effect === "haste") {
          return {
            haste: { duration: 4, multiplier: behavior.amount },
            notice: "friendly_help",
            message: `${name}: ¡estela veloz!`,
          }
        }
        this.attached = true
        return {
          shield: true,
          notice: "friendly_help",
          message: `${name}: te protege del próximo golpe`,
        }
      }

      case "aura": {
        if (distance >= behavior.radius) {
          this.noticed = false
          return null
        }
        const effects: CreatureEffects = { radiusBoost: behavior.amount }
        if (!this.noticed) effects.notice = "manta_aura"
        this.noticed = true
        return effects
      }

      case "song": {
        this.progress += deltaTime
        if (this.progress >= behavior.period) {
          this.progress = 0
          this.active = behavior.length
        }
        if (this.active > 0 && distance < behavior.radius) {
          return { drain: -behavior.cleanse, notice: "whale_song" }
        }
        return null
      }

      case "rescue": {
        if (this.freed) return null
        let effects: CreatureEffects | null = null
        if (!this.noticed && distance < 9) {
          this.noticed = true
          effects = { notice: "rescue_net" }
        }
        if (distance < behavior.radius) {
          this.progress += deltaTime
        } else {
          this.progress = Math.max(0, this.progress - deltaTime * 0.5)
        }
        if (this.progress >= behavior.time) {
          this.freed = true
          if (this.look.net) this.look.net.visible = false
          return {
            eco: behavior.eco,
            heal: behavior.heal,
            message: `¡Tortuga liberada! +${behavior.eco} Eco`,
          }
        }
        return effects
      }

      case "graze": {
        if (this.active > 0) return null
        this.active = behavior.interval
        return {
          graze: { center: position.clone(), radius: behavior.radius, max: 1 },
        }
      }
    }
  }

  private nearestSphere(
    ctx: CreatureContext,
    range: number,
  ): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null
    let bestDistance = range
    for (const sphere of ctx.target.spheres ?? []) {
      const d = sphere.distanceTo(this.mesh.position)
      if (d < bestDistance) {
        bestDistance = d
        best = sphere
      }
    }
    return best
  }

  // ---------------------------------------------------------------- movimiento

  private move(ctx: CreatureContext): void {
    const { deltaTime, time, bounds } = ctx
    const position = this.mesh.position
    const move = this.spec.move
    if (this.attached) return

    // La tortuga liberada sube nadando hacia la superficie.
    if (this.freed) {
      position.y += 2.2 * deltaTime
      this.heading += 0.4 * deltaTime
      position.x += Math.sin(this.heading) * 1.5 * deltaTime
      position.z += Math.cos(this.heading) * 1.5 * deltaTime
      return
    }

    if (move.style === "still") {
      position.y += Math.sin(time * 0.8 + this.phase) * 0.05 * deltaTime
      return
    }

    const behavior = this.spec.behavior
    const hunting = behavior.type === "chase" && this.active > 0
    const ambushing = behavior.type === "chase" && behavior.ambush && !hunting

    if (!hunting) {
      this.heading += Math.sin(time * 0.4 + this.phase) * move.turn * deltaTime
      const away = edgeAvoidance(position, bounds, EDGE_MARGIN)
      if (away !== null) {
        this.heading = turnToward(this.heading, away, 1.5 * deltaTime)
      }
      this.pitch =
        move.style === "glide"
          ? Math.sin(time * 0.15 + this.phase) * 0.12
          : Math.sin(time * 0.3 + this.phase) * 0.2
      const marginY = Math.min(2, (bounds.maxY - bounds.minY) * 0.2)
      if (position.y > bounds.maxY - marginY) this.pitch = -0.4
      else if (position.y < bounds.minY + marginY) this.pitch = 0.4
    }

    const speed = move.speed * this.speedFactor * (ambushing ? 0.3 : 1)
    const horizontal = Math.cos(this.pitch)
    position.x += Math.sin(this.heading) * horizontal * speed * deltaTime
    position.z += Math.cos(this.heading) * horizontal * speed * deltaTime

    if (move.style === "floor" && !hunting) {
      // Pegada al fondo: baja poco a poco hasta él.
      const floor = bounds.minY + FLOOR_OFFSET
      position.y += (floor - position.y) * Math.min(1, 1.5 * deltaTime)
    } else {
      position.y += Math.sin(this.pitch) * speed * deltaTime
    }
  }

  private animate(ctx: CreatureContext): void {
    const { time, deltaTime } = ctx
    const look = this.look
    look.root.rotation.order = "YXZ"
    look.root.rotation.y = this.heading
    look.root.rotation.x = -this.pitch * 0.6
    animateLook(look, time, this.phase, Math.min(3, this.speedFactor))

    const behavior = this.spec.behavior
    const blend = 1 - Math.exp(-6 * deltaTime)

    if (behavior.type === "inflate") {
      const inflated = this.active > 0 ? 1.8 : 1
      const current = look.body.scale.x / this.spec.look.body[0]
      const next = current + (inflated - current) * blend
      const [w, h, l] = this.spec.look.body
      look.body.scale.set(w * next, h * next, l * next)
      look.spikes?.scale.setScalar(next > 1.2 ? next : 0.35)
    }

    if (look.lureMaterial) {
      const lit = behavior.type === "chase" && this.cooldown > 0 ? 0.2 : 2.4
      look.lureMaterial.emissiveIntensity +=
        (lit - look.lureMaterial.emissiveIntensity) * blend
    }

    if (this.inkCloud && behavior.type === "ink") {
      const visible = this.active > 0
      this.inkCloud.visible = visible
      if (visible) {
        const life = this.active / behavior.duration
        this.inkCloud.position.copy(this.inkWorld).sub(this.mesh.position)
        this.inkCloud.scale.setScalar(0.6 + (1 - life) * 0.6)
        ;(this.inkCloud.material as THREE.MeshBasicMaterial).opacity =
          0.55 * Math.min(1, life * 2)
      }
    }

    if (this.songRing && behavior.type === "song") {
      const singing = this.active > 0
      this.songRing.visible = singing
      const pulse = singing ? 1 - this.active / behavior.length : 0
      look.bodyMaterial.emissiveIntensity = singing
        ? 0.5 + Math.sin(time * 6) * 0.25
        : 0.12
      if (singing) {
        const ring = ((pulse * 3) % 1) * behavior.radius
        this.songRing.scale.setScalar(Math.max(0.1, ring))
        ;(this.songRing.material as THREE.MeshBasicMaterial).opacity =
          0.5 * (1 - ring / behavior.radius)
      }
    }

    if (behavior.type === "rescue" && look.net && !this.freed) {
      // La red tiembla mientras la tortuga la va soltando.
      const shake = (this.progress / behavior.time) * 0.15
      look.net.rotation.y = Math.sin(time * 30) * shake
      look.net.rotation.x = Math.cos(time * 27) * shake
    }
  }
}
