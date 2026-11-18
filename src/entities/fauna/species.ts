import type { CreatureKind } from "../Creature"
import type { LookSpec } from "./look"

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

export interface SpeciesSpec {
  look: LookSpec
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
    look: {
      color: 0xe8c66a,
      accent: 0x8a6a2a,
      body: [0.45, 0.42, 0.5],
      tail: "fin",
      fins: "side",
      spikes: 26,
      eyeSize: 0.09,
      scale: [0.9, 1.15],
    },
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
    look: {
      color: 0x9fb4c4,
      accent: 0x4c6070,
      body: [0.22, 0.26, 1.2],
      tail: "fork",
      fins: "sideDorsal",
      snout: 0.35,
      stripes: 4,
      scale: [1, 1.25],
    },
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
    look: {
      color: 0x2b2533,
      accent: 0x5a3f5e,
      emissive: 0x41325a,
      body: [0.75, 0.65, 0.8],
      tail: "fin",
      fins: "side",
      lure: true,
      spikes: 10,
      eyeSize: 0.08,
      scale: [1, 1.3],
    },
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
    look: {
      color: 0xb2475a,
      accent: 0x8c3446,
      body: [0.6, 0.75, 0.6],
      tentacles: { count: 8, length: 1.5 },
      eyeSize: 0.1,
      scale: [0.9, 1.2],
    },
    move: { style: "swim", speed: 1.8, turn: 0.8 },
    behavior: { type: "steal", radius: 6, interval: 3.5, toxicity: 10 },
  },
  squid: {
    look: {
      color: 0xd8d0f0,
      accent: 0x9f8fd6,
      emissive: 0x7a6bd0,
      glow: 0.35,
      body: [0.32, 0.32, 1],
      fins: "side",
      tentacles: { count: 8, length: 1.1, front: true },
      scale: [0.9, 1.15],
    },
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
    look: {
      color: 0x7d6f62,
      accent: 0xb3542f,
      body: [0.75, 0.32, 0.55],
      legs: 6,
      claws: true,
      spikes: 6,
      eyeSize: 0.08,
      scale: [0.9, 1.3],
    },
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
    look: {
      color: 0x6b2f5c,
      accent: 0xb7ff5c,
      emissive: 0x9aff3c,
      glow: 0.45,
      body: [0.6, 0.35, 0.6],
      tentacles: { count: 14, length: 1.2, up: true },
      scale: [1, 1.4],
    },
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
    look: {
      color: 0x8fb1c9,
      accent: 0x6c8ea8,
      body: [0.4, 0.42, 1.3],
      tail: "fluke",
      fins: "sideDorsal",
      snout: 0.35,
      scale: [1, 1.2],
    },
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
    look: {
      color: 0xffa94d,
      accent: 0xffd27a,
      glow: 0.3,
      body: [0.22, 0.6, 0.25],
      tail: "whip",
      fins: "dorsal",
      snout: 0.25,
      scale: [0.9, 1.1],
    },
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
    look: {
      color: 0x5f6b73,
      accent: 0xd0d7dc,
      body: [0.18, 0.13, 0.6],
      tail: "fork",
      fins: "side",
      stripes: 2,
      scale: [1, 1.15],
    },
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
    look: {
      color: 0x2c3e55,
      accent: 0x3e5878,
      body: [0.7, 0.18, 0.9],
      fins: "wings",
      tail: "whip",
      eyeSize: 0.07,
      scale: [1.2, 1.5],
    },
    move: { style: "glide", speed: 2.2, turn: 0.35 },
    behavior: { type: "aura", effect: "radius", radius: 5.5, amount: 1.6 },
  },
  whale: {
    look: {
      color: 0x3f5f7a,
      accent: 0x5b7e9c,
      emissive: 0x7fd4ff,
      glow: 0.12,
      body: [1.3, 1.2, 3.6],
      tail: "fluke",
      fins: "side",
      eyeSize: 0.14,
      scale: [1.3, 1.6],
    },
    move: { style: "glide", speed: 1.6, turn: 0.2 },
    behavior: { type: "song", radius: 18, cleanse: 2.5, period: 16, length: 5 },
  },
  cleanerFish: {
    look: {
      color: 0x4fc3f7,
      accent: 0x0d2a4a,
      emissive: 0x4fc3f7,
      glow: 0.4,
      body: [0.14, 0.18, 0.42],
      tail: "fork",
      fins: "side",
      stripes: 1,
      scale: [1, 1.2],
    },
    move: { style: "swim", speed: 2.6, turn: 1.2 },
    behavior: { type: "graze", radius: 4, interval: 2.5 },
  },
  nettedTurtle: {
    look: {
      color: 0x7aa86a,
      accent: 0x4a6b3c,
      body: [0.55, 0.3, 0.7],
      legs: 4,
      shell: true,
      net: true,
      scale: [0.9, 1.05],
    },
    move: { style: "still", speed: 0, turn: 0 },
    behavior: { type: "rescue", radius: 2.6, time: 1.8, eco: 40, heal: 10 },
  },
}
