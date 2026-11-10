// src/cards/Card.ts
// Tipos del sistema de cartas roguelike.

import type { Turtle } from "@entities/Turtle"
import type { GameState } from "@core/types"
import type { Rng } from "@core/rng"
import type { CardEffects, CardValuePart } from "./CardEffects"

export type CardRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "curse"
  | "ultra_legendary"
  | "chaos"

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

  /** Multiplicador de la toxicidad pasiva (cartas de riesgo). */
  toxicityMultiplier: number

  /** Medusas extra por bioma (Pacto de la Medusa). */
  enemyCountBonus: number
}

export function createRunState(): RunState {
  return {
    cards: [],
    ecoMultiplier: 1,
    reviveCharges: 0,
    filterEcoPerSecond: 0,
    toxicityMultiplier: 1,
    enemyCountBonus: 0,
  }
}

/** Contexto que recibe una carta al aplicarse: puede tocar `turtle.stats`, `state` o `run`. */
export interface CardContext {
  turtle: Turtle
  state: GameState
  run: RunState
  rng: Rng
}

/** Parte con azar de una carta: no se puede declarar, así que trae su propio texto. */
export interface CardRandomEffect {
  /** Tramos del valor que se muestran, con su signo. */
  value: CardValuePart[]
  /** Separador entre tramos (por defecto " / "). */
  separator?: string
  /** Aplica el efecto y devuelve un texto que explica qué ha salido. */
  apply(ctx: CardContext): string
}

export interface Card {
  id: string
  name: string
  description: string
  rarity: CardRarity
  /**
   * Efectos declarativos: de aquí salen el valor mostrado y la aplicación, así
   * que una carta no puede hacer nada que no enseñe.
   */
  effects?: CardEffects
  /** Solo para cartas cuyo resultado depende del azar. */
  random?: CardRandomEffect
}
