// src/cards/BuildStats.ts
// La "build" de la inmersión en números: qué significa cada atributo de las cartas,
// cuánto tiene ahora la tortuga y cómo quedaría al elegir una carta.

import { addToxicityResistance } from "@core/systems/toxicity"
import type { Card, CardContext } from "./Card"
import type { CardEffects, CardTone } from "./CardEffects"

export type StatKey = keyof CardEffects

/** Valor actual de cada atributo que las cartas pueden tocar. */
export type BuildSnapshot = Record<StatKey, number>

export interface StatInfo {
  /** Nombre que usan las cartas en su valor ("VELOCIDAD", "RADIO"...). */
  term: string
  label: string
  description: string
  /** `false` en los atributos que perjudican al subir (toxicidad, medusas). */
  goodWhenHigher: boolean
  format(value: number): string
}

function fixed(value: number, digits: number): string {
  return value.toFixed(digits)
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** En el orden en que se enseñan en el panel "Tu tortuga". */
export const STAT_INFO: Record<StatKey, StatInfo> = {
  speed: {
    term: "VELOCIDAD",
    label: "Velocidad",
    description: "Lo rápido que nadas.",
    goodWhenHigher: true,
    format: (v) => fixed(v, 1),
  },
  resistance: {
    term: "RESISTENCIA",
    label: "Resistencia",
    description:
      "Frena la toxicidad que sube sola. Cada punto extra rinde menos (tope 90%).",
    goodWhenHigher: true,
    format: percent,
  },
  radius: {
    term: "RADIO",
    label: "Radio de recogida",
    description: "Distancia a la que recoges un desecho.",
    goodWhenHigher: true,
    format: (v) => fixed(v, 1),
  },
  filters: {
    term: "FILTRO",
    label: "Filtros",
    description: "Esferas filtradoras que puedes tener activas a la vez.",
    goodWhenHigher: true,
    format: (v) => String(Math.round(v)),
  },
  eco: {
    term: "ECO",
    label: "Eco por desecho",
    description: "Multiplica el Eco que da cada desecho.",
    goodWhenHigher: true,
    format: (v) => `×${fixed(v, 2)}`,
  },
  dash: {
    term: "DASH",
    label: "Fuerza del dash",
    description: "Empujón de velocidad del giro de 360°.",
    goodWhenHigher: true,
    format: (v) => `×${fixed(v, 1)}`,
  },
  ecoPerSecond: {
    term: "ECO POR FILTRO",
    label: "Eco por filtro",
    description: "Eco por segundo que genera cada esfera activa.",
    goodWhenHigher: true,
    format: (v) => `${fixed(v, 1)}/s`,
  },
  revives: {
    term: "REVIVIR",
    label: "Revivir",
    description: "Veces que vuelves si la toxicidad se llena.",
    goodWhenHigher: true,
    format: (v) => String(Math.round(v)),
  },
  glow: {
    term: "BRILLO",
    label: "Brillo",
    description: "Luz propia de la tortuga en las zonas oscuras.",
    goodWhenHigher: true,
    format: percent,
  },
  enemies: {
    term: "MEDUSAS",
    label: "Medusas extra",
    description: "Medusas añadidas a cada zona.",
    goodWhenHigher: false,
    format: (v) => `+${Math.round(v)}`,
  },
  passiveToxicity: {
    term: "TOXICIDAD PASIVA",
    label: "Toxicidad pasiva",
    description: "Multiplica lo rápido que sube sola la toxicidad.",
    goodWhenHigher: false,
    format: (v) => `×${fixed(v, 2)}`,
  },
  toxicity: {
    term: "TOXICIDAD",
    label: "Toxicidad",
    description: "Cambio inmediato en la calavera de toxicidad.",
    goodWhenHigher: false,
    format: (v) => `${Math.round(v)}%`,
  },
}

export const STAT_KEYS = Object.keys(STAT_INFO) as StatKey[]

/** Valor neutro: con él, un atributo "malo" no merece salir en el panel. */
const NEUTRAL: Partial<Record<StatKey, number>> = {
  enemies: 0,
  passiveToxicity: 1,
}

export type BuildSource = Pick<CardContext, "turtle" | "run" | "state">

/** Lee los valores actuales de la inmersión. */
export function readBuild({ turtle, run, state }: BuildSource): BuildSnapshot {
  return {
    speed: turtle.stats.speed,
    resistance: turtle.stats.toxicityResistance,
    radius: turtle.stats.collectionRadius,
    filters: turtle.stats.filterCapacity,
    eco: run.ecoMultiplier,
    dash: turtle.getSpinBoostMultiplier(),
    ecoPerSecond: run.filterEcoPerSecond,
    revives: run.reviveCharges,
    glow: turtle.getGlowTarget(),
    enemies: run.enemyCountBonus,
    passiveToxicity: run.toxicityMultiplier,
    toxicity: state.toxicity,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Cómo cambia cada atributo con un efecto. Tiene que coincidir con lo que
 * aplica `applyCardEffects`; un test lo comprueba con todas las cartas.
 */
const PROJECTORS: Record<StatKey, (current: number, value: number) => number> =
  {
    speed: (c, v) => c * v,
    resistance: (c, v) =>
      v >= 0 ? addToxicityResistance(c, v) : Math.max(0, c + v),
    radius: (c, v) => c + v,
    filters: (c, v) => c + v,
    eco: (c, v) => c * v,
    dash: (c, v) => c + v,
    ecoPerSecond: (c, v) => c + v,
    revives: (c, v) => c + v,
    glow: (c, v) => clamp(c + v, 0, 1),
    enemies: (c, v) => c + v,
    passiveToxicity: (c, v) => c * v,
    toxicity: (c, v) => clamp(c + v, 0, 100),
  }

/** Los valores que quedarían tras aplicar los efectos (no modifica nada). */
export function projectBuild(
  build: BuildSnapshot,
  effects: CardEffects,
): BuildSnapshot {
  const next = { ...build }
  for (const key of Object.keys(effects) as StatKey[]) {
    const value = effects[key]
    if (value !== undefined) next[key] = PROJECTORS[key](build[key], value)
  }
  return next
}

export interface CardPreviewLine {
  key: StatKey
  label: string
  before: string
  after: string
  tone: CardTone
  /** El valor no cambia (p. ej. la resistencia ya está en el tope). */
  noEffect: boolean
}

/**
 * Líneas "antes → después" de una carta, en el orden de sus efectos. Las
 * cartas con azar no se pueden prever: devuelven solo su parte declarada.
 */
export function previewCard(
  card: Card,
  build: BuildSnapshot,
): CardPreviewLine[] {
  if (!card.effects) return []

  const after = projectBuild(build, card.effects)
  const lines: CardPreviewLine[] = []

  for (const key of Object.keys(card.effects) as StatKey[]) {
    if (card.effects[key] === undefined) continue

    const info = STAT_INFO[key]
    const beforeText = info.format(build[key])
    const afterText = info.format(after[key])
    const delta = after[key] - build[key]
    const noEffect = beforeText === afterText

    lines.push({
      key,
      label: info.label,
      before: beforeText,
      after: afterText,
      tone: noEffect
        ? "neutral"
        : delta > 0 === info.goodWhenHigher
          ? "positive"
          : "negative",
      noEffect,
    })
  }

  return lines
}

/** Texto plano de una línea de vista previa (lectores de pantalla). */
export function previewLineText(line: CardPreviewLine): string {
  return line.noEffect
    ? `${line.label}: sin cambio (${line.before})`
    : `${line.label}: de ${line.before} a ${line.after}`
}

export interface BuildStatLine {
  key: StatKey
  label: string
  value: string
  description: string
  /** Atributo perjudicial activo (se pinta como aviso). */
  warning: boolean
}

/**
 * Atributos para el panel "Tu tortuga". La toxicidad ya tiene su calavera, y
 * los atributos perjudiciales solo salen cuando alguna carta los ha activado.
 */
export function buildStatLines(build: BuildSnapshot): BuildStatLine[] {
  const lines: BuildStatLine[] = []

  for (const key of STAT_KEYS) {
    if (key === "toxicity") continue
    if (NEUTRAL[key] !== undefined && build[key] === NEUTRAL[key]) continue

    const info = STAT_INFO[key]
    lines.push({
      key,
      label: info.label,
      value: info.format(build[key]),
      description: info.description,
      warning: !info.goodWhenHigher,
    })
  }

  return lines
}
