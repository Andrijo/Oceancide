import type { TurtleStats } from "@core/types"

export interface Upgrade {
  id: string
  name: string
  description: string
  maxLevel: number
  costs: number[] // Coste para subir al nivel 1, 2, 3...
  apply: (stats: TurtleStats, level: number) => void
}

export const UPGRADES: Upgrade[] = [
  {
    id: "speed",
    name: "Aletas Mejoradas",
    description: "+5% de velocidad base por nivel.",
    maxLevel: 5,
    costs: [50, 100, 200, 400, 800],
    apply: (stats, level) => {
      stats.speed *= 1 + level * 0.05
    },
  },
  {
    id: "resistance",
    name: "Caparazón Reforzado",
    description: "+3% de resistencia a la toxicidad por nivel.",
    maxLevel: 5,
    costs: [60, 120, 240, 480, 960],
    apply: (stats, level) => {
      stats.toxicityResistance = Math.min(
        0.9,
        stats.toxicityResistance + level * 0.03,
      )
    },
  },
  {
    id: "magnet",
    name: "Imán Permanente",
    description: "+0.3 al radio de recolección por nivel.",
    maxLevel: 3,
    costs: [80, 240, 720],
    apply: (stats, level) => {
      stats.collectionRadius += level * 0.3
    },
  },
  {
    id: "filters",
    name: "Filtros Avanzados",
    description: "+1 filtro activo simultáneo por nivel.",
    maxLevel: 3,
    costs: [150, 450, 1350],
    apply: (stats, level) => {
      stats.filterCapacity += level
    },
  },
  {
    id: "eco",
    name: "Tanque de Eco",
    description: "+10% de eco ganado por nivel.",
    maxLevel: 5,
    costs: [100, 200, 400, 800, 1600],
    apply: () => {
      // Se aplica directamente al runState.ecoMultiplier en Game.ts
    },
  },
  {
    id: "immune",
    name: "Sistema Inmune",
    description: "-5% a la tasa de toxicidad pasiva por nivel.",
    maxLevel: 3,
    costs: [200, 600, 1800],
    apply: () => {
      // Se aplica modificando el TOXICITY_SCALE en Game.ts
    },
  },
]
