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
  label: string
  description: string
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
        label: "Forzar la cerradura",
        description: "Obtienes 250 Eco, pero el ruido atrae toxicidad (+25).",
        apply: ({ state }) => {
          state.ecoAwareness += 250
          state.toxicity = Math.min(100, state.toxicity + 25)
        },
      },
      {
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
        label: "Sumergirte a por el núcleo",
        description:
          "Ganas +1 capacidad de filtro, pero sufres un gran daño (+45 toxicidad).",
        apply: ({ turtle, state }) => {
          state.toxicity = Math.min(100, state.toxicity + 45)
          turtle.stats.filterCapacity += 1
        },
      },
      {
        label: "Ventilar y pasar de largo",
        description:
          "Pierdes 20 segundos del temporizador, pero limpias el gas (-30 toxicidad).",
        apply: ({ state }) => {
          state.toxicity = Math.max(0, state.toxicity - 30)
          // El tiempo extra/penalización se maneja en Game.ts
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
        label: "Pedir consejo",
        description:
          "Te enseña a filtrar mejor (+1 filtro), pero su ritmo te vuelve lenta (-15% velocidad).",
        apply: ({ turtle }) => {
          turtle.stats.filterCapacity += 1
          turtle.stats.speed *= 0.85
        },
      },
      {
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
        label: "Nadar en su estela",
        description:
          "Ganas 400 Eco al arrastrar tesoros, pero pierdes 20s del temporizador.",
        apply: ({ state }) => {
          state.ecoAwareness += 400
          // La penalización de tiempo se maneja en Game.ts
        },
      },
      {
        label: "Escuchar el canto",
        description:
          "Recuperas toda tu salud (0 toxicidad), pero te roba tiempo (-10s).",
        apply: ({ state }) => {
          state.toxicity = 0
          // La penalización de tiempo se maneja en Game.ts
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
        label: "Rodearla",
        description:
          "Pierdes 30 segundos del temporizador, pero ganas un pequeño impulso (+5% vel).",
        apply: ({ turtle }) => {
          turtle.stats.speed *= 1.05
          // Penalización de tiempo en Game.ts
        },
      },
    ],
  },
]
