// src/types.ts

export interface GameState {
  debrisCollected: number
  ecoAwareness: number
  toxicity: number
  zoneProgress: number
  isRunning: boolean
}

export interface TurtleStats {
  speed: number // unidades por segundo
  collectionRadius: number
  toxicityResistance: number // 0..1, reduce la toxicidad pasiva
  filterCapacity: number // (reservado para futuras mecánicas)
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
}

export type BiomeKey = "coralReef" | "plasticZone" | "abyssalPit"

export const BIOME_ORDER: BiomeKey[] = [
  "coralReef",
  "plasticZone",
  "abyssalPit",
]

export const BIOMES: Record<BiomeKey, BiomeConfig> = {
  coralReef: {
    name: "Arrecife de Coral",
    waterColor: [0.0, 0.6, 0.9],
    fogDensity: 0.02,
    debrisDensity: 0.5,
    toxicityRate: 0.1,
    depth: 20,
  },
  plasticZone: {
    name: "Zona de Plástico",
    waterColor: [0.1, 0.5, 0.7],
    fogDensity: 0.04,
    debrisDensity: 1.2,
    toxicityRate: 0.3,
    depth: 40,
  },
  abyssalPit: {
    name: "Fosa Abisal",
    waterColor: [0.05, 0.2, 0.4],
    fogDensity: 0.06,
    debrisDensity: 0.8,
    toxicityRate: 0.5,
    depth: 100,
  },
}
