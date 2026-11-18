// src/events/EventPool.ts
// Eventos narrativos que interrumpen la run entre biomas. Cada evento puede
// tener una condición (solo sale si se cumple), y cada opción puede pedir un
// requisito (se muestra bloqueada si no), tener una tirada de riesgo visible o
// dejar una consecuencia que llega unos biomas después.

import type { EventEffects } from "@/events/EventEffects"
import type { CardRarity } from "@cards/Card"
import type { BiomeKey } from "@core/types"

/** Lo que miran las condiciones de los eventos y los requisitos de las opciones. */
export interface EventConditionContext {
  toxicity: number
  eco: number
  reviveCharges: number
  biomeKey: BiomeKey
  /** Profundidad del bioma recién limpiado, en metros. */
  depth: number
  endless: boolean
  cardIds: readonly string[]
  cardRarities: readonly CardRarity[]
  /** Nivel de cada mejora permanente del Refugio. */
  upgrades: Readonly<Record<string, number>>
}

/** Requisito de una opción. Si no se cumple, la opción sale bloqueada. */
export interface OptionRequirement {
  /** Basta con llevar una de estas cartas. */
  anyCard?: readonly string[]
  /** Mejora del Refugio con al menos ese nivel. */
  upgrade?: { id: string; level: number }
  minEco?: number
  minRevives?: number
  /** Texto del requisito ("Requiere Filtros Avanzados 1"). */
  label: string
}

/** Opción con azar: la probabilidad se enseña antes de elegir. */
export interface EventRisk {
  /** Probabilidad de éxito (0..1). */
  chance: number
  success: EventEffects
  failure: EventEffects
}

/** Consecuencia diferida: llega al entrar en un bioma posterior. */
export interface DeferredConsequence {
  /** Biomas que tienen que pasar (1 = al entrar en el siguiente). */
  afterBiomes: number
  title: string
  message: string
  effects: EventEffects
}

export interface EventOption {
  id: string
  label: string
  description: string
  /** Efectos seguros de la opción (se suman al resultado de la tirada). */
  effects: EventEffects
  requires?: OptionRequirement
  risk?: EventRisk
  later?: DeferredConsequence
}

export interface GameEvent {
  id: string
  title: string
  description: string
  options: EventOption[]
  /** Si existe, el evento solo puede salir cuando devuelve `true`. */
  condition?: (ctx: EventConditionContext) => boolean
  /** Peso en el sorteo (1 por defecto). Los condicionados pesan más: son raros. */
  weight?: number
}

export const ACT_EVENTS: GameEvent[] = [
  {
    id: "sunken_chest",
    title: "El Cofre Hundido",
    description:
      "Encuentras un cofre de madera cubierto de percebes. Parece antiguo, pero algo brilla en su interior.",
    options: [
      {
        id: "force_lock",
        label: "Forzar la cerradura",
        description: "Obtienes 250 Eco, pero el ruido atrae toxicidad (+25).",
        effects: { eco: 250, toxicity: 25 },
      },
      {
        id: "leave_chest",
        label: "Dejarlo intacto",
        description:
          "Usas el cofre como refugio y reduces tu toxicidad actual (-20).",
        effects: { toxicity: -20 },
      },
    ],
  },
  {
    id: "toxic_vent",
    title: "Fumarola Tóxica",
    description:
      "Una grieta en el suelo libera un gas verde. Tus pulmones arden, pero el calor extremo podría acelerar tu metabolismo.",
    options: [
      {
        id: "take_core",
        label: "Sumergirte a por el núcleo",
        description:
          "Ganas +1 filtro, pero te intoxicas mucho (+45 toxicidad).",
        effects: { toxicity: 45, filterCapacity: 1 },
      },
      {
        id: "vent_and_pass",
        label: "Ventilar y pasar de largo",
        description:
          "El siguiente bioma empieza con 20s menos, pero limpias el gas (-30 toxicidad).",
        effects: { toxicity: -30, nextBiomeTimeDelta: -20 },
      },
    ],
  },
  {
    id: "wandering_turtle",
    title: "La Anciana",
    description:
      "Una tortuga gigante y sabia flota en la penumbra. Te observa con ojos que brillan en la oscuridad.",
    options: [
      {
        id: "ask_advice",
        label: "Pedir consejo",
        description:
          "Te enseña a filtrar mejor (+1 filtro), pero su ritmo te vuelve lenta (-15% velocidad).",
        effects: { filterCapacity: 1, speedMultiplier: 0.85 },
      },
      {
        id: "steal_glow",
        label: "Robar su bioluminiscencia",
        description:
          "Brillas con fuerza (+50% de brillo), pero el remordimiento te resta 150 Eco.",
        effects: { glow: 0.5, eco: -150 },
      },
    ],
  },
  {
    id: "abyssal_whale",
    title: "El Canto de la Ballena",
    description:
      "Una ballena colosal pasa a tu lado. Su canto resuena en tu caparazón y hace que el océano parezca más pequeño.",
    options: [
      {
        id: "ride_wake",
        label: "Nadar en su estela",
        description:
          "Ganas 400 Eco al arrastrar tesoros, pero el siguiente bioma empieza con 20s menos.",
        effects: { eco: 400, nextBiomeTimeDelta: -20 },
      },
      {
        id: "listen_song",
        label: "Escuchar el canto",
        description:
          "Te limpias por completo (toxicidad a 0), pero el siguiente bioma empieza con 10s menos.",
        effects: {
          toxicitySet: 0,
          nextBiomeTimeDelta: -10,
          nextBiomeToxicityFloor: 0,
        },
      },
    ],
  },
  {
    id: "ghost_net",
    title: "Red Fantasma",
    description:
      "Una red de pesca industrial abandonada bloquea tu camino. Está llena de desechos valiosos, pero parece peligrosa.",
    options: [
      {
        id: "cut_net",
        label: "Cortar la red",
        description:
          "Obtienes 100 Eco y +1 de radio, pero te enredas (-25% velocidad por el resto de la inmersión).",
        effects: {
          eco: 100,
          collectionRadius: 1,
          speedMultiplier: 0.75,
        },
      },
      {
        id: "go_around",
        label: "Rodearla",
        description:
          "El siguiente bioma empieza con 30s menos, pero ganas un pequeño impulso (+5% velocidad).",
        effects: { speedMultiplier: 1.05, nextBiomeTimeDelta: -30 },
      },
    ],
  },
  {
    id: "oil_spill",
    title: "Vertido del Petrolero",
    description:
      "Un petrolero encallado sangra crudo hacia el fondo. La mancha negra avanza y asfixia todo lo que toca.",
    options: [
      {
        id: "contain_spill",
        label: "Contener la mancha",
        description:
          "Empujas los restos lejos de la fauna: +200 Eco, pero te impregnas (+20 toxicidad).",
        effects: { eco: 200, toxicity: 20 },
      },
      {
        id: "cross_spill",
        label: "Atravesarla a toda velocidad",
        description:
          "Si sale bien, arrastras lo que flota; si no, el crudo se te pega al caparazón.",
        effects: {},
        risk: {
          chance: 0.5,
          success: { eco: 350 },
          failure: { toxicity: 35 },
        },
      },
      {
        id: "avoid_spill",
        label: "Rodear la mancha",
        description: "No te mancha, pero pierdes tiempo en el desvío.",
        effects: { nextBiomeTimeDelta: -15 },
      },
    ],
  },
  {
    id: "bleached_reef",
    title: "Arrecife Blanqueado",
    description:
      "El agua demasiado caliente ha dejado el coral blanco como el hueso. Aún quedan pólipos vivos entre las ramas muertas.",
    condition: (ctx) => ctx.depth <= 500,
    weight: 1.5,
    options: [
      {
        id: "replant_coral",
        label: "Replantar fragmentos vivos",
        description:
          "Cuesta 100 Eco, pero el arrecife te devuelve el favor: -25 toxicidad y entrada limpia en el siguiente bioma.",
        effects: { eco: -100, toxicity: -25, nextBiomeToxicityFloor: 0 },
        requires: { minEco: 100, label: "Requiere 100 Eco" },
      },
      {
        id: "collect_skeletons",
        label: "Recoger el coral muerto",
        description:
          "Lo vendes como recuerdo: +180 Eco, pero remover el fondo te intoxica (+10).",
        effects: { eco: 180, toxicity: 10 },
      },
      {
        id: "coral_shield_bond",
        label: "Fundir tu escudo con el coral",
        description:
          "Tu Escudo de Coral hace de semillero: +1 filtro y -15 toxicidad.",
        effects: { filterCapacity: 1, toxicity: -15 },
        requires: {
          anyCard: ["coral_shield"],
          label: "Requiere la carta Escudo de Coral",
        },
      },
    ],
  },
  {
    id: "poachers",
    title: "Pescadores Furtivos",
    description:
      "Un arrastrero sin bandera barre el fondo con redes prohibidas. Nadie más lo ha visto.",
    options: [
      {
        id: "sabotage_nets",
        label: "Sabotear sus redes",
        description: "Muerdes los cabos sin que te vean... o eso esperas.",
        effects: {},
        risk: {
          chance: 0.6,
          success: { eco: 300 },
          failure: { toxicity: 30 },
        },
      },
      {
        id: "free_catch",
        label: "Liberar las capturas",
        description:
          "Tus aletas mejoradas te dan la velocidad justa: +150 Eco y +1 de radio.",
        effects: { eco: 150, collectionRadius: 1 },
        requires: {
          upgrade: { id: "speed", level: 2 },
          label: "Requiere Aletas Mejoradas 2",
        },
      },
      {
        id: "hide_from_poachers",
        label: "Esconderte hasta que se vayan",
        description:
          "No arriesgas nada, pero el siguiente bioma empieza con 10s menos.",
        effects: { nextBiomeTimeDelta: -10 },
      },
    ],
  },
  {
    id: "entangled_whale",
    title: "Ballena Enredada",
    description:
      "Una ballena joven arrastra una maraña de cabos y boyas. Cada vez sale menos a respirar.",
    options: [
      {
        id: "free_whale",
        label: "Liberarla",
        description:
          "Te lleva tiempo (-15s en el siguiente bioma). Puede que no olvide tu ayuda.",
        effects: { nextBiomeTimeDelta: -15 },
        later: {
          afterBiomes: 2,
          title: "La ballena vuelve",
          message:
            "La ballena que liberaste te encuentra y su canto te limpia.",
          effects: { toxicity: -40, eco: 200 },
        },
      },
      {
        id: "keep_swimming",
        label: "Seguir nadando",
        description: "Recoges las boyas que suelta: +80 Eco.",
        effects: { eco: 80 },
      },
    ],
  },
  {
    id: "trapped_turtle",
    title: "Tortuga Atrapada",
    description:
      "Una tortuga como tú tiene el cuello atrapado en una anilla de plástico. Te mira, agotada.",
    options: [
      {
        id: "free_turtle",
        label: "Liberarla",
        description:
          "Romper la anilla te deja rozaduras (+10 toxicidad). Dice que te buscará más adelante.",
        effects: { toxicity: 10 },
        later: {
          afterBiomes: 2,
          title: "Una vieja amiga",
          message:
            "La tortuga que liberaste nada a tu lado y te ayuda a filtrar.",
          effects: { filterCapacity: 1, eco: 250 },
        },
      },
      {
        id: "take_ring",
        label: "Quedarte la anilla",
        description: "La reciclas: +60 Eco.",
        effects: { eco: 60 },
      },
    ],
  },
  {
    id: "roman_amphora",
    title: "Ánfora Romana",
    description:
      "Entre la basura asoma un ánfora de dos mil años, con el sello del alfarero intacto. Pesa muchísimo.",
    options: [
      {
        id: "carry_amphora",
        label: "Llevarla a un museo",
        description:
          "+300 Eco al entregarla, pero nadas más lenta (-10% velocidad).",
        effects: { eco: 300, speedMultiplier: 0.9 },
      },
      {
        id: "leave_amphora",
        label: "Dejarla donde está",
        description:
          "Es un refugio para los pulpos. Verlo te calma (-15 toxicidad).",
        effects: { toxicity: -15 },
      },
    ],
  },
  {
    id: "research_station",
    title: "Estación Científica Abandonada",
    description:
      "Un módulo de investigación yace hundido, con las luces de emergencia aún parpadeando.",
    condition: (ctx) => ctx.depth >= 1000,
    weight: 1.5,
    options: [
      {
        id: "loot_lab",
        label: "Registrar el laboratorio",
        description: "Quizá queden filtros de repuesto; quizá solo reactivos.",
        effects: {},
        risk: {
          chance: 0.5,
          success: { filterCapacity: 1 },
          failure: { toxicity: 40 },
        },
      },
      {
        id: "use_decontaminator",
        label: "Usar el descontaminador",
        description:
          "Te deja la toxicidad en 10, pero gasta 150 Eco de energía.",
        effects: { toxicitySet: 10, eco: -150 },
        requires: { minEco: 150, label: "Requiere 150 Eco" },
      },
      {
        id: "restart_reactor",
        label: "Reiniciar el reactor",
        description:
          "Con tus filtros avanzados lo estabilizas: +500 Eco, aunque algo se escapa (+20 toxicidad).",
        effects: { eco: 500, toxicity: 20 },
        requires: {
          upgrade: { id: "filters", level: 1 },
          label: "Requiere Filtros Avanzados 1",
        },
      },
    ],
  },
  {
    id: "toxic_bloom",
    title: "Marea Tóxica",
    description:
      "Tu cuerpo no aguanta más: el agua se vuelve espesa y verde a tu alrededor. Tienes que decidir rápido.",
    condition: (ctx) => ctx.toxicity > 70,
    weight: 3,
    options: [
      {
        id: "emergency_purge",
        label: "Purga de emergencia",
        description: "Gastas 200 Eco en limpiarte: -50 toxicidad.",
        effects: { eco: -200, toxicity: -50 },
        requires: { minEco: 200, label: "Requiere 200 Eco" },
      },
      {
        id: "endure_bloom",
        label: "Aguantar la marea",
        description: "Si resistes, la marea arrastra desechos valiosos.",
        effects: {},
        risk: {
          chance: 0.4,
          success: { eco: 600 },
          failure: { toxicity: 25 },
        },
      },
      {
        id: "flee_bloom",
        label: "Huir hacia aguas limpias",
        description:
          "-20 toxicidad, pero el siguiente bioma empieza con 20s menos.",
        effects: { toxicity: -20, nextBiomeTimeDelta: -20 },
      },
    ],
  },
  {
    id: "chaos_rift",
    title: "Grieta del Caos",
    description:
      "La carta de caos que llevas vibra. Delante, el agua se pliega sobre sí misma como un espejo roto.",
    condition: (ctx) => ctx.cardRarities.includes("chaos"),
    weight: 3,
    options: [
      {
        id: "embrace_chaos",
        label: "Abrazar el caos",
        description: "Puede multiplicar tu Eco o envenenarte.",
        effects: {},
        risk: {
          chance: 0.5,
          success: { ecoMultiplier: 1.25 },
          failure: { toxicity: 40 },
        },
      },
      {
        id: "seal_rift",
        label: "Sellar la grieta",
        description: "Cuesta 100 Eco, pero el agua se calma (-15 toxicidad).",
        effects: { eco: -100, toxicity: -15 },
      },
    ],
  },
  {
    id: "jelly_offering",
    title: "El Trono de las Medusas",
    description:
      "Una medusa enorme y translúcida bloquea el paso. Parece reconocer el revive que llevas contigo.",
    condition: (ctx) => ctx.reviveCharges > 0,
    weight: 2,
    options: [
      {
        id: "offer_revive",
        label: "Ofrecerle un revive",
        description: "Pierdes un revive a cambio de +700 Eco y +1 filtro.",
        effects: { revives: -1, eco: 700, filterCapacity: 1 },
        requires: { minRevives: 1, label: "Requiere un revive" },
      },
      {
        id: "sneak_past",
        label: "Rodearla con cuidado",
        description: "El siguiente bioma empieza con 20s menos.",
        effects: { nextBiomeTimeDelta: -20 },
      },
    ],
  },
  {
    id: "microplastic_storm",
    title: "Tormenta de Microplásticos",
    description:
      "Una nube brillante de partículas diminutas cubre el agua. Imposible verlas una a una; imposible no tragarlas.",
    options: [
      {
        id: "filter_storm",
        label: "Filtrar la nube",
        description:
          "Tus filtros avanzados la atrapan: +250 Eco y -20 toxicidad.",
        effects: { eco: 250, toxicity: -20 },
        requires: {
          upgrade: { id: "filters", level: 1 },
          label: "Requiere Filtros Avanzados 1",
        },
      },
      {
        id: "swim_through_storm",
        label: "Nadar a través",
        description:
          "Lo normal es salir con algo de Eco; a veces, con la tripa llena de plástico.",
        effects: {},
        risk: {
          chance: 0.7,
          success: { eco: 200 },
          failure: { toxicity: 20 },
        },
      },
      {
        id: "shelter_storm",
        label: "Refugiarte en el fondo",
        description: "Esperas a que pase: -10 toxicidad, -10% velocidad.",
        effects: { toxicity: -10, speedMultiplier: 0.9 },
      },
    ],
  },
  {
    id: "hydrothermal_garden",
    title: "Jardín Hidrotermal",
    description:
      "Gusanos tubícolas rojos se mecen alrededor de una chimenea caliente. La vida aquí no necesita el sol.",
    condition: (ctx) => ctx.depth >= 2000,
    weight: 1.5,
    options: [
      {
        id: "rest_in_heat",
        label: "Descansar en el calor",
        description:
          "-35 toxicidad, pero te entretienes (-10s en el siguiente bioma).",
        effects: { toxicity: -35, nextBiomeTimeDelta: -10 },
      },
      {
        id: "harvest_minerals",
        label: "Recoger minerales",
        description:
          "+350 Eco, aunque el agua ácida te pasa factura (+15 toxicidad).",
        effects: { eco: 350, toxicity: 15 },
      },
    ],
  },
  {
    id: "lost_diver",
    title: "El Buzo Perdido",
    description:
      "Un buzo desorientado da vueltas con poco aire. Su linterna apunta hacia el fondo, no hacia arriba.",
    options: [
      {
        id: "guide_diver",
        label: "Guiarlo a la superficie",
        description:
          "Pierdes 25s en el siguiente bioma. Tal vez cuente tu historia.",
        effects: { nextBiomeTimeDelta: -25 },
        later: {
          afterBiomes: 1,
          title: "El buzo cuenta tu historia",
          message:
            "El buzo que salvaste ha publicado tu hazaña: llegan donaciones.",
          effects: { eco: 400 },
        },
      },
      {
        id: "take_lantern",
        label: "Quedarte su linterna",
        description: "+40% de brillo, pero te sientes fatal (-50 Eco).",
        effects: { glow: 0.4, eco: -50 },
      },
    ],
  },
  {
    id: "ghost_ship",
    title: "Barco Fantasma",
    description:
      "Un pesquero hundido descansa de lado. En la bodega se adivina algo que late con luz propia.",
    options: [
      {
        id: "explore_hold",
        label: "Explorar la bodega",
        description: "Puede haber un corazón de medusa... o bidones abiertos.",
        effects: {},
        risk: {
          chance: 0.35,
          success: { revives: 1 },
          failure: { toxicity: 30 },
        },
      },
      {
        id: "salvage_deck",
        label: "Rebuscar en la cubierta",
        description: "Sin riesgos: +120 Eco.",
        effects: { eco: 120 },
      },
    ],
  },
  {
    id: "coral_nursery",
    title: "Vivero de Coral",
    description:
      "Unos biólogos han dejado estructuras con esquejes de coral. Muchas se han soltado con la corriente.",
    condition: (ctx) => ctx.depth <= 1000,
    options: [
      {
        id: "fix_nursery",
        label: "Recolocar las estructuras",
        description:
          "Tardas un rato (-15s en el siguiente bioma). El coral crecerá.",
        effects: { nextBiomeTimeDelta: -15 },
        later: {
          afterBiomes: 2,
          title: "El vivero florece",
          message: "El coral que recolocaste ya filtra el agua.",
          effects: { toxicity: -30, ecoMultiplier: 1.1 },
        },
      },
      {
        id: "eco_cargo_haul",
        label: "Cargar los esquejes sueltos",
        description: "Tu Carga Ecológica los lleva sin esfuerzo: +350 Eco.",
        effects: { eco: 350 },
        requires: {
          anyCard: ["eco_cargo"],
          label: "Requiere la carta Carga Ecológica",
        },
      },
      {
        id: "ignore_nursery",
        label: "Seguir tu camino",
        description: "+5% de velocidad por ir ligera.",
        effects: { speedMultiplier: 1.05 },
      },
    ],
  },
]
