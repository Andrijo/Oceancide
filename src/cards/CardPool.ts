import type { Card, CardRarity } from "./Card"

export const CARD_POOL: Card[] = [
  // Cartas comunes
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
      turtle.addToxicityResistance(0.05)
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
  {
    id: "short_fins",
    name: "Aletas Cortas",
    description: "Pequeñas mejoras en las aletas traseras.",
    rarity: "common",
    value: "+6% VEL",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.06
    },
  },
  {
    id: "thick_skin",
    name: "Piel Gruesa",
    description: "La piel se endurece, resistiendo mejor el agua.",
    rarity: "common",
    value: "+4% RES",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.04)
    },
  },
  {
    id: "instinct",
    name: "Instinto",
    description: "Un sexto sentido para encontrar desechos.",
    rarity: "common",
    value: "+0.4 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.collectionRadius += 0.4
    },
  },
  {
    id: "extra_valve",
    name: "Válvula Extra",
    description: "Un filtro adicional en el caparazón.",
    rarity: "common",
    value: "+1 FILTRO",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 1
    },
  },
  {
    id: "minor_echo",
    name: "Eco Menor",
    description: "Cada desecho resuena un poco más.",
    rarity: "common",
    value: "+8% ECO",
    apply: ({ run }) => {
      run.ecoMultiplier *= 1.08
    },
  },
  {
    id: "reflexes",
    name: "Reflejos",
    description: "Reacciona más rápido y detecta mejor.",
    rarity: "common",
    value: "+5% VEL / +0.3 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.05
      turtle.stats.collectionRadius += 0.3
    },
  },
  {
    id: "curled_shell",
    name: "Caparazón Rizado",
    description: "La forma curva repele un poco la toxicidad.",
    rarity: "common",
    value: "+3% RES / +0.3 RADIO",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.03)
      turtle.stats.collectionRadius += 0.3
    },
  },
  {
    id: "weak_turbo",
    name: "Turbo Débil",
    description: "Un pequeño impulso adicional en el giro.",
    rarity: "common",
    value: "+0.2 DASH",
    apply: ({ turtle }) => {
      turtle.addSpinBoostMultiplier(0.2)
    },
  },
  {
    id: "collector",
    name: "Colector",
    description: "Un filtro más y algo de radio extra.",
    rarity: "common",
    value: "+1 FILTRO / +0.3 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 1
      turtle.stats.collectionRadius += 0.3
    },
  },
  {
    id: "adaptation",
    name: "Adaptación",
    description: "La tortuga se adapta al medio hostil.",
    rarity: "common",
    value: "+3% VEL / +3% RES",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.03
      turtle.addToxicityResistance(0.03)
    },
  },
  {
    id: "fish_eye",
    name: "Ojo de Pez",
    description: "Visión panorámica del entorno.",
    rarity: "common",
    value: "+0.6 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.collectionRadius += 0.6
    },
  },
  {
    id: "breathing",
    name: "Respiración",
    description: "Respira mejor y vive en armonía con el océano.",
    rarity: "common",
    value: "+2% RES / +5% ECO",
    apply: ({ turtle, run }) => {
      turtle.addToxicityResistance(0.02)
      run.ecoMultiplier *= 1.05
    },
  },

  // Raras
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
  {
    id: "filter_shell",
    name: "Caparazón Filtro",
    description: "El caparazón absorbe mejor los tóxicos.",
    rarity: "rare",
    value: "+15% RES",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.15)
    },
  },
  {
    id: "turbo",
    name: "Turbo",
    description: "Impulso de giro notablemente más fuerte.",
    rarity: "rare",
    value: "+0.6 DASH",
    apply: ({ turtle }) => {
      turtle.addSpinBoostMultiplier(0.6)
    },
  },
  {
    id: "filter_colony",
    name: "Colonia de Filtros",
    description: "Los filtros generan más eco por segundo.",
    rarity: "rare",
    value: "+1.5 ECO/S",
    apply: ({ run }) => {
      run.filterEcoPerSecond += 1.5
    },
  },
  {
    id: "greater_echo",
    name: "Eco Mayor",
    description: "El eco resuena con fuerza.",
    rarity: "rare",
    value: "+35% ECO",
    apply: ({ run }) => {
      run.ecoMultiplier *= 1.35
    },
  },
  {
    id: "double_fin",
    name: "Aleta Doble",
    description: "Aletas extendidas, mucha más velocidad.",
    rarity: "rare",
    value: "+20% VEL",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.2
    },
  },
  {
    id: "super_magnet",
    name: "Super Imán",
    description: "Atrae desechos desde puntos lejanos.",
    rarity: "rare",
    value: "+2 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.collectionRadius += 2
    },
  },
  {
    id: "iron_lung",
    name: "Pulmón de Hierro",
    description: "Dos filtros más activos a la vez.",
    rarity: "rare",
    value: "+2 FILTROS",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 2
    },
  },
  {
    id: "sea_resistance",
    name: "Resistencia Marina",
    description: "Resistente y rápida a la vez.",
    rarity: "rare",
    value: "+15% RES / +5% VEL",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.15)
      turtle.stats.speed *= 1.05
    },
  },

  // Epicas
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
    description: "Revives una vez al morir, con 20s de gracia.",
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
  {
    id: "reinforced_shell",
    name: "Caparazón Reforzado",
    description: "Más filtros y mejor resistencia.",
    rarity: "epic",
    value: "+2 FILTROS / +8% RES",
    apply: ({ turtle }) => {
      turtle.stats.filterCapacity += 2
      turtle.addToxicityResistance(0.08)
    },
  },
  {
    id: "hive_mind",
    name: "Mente Colmena",
    description: "Los filtros trabajan en perfecta sincronía.",
    rarity: "epic",
    value: "+2 ECO/S",
    apply: ({ run }) => {
      run.filterEcoPerSecond += 2
    },
  },
  {
    id: "elegant_swim",
    name: "Nado Elegante",
    description: "Desplazamiento fluido y mayor alcance.",
    rarity: "epic",
    value: "+15% VEL / +0.5 RADIO",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.15
      turtle.stats.collectionRadius += 0.5
    },
  },
  {
    id: "toxic_reflex",
    name: "Reflejo Tóxico",
    description: "El caparazón refleja gran parte de la toxicidad.",
    rarity: "epic",
    value: "+25% RES",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.25)
    },
  },
  {
    id: "greater_symbiosis",
    name: "Simbiosis Mayor",
    description: "Los filtros generan más eco y tienes uno extra.",
    rarity: "epic",
    value: "+2 ECO/S / +1 FILTRO",
    apply: ({ turtle, run }) => {
      run.filterEcoPerSecond += 2
      turtle.stats.filterCapacity += 1
    },
  },
  {
    id: "coral_shield",
    name: "Escudo de Coral",
    description: "Un revivir adicional y algo de resistencia.",
    rarity: "epic",
    value: "+1 REVIVIR / +5% RES",
    apply: ({ turtle, run }) => {
      run.reviveCharges += 1
      turtle.addToxicityResistance(0.05)
    },
  },
  {
    id: "eco_cargo",
    name: "Carga Ecológica",
    description: "El eco se acumula rápidamente.",
    rarity: "epic",
    value: "+50% ECO",
    apply: ({ run }) => {
      run.ecoMultiplier *= 1.5
    },
  },

  // Legendarias
  {
    id: "mirror_shell",
    name: "Caparazón Espejo",
    description: "El caparazón repele la mayor parte de la contaminación.",
    rarity: "legendary",
    value: "+40% RES",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.4)
    },
  },
  {
    id: "supersonic_swim",
    name: "Nado Supersónico",
    description: "La tortuga es la reencarnación de Flash.",
    rarity: "legendary",
    value: "+50% VEL",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.5
    },
  },
  {
    id: "titan_shell",
    name: "Caparazón del Titán",
    description: "Un caparazón colosal con filtros y resistencia.",
    rarity: "legendary",
    value: "+15% RES / +2 FILTROS",
    apply: ({ turtle }) => {
      turtle.addToxicityResistance(0.15)
      turtle.stats.filterCapacity += 2
    },
  },
  {
    id: "whirlwind",
    name: "Torbellino",
    description: "El giro genera un vórtice devastador.",
    rarity: "legendary",
    value: "+1.0 DASH",
    apply: ({ turtle }) => {
      turtle.addSpinBoostMultiplier(1.0)
    },
  },
  {
    id: "amplifier",
    name: "Amplificador",
    description: "Todo el eco que generas se multiplica.",
    rarity: "legendary",
    value: "+75% ECO",
    apply: ({ run }) => {
      run.ecoMultiplier *= 1.75
    },
  },

  // Maldiciones
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
      turtle.reduceToxicityResistance(0.5)
    },
  },
  {
    id: "extreme_greed",
    name: "Codicia Extrema",
    description: "Mucho más eco, pero nadar cansa.",
    rarity: "curse",
    value: "+100% ECO / -30% VEL",
    apply: ({ turtle, run }) => {
      run.ecoMultiplier *= 2.0
      turtle.stats.speed *= 0.7
    },
  },
  {
    id: "rupture",
    name: "Ruptura",
    description: "Velocidad extrema con un caparazón frágil.",
    rarity: "curse",
    value: "+50% VEL / -30% RES",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.5
      turtle.reduceToxicityResistance(0.3)
    },
  },

  // Ultra
  {
    id: "ancestral_current",
    name: "Marea Primigenia",
    description:
      "Una sobrecarga de energía ancestral. Más velocidad y filtros adicionales.",
    rarity: "ultra_legendary",
    value: "+80% VEL / +5 FILTROS",
    apply: ({ turtle }) => {
      turtle.stats.speed *= 1.8
      turtle.stats.filterCapacity += 5
    },
  },
  {
    id: "ocean_heart",
    name: "Corazón del Océano",
    description: "Sientes el pulso del mar. El eco fluye hacia ti.",
    rarity: "ultra_legendary",
    value: "+100% ECO / +3 ECO/S",
    apply: ({ run }) => {
      run.ecoMultiplier *= 2.0
      run.filterEcoPerSecond += 3
    },
  },
  {
    id: "abyssal_fury",
    name: "Furia Abisal",
    description: "Una criatura ancestral se manifiesta a través del caparazón.",
    rarity: "ultra_legendary",
    value: "+1.2 DASH / +30% VEL / +1 REVIVIR",
    apply: ({ turtle, run }) => {
      turtle.addSpinBoostMultiplier(1.2)
      turtle.stats.speed *= 1.3
      run.reviveCharges += 1
    },
  },
]

/** Pesos relativos de rareza al hacer el roll. */
export const RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 40,
  rare: 30,
  epic: 20,
  legendary: 7,
  curse: 2,
  ultra_legendary: 1,
}
