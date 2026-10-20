// src/events/EventPool.ts
import type { EventEffects } from "@/events/EventEffects"

export interface EventOption {
  id: string
  label: string
  description: string
  effects: EventEffects
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
          "Ganas +1 capacidad de filtro, pero sufres un gran daño (+45 toxicidad).",
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
          "Brillas con fuerza (+0.5 Glow), pero el remordimiento te resta eco (-150 Eco).",
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
          "Recuperas toda tu salud (0 toxicidad), pero el siguiente bioma empieza con 10s menos.",
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
          "Obtienes 100 Eco y +1 de radio, pero te enredas (-25% velocidad por el resto de la run).",
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
          "El siguiente bioma empieza con 30s menos, pero ganas un pequeño impulso (+5% vel).",
        effects: { speedMultiplier: 1.05, nextBiomeTimeDelta: -30 },
      },
    ],
  },
]
