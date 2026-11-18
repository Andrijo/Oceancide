import * as THREE from "three"
import { Rng } from "@core/rng"
import type { BiomeKey, WorldBounds } from "@core/types"
import type {
  BossStatus,
  Creature,
  CreatureEffects,
  CreatureHit,
  CreatureKind,
  CreatureNotice,
  CreatureTarget,
} from "@entities/Creature"
import { isBossKind } from "@entities/Creature"
import { Jellyfish } from "@entities/Enemy"
import { Eel } from "@entities/Eel"
import { FishSchool } from "@entities/FishSchool"
import { Lanternfish } from "@entities/Lanternfish"
import { Megaboss } from "@entities/fauna/Megaboss"
import { SpeciesCreature } from "@entities/fauna/SpeciesCreature"
import { faunaFor } from "./fauna"

const SPAWN_MARGIN = 6
const SPAWN_ATTEMPTS = 12
const CENTER_CLEARANCE = 10
/** Los jefes aparecen lejos de la tortuga para que dé tiempo a verlos llegar. */
const BOSS_CLEARANCE = 30
/**
 * Distancia a la que la tortuga "ve" una criatura y la registra en el códice.
 * Los megajefes, enormes, se ven desde más lejos.
 */
const SIGHT_RADIUS = 12
const BOSS_SIGHT_RADIUS = 24

function createCreature(
  kind: CreatureKind,
  position: THREE.Vector3,
  rng: Rng,
): Creature {
  switch (kind) {
    case "jellyfish":
      return new Jellyfish(position, rng)
    case "fishSchool":
      return new FishSchool(position, rng)
    case "lanternfish":
      return new Lanternfish(position, rng)
    case "eel":
      return new Eel(position, rng)
    case "netKraken":
    case "scrapShark":
    case "leviathan":
      return new Megaboss(kind, position, rng)
    default:
      return new SpeciesCreature(kind, position, rng)
  }
}

type Scatter = NonNullable<CreatureEffects["scatter"]>
type Graze = NonNullable<CreatureEffects["graze"]>
type Steal = NonNullable<CreatureEffects["steal"]>

/** Lo que la fauna le hizo al mundo en un frame, ya combinado. */
export interface FaunaFrame {
  /** Golpe más fuerte que recibió la tortuga, o `null`. */
  hit: CreatureHit | null
  /** Suma de los arrastres sobre la tortuga (u/s). */
  pull: THREE.Vector3
  scatters: Scatter[]
  grazes: Graze[]
  steals: Steal[]
  notices: CreatureNotice[]
  messages: string[]
  /** Toxicidad por segundo sumada (negativa: limpia). */
  drain: number
  heal: number
  eco: number
  shield: boolean
  haste: { duration: number; multiplier: number } | null
  /** Mayor multiplicador del radio de recogida (1 sin efecto). */
  radiusBoost: number
  /** Megajefe del bioma, si lo hay. */
  boss: BossStatus | null
  /** Especies que la tortuga tiene cerca este frame (sin repetir). */
  sighted: CreatureKind[]
}

/**
 * Gestiona la fauna del bioma: medusas, las criaturas propias de cada
 * profundidad, la fauna amiga y los megajefes (ver `faunaFor`).
 *
 * `spawn` limpia la generación anterior para que el cambio de bioma no deje
 * criaturas huérfanas en la escena.
 */
export class EnemyManager {
  private readonly creatures: Creature[] = []
  private readonly scene: THREE.Scene
  private rng = new Rng(1)
  private readonly frame: FaunaFrame = {
    hit: null,
    pull: new THREE.Vector3(),
    scatters: [],
    grazes: [],
    steals: [],
    notices: [],
    messages: [],
    drain: 0,
    heal: 0,
    eco: 0,
    shield: false,
    haste: null,
    radiusBoost: 1,
    boss: null,
    sighted: [],
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public clear(): void {
    for (const creature of this.creatures) {
      creature.dispose()
    }
    this.creatures.length = 0
  }

  /**
   * Genera la fauna de un bioma. `hostileCount` es cuánta fauna peligrosa
   * lleva; sin bioma, todas son medusas.
   */
  public spawn(
    hostileCount: number,
    bounds: WorldBounds,
    rng: Rng,
    biome: BiomeKey = "epipelagic_upper",
  ): void {
    this.spawnKinds(faunaFor(biome, hostileCount), bounds, rng)
  }

  public spawnKinds(
    kinds: readonly CreatureKind[],
    bounds: WorldBounds,
    rng: Rng,
  ): void {
    this.clear()
    this.rng = rng

    const marginXZ = Math.min(SPAWN_MARGIN, Math.max(0, bounds.halfSize - 1))
    const marginY = Math.min(1, Math.max(0, (bounds.maxY - bounds.minY) * 0.1))

    for (const kind of kinds) {
      const clearance = isBossKind(kind) ? BOSS_CLEARANCE : CENTER_CLEARANCE
      const position = this.findSpawnPosition(
        bounds,
        rng,
        marginXZ,
        marginY,
        clearance,
      )
      this.add(createCreature(kind, position, rng))
    }
  }

  /**
   * Mueve toda la fauna y devuelve lo que le ha hecho a la tortuga y al bioma
   * en este frame. El objeto devuelto se reutiliza entre llamadas.
   */
  public update(
    deltaTime: number,
    time: number,
    target: CreatureTarget,
    bounds: WorldBounds,
  ): FaunaFrame {
    const frame = this.frame
    frame.hit = null
    frame.pull.set(0, 0, 0)
    frame.scatters.length = 0
    frame.grazes.length = 0
    frame.steals.length = 0
    frame.notices.length = 0
    frame.messages.length = 0
    frame.drain = 0
    frame.heal = 0
    frame.eco = 0
    frame.shield = false
    frame.haste = null
    frame.radiusBoost = 1
    frame.boss = null
    frame.sighted.length = 0

    const ctx = { deltaTime, time, bounds, target }
    // Las crías se añaden al acabar, para no recorrerlas en este frame.
    const spawned: Creature[] = []

    for (const creature of this.creatures) {
      const effects = creature.update(ctx)

      const position = creature.mesh.position
      position.x = THREE.MathUtils.clamp(
        position.x,
        -bounds.halfSize,
        bounds.halfSize,
      )
      position.y = THREE.MathUtils.clamp(position.y, bounds.minY, bounds.maxY)
      position.z = THREE.MathUtils.clamp(
        position.z,
        -bounds.halfSize,
        bounds.halfSize,
      )

      const sight = isBossKind(creature.kind) ? BOSS_SIGHT_RADIUS : SIGHT_RADIUS
      if (
        !frame.sighted.includes(creature.kind) &&
        position.distanceToSquared(target.position) <= sight * sight
      ) {
        frame.sighted.push(creature.kind)
      }

      if (!effects) continue
      if (
        effects.hit &&
        (!frame.hit || effects.hit.toxicity > frame.hit.toxicity)
      ) {
        frame.hit = effects.hit
      }
      if (effects.pull) frame.pull.add(effects.pull)
      if (effects.scatter) frame.scatters.push(effects.scatter)
      if (effects.graze) frame.grazes.push(effects.graze)
      if (effects.steal) frame.steals.push(effects.steal)
      if (effects.notice) frame.notices.push(effects.notice)
      if (effects.message) frame.messages.push(effects.message)
      if (effects.drain) frame.drain += effects.drain
      if (effects.heal) frame.heal += effects.heal
      if (effects.eco) frame.eco += effects.eco
      if (effects.shield) frame.shield = true
      if (
        effects.haste &&
        (!frame.haste || effects.haste.multiplier > frame.haste.multiplier)
      ) {
        frame.haste = effects.haste
      }
      if (effects.radiusBoost) {
        frame.radiusBoost = Math.max(frame.radiusBoost, effects.radiusBoost)
      }
      if (effects.boss) frame.boss = effects.boss
      for (const spawn of effects.spawn ?? []) {
        spawned.push(createCreature(spawn.kind, spawn.position, this.rng))
      }
    }

    for (const creature of spawned) this.add(creature)
    return frame
  }

  /** El escudo de la tortuga absorbió un golpe: la rémora se suelta. */
  public onShieldUsed(): void {
    for (const creature of this.creatures) creature.onShieldUsed?.()
  }

  public getCount(): number {
    return this.creatures.length
  }

  public getKinds(): CreatureKind[] {
    return this.creatures.map((creature) => creature.kind)
  }

  /** Para tests: la criatura en una posición de la lista. */
  public getCreature(index: number): Creature | undefined {
    return this.creatures[index]
  }

  private add(creature: Creature): void {
    this.creatures.push(creature)
    this.scene.add(creature.mesh)
  }

  private findSpawnPosition(
    bounds: WorldBounds,
    rng: Rng,
    marginXZ: number,
    marginY: number,
    clearance: number,
  ): THREE.Vector3 {
    const minX = -bounds.halfSize + marginXZ
    const maxX = bounds.halfSize - marginXZ
    const minY = bounds.minY + marginY
    const maxY = bounds.maxY - marginY
    const centerY = (bounds.minY + bounds.maxY) / 2
    const reach = Math.min(clearance, maxX * 0.9)

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const x = rng.range(minX, maxX)
      const z = rng.range(minX, maxX)

      if (Math.hypot(x, z) >= reach) {
        return new THREE.Vector3(x, rng.range(minY, maxY), z)
      }
    }

    // Fallback: una esquina lejos del centro, siempre dentro de los bounds.
    return new THREE.Vector3(maxX, centerY, maxX)
  }
}
