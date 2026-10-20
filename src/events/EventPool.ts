// src/events/EventPool.ts
import type { Turtle } from "@entities/Turtle"
import type { GameState } from "@core/types"
import type { RunState } from "@cards/Card"
import type { Rng } from "@core/rng"

export interface EventContext {
  turtle: Turtle
  state: GameState
  run: RunState
  rng: Rng
}

export interface EventOption {
  id: string
  label: string
  description: string
  /** Segundos que se suman (o restan) al límite del siguiente bioma. */
  nextBiomeTimeDelta?: number
  /** Suelo de toxicidad del siguiente bioma; 0 elimina el suelo natural. */
  nextBiomeToxicityFloor?: number
  apply: (ctx: EventContext) => void
}

export interface GameEvent {
  id: string
  title: string
  description: string
  options: EventOption[]
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
        apply: ({ state }) => {
          state.ecoAwareness += 250
          state.toxicity = Math.min(100, state.toxicity + 25)
        },
      },
      {
        id: "leave_chest",
        label: "Dejarlo intacto",
        description:
          "Usas el cofre como refugio y reduces tu toxicidad actual (-20).",
        apply: ({ state }) => {
          state.toxicity = Math.max(0, state.toxicity - 20)
        },
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
          "Ganas +1 capacidad de filtro, pero sufres un gran daño (+45 toxicidad).",
        apply: ({ turtle, state }) => {
          state.toxicity = Math.min(100, state.toxicity + 45)
          turtle.stats.filterCapacity += 1
        },
      },
      {
        id: "vent_and_pass",
        label: "Ventilar y pasar de largo",
        description:
          "El siguiente bioma empieza con 20s menos, pero limpias el gas (-30 toxicidad).",
        nextBiomeTimeDelta: -20,
        apply: ({ state }) => {
          state.toxicity = Math.max(0, state.toxicity - 30)
        },
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
        apply: ({ turtle }) => {
          turtle.stats.filterCapacity += 1
          turtle.stats.speed *= 0.85
        },
      },
      {
        id: "steal_glow",
        label: "Robar su bioluminiscencia",
        description:
          "Brillas con fuerza (+0.5 Glow), pero el remordimiento te resta eco (-150 Eco).",
        apply: ({ turtle, state }) => {
          turtle.setGlow(Math.min(1, turtle.getGlow() + 0.5))
          state.ecoAwareness = Math.max(0, state.ecoAwareness - 150)
        },
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
        nextBiomeTimeDelta: -20,
        apply: ({ state }) => {
          state.ecoAwareness += 400
        },
      },
      {
        id: "listen_song",
        label: "Escuchar el canto",
        description:
          "Recuperas toda tu salud (0 toxicidad), pero el siguiente bioma empieza con 10s menos.",
        nextBiomeTimeDelta: -10,
        nextBiomeToxicityFloor: 0,
        apply: ({ state }) => {
          state.toxicity = 0
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
          "Obtienes 100 Eco y +1 de radio, pero te enredas (-25% velocidad por el resto de la run).",
        apply: ({ turtle, state }) => {
          state.ecoAwareness += 100
          turtle.stats.collectionRadius += 1
          turtle.stats.speed *= 0.75
        },
      },
      {
        id: "go_around",
        label: "Rodearla",
        description:
          "El siguiente bioma empieza con 30s menos, pero ganas un pequeño impulso (+5% vel).",
        nextBiomeTimeDelta: -30,
        apply: ({ turtle }) => {
          turtle.stats.speed *= 1.05
        },
      },
    ],
  },
]
