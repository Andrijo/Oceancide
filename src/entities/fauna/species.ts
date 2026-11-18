import type { CreatureKind } from "../Creature"

export type MoveStyle = "swim" | "glide" | "floor" | "still"

export interface MoveSpec {
  style: MoveStyle
  /** u/s de crucero (la tortuga va a 9). */
  speed: number
  /** rad/s máximos de giro al vagar. */
  turn: number
}

/** Qué hace cada especie. Los números están en unidades del juego. */
export type BehaviorSpec =
  // Hostiles
  | {
      type: "contact"
      toxicity: number
      slow?: [number, number]
      cooldown: number
      radius: number
    }
  | {
      type: "inflate"
      trigger: number
      duration: number
      toxicity: number
      aura: number
      drain: number
    }
  | {
      type: "chase"
      detect: number
      speed: number
      duration: number
      rest: number
      toxicity: number
      /** Espera quieta en el fondo y se lanza de cerca (rape). */
      ambush?: boolean
    }
  | { type: "steal"; radius: number; interval: number; toxicity: number }
  | {
      type: "ink"
      trigger: number
      cloud: number
      duration: number
      drain: number
      cooldown: number
    }
  // Amigas
  | {
      type: "boon"
      effect: "heal" | "haste" | "shield"
      amount: number
      cooldown: number
      radius: number
    }
  | { type: "aura"; effect: "radius"; radius: number; amount: number }
  | {
      type: "song"
      radius: number
      cleanse: number
      period: number
      length: number
    }
  | { type: "rescue"; radius: number; time: number; eco: number; heal: number }
  | { type: "graze"; radius: number; interval: number }

/**
 * Ficha de una especie: cómo se mueve y qué hace. Su aspecto está en
 * `models/` (un modelo propio por especie).
 */
export interface SpeciesSpec {
  move: MoveSpec
  behavior: BehaviorSpec
}

/** Especies montadas con piezas (las de clase propia no están aquí). */
export type GenericKind = Exclude<
  CreatureKind,
  | "jellyfish"
  | "lanternfish"
  | "eel"
  | "fishSchool"
  | "netKraken"
  | "scrapShark"
  | "leviathan"
>

export const SPECIES: Record<GenericKind, SpeciesSpec> = {
  // ---------------------------------------------------------------- hostiles
  pufferfish: {
    move: { style: "swim", speed: 1.2, turn: 0.6 },
    behavior: {
      type: "inflate",
      trigger: 4.5,
      duration: 3.5,
      toxicity: 12,
      aura: 3.2,
      drain: 6,
    },
  },
  barracuda: {
    move: { style: "swim", speed: 2.4, turn: 0.5 },
    behavior: {
      type: "chase",
      detect: 13,
      speed: 7.2,
      duration: 3.5,
      rest: 5,
      toxicity: 14,
    },
  },
  anglerfish: {
    move: { style: "floor", speed: 0.4, turn: 0.3 },
    behavior: {
      type: "chase",
      detect: 6.5,
      speed: 11,
      duration: 1.1,
      rest: 6,
      toxicity: 18,
      ambush: true,
    },
  },
  octopus: {
    move: { style: "swim", speed: 1.8, turn: 0.8 },
    behavior: { type: "steal", radius: 6, interval: 3.5, toxicity: 10 },
  },
  squid: {
    move: { style: "swim", speed: 2, turn: 0.7 },
    behavior: {
      type: "ink",
      trigger: 7,
      cloud: 3.6,
      duration: 5,
      drain: 7,
      cooldown: 9,
    },
  },
  scrapCrab: {
    move: { style: "floor", speed: 1.4, turn: 0.9 },
    behavior: {
      type: "contact",
      toxicity: 10,
      slow: [1.5, 0.6],
      cooldown: 2.5,
      radius: 1.5,
    },
  },
  anemone: {
    move: { style: "still", speed: 0, turn: 0 },
    behavior: {
      type: "contact",
      toxicity: 9,
      slow: [2.5, 0.35],
      cooldown: 2,
      radius: 1.8,
    },
  },

  // ------------------------------------------------------------------ amigas
  dolphin: {
    move: { style: "swim", speed: 5.5, turn: 0.9 },
    behavior: {
      type: "boon",
      effect: "haste",
      amount: 1.45,
      cooldown: 10,
      radius: 2.6,
    },
  },
  seahorse: {
    move: { style: "swim", speed: 0.7, turn: 0.5 },
    behavior: {
      type: "boon",
      effect: "heal",
      amount: 14,
      cooldown: 14,
      radius: 2,
    },
  },
  remora: {
    move: { style: "swim", speed: 2.2, turn: 0.8 },
    behavior: {
      type: "boon",
      effect: "shield",
      amount: 1,
      cooldown: 20,
      radius: 2,
    },
  },
  manta: {
    move: { style: "glide", speed: 2.2, turn: 0.35 },
    behavior: { type: "aura", effect: "radius", radius: 5.5, amount: 1.6 },
  },
  whale: {
    move: { style: "glide", speed: 1.6, turn: 0.2 },
    behavior: { type: "song", radius: 18, cleanse: 2.5, period: 16, length: 5 },
  },
  cleanerFish: {
    move: { style: "swim", speed: 2.6, turn: 1.2 },
    behavior: { type: "graze", radius: 4, interval: 2.5 },
  },
  nettedTurtle: {
    move: { style: "still", speed: 0, turn: 0 },
    behavior: { type: "rescue", radius: 2.6, time: 1.8, eco: 40, heal: 10 },
  },
}
