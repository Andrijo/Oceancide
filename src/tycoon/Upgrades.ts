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
    costs: [500, 1000, 2000, 4000, 8000], // Antes 50, 100...
    apply: (stats, level) => {
      stats.speed *= 1 + level * 0.05
    },
  },
  {
    id: "resistance",
    name: "Caparazón Reforzado",
    description: "+3% de resistencia a la toxicidad por nivel.",
    maxLevel: 5,
    costs: [600, 1200, 2400, 4800, 9600],
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
    costs: [800, 2400, 7200],
    apply: (stats, level) => {
      stats.collectionRadius += level * 0.3
    },
  },
  {
    id: "filters",
    name: "Filtros Avanzados",
    description: "+1 filtro activo simultáneo por nivel.",
    maxLevel: 3,
    costs: [1500, 4500, 13500],
    apply: (stats, level) => {
      stats.filterCapacity += level
    },
  },
  {
    id: "eco",
    name: "Tanque de Eco",
    description: "+10% de eco ganado por nivel.",
    maxLevel: 5,
    costs: [1000, 2000, 4000, 8000, 16000],
    apply: () => {},
  },
  {
    id: "immune",
    name: "Sistema Inmune",
    description: "-5% a la tasa de toxicidad pasiva por nivel.",
    maxLevel: 3,
    costs: [2000, 6000, 18000],
    apply: () => {},
  },
]
