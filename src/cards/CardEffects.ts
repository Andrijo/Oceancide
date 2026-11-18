// src/cards/CardEffects.ts
// Efectos declarativos de las cartas: de una sola declaración salen el texto
// del valor, su color (positivo/negativo) y la aplicación real.

import type { Card, CardContext, CardTag } from "./Card"
import { applyCardRules, describeCardRules } from "./CardRules"

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
  /** Multiplicador del Eco ganado. */
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
  speed: (v) => ({ text: `${percent(v)} VELOCIDAD`, tone: tone(v - 1) }),
  resistance: (v) => ({
    text: `${signed(v * 100)}% RESISTENCIA`,
    tone: tone(v),
  }),
  radius: (v) => ({ text: `${signed(v, 1)} RADIO`, tone: tone(v) }),
  filters: (v) => ({
    text: `${signed(v)} ${Math.abs(v) === 1 ? "FILTRO" : "FILTROS"}`,
    tone: tone(v),
  }),
  eco: (v) => ({ text: `${percent(v)} ECO`, tone: tone(v - 1) }),
  dash: (v) => ({ text: `${signed(v, 1)} DASH`, tone: tone(v) }),
  ecoPerSecond: (v) => ({
    text: `${signed(v, 1)} ECO POR FILTRO`,
    tone: tone(v),
  }),
  revives: (v) => ({ text: `${signed(v)} REVIVIR`, tone: tone(v) }),
  glow: (v) => ({ text: `${signed(v * 100)}% BRILLO`, tone: tone(v) }),
  enemies: (v) => ({
    text: `${signed(v)} ${Math.abs(v) === 1 ? "MEDUSA" : "MEDUSAS"}`,
    tone: tone(v, false),
  }),
  passiveToxicity: (v) => ({
    text: `${percent(v)} TOXICIDAD PASIVA`,
    tone: tone(v - 1, false),
  }),
  toxicity: (v) => ({ text: `${signed(v)} TOXICIDAD`, tone: tone(v, false) }),
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

/** Efectos que se multiplican entre sí (el resto se suman). */
const MULTIPLICATIVE: ReadonlySet<EffectKey> = new Set<EffectKey>([
  "speed",
  "eco",
  "passiveToxicity",
])

/** Junta dos efectos en uno equivalente a aplicar `a` y después `b`. */
export function combineCardEffects(
  a: CardEffects,
  b: CardEffects,
): CardEffects {
  const result: CardEffects = { ...a }
  for (const [key, value] of entries(b)) {
    const current = result[key]
    if (current === undefined) result[key] = value
    else
      result[key] = MULTIPLICATIVE.has(key) ? current * value : current + value
  }
  return result
}

/** Efectos aplicados `times` veces seguidas. */
export function scaleCardEffects(
  effects: CardEffects,
  times: number,
): CardEffects {
  const result: CardEffects = {}
  if (times <= 0) return result
  for (const [key, value] of entries(effects)) {
    result[key] = MULTIPLICATIVE.has(key) ? value ** times : value * times
  }
  return result
}

const TAG_LABELS: Record<CardTag, string> = {
  dash: "#DASH",
  filtro: "#FILTRO",
  eco: "#ECO",
  cuidado: "#CUIDADO",
  riesgo: "#RIESGO",
}

export function tagLabel(tag: CardTag): string {
  return TAG_LABELS[tag]
}

/**
 * Arquetipos de una carta: los declarados o, si no los tiene, los que se
 * deducen de sus efectos y su rareza.
 */
export function cardTags(card: Card): CardTag[] {
  if (card.tags) return card.tags
  const tags: CardTag[] = []
  const effects = card.effects ?? {}
  if (effects.dash !== undefined) tags.push("dash")
  if (effects.filters !== undefined || effects.ecoPerSecond !== undefined) {
    tags.push("filtro")
  }
  if (effects.eco !== undefined && effects.eco > 1) tags.push("eco")
  if (effects.resistance !== undefined && effects.resistance > 0) {
    tags.push("cuidado")
  }
  if (card.rarity === "curse" || card.rarity === "chaos") tags.push("riesgo")
  return tags
}

function countTag(cards: readonly Card[], tag: CardTag): number {
  return cards.filter((card) => cardTags(card).includes(tag)).length
}

/**
 * Lo que de verdad aplica una carta con las que ya tienes (`owned`): sus
 * efectos, su sinergia (una vez por carta de su etiqueta, ella incluida) y la
 * sinergia de las cartas que ya tienes y que escalan con sus etiquetas.
 */
export function effectiveCardEffects(
  card: Card,
  owned: readonly Card[],
): CardEffects {
  let effects: CardEffects = card.effects ?? {}

  if (card.scaling) {
    const own = cardTags(card).includes(card.scaling.tag) ? 1 : 0
    const times = countTag(owned, card.scaling.tag) + own
    effects = combineCardEffects(
      effects,
      scaleCardEffects(card.scaling.effects, times),
    )
  }

  const tags = cardTags(card)
  for (const other of owned) {
    if (other.scaling && tags.includes(other.scaling.tag)) {
      effects = combineCardEffects(effects, other.scaling.effects)
    }
  }

  return effects
}

/** Texto de una sinergia: sus efectos "POR #ETIQUETA". */
function describeScaling(card: Card): CardValuePart[] {
  if (!card.scaling) return []
  const suffix = ` POR ${tagLabel(card.scaling.tag)}`
  return describeCardEffects(card.scaling.effects).map((part) => ({
    ...part,
    text: part.text + suffix,
  }))
}

/** Tramos del valor de una carta: efectos, reglas, sinergia y azar. */
export function cardValueParts(card: Card): CardValuePart[] {
  return [
    ...(card.effects ? describeCardEffects(card.effects) : []),
    ...(card.rules ? describeCardRules(card.rules) : []),
    ...describeScaling(card),
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

/**
 * Aplica la carta entera con las que ya hay en `ctx.run.cards` (sinergias y
 * reglas incluidas); devuelve el resultado del azar si lo hay.
 */
export function applyCard(card: Card, ctx: CardContext): string | undefined {
  applyCardEffects(effectiveCardEffects(card, ctx.run.cards), ctx)
  if (card.rules) applyCardRules(card.rules, ctx.run.rules)
  return card.random?.apply(ctx)
}
