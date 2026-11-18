import type * as THREE from "three"
import type { WorldBounds } from "@core/types"

export const HOSTILE_KINDS = [
  "jellyfish",
  "lanternfish",
  "eel",
  "pufferfish",
  "barracuda",
  "anglerfish",
  "octopus",
  "squid",
  "scrapCrab",
  "anemone",
] as const

export const FRIENDLY_KINDS = [
  "fishSchool",
  "dolphin",
  "seahorse",
  "remora",
  "manta",
  "whale",
  "cleanerFish",
  "nettedTurtle",
] as const

export const BOSS_KINDS = ["netKraken", "scrapShark", "leviathan"] as const

export type HostileKind = (typeof HOSTILE_KINDS)[number]
export type FriendlyKind = (typeof FRIENDLY_KINDS)[number]
export type BossKind = (typeof BOSS_KINDS)[number]
export type CreatureKind = HostileKind | FriendlyKind | BossKind

/** Nombre de cada criatura tal y como se le enseña al jugador. */
export const CREATURE_NAMES: Record<CreatureKind, string> = {
  jellyfish: "Medusa",
  lanternfish: "Pez linterna",
  eel: "Anguila",
  pufferfish: "Pez globo",
  barracuda: "Barracuda",
  anglerfish: "Rape abisal",
  octopus: "Pulpo",
  squid: "Calamar",
  scrapCrab: "Cangrejo de chatarra",
  anemone: "Anémona tóxica",
  fishSchool: "Banco de peces",
  dolphin: "Delfín",
  seahorse: "Caballito de mar",
  remora: "Rémora",
  manta: "Manta raya",
  whale: "Ballena",
  cleanerFish: "Pez limpiador",
  nettedTurtle: "Tortuga atrapada",
  netKraken: "Kraken de Redes",
  scrapShark: "Tiburón de Chatarra",
  leviathan: "Leviatán Contaminado",
}

export function isBossKind(kind: CreatureKind): kind is BossKind {
  return (BOSS_KINDS as readonly string[]).includes(kind)
}

export function isFriendlyKind(kind: CreatureKind): kind is FriendlyKind {
  return (FRIENDLY_KINDS as readonly string[]).includes(kind)
}

/** Lo que las criaturas saben de la tortuga en cada frame. */
export interface CreatureTarget {
  position: THREE.Vector3
  /** Va con el impulso normal. */
  boosting: boolean
  /** Está haciendo el giro con dash (o le dura el empujón). */
  dashing: boolean
  /** Esferas filtradoras activas (el pulpo va a por ellas). */
  spheres?: readonly THREE.Vector3[]
}

export interface CreatureContext {
  deltaTime: number
  time: number
  bounds: WorldBounds
  target: CreatureTarget
}

/** Golpe de una criatura a la tortuga. */
export interface CreatureHit {
  kind: CreatureKind
  toxicity: number
  slowDuration: number
  slowMultiplier: number
}

/** Estado de un megajefe para el HUD. */
export interface BossStatus {
  kind: BossKind
  /** Fugas de su cuerpo ya limpiadas. */
  cleaned: number
  total: number
  defeated: boolean
}

/** Criatura nueva que suelta otra (crías de un jefe). */
export interface CreatureSpawn {
  kind: HostileKind
  position: THREE.Vector3
}

/**
 * Efectos de una criatura sobre el mundo en un frame. Las criaturas no tocan
 * la tortuga ni los desechos directamente: lo devuelven y Game lo aplica.
 */
export interface CreatureEffects {
  /** Golpe al tocar a la tortuga (con su propio enfriamiento). */
  hit?: CreatureHit
  /** Velocidad (u/s) con la que arrastra a la tortuga este frame. */
  pull?: THREE.Vector3
  /** Esparce los desechos alrededor de un punto. */
  scatter?: { center: THREE.Vector3; radius: number; speed: number }
  /** Algo que merece un aviso (la primera vez). */
  notice?: CreatureNotice
  /** Toxicidad por segundo mientras dura (negativa: limpia). */
  drain?: number
  /** Toxicidad que quita de golpe. */
  heal?: number
  /** Eco que regala. */
  eco?: number
  /** Escudo que absorbe el siguiente golpe. */
  shield?: boolean
  /** Acelera a la tortuga un rato. */
  haste?: { duration: number; multiplier: number }
  /** Multiplica el radio de recogida este frame. */
  radiusBoost?: number
  /** Se come los desechos libres de alrededor (cuentan para la tortuga). */
  graze?: { center: THREE.Vector3; radius: number; max: number }
  /** Roba los desechos que atraen las esferas. */
  steal?: { center: THREE.Vector3; radius: number }
  /** Suelta criaturas nuevas. */
  spawn?: CreatureSpawn[]
  /** Estado del megajefe. */
  boss?: BossStatus
  /** Texto corto para la pantalla. */
  message?: string
}

export type CreatureNotice =
  | "eel_charge"
  | "lantern_pull"
  | "school_scatter"
  | "puffer_inflate"
  | "barracuda_chase"
  | "angler_ambush"
  | "octopus_steal"
  | "squid_ink"
  | "friendly_help"
  | "rescue_net"
  | "manta_aura"
  | "whale_song"
  | "boss_seen"

/**
 * Fauna del bioma. Cada criatura decide su propio movimiento y qué le hace a
 * la tortuga; `EnemyManager` solo las recorre, las mantiene dentro del bioma y
 * junta sus efectos.
 *
 * Convención: `mesh` es un grupo que se mueve pero no se gira; lo que tenga
 * rumbo va en un hijo. Así un hijo puede quedarse fijo en el mundo (nubes de
 * tinta, ondas) restando la posición del grupo.
 */
export interface Creature {
  readonly kind: CreatureKind
  readonly mesh: THREE.Object3D
  update(ctx: CreatureContext): CreatureEffects | null
  /** El escudo que dio esta criatura se ha gastado. */
  onShieldUsed?(): void
  dispose(): void
}
