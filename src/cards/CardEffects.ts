// src/cards/CardEffects.ts
// Efectos declarativos de las cartas: de una sola declaración salen el texto
// del valor, su color (positivo/negativo) y la aplicación real.

import type { Card, CardContext } from "./Card"

/**
 * Efectos de una carta. El orden de las claves es el orden en que se muestran.
 * Los multiplicadores usan 1 como neutro (1.1 = +10%, 0.8 = -20%).
 */
export interface CardEffects {
  /** Multiplicador de velocidad. */
  speed?: number
  /** Resistencia a la toxicidad (0.05 = +5%); en negativo la resta. */
  resistance?: number
  /** Radio de recolección sumado. */
  radius?: number
  /** Filtros activos simultáneos sumados. */
  filters?: number
  /** Multiplicador del eco ganado. */
  eco?: number
  /** Fuerza del dash (impulso del giro) sumada. */
  dash?: number
  /** Eco por segundo que genera cada filtro activo. */
  ecoPerSecond?: number
  /** Revivir extra. */
  revives?: number
  /** Brillo de la tortuga (0..1). */
  glow?: number
  /** Medusas extra por bioma. */
  enemies?: number
  /** Multiplicador de la toxicidad pasiva. */
  passiveToxicity?: number
  /** Toxicidad sumada al instante. */
  toxicity?: number
}

export type CardTone = "positive" | "negative" | "neutral"

/** Un tramo del valor de la carta, con su signo para pintarlo. */
export interface CardValuePart {
  text: string
  tone: CardTone
}

const VALUE_SEPARATOR = " / "

function signed(value: number, digits = 0): string {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return `${rounded > 0 ? "+" : ""}${rounded}`
}

function percent(multiplier: number): string {
  return `${signed((multiplier - 1) * 100)}%`
}

function tone(delta: number, goodWhenPositive = true): CardTone {
  if (delta === 0) return "neutral"
  return delta > 0 === goodWhenPositive ? "positive" : "negative"
}

type EffectKey = keyof CardEffects

const DESCRIBERS: Record<EffectKey, (value: number) => CardValuePart> = {
  speed: (v) => ({ text: `${percent(v)} VEL`, tone: tone(v - 1) }),
  resistance: (v) => ({ text: `${signed(v * 100)}% RES`, tone: tone(v) }),
  radius: (v) => ({ text: `${signed(v, 1)} RADIO`, tone: tone(v) }),
  filters: (v) => ({
    text: `${signed(v)} ${Math.abs(v) === 1 ? "FILTRO" : "FILTROS"}`,
    tone: tone(v),
  }),
  eco: (v) => ({ text: `${percent(v)} ECO`, tone: tone(v - 1) }),
  dash: (v) => ({ text: `${signed(v, 1)} DASH`, tone: tone(v) }),
  ecoPerSecond: (v) => ({ text: `${signed(v, 1)} ECO/S`, tone: tone(v) }),
  revives: (v) => ({ text: `${signed(v)} REVIVIR`, tone: tone(v) }),
  glow: (v) => ({ text: `${signed(v * 100)}% BRILLO`, tone: tone(v) }),
  enemies: (v) => ({
    text: `${signed(v)} ${Math.abs(v) === 1 ? "MEDUSA" : "MEDUSAS"}`,
    tone: tone(v, false),
  }),
  passiveToxicity: (v) => ({
    text: `${percent(v)} TOX PASIVA`,
    tone: tone(v - 1, false),
  }),
  toxicity: (v) => ({ text: `${signed(v)} TOX`, tone: tone(v, false) }),
}

const APPLIERS: Record<EffectKey, (value: number, ctx: CardContext) => void> = {
  speed: (v, { turtle }) => {
    turtle.stats.speed *= v
  },
  resistance: (v, { turtle }) => {
    if (v >= 0) turtle.addToxicityResistance(v)
    else turtle.reduceToxicityResistance(-v)
  },
  radius: (v, { turtle }) => {
    turtle.stats.collectionRadius += v
  },
  filters: (v, { turtle }) => {
    turtle.stats.filterCapacity += v
  },
  eco: (v, { run }) => {
    run.ecoMultiplier *= v
  },
  dash: (v, { turtle }) => {
    turtle.addSpinBoostMultiplier(v)
  },
  ecoPerSecond: (v, { run }) => {
    run.filterEcoPerSecond += v
  },
  revives: (v, { run }) => {
    run.reviveCharges += v
  },
  glow: (v, { turtle }) => {
    turtle.addGlow(v)
  },
  enemies: (v, { run }) => {
    run.enemyCountBonus += v
  },
  passiveToxicity: (v, { run }) => {
    run.toxicityMultiplier *= v
  },
  toxicity: (v, { state }) => {
    state.toxicity = Math.max(0, Math.min(100, state.toxicity + v))
  },
}

function entries(effects: CardEffects): [EffectKey, number][] {
  return (Object.keys(effects) as EffectKey[])
    .filter((key) => effects[key] !== undefined)
    .map((key) => [key, effects[key] as number])
}

/** Tramos del valor que se muestran en la carta, en el orden declarado. */
export function describeCardEffects(effects: CardEffects): CardValuePart[] {
  return entries(effects).map(([key, value]) => DESCRIBERS[key](value))
}

/** Aplica todos los efectos declarados. */
export function applyCardEffects(effects: CardEffects, ctx: CardContext): void {
  for (const [key, value] of entries(effects)) APPLIERS[key](value, ctx)
}

/** Une los tramos en un texto plano (lectores de pantalla, mensajes). */
export function joinCardValue(
  parts: CardValuePart[],
  separator = VALUE_SEPARATOR,
): string {
  return parts.map((part) => part.text).join(separator)
}

/** Tramos del valor de una carta: los declarados y, si tiene azar, los suyos. */
export function cardValueParts(card: Card): CardValuePart[] {
  return [
    ...(card.effects ? describeCardEffects(card.effects) : []),
    ...(card.random?.value ?? []),
  ]
}

export function cardValueSeparator(card: Card): string {
  return card.random?.separator ?? VALUE_SEPARATOR
}

/** Valor de la carta como texto plano. */
export function cardValueText(card: Card): string {
  return joinCardValue(cardValueParts(card), cardValueSeparator(card))
}

/** Aplica la carta entera; devuelve el resultado del azar si lo hay. */
export function applyCard(card: Card, ctx: CardContext): string | undefined {
  if (card.effects) applyCardEffects(card.effects, ctx)
  return card.random?.apply(ctx)
}
