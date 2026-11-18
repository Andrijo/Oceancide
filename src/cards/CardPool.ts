import type { Card, CardRarity } from "./Card"

export const CARD_POOL: Card[] = [
  // Cartas comunes
  {
    id: "fins_agiles",
    name: "Aletas Ágiles",
    description: "La tortuga nada más rápido en línea recta.",
    rarity: "common",
    effects: { speed: 1.1 },
  },
  {
    id: "shell_dense",
    name: "Caparazón Denso",
    description: "El caparazón filtra mejor la toxicidad del agua.",
    rarity: "common",
    effects: { resistance: 0.05 },
  },
  {
    id: "weak_magnet",
    name: "Imán Débil",
    description: "Atrae desechos desde un poco más lejos.",
    rarity: "common",
    effects: { radius: 0.5 },
  },
  {
    id: "extra_lung",
    name: "Pulmón Extra",
    description: "Puedes mantener un filtro más activo a la vez.",
    rarity: "common",
    effects: { filters: 1 },
  },
  {
    id: "minor_echo",
    name: "Eco Menor",
    description: "Cada desecho resuena un poco más.",
    rarity: "common",
    effects: { eco: 1.08 },
  },
  {
    id: "reflexes",
    name: "Reflejos",
    description: "Reacciona más rápido y detecta mejor.",
    rarity: "common",
    effects: { speed: 1.05, radius: 0.3 },
  },
  {
    id: "curled_shell",
    name: "Caparazón Rizado",
    description: "La forma curva repele un poco la toxicidad.",
    rarity: "common",
    effects: { resistance: 0.03, radius: 0.3 },
  },
  {
    id: "weak_turbo",
    name: "Turbo Débil",
    description: "Un pequeño impulso adicional en el dash.",
    rarity: "common",
    effects: { dash: 0.2 },
  },
  {
    id: "collector",
    name: "Colector",
    description: "Un filtro más y algo de radio extra.",
    rarity: "common",
    effects: { filters: 1, radius: 0.3 },
  },
  {
    id: "adaptation",
    name: "Adaptación",
    description: "La tortuga se adapta al medio hostil.",
    rarity: "common",
    effects: { speed: 1.03, resistance: 0.03 },
  },
  {
    id: "breathing",
    name: "Respiración",
    description: "Respira mejor y vive en armonía con el océano.",
    rarity: "common",
    effects: { resistance: 0.02, eco: 1.05 },
  },
  // Raras
  {
    id: "eco_amp",
    name: "Eco Amplificado",
    description: "Cada desecho recogido vale más.",
    rarity: "rare",
    effects: { eco: 1.25 },
  },
  {
    id: "dash_boost",
    name: "Dash Potenciado",
    description: "El giro de 360° da un impulso más fuerte.",
    rarity: "rare",
    effects: { dash: 0.4 },
  },
  {
    id: "symbiosis",
    name: "Simbiosis",
    description: "Cada filtro activo genera Eco por segundo.",
    rarity: "rare",
    effects: { ecoPerSecond: 1 },
  },
  {
    id: "big_magnet",
    name: "Imán Grande",
    description: "Atrae desechos desde muy lejos.",
    rarity: "rare",
    effects: { radius: 1.5 },
  },
  {
    id: "filter_shell",
    name: "Caparazón Filtro",
    description: "El caparazón absorbe mejor los tóxicos.",
    rarity: "rare",
    effects: { resistance: 0.15 },
  },
  {
    id: "double_fin",
    name: "Aleta Doble",
    description: "Aletas extendidas, mucha más velocidad.",
    rarity: "rare",
    effects: { speed: 1.2 },
  },
  {
    id: "iron_lung",
    name: "Pulmón de Hierro",
    description: "Dos filtros más activos a la vez.",
    rarity: "rare",
    effects: { filters: 2 },
  },
  {
    id: "sea_resistance",
    name: "Resistencia Marina",
    description: "Resistente y rápida a la vez.",
    rarity: "rare",
    effects: { resistance: 0.15, speed: 1.05 },
  },
  // Épicas
  {
    id: "medusa_heart",
    name: "Corazón de Medusa",
    description: "Revives una vez al morir, con 20s de gracia.",
    rarity: "epic",
    effects: { revives: 1 },
  },
  {
    id: "bioluminescence",
    name: "Bioluminiscencia",
    description:
      "Brillas en la oscuridad, nadas algo más rápido y ganas más Eco.",
    rarity: "epic",
    effects: { eco: 1.3, speed: 1.05, glow: 0.5 },
  },
  {
    id: "reinforced_shell",
    name: "Caparazón Reforzado",
    description: "Más filtros y mejor resistencia.",
    rarity: "epic",
    effects: { filters: 2, resistance: 0.08 },
  },
  {
    id: "hive_mind",
    name: "Mente Colmena",
    description: "Los filtros trabajan en perfecta sincronía.",
    rarity: "epic",
    effects: { ecoPerSecond: 2 },
  },
  {
    id: "elegant_swim",
    name: "Nado Elegante",
    description: "Desplazamiento fluido y mayor alcance.",
    rarity: "epic",
    effects: { speed: 1.15, radius: 0.5 },
  },
  {
    id: "toxic_reflex",
    name: "Reflejo Tóxico",
    description: "El caparazón refleja gran parte de la toxicidad.",
    rarity: "epic",
    effects: { resistance: 0.25 },
  },
  {
    id: "greater_symbiosis",
    name: "Simbiosis Mayor",
    description: "Los filtros generan más Eco y tienes uno extra.",
    rarity: "epic",
    effects: { ecoPerSecond: 2, filters: 1 },
  },
  {
    id: "coral_shield",
    name: "Escudo de Coral",
    description: "Un revivir adicional y algo de resistencia.",
    rarity: "epic",
    effects: { revives: 1, resistance: 0.05 },
  },
  {
    id: "eco_cargo",
    name: "Carga Ecológica",
    description: "El Eco se acumula rápidamente.",
    rarity: "epic",
    effects: { eco: 1.5 },
  },
  // Legendarias
  {
    id: "mirror_shell",
    name: "Caparazón Espejo",
    description: "El caparazón repele la mayor parte de la toxicidad.",
    rarity: "legendary",
    effects: { resistance: 0.4 },
  },
  {
    id: "supersonic_swim",
    name: "Nado Supersónico",
    description: "Nadas tan rápido que dejas atrás tu propia estela.",
    rarity: "legendary",
    effects: { speed: 1.5 },
  },
  {
    id: "titan_shell",
    name: "Caparazón del Titán",
    description: "Un caparazón colosal con filtros y resistencia.",
    rarity: "legendary",
    effects: { resistance: 0.15, filters: 2 },
  },
  {
    id: "whirlwind",
    name: "Torbellino",
    description: "El dash desata un vórtice devastador.",
    rarity: "legendary",
    effects: { dash: 1 },
  },
  {
    id: "amplifier",
    name: "Amplificador",
    description: "Todo el Eco que generas se multiplica.",
    rarity: "legendary",
    effects: { eco: 1.75 },
  },
  // Maldiciones
  {
    id: "greed",
    name: "Avaricia",
    description: "Más Eco, pero la tortuga se vuelve lenta.",
    rarity: "curse",
    effects: { eco: 1.5, speed: 0.8 },
  },
  {
    id: "fragility",
    name: "Fragilidad",
    description: "Más rápida, pero mucho más vulnerable a la toxicidad.",
    rarity: "curse",
    effects: { speed: 1.3, resistance: -0.5 },
  },
  {
    id: "extreme_greed",
    name: "Codicia Extrema",
    description: "Mucho más Eco, pero nadar cansa.",
    rarity: "curse",
    effects: { eco: 2, speed: 0.7 },
  },
  {
    id: "rupture",
    name: "Ruptura",
    description: "Velocidad extrema con un caparazón frágil.",
    rarity: "curse",
    effects: { speed: 1.5, resistance: -0.3 },
  },
  // Ultra
  {
    id: "ancestral_current",
    name: "Marea Primigenia",
    description:
      "Una sobrecarga de energía ancestral. Más velocidad y filtros adicionales.",
    rarity: "ultra_legendary",
    effects: { speed: 1.8, filters: 5 },
  },
  {
    id: "ocean_heart",
    name: "Corazón del Océano",
    description: "Sientes el pulso del mar. El Eco fluye hacia ti.",
    rarity: "ultra_legendary",
    effects: { eco: 2, ecoPerSecond: 3 },
  },
  {
    id: "abyssal_fury",
    name: "Furia Abisal",
    description: "Una criatura ancestral se manifiesta a través del caparazón.",
    rarity: "ultra_legendary",
    effects: { dash: 1.2, speed: 1.3, revives: 1 },
  },

  // Cartas que cambian reglas (#60): no suben números, cambian cómo se juega.
  {
    id: "whirlpool",
    name: "Remolino",
    description: "Mientras giras, recoges desechos al doble de distancia.",
    rarity: "rare",
    tags: ["dash"],
    rules: { spinCollectRadius: 2 },
  },
  {
    id: "chain_current",
    name: "Corriente Encadenada",
    description:
      "Cada giro que encadenas en menos de 1 s empuja más que el anterior.",
    rarity: "epic",
    tags: ["dash"],
    rules: { dashChainBonus: 0.2 },
  },
  {
    id: "twin_spheres",
    name: "Esferas Gemelas",
    description: "Cada esfera filtradora atrae dos desechos a la vez.",
    rarity: "epic",
    tags: ["filtro"],
    rules: { spherePull: 1 },
  },
  {
    id: "cheap_spheres",
    name: "Esferas de Algas",
    description: "Las esferas cuestan menos, pero se agotan antes.",
    rarity: "rare",
    tags: ["filtro"],
    rules: { sphereCost: 25, sphereCapacity: 0.5 },
  },
  {
    id: "burst_sphere",
    name: "Esfera Estallido",
    description: "Al agotarse, cada esfera estalla y limpia el agua.",
    rarity: "rare",
    tags: ["filtro", "cuidado"],
    rules: { sphereBurst: 10 },
  },
  {
    id: "soft_touch",
    name: "Tacto Suave",
    description:
      "Los desechos frágiles ya no se rompen aunque vayas a toda prisa.",
    rarity: "rare",
    tags: ["cuidado"],
    rules: { fragileSafe: true },
  },
  {
    id: "leak_hunter",
    name: "Cazafugas",
    description: "Las fugas tóxicas valen el triple de Eco.",
    rarity: "rare",
    tags: ["cuidado", "eco"],
    rules: { leakEco: 3 },
  },
  {
    id: "stinging_skin",
    name: "Piel Urticante",
    description:
      "Cada picadura de medusa te da Eco, pero atraes a una medusa más.",
    rarity: "rare",
    tags: ["riesgo"],
    effects: { enemies: 1 },
    rules: { jellyfishEco: 50 },
  },
  {
    id: "endless_tide",
    name: "Marea Eterna",
    description:
      "El tiempo del bioma deja de correr, pero el agua se vuelve más tóxica.",
    rarity: "epic",
    tags: ["riesgo"],
    effects: { passiveToxicity: 1.5 },
    rules: { noTimeLimit: true },
  },
  // Sinergias: crecen con cada carta de su etiqueta.
  {
    id: "fish_school",
    name: "Banco de Peces",
    description: "El dash crece con cada carta #DASH que tengas o elijas.",
    rarity: "rare",
    tags: ["dash"],
    scaling: { tag: "dash", effects: { dash: 0.15 } },
  },
  {
    id: "filter_network",
    name: "Red de Filtros",
    description:
      "Cada esfera genera más Eco con cada carta #FILTRO que tengas o elijas.",
    rarity: "epic",
    tags: ["filtro"],
    scaling: { tag: "filtro", effects: { ecoPerSecond: 0.3 } },
  },
  {
    id: "resonance",
    name: "Resonancia",
    description: "El Eco crece con cada carta #ECO que tengas o elijas.",
    rarity: "epic",
    tags: ["eco"],
    scaling: { tag: "eco", effects: { eco: 1.05 } },
  },

  // Caos: efectos con azar real, reglas alteradas o riesgo inmediato.
  {
    id: "mutation",
    name: "Mutación",
    description:
      "El agua reescribe tu cuerpo: un atributo al azar florece y otro se atrofia.",
    rarity: "chaos",
    random: {
      value: [
        { text: "↑ AL AZAR", tone: "positive" },
        { text: "↓ AL AZAR", tone: "negative" },
      ],
      apply: ({ turtle, run, rng }) => {
        const traits = [
          {
            label: "VELOCIDAD",
            buff: () => {
              turtle.stats.speed *= 1.5
            },
            curse: () => {
              turtle.stats.speed *= 0.8
            },
          },
          {
            label: "RADIO",
            buff: () => {
              turtle.stats.collectionRadius += 1.5
            },
            curse: () => {
              turtle.stats.collectionRadius = Math.max(
                0.5,
                turtle.stats.collectionRadius - 0.8,
              )
            },
          },
          {
            label: "FILTRO",
            buff: () => {
              turtle.stats.filterCapacity += 2
            },
            curse: () => {
              turtle.stats.filterCapacity = Math.max(
                1,
                turtle.stats.filterCapacity - 1,
              )
            },
          },
          {
            label: "RESISTENCIA",
            buff: () => {
              turtle.addToxicityResistance(0.2)
            },
            curse: () => {
              turtle.reduceToxicityResistance(0.15)
            },
          },
          {
            label: "ECO",
            buff: () => {
              run.ecoMultiplier *= 1.5
            },
            curse: () => {
              run.ecoMultiplier *= 0.8
            },
          },
        ]

        const buffIndex = rng.int(traits.length)
        let curseIndex = rng.int(traits.length - 1)
        if (curseIndex >= buffIndex) curseIndex++

        traits[buffIndex].buff()
        traits[curseIndex].curse()

        return `${traits[buffIndex].label} ↑ / ${traits[curseIndex].label} ↓`
      },
    },
  },
  {
    id: "double_or_nothing",
    name: "Doble o Nada",
    description: "La marea decide: el Eco se duplica o se parte en dos.",
    rarity: "chaos",
    random: {
      value: [
        { text: "ECO ×2", tone: "positive" },
        { text: "×0.5", tone: "negative" },
      ],
      separator: " O ",
      apply: ({ run, rng }) => {
        if (rng.next() < 0.5) {
          run.ecoMultiplier *= 2
          return "¡El Eco se duplica!"
        }

        run.ecoMultiplier *= 0.5
        return "El Eco se parte en dos"
      },
    },
  },
  {
    id: "medusa_pact",
    name: "Pacto de la Medusa",
    description:
      "La colonia te presta una vida, pero cada bioma trae más tentáculos.",
    rarity: "chaos",
    effects: { revives: 1, enemies: 2 },
  },
  {
    id: "unstable_eco",
    name: "Eco Inestable",
    description:
      "El Eco grita tan fuerte que el agua se vuelve más tóxica a tu alrededor.",
    rarity: "chaos",
    effects: { eco: 2, passiveToxicity: 1.5 },
  },
  {
    id: "black_tide",
    name: "Marea Negra",
    description:
      "Ganas impulso y un filtro extra, pero el agua te envenena al instante.",
    rarity: "chaos",
    effects: { speed: 1.25, filters: 1, toxicity: 20 },
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
  chaos: 14,
}
