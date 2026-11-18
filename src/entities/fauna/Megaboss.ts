import * as THREE from "three"
import type { Rng } from "@core/rng"
import type {
  BossKind,
  BossStatus,
  Creature,
  CreatureContext,
  CreatureEffects,
  HostileKind,
} from "../Creature"
import { CREATURE_NAMES } from "../Creature"
import { angleDelta, edgeAvoidance, turnToward } from "../steering"
import { animateLook, type CreatureLook } from "./look"
import {
  leviathan,
  netKraken,
  scrapShark,
  type BossModel,
  type LeakAnchor,
} from "./models/bosses"
import { disposeTree } from "./models/kit"

export type BossAttack = "shockwave" | "charge" | "spawn"

export interface BossSpec {
  variant: "kraken" | "shark" | "serpent"
  color: number
  accent: number
  /** Fugas que hay que limpiar de su cuerpo. */
  nodes: number
  speed: number
  attacks: BossAttack[]
  minion: HostileKind
  /** Segundos entre ataques en la primera fase. */
  interval: number
}

export const BOSSES: Record<BossKind, BossSpec> = {
  netKraken: {
    variant: "kraken",
    color: 0x6d3b52,
    accent: 0x9e5a6e,
    nodes: 5,
    speed: 2.4,
    attacks: ["shockwave", "spawn"],
    minion: "jellyfish",
    interval: 6.5,
  },
  scrapShark: {
    variant: "shark",
    color: 0x5d6670,
    accent: 0xa0522d,
    nodes: 5,
    speed: 3.6,
    attacks: ["charge", "shockwave", "charge"],
    minion: "barracuda",
    interval: 5.5,
  },
  leviathan: {
    variant: "serpent",
    color: 0x2d3b2f,
    accent: 0x7a9a3a,
    nodes: 7,
    speed: 3,
    attacks: ["shockwave", "charge", "spawn"],
    minion: "eel",
    interval: 5,
  },
}

export const BOSS_NODE_RADIUS = 1.9
export const BOSS_NODE_ECO = 20
export const BOSS_DEFEAT_ECO = 150
const NODE_HEAL = 6
const DEFEAT_HEAL = 30
const BODY_TOXICITY = 16
const CHARGE_TOXICITY = 22
const BODY_COOLDOWN = 2
const TELEGRAPH = 1.1
const WAVE_SPEED = 11
const WAVE_MAX = 26
const WAVE_WIDTH = 1.4
const WAVE_HEIGHT = 3
const WAVE_TOXICITY = 14
const CHARGE_SPEED = 16
const CHARGE_TIME = 1.4
const MAX_MINIONS = 6
const NOTICE_RADIUS = 38
const EDGE_MARGIN = 14
const SERPENT_SEGMENTS = 16
const SERPENT_SPACING = 1.5

type Phase = "roam" | "telegraph" | "wave" | "charge"

const scratch = new THREE.Vector3()
const nodeWorld = new THREE.Vector3()

interface LeakNode {
  mesh: THREE.Mesh
  cleaned: boolean
}

/**
 * Megajefe de los biomas profundos: una criatura enorme contaminada con fugas
 * brillantes repartidas por el cuerpo. Tocar una fuga la limpia (da Eco y baja
 * la toxicidad); tocar el cuerpo intoxica. Cada tercio de fugas limpias pasa
 * de fase y ataca más a menudo: ondas de choque que hay que saltar (cambiar de
 * profundidad) o atravesar con dash, embestidas y crías. Con todas las fugas
 * limpias queda purificado y se marcha.
 */
export class Megaboss implements Creature {
  public readonly kind: BossKind
  public readonly mesh = new THREE.Group()

  private readonly spec: BossSpec
  /** Modelo del kraken y del tiburón (el leviatán va por segmentos). */
  private readonly look: CreatureLook | null = null
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly nodeMaterial: THREE.MeshStandardMaterial
  private readonly cleanMaterial: THREE.MeshStandardMaterial
  private readonly nodeGeometry = new THREE.IcosahedronGeometry(1, 1)
  private readonly nodes: LeakNode[] = []
  /** Centros del cuerpo que hacen daño al tocarlos, y su radio. */
  private readonly cores: { object: THREE.Object3D; radius: number }[] = []
  private readonly segments: THREE.Object3D[] = []
  private readonly serpentJaw: THREE.Group | null = null
  private readonly trail: THREE.Vector3[] = []
  private readonly wave: THREE.Mesh
  private readonly waveCenter = new THREE.Vector3()
  private readonly chargeDirection = new THREE.Vector3()

  private readonly phaseOffset: number
  private heading: number
  private lastHeading: number
  private state: Phase = "roam"
  private stateTimer = 0
  private attackTimer: number
  private attackIndex = 0
  private pendingAttack: BossAttack = "shockwave"
  private waveRadius = 0
  private waveHit = false
  private bodyCooldown = 0
  private minions = 0
  private noticed = false
  private defeated = false
  private readonly status: BossStatus

  constructor(kind: BossKind, position: THREE.Vector3, rng: Rng) {
    this.kind = kind
    this.spec = BOSSES[kind]
    this.phaseOffset = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)
    this.lastHeading = this.heading
    this.attackTimer = this.spec.interval
    this.status = { kind, cleaned: 0, total: this.spec.nodes, defeated: false }

    this.mesh.name = kind
    this.mesh.userData.kind = kind
    this.mesh.position.copy(position)

    // Fugas: lodo tóxico facetado que brilla; limpias, se vuelven agua clara.
    this.nodeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb6ff3a,
      emissive: 0x8cff1a,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      flatShading: true,
    })
    this.cleanMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fe6ff,
      emissive: 0x4fc3f7,
      emissiveIntensity: 0.6,
      flatShading: true,
    })

    let leaks: LeakAnchor[]
    if (this.spec.variant === "serpent") {
      const serpent = leviathan(SERPENT_SEGMENTS, this.spec.nodes)
      this.bodyMaterial = serpent.bodyMaterial
      this.serpentJaw = serpent.jaw
      serpent.segments.forEach((segment, i) => {
        this.mesh.add(segment)
        this.segments.push(segment)
        this.cores.push({ object: segment, radius: serpent.radii[i] })
        this.trail.push(
          position
            .clone()
            .add(
              new THREE.Vector3(
                -Math.sin(this.heading) * SERPENT_SPACING * i,
                0,
                -Math.cos(this.heading) * SERPENT_SPACING * i,
              ),
            ),
        )
      })
      leaks = serpent.leaks
    } else {
      const model: BossModel =
        this.spec.variant === "kraken"
          ? netKraken(rng, this.spec.nodes)
          : scrapShark(rng, this.spec.nodes)
      this.look = model.look
      this.bodyMaterial = model.look.bodyMaterial
      this.cores.push(...model.cores)
      this.mesh.add(model.look.root)
      leaks = model.leaks
    }
    for (const leak of leaks) this.addNode(leak.parent, leak.at)
    if (this.spec.variant === "serpent") this.layoutSerpent(0)

    this.wave = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 6, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc6ff4a,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    )
    this.wave.rotation.x = Math.PI / 2
    this.wave.visible = false
    this.mesh.add(this.wave)
  }

  public get isDefeated(): boolean {
    return this.defeated
  }

  public get currentState(): Phase {
    return this.state
  }

  /** Fase de combate: 0, 1 o 2 según el tercio de fugas limpias. */
  public get phase(): number {
    return Math.min(
      2,
      Math.floor((this.status.cleaned / this.status.total) * 3),
    )
  }

  /** Posiciones de las fugas pendientes (para tests y ayudas). */
  public pendingNodePositions(): THREE.Vector3[] {
    this.mesh.updateMatrixWorld(true)
    return this.nodes
      .filter((node) => !node.cleaned)
      .map((node) => node.mesh.getWorldPosition(new THREE.Vector3()))
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime, time, target } = ctx
    const position = this.mesh.position
    this.bodyCooldown = Math.max(0, this.bodyCooldown - deltaTime)
    this.stateTimer = Math.max(0, this.stateTimer - deltaTime)

    const effects: CreatureEffects = { boss: this.status }
    const distance = position.distanceTo(target.position)

    if (!this.noticed && distance < NOTICE_RADIUS) {
      this.noticed = true
      effects.notice = "boss_seen"
    }

    if (this.defeated) {
      // Purificado: se aleja despacio hacia arriba, ya inofensivo.
      position.y += 0.8 * deltaTime
      this.swim(this.spec.speed * 0.4, deltaTime, 0)
      this.animate(time, deltaTime)
      this.updateWave(deltaTime, ctx, effects)
      return effects
    }

    this.updateAttacks(ctx, effects, distance)
    this.updateWave(deltaTime, ctx, effects)
    this.animate(time, deltaTime)
    this.mesh.updateMatrixWorld(true)

    // --- Fugas: tocarlas las limpia ---
    for (const node of this.nodes) {
      if (node.cleaned) continue
      node.mesh.getWorldPosition(nodeWorld)
      if (nodeWorld.distanceTo(target.position) < BOSS_NODE_RADIUS) {
        this.cleanNode(node, effects)
        if (this.defeated) return effects
      }
    }

    // --- Cuerpo: tocarlo intoxica ---
    if (this.bodyCooldown === 0) {
      for (const core of this.cores) {
        core.object.getWorldPosition(scratch)
        if (scratch.distanceTo(target.position) < core.radius) {
          this.bodyCooldown = BODY_COOLDOWN
          effects.hit = {
            kind: this.kind,
            toxicity: this.state === "charge" ? CHARGE_TOXICITY : BODY_TOXICITY,
            slowDuration: 1.5,
            slowMultiplier: 0.5,
          }
          break
        }
      }
    }

    return effects
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    disposeTree(this.mesh)
    // Pueden no estar ya en ninguna malla (todas limpias / ninguna limpia).
    this.nodeMaterial.dispose()
    this.cleanMaterial.dispose()
    this.nodeGeometry.dispose()
  }

  // ------------------------------------------------------------------ combate

  private updateAttacks(
    ctx: CreatureContext,
    effects: CreatureEffects,
    distance: number,
  ): void {
    const { deltaTime, time, bounds, target } = ctx
    const position = this.mesh.position
    scratch.copy(target.position).sub(position)
    const towardTurtle = Math.atan2(scratch.x, scratch.z)

    switch (this.state) {
      case "roam": {
        // Ronda; si la tortuga se aleja mucho, va a buscarla.
        this.heading +=
          Math.sin(time * 0.3 + this.phaseOffset) * 0.4 * deltaTime
        if (distance > 18) {
          this.heading = turnToward(this.heading, towardTurtle, 0.5 * deltaTime)
        }
        const away = edgeAvoidance(position, bounds, EDGE_MARGIN)
        if (away !== null) {
          this.heading = turnToward(this.heading, away, 1.2 * deltaTime)
        }
        const dy = THREE.MathUtils.clamp(scratch.y, -1, 1) * 0.6
        this.swim(this.spec.speed * (1 + this.phase * 0.25), deltaTime, dy)

        // Solo ataca si la tortuga está en la pelea.
        if (distance < NOTICE_RADIUS) {
          this.attackTimer -= deltaTime
          if (this.attackTimer <= 0) {
            this.pendingAttack =
              this.spec.attacks[this.attackIndex % this.spec.attacks.length]
            this.attackIndex++
            this.state = "telegraph"
            this.stateTimer = TELEGRAPH
          }
        }
        break
      }

      case "telegraph": {
        this.heading = turnToward(this.heading, towardTurtle, 3 * deltaTime)
        if (this.stateTimer > 0) break
        this.attackTimer = this.spec.interval * (1 - this.phase * 0.2)
        if (this.pendingAttack === "shockwave") {
          this.state = "roam"
          this.waveCenter.copy(position)
          this.waveRadius = 0.5
          this.waveHit = false
          this.wave.visible = true
        } else if (this.pendingAttack === "charge") {
          this.state = "charge"
          this.stateTimer = CHARGE_TIME
          this.chargeDirection.copy(scratch).normalize()
          this.heading = Math.atan2(
            this.chargeDirection.x,
            this.chargeDirection.z,
          )
        } else {
          this.state = "roam"
          const count = Math.min(2, MAX_MINIONS - this.minions)
          if (count > 0) {
            this.minions += count
            effects.spawn = []
            for (let i = 0; i < count; i++) {
              const angle = this.heading + (i === 0 ? 1.4 : -1.4)
              effects.spawn.push({
                kind: this.spec.minion,
                position: position
                  .clone()
                  .add(
                    new THREE.Vector3(
                      Math.sin(angle) * 5,
                      0,
                      Math.cos(angle) * 5,
                    ),
                  ),
              })
            }
          }
        }
        break
      }

      case "charge": {
        position.addScaledVector(this.chargeDirection, CHARGE_SPEED * deltaTime)
        const outside =
          Math.abs(position.x) > bounds.halfSize - 4 ||
          Math.abs(position.z) > bounds.halfSize - 4
        if (this.stateTimer === 0 || outside) this.state = "roam"
        break
      }

      case "wave":
        this.state = "roam"
        break
    }
  }

  private updateWave(
    deltaTime: number,
    ctx: CreatureContext,
    effects: CreatureEffects,
  ): void {
    if (!this.wave.visible) return
    this.waveRadius += WAVE_SPEED * deltaTime
    if (this.waveRadius >= WAVE_MAX) {
      this.wave.visible = false
      return
    }
    this.wave.position.copy(this.waveCenter).sub(this.mesh.position)
    this.wave.scale.setScalar(this.waveRadius)
    ;(this.wave.material as THREE.MeshBasicMaterial).opacity =
      0.75 * (1 - this.waveRadius / WAVE_MAX)

    const { target } = ctx
    if (this.waveHit || this.defeated || target.dashing) return
    const dx = target.position.x - this.waveCenter.x
    const dz = target.position.z - this.waveCenter.z
    const ring = Math.abs(Math.hypot(dx, dz) - this.waveRadius)
    const dy = Math.abs(target.position.y - this.waveCenter.y)
    if (ring < WAVE_WIDTH && dy < WAVE_HEIGHT) {
      this.waveHit = true
      effects.hit = {
        kind: this.kind,
        toxicity: WAVE_TOXICITY,
        slowDuration: 1,
        slowMultiplier: 0.6,
      }
    }
  }

  private cleanNode(node: LeakNode, effects: CreatureEffects): void {
    node.cleaned = true
    node.mesh.material = this.cleanMaterial
    node.mesh.scale.multiplyScalar(0.6)
    this.status.cleaned++
    const name = CREATURE_NAMES[this.kind]

    if (this.status.cleaned >= this.status.total) {
      this.defeated = true
      this.status.defeated = true
      this.state = "roam"
      this.bodyMaterial.color.lerp(new THREE.Color(0x9fc9d8), 0.6)
      this.bodyMaterial.emissive.setHex(0x2a6f9a)
      this.bodyMaterial.emissiveIntensity = 0.4
      effects.eco = (effects.eco ?? 0) + BOSS_DEFEAT_ECO
      effects.heal = (effects.heal ?? 0) + DEFEAT_HEAL
      effects.message = `¡${name} purificado! +${BOSS_DEFEAT_ECO} Eco`
      return
    }

    effects.eco = (effects.eco ?? 0) + BOSS_NODE_ECO
    effects.heal = (effects.heal ?? 0) + NODE_HEAL
    effects.message = `Fuga limpiada ${this.status.cleaned}/${this.status.total} · +${BOSS_NODE_ECO} Eco`
  }

  // --------------------------------------------------------------- movimiento

  private swim(speed: number, deltaTime: number, dy: number): void {
    const position = this.mesh.position
    position.x += Math.sin(this.heading) * speed * deltaTime
    position.z += Math.cos(this.heading) * speed * deltaTime
    position.y += dy * deltaTime
  }

  private animate(time: number, deltaTime: number): void {
    const t = time + this.phaseOffset
    const flashing = this.state === "telegraph" && !this.defeated
    const glow = flashing
      ? 0.9 + Math.sin(t * 25) * 0.5
      : this.defeated
        ? 0.4
        : 0.25
    const blend = 1 - Math.exp(-10 * deltaTime)
    this.bodyMaterial.emissiveIntensity +=
      (glow - this.bodyMaterial.emissiveIntensity) * blend
    this.nodeMaterial.emissiveIntensity = 1.8 + Math.sin(t * 4) * 0.6

    // Abre la boca al avisar y al embestir.
    const attacking =
      !this.defeated && (this.state === "telegraph" || this.state === "charge")

    if (this.serpentJaw) {
      this.layoutSerpent(t)
      const open = attacking ? 0.6 : 0.08 + Math.sin(t * 1.3) * 0.04
      this.serpentJaw.rotation.x += (open - this.serpentJaw.rotation.x) * blend
      return
    }

    if (!this.look) return
    this.look.root.rotation.y = this.heading
    const turn =
      deltaTime > 0 ? angleDelta(this.lastHeading, this.heading) / deltaTime : 0
    this.lastHeading = this.heading
    animateLook(this.look, {
      deltaTime,
      time,
      phase: this.phaseOffset,
      effort: this.state === "charge" ? 3 : attacking ? 1.6 : 1,
      turn,
      mouth: attacking ? 1 : 0,
    })
  }

  // ------------------------------------------------------------------ aspecto

  private addNode(
    parent: THREE.Object3D,
    local: THREE.Vector3,
    size = 0.55,
  ): void {
    const mesh = new THREE.Mesh(this.nodeGeometry, this.nodeMaterial)
    mesh.position.copy(local)
    // Compensa la escala del padre para que todas las fugas midan lo mismo.
    const s = parent.scale
    mesh.scale.set(size / s.x, size / s.y, size / s.z)
    parent.add(mesh)
    this.nodes.push({ mesh, cleaned: false })
  }

  /** El leviatán es una cadena de segmentos que sigue a la cabeza. */
  private layoutSerpent(t: number): void {
    const head = this.mesh.position
    this.trail[0].copy(head)
    for (let i = 1; i < this.trail.length; i++) {
      const previous = this.trail[i - 1]
      const current = this.trail[i]
      scratch.copy(current).sub(previous)
      const length = scratch.length()
      if (length < 1e-4)
        scratch.set(-Math.sin(this.heading), 0, -Math.cos(this.heading))
      else scratch.divideScalar(length)
      current.copy(previous).addScaledVector(scratch, SERPENT_SPACING)
    }
    const sideX = Math.cos(this.heading)
    const sideZ = -Math.sin(this.heading)
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i]
      const wave =
        Math.sin(t * 2.5 - i * 0.5) * 0.4 * (i / this.segments.length)
      segment.position
        .copy(this.trail[i])
        .sub(head)
        .add(scratch.set(sideX * wave, 0, sideZ * wave))
      if (i === 0) {
        segment.rotation.set(0, this.heading, 0)
      } else {
        const ahead = this.trail[i - 1]
        segment.rotation.set(
          0,
          Math.atan2(ahead.x - this.trail[i].x, ahead.z - this.trail[i].z),
          0,
        )
      }
    }
  }
}
