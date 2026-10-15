// src/cards/CardPool.ts
// Las 15 cartas del juego, repartidas entre rarezas.

import type { Card, CardRarity } from "./Card"

export const CARD_POOL: Card[] = [
  // ---------------------------------------------
  // Comunes
  // ---------------------------------------------
  {
    id: "fins_agiles",
    name: "Aletas Ágiles",
    description: "La tortuga nada más rápido en línea recta.",
    rarity: "common",
    value: "+10% VEL",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.1
    },
  },
  {
    id: "shell_dense",
    name: "Caparazón Denso",
    description: "El caparazón filtra mejor la toxicidad del agua.",
    rarity: "common",
    value: "+5% RES",
    apply: ({ turtle }) => {
      turtle.stats.toxicityResistance = Math.min(
        0.9,
        turtle.stats.toxicityResistance + 0.05,
      )
    },
  },
  {
    id: "weak_magnet",
    name: "Imán Débil",
    description: "Atrae desechos desde un poco más lejos.",
    rarity: "common",
    value: "+0.5 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.collectionRadius += 0.5
    },
  },
  {
    id: "extra_lung",
    name: "Pulmón Extra",
    description: "Puedes mantener un filtro más activo a la vez.",
    rarity: "common",
    value: "+1 FILTRO",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 1
    },
  },

  // ---------------------------------------------
  // Raras
  // ---------------------------------------------
  {
    id: "eco_amp",
    name: "Eco Amplificado",
    description: "Cada desecho recogido vale más.",
    rarity: "rare",
    value: "+25% ECO",
    apply: ({ run }) => {
      run.ecoMultiplier *= 1.25
    },
  },
  {
    id: "dash_boost",
    name: "Dash Potenciado",
    description: "El giro de 360° da un impulso más fuerte.",
    rarity: "rare",
    value: "+0.4 DASH",
    apply: ({ turtle }) => {
      turtle.addSpinBoostMultiplier(0.4)
    },
  },
  {
    id: "symbiosis",
    name: "Simbiosis",
    description: "Cada filtro activo genera eco por segundo.",
    rarity: "rare",
    value: "+1 ECO/S",
    apply: ({ run }) => {
      run.filterEcoPerSecond += 1
    },
  },
  {
    id: "big_magnet",
    name: "Imán Grande",
    description: "Atrae desechos desde muy lejos.",
    rarity: "rare",
    value: "+1.5 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.collectionRadius += 1.5
    },
  },

  // ---------------------------------------------
  // Épicas
  // ---------------------------------------------
  {
    id: "advanced_filter",
    name: "Filtro Mejorado",
    description: "Puedes mantener dos filtros más a la vez.",
    rarity: "epic",
    value: "+2 FILTROS",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 2
    },
  },
  {
    id: "medusa_heart",
    name: "Corazón de Medusa",
    description: "Revives una vez al morir con 50% de toxicidad.",
    rarity: "epic",
    value: "+1 REVIVIR",
    apply: ({ run }) => {
      run.reviveCharges += 1
    },
  },
  {
    id: "bioluminescence",
    name: "Bioluminiscencia",
    description: "Brillas en la oscuridad y ganas más eco.",
    rarity: "epic",
    value: "+30% ECO",
    apply: ({ turtle, run }) => {
      turtle.stats.speed *= 1.05
      run.ecoMultiplier *= 1.3
    },
  },

  // ---------------------------------------------
  // Legendarias
  // ---------------------------------------------
  {
    id: "mirror_shell",
    name: "Caparazón Espejo",
    description: "El caparazón repele la mayor parte de la contaminación.",
    rarity: "legendary",
    value: "-40% TOX",
    apply: ({ turtle }) => {
      turtle.stats.toxicityResistance = Math.min(
        0.95,
        turtle.stats.toxicityResistance + 0.4,
      )
    },
  },
  {
    id: "supersonic_swim",
    name: "Nado Supersónico",
    description: "La tortuga nada como un torpedo.",
    rarity: "legendary",
    value: "+50% VEL",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.5
    },
  },

  // ---------------------------------------------
  // Maldiciones
  // ---------------------------------------------
  {
    id: "greed",
    name: "Avaricia",
    description: "Más eco, pero la tortuga se vuelve lenta.",
    rarity: "curse",
    value: "+50% ECO / -20% VEL",
    apply: ({ turtle, run }) => {
      run.ecoMultiplier *= 1.5
      turtle.stats.speed *= 0.8
    },
  },
  {
    id: "fragility",
    name: "Fragilidad",
    description: "Más rápida, pero mucho más vulnerable a la toxicidad.",
    rarity: "curse",
    value: "+30% VEL / -50% RES",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.3
      turtle.stats.toxicityResistance = Math.max(
        0,
        turtle.stats.toxicityResistance - 0.5,
      )
    },
  },
]

/** Pesos relativos de rareza al hacer el roll. */
export const RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 40,
  rare: 30,
  epic: 20,
  legendary: 8,
  curse: 2,
}
