// src/types.ts
// Clases y tipos de datos compartidos entre los distintos módulos del juego.

export interface GameState {
  debrisCollected: number
  ecoAwareness: number
  toxicity: number
  zoneProgress: number
  isRunning: boolean
}

export type RunOutcome = "died" | "completed" | "abandoned"

export interface RunSummary {
  outcome: RunOutcome
  biomeIndex: number // índice en BIOME_ORDER del último bioma alcanzado
  biomeName: string
  debrisCollected: number
  ecoBase: number // Conciencia Ecológica recolectada
  ecoBonus: number // bono por completar la run
  durationSeconds: number
  seed: number
  cardsPicked: string[] // ID de cartas elegidas
}

export interface TurtleStats {
  speed: number // unidades por segundo
  collectionRadius: number
  toxicityResistance: number // 0..1, reduce la toxicidad pasiva
  filterCapacity: number // máximo de filtros activos a la vez
}

export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  boost: boolean
}

export interface WorldBounds {
  halfSize: number // límite horizontal (±)
  minY: number
  maxY: number
}

export interface BiomeConfig {
  name: string
  waterColor: [number, number, number]
  fogDensity: number
  debrisDensity: number
  toxicityRate: number
  depth: number
  floorColor: [number, number, number]
  accentColor: number // color de las luces puntuales (bioluminiscencia)
}

export type BiomeKey =
  | "epipelagic_upper"
  | "pelagic_mid"
  | "subphotic"
  | "mesopelagic_upper"
  | "mesopelagic_deep"
  | "bathypelagic_upper"
  | "bathypelagic_deep"
  | "abyssopelagic"
  | "hadopelagic"
  | "deepSea"

export const BIOME_ORDER: BiomeKey[] = [
  "epipelagic_upper",
  "pelagic_mid",
  "subphotic",
  "mesopelagic_upper",
  "mesopelagic_deep",
  "bathypelagic_upper",
  "bathypelagic_deep",
  "abyssopelagic",
  "hadopelagic",
  "deepSea",
]

export const BIOMES: Record<BiomeKey, BiomeConfig> = {
  epipelagic_upper: {
    name: "Epipelágico Superior",
    waterColor: [0.1, 0.75, 0.85],
    fogDensity: 0.015,
    debrisDensity: 0.1,
    toxicityRate: 0.0,
    depth: 20,
    floorColor: [0.8, 0.72, 0.5],
    accentColor: 0xaaffee,
  },
  pelagic_mid: {
    name: "Pelágico Medio",
    waterColor: [0.0, 0.5, 0.85],
    fogDensity: 0.02,
    debrisDensity: 0.2,
    toxicityRate: 0.0,
    depth: 100,
    floorColor: [0.55, 0.55, 0.45],
    accentColor: 0x66ccff,
  },
  subphotic: {
    name: "Subfótico",
    waterColor: [0.05, 0.3, 0.7],
    fogDensity: 0.026,
    debrisDensity: 0.3,
    toxicityRate: 0.05,
    depth: 200,
    floorColor: [0.35, 0.4, 0.45],
    accentColor: 0x66aaff,
  },
  mesopelagic_upper: {
    name: "Mesopelágico Superior",
    waterColor: [0.2, 0.18, 0.6],
    fogDensity: 0.032,
    debrisDensity: 0.45,
    toxicityRate: 0.1,
    depth: 500,
    floorColor: [0.25, 0.25, 0.4],
    accentColor: 0x9988ff,
  },
  mesopelagic_deep: {
    name: "Mesopelágico Profundo",
    waterColor: [0.35, 0.12, 0.55],
    fogDensity: 0.038,
    debrisDensity: 0.6,
    toxicityRate: 0.2,
    depth: 1000,
    floorColor: [0.3, 0.2, 0.4],
    accentColor: 0xcc77ff,
  },
  bathypelagic_upper: {
    name: "Batipelágico Superior",
    waterColor: [0.3, 0.1, 0.45],
    fogDensity: 0.044,
    debrisDensity: 0.7,
    toxicityRate: 0.35,
    depth: 2000,
    floorColor: [0.3, 0.18, 0.28],
    accentColor: 0xff77dd,
  },
  bathypelagic_deep: {
    name: "Batipelágico Profundo",
    waterColor: [0.4, 0.08, 0.3],
    fogDensity: 0.05,
    debrisDensity: 0.8,
    toxicityRate: 0.5,
    depth: 4000,
    floorColor: [0.35, 0.18, 0.2],
    accentColor: 0xff6688,
  },
  abyssopelagic: {
    name: "Abisopelágico",
    waterColor: [0.08, 0.22, 0.32],
    fogDensity: 0.055,
    debrisDensity: 0.9,
    toxicityRate: 0.7,
    depth: 6000,
    floorColor: [0.15, 0.3, 0.3],
    accentColor: 0x44ffdd,
  },
  hadopelagic: {
    name: "Hadopelágico",
    waterColor: [0.28, 0.22, 0.06],
    fogDensity: 0.06,
    debrisDensity: 0.95,
    toxicityRate: 0.85,
    depth: 8000,
    floorColor: [0.4, 0.35, 0.15],
    accentColor: 0xffdd44,
  },
  deepSea: {
    name: "Mar Profundo",
    waterColor: [0.35, 0.08, 0.06],
    fogDensity: 0.065,
    debrisDensity: 1.0,
    toxicityRate: 1.0,
    depth: 11000,
    floorColor: [0.3, 0.15, 0.12],
    accentColor: 0xff6633,
  },
}
