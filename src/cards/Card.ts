// src/cards/Card.ts
// Tipos del sistema de cartas roguelike.

import type { Turtle } from "@entities/Turtle"
import type { GameState } from "@core/types"

export type CardRarity =
  "common" | "rare" | "epic" | "legendary" | "curse" | "ultra_legendary"

/** Estado de la run que las cartas pueden modificar; vive en Game y se reinicia al empezar una run. */
export interface RunState {
  /** Cartas elegidas en esta run, en orden. */
  cards: Card[]

  /** Multiplicador de eco ganado (1 = normal). */
  ecoMultiplier: number

  /** Revives disponibles (Corazón de medusa). */
  reviveCharges: number

  /** Eco por segundo que genera cada filtro activo (Simbiosis). */
  filterEcoPerSecond: number
}

export function createRunState(): RunState {
  return {
    cards: [],
    ecoMultiplier: 1,
    reviveCharges: 0,
    filterEcoPerSecond: 0,
  }
}

/** Contexto que recibe una carta al aplicarse: puede tocar `turtle.stats`, `state` o `run`. */
export interface CardContext {
  turtle: Turtle
  state: GameState
  run: RunState
}

export interface Card {
  id: string
  name: string
  description: string
  rarity: CardRarity
  value: string
  apply(ctx: CardContext): void
}
