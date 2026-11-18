// src/cards/CardRules.ts
// Reglas de la run que las cartas pueden cambiar: no son números de la
// tortuga, sino cómo funcionan las mecánicas (giro, esferas, frágiles, fugas,
// medusas, tiempo). Igual que los efectos, son declarativas: de la misma
// declaración salen el texto de la carta y la regla que se activa.

import type { CardValuePart } from "./CardEffects"

export interface RunRules {
  /** Multiplicador del radio de recogida mientras dura el giro de 360°. */
  spinCollectRadius: number
  /** Fuerza extra del dash por cada giro encadenado (en menos de 1 s). */
  dashChainBonus: number
  /** Desechos que atrae cada esfera a la vez. */
  spherePull: number
  /** Coste en Eco de una esfera (0 = el normal). */
  sphereCost: number
  /** Multiplicador de los desechos que absorbe una esfera antes de agotarse. */
  sphereCapacity: number
  /** Toxicidad que limpia una esfera al agotarse. */
  sphereBurst: number
  /** Los desechos frágiles no se rompen al tocarlos en impulso. */
  fragileSafe: boolean
  /** Multiplicador del Eco de las fugas. */
  leakEco: number
  /** Eco por cada picadura de medusa. */
  jellyfishEco: number
  /** El tiempo del bioma no corre. */
  noTimeLimit: boolean
}

export type CardRules = Partial<RunRules>

export function createDefaultRules(): RunRules {
  return {
    spinCollectRadius: 1,
    dashChainBonus: 0,
    spherePull: 1,
    sphereCost: 0,
    sphereCapacity: 1,
    sphereBurst: 0,
    fragileSafe: false,
    leakEco: 1,
    jellyfishEco: 0,
    noTimeLimit: false,
  }
}

type RuleKey = keyof RunRules

/** Cómo se suma cada regla a la que ya hay (dos cartas iguales se acumulan). */
const COMBINERS: {
  [K in RuleKey]: (current: RunRules[K], value: RunRules[K]) => RunRules[K]
} = {
  spinCollectRadius: (c, v) => c * v,
  dashChainBonus: (c, v) => c + v,
  // `value` es cuántos desechos extra atrae.
  spherePull: (c, v) => c + v,
  sphereCost: (c, v) => (c > 0 ? Math.min(c, v) : v),
  sphereCapacity: (c, v) => c * v,
  sphereBurst: (c, v) => c + v,
  fragileSafe: (c, v) => c || v,
  leakEco: (c, v) => c * v,
  jellyfishEco: (c, v) => c + v,
  noTimeLimit: (c, v) => c || v,
}

const DESCRIBERS: {
  [K in RuleKey]: (value: RunRules[K]) => CardValuePart
} = {
  spinCollectRadius: (v) => ({
    text: `RADIO ×${v} AL GIRAR`,
    tone: "positive",
  }),
  dashChainBonus: (v) => ({
    text: `+${v} DASH POR GIRO ENCADENADO`,
    tone: "positive",
  }),
  spherePull: (v) => ({
    text: `ESFERAS ATRAEN ${1 + v} A LA VEZ`,
    tone: "positive",
  }),
  sphereCost: (v) => ({ text: `ESFERAS CUESTAN ${v}`, tone: "positive" }),
  sphereCapacity: (v) => ({
    text: `DURAN ×${v}`,
    tone: v >= 1 ? "positive" : "negative",
  }),
  sphereBurst: (v) => ({
    text: `ESFERA AGOTADA: −${v} TOXICIDAD`,
    tone: "positive",
  }),
  fragileSafe: () => ({ text: "FRÁGILES NO SE ROMPEN", tone: "positive" }),
  leakEco: (v) => ({ text: `FUGAS: ECO ×${v}`, tone: "positive" }),
  jellyfishEco: (v) => ({
    text: `+${v} ECO POR PICADURA`,
    tone: "positive",
  }),
  noTimeLimit: () => ({ text: "SIN TIEMPO LÍMITE", tone: "positive" }),
}

function ruleEntries(rules: CardRules): RuleKey[] {
  return (Object.keys(rules) as RuleKey[]).filter(
    (key) => rules[key] !== undefined,
  )
}

/** Tramos del valor de la carta que corresponden a sus reglas. */
export function describeCardRules(rules: CardRules): CardValuePart[] {
  return ruleEntries(rules).map((key) =>
    (DESCRIBERS[key] as (v: unknown) => CardValuePart)(rules[key]),
  )
}

/** Activa las reglas de una carta en las de la run (modifica `target`). */
export function applyCardRules(rules: CardRules, target: RunRules): void {
  for (const key of ruleEntries(rules)) {
    const combine = COMBINERS[key] as (c: unknown, v: unknown) => unknown
    ;(target as unknown as Record<RuleKey, unknown>)[key] = combine(
      target[key],
      rules[key],
    )
  }
}

/** Coste de una esfera con las reglas de la run. */
export function sphereCost(rules: RunRules, baseCost: number): number {
  return rules.sphereCost > 0 ? rules.sphereCost : baseCost
}

/** Desechos que absorbe una esfera con las reglas de la run (mínimo 1). */
export function sphereCapacity(rules: RunRules, baseCapacity: number): number {
  return Math.max(1, Math.round(baseCapacity * rules.sphereCapacity))
}

// --- Elección de carta: volver a tirar ---

const REROLL_BASE_COST = 15
const REROLL_COST_STEP = 10

/** Eco que cuesta volver a tirar las cartas tras `rerollsUsed` tiradas en la run. */
export function rerollCost(rerollsUsed: number): number {
  return REROLL_BASE_COST + REROLL_COST_STEP * Math.max(0, rerollsUsed)
}

/** Ventana (s desde el giro anterior) para que un giro cuente como encadenado. */
export const DASH_CHAIN_WINDOW = 1.8
/** Tope de la fuerza extra que suma una cadena de giros. */
export const DASH_CHAIN_MAX = 1

/**
 * Fuerza extra del giro según la cadena: cada giro encadenado suma
 * `bonus`, hasta `DASH_CHAIN_MAX`.
 */
export function dashChainBoost(chain: number, bonus: number): number {
  return Math.min(DASH_CHAIN_MAX, Math.max(0, chain) * bonus)
}
