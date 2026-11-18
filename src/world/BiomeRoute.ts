// src/world/BiomeRoute.ts
// Rutas ramificadas: la inmersión baja por 6 capas y, al terminar cada una, se
// elige entre dos zonas de la siguiente. Cada zona trae un bioma, un
// modificador (corriente, apagón, marea roja, medusas), un objetivo (limpiar,
// cerrar las fugas, contrarreloj) y a veces una recompensa al terminarla
// (tienda o evento). Lógica pura y determinista con la semilla de la run.

import { LOCALE } from "@core/locale"
import { Rng, deriveSeed } from "@core/rng"
import { BIOMES, type BiomeKey } from "@core/types"

/**
 * Biomas posibles en cada capa. Juntas cubren los 10 biomas. `BIOME_ORDER`
 * (types.ts) sigue siendo la ruta por defecto: un bioma representativo por
 * capa, que usan los récords y el menú de desarrollo.
 */
export const ROUTE_LAYERS: readonly (readonly BiomeKey[])[] = [
  ["epipelagic_upper"],
  ["subphotic", "pelagic_mid"],
  ["mesopelagic_deep", "mesopelagic_upper"],
  ["bathypelagic_deep", "bathypelagic_upper"],
  ["abyssopelagic", "hadopelagic"],
  ["deepSea"],
]

export type BiomeModifierId =
  "none" | "strong_current" | "blackout" | "red_tide" | "jelly_bloom"

export interface BiomeModifier {
  id: BiomeModifierId
  name: string
  description: string
  /** Multiplicador del Eco ganado en la zona (la recompensa del riesgo). */
  ecoMultiplier: number
  /** Multiplicador de la toxicidad pasiva del bioma. */
  toxicityRateMultiplier: number
  /** Toxicidad pasiva base que se suma (para que afecte también arriba). */
  toxicityRateBonus: number
  /** Medusas extra. */
  extraEnemies: number
  /** Velocidad de la corriente que arrastra a la tortuga (u/s). */
  currentSpeed: number
  /** Multiplicador de las luces (0 = apagón). */
  lightMultiplier: number
}

const NEUTRAL: Omit<BiomeModifier, "id" | "name" | "description"> = {
  ecoMultiplier: 1,
  toxicityRateMultiplier: 1,
  toxicityRateBonus: 0,
  extraEnemies: 0,
  currentSpeed: 0,
  lightMultiplier: 1,
}

export const BIOME_MODIFIERS: Record<BiomeModifierId, BiomeModifier> = {
  none: {
    ...NEUTRAL,
    id: "none",
    name: "Aguas tranquilas",
    description: "Sin sorpresas.",
  },
  strong_current: {
    ...NEUTRAL,
    id: "strong_current",
    name: "Corriente fuerte",
    description: "Una corriente constante te arrastra. Eco ×1.2.",
    ecoMultiplier: 1.2,
    currentSpeed: 2.6,
  },
  blackout: {
    ...NEUTRAL,
    id: "blackout",
    name: "Apagón",
    description:
      "Sin luces de bioluminiscencia y el sol casi apagado. Eco ×1.25.",
    ecoMultiplier: 1.25,
    lightMultiplier: 0,
  },
  red_tide: {
    ...NEUTRAL,
    id: "red_tide",
    name: "Marea roja",
    description: "La toxicidad pasiva sube un 50%. Eco ×1.5.",
    ecoMultiplier: 1.5,
    toxicityRateMultiplier: 1.5,
    toxicityRateBonus: 0.08,
  },
  jelly_bloom: {
    ...NEUTRAL,
    id: "jelly_bloom",
    name: "Floración de medusas",
    description: "4 medusas más. Eco ×1.3.",
    ecoMultiplier: 1.3,
    extraEnemies: 4,
  },
}

export type BiomeObjectiveId = "clean" | "leaks" | "time_trial"

export interface BiomeObjective {
  id: BiomeObjectiveId
  name: string
  description: string
  /** Multiplicador del tiempo del bioma. */
  timeMultiplier: number
}

export const BIOME_OBJECTIVES: Record<BiomeObjectiveId, BiomeObjective> = {
  clean: {
    id: "clean",
    name: "Limpieza",
    description: "Recoge el 60% de los desechos.",
    timeMultiplier: 1,
  },
  leaks: {
    id: "leaks",
    name: "Cierra las fugas",
    description: "Cierra todas las fugas del bioma.",
    timeMultiplier: 1,
  },
  time_trial: {
    id: "time_trial",
    name: "Contrarreloj",
    description:
      "Limpia el 60% con un 40% menos de tiempo. Bono si llegas a tiempo.",
    timeMultiplier: 0.6,
  },
}

/** Fugas mínimas para que "cierra las fugas" tenga sentido; si no, se limpia. */
export const MIN_LEAKS_FOR_OBJECTIVE = 2

export type RoutePerk = "none" | "shop" | "event"

export const ROUTE_PERK_LABELS: Record<RoutePerk, string> = {
  none: "Ninguna",
  shop: "Tienda al terminar",
  event: "Evento garantizado",
}

export interface RouteNode {
  biome: BiomeKey
  modifier: BiomeModifierId
  objective: BiomeObjectiveId
  perk: RoutePerk
}

/** Sal de la semilla de las rutas (0 bioma, 1000 cartas, 2000 eventos, 3000 reliquias). */
export const ROUTE_SEED_SALT = 4000

export const LAYER_COUNT = ROUTE_LAYERS.length

export function layerOf(biomeIndex: number): number {
  return ((biomeIndex % LAYER_COUNT) + LAYER_COUNT) % LAYER_COUNT
}

/** Zona de partida: el primer bioma, sin modificador. */
export const START_NODE: RouteNode = {
  biome: ROUTE_LAYERS[0][0],
  modifier: "none",
  objective: "clean",
  perk: "none",
}

/** Zona por defecto de un índice (ruta clásica, sin modificadores). */
export function defaultNode(biomeIndex: number): RouteNode {
  return { ...START_NODE, biome: ROUTE_LAYERS[layerOf(biomeIndex)][0] }
}

const MODIFIER_POOL: readonly BiomeModifierId[] = [
  "strong_current",
  "blackout",
  "red_tide",
  "jelly_bloom",
]

function sameNode(a: RouteNode, b: RouteNode): boolean {
  return (
    a.biome === b.biome &&
    a.modifier === b.modifier &&
    a.objective === b.objective &&
    a.perk === b.perk
  )
}

/**
 * Las dos zonas entre las que se elige para entrar en `biomeIndex`.
 * @param eventPlanned Ya hay evento tras ese bioma: no se ofrece como recompensa.
 */
export function generateRouteOptions(
  seed: number,
  biomeIndex: number,
  eventPlanned = false,
): [RouteNode, RouteNode] {
  const rng = new Rng(deriveSeed(seed, biomeIndex + ROUTE_SEED_SALT))
  const layer = layerOf(biomeIndex)
  const biomes = [...ROUTE_LAYERS[layer]]
  if (biomes.length > 1 && rng.next() < 0.5) biomes.reverse()

  const makeNode = (biome: BiomeKey): RouteNode => {
    const modifier: BiomeModifierId =
      rng.next() < 0.45 ? "none" : rng.pick(MODIFIER_POOL)
    const objectiveRoll = rng.next()
    const objective: BiomeObjectiveId =
      layer === 0 || objectiveRoll < 0.6
        ? "clean"
        : objectiveRoll < 0.8
          ? "leaks"
          : "time_trial"
    const perkRoll = rng.next()
    const perks: RoutePerk[] = eventPlanned ? ["shop"] : ["shop", "event"]
    const perk: RoutePerk = perkRoll < 0.6 ? "none" : rng.pick(perks)
    return { biome, modifier, objective, perk }
  }

  const first = makeNode(biomes[0])
  const second = makeNode(biomes[biomes.length > 1 ? 1 : 0])
  // Las dos opciones tienen que diferenciarse en algo.
  if (sameNode(first, second)) {
    const others = MODIFIER_POOL.filter((m) => m !== first.modifier)
    second.modifier = rng.pick(others)
  }
  return [first, second]
}

/** Toxicidad pasiva del bioma con el modificador aplicado. */
export function modifiedToxicityRate(
  baseRate: number,
  modifier: BiomeModifier,
): number {
  return baseRate * modifier.toxicityRateMultiplier + modifier.toxicityRateBonus
}

/** Progreso (0..100) del objetivo "cierra las fugas". */
export function leakProgress(initialLeaks: number, remaining: number): number {
  if (initialLeaks <= 0) return 100
  const closed = Math.max(0, initialLeaks - Math.max(0, remaining))
  return Math.min(100, (closed / initialLeaks) * 100)
}

/** Bono de Eco por cumplir un objetivo alternativo en la capa `layer`. */
export function objectiveBonus(
  objective: BiomeObjectiveId,
  layer: number,
  timeRemaining: number,
): number {
  if (objective === "leaks") return 100 * (layer + 1)
  if (objective === "time_trial" && timeRemaining > 0) return 150 * (layer + 1)
  return 0
}

/** Ítems de la tienda entre zonas. */
export interface ShopItem {
  id: "purify" | "revive" | "filter" | "magnet"
  label: string
  description: string
  cost: number
}

/** La tienda: precios que suben con la profundidad. */
export function shopItems(layer: number): ShopItem[] {
  const scale = 1 + layer * 0.25
  return [
    {
      id: "purify",
      label: "Purificación",
      description: "-35 toxicidad.",
      cost: Math.round(150 * scale),
    },
    {
      id: "magnet",
      label: "Imán de deriva",
      description: "+0.5 de radio de recolección.",
      cost: Math.round(250 * scale),
    },
    {
      id: "filter",
      label: "Filtro de repuesto",
      description: "+1 filtro activo.",
      cost: Math.round(400 * scale),
    },
    {
      id: "revive",
      label: "Corazón de medusa",
      description: "+1 revive.",
      cost: Math.round(650 * scale),
    },
  ]
}

/** Texto corto de una zona para la elección de ruta. */
export function describeNode(node: RouteNode): string {
  const modifier = BIOME_MODIFIERS[node.modifier]
  const objective = BIOME_OBJECTIVES[node.objective]
  const parts = [
    `${objective.name}: ${objective.description}`,
    node.modifier === "none"
      ? modifier.name
      : `${modifier.name}: ${modifier.description}`,
  ]
  if (node.perk !== "none")
    parts.push(`Recompensa: ${ROUTE_PERK_LABELS[node.perk]}.`)
  return parts.join(" ")
}

/** Nombre y profundidad de una zona ("Subfótico · 200 m"). */
export function nodeTitle(node: RouteNode): string {
  const biome = BIOMES[node.biome]
  return `${biome.name} · ${biome.depth.toLocaleString(LOCALE)} m`
}
