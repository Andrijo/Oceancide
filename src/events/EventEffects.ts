// src/events/EventEffects.ts
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

/** Efectos declarativos de una opción. No mutan nada por sí solos. */
export interface EventEffects {
  eco?: number
  toxicity?: number
  toxicitySet?: number
  nextBiomeTimeDelta?: number
  nextBiomeToxicityFloor?: number
  filterCapacity?: number
  collectionRadius?: number
  speedMultiplier?: number
  glow?: number
}

export type EventTone = "positive" | "negative" | "neutral"

export interface EventPreviewLine {
  label: string
  value: string
  tone: EventTone
  noEffect?: boolean
}

export interface EventPreview {
  lines: EventPreviewLine[]
  warning?: string
}

export interface AppliedEventEffects {
  nextBiomeTimeDelta: number
  nextBiomeToxicityFloor?: number
  summary: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("es")
}

function signedInt(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("es")}`
}

function signedDecimal(value: number, digits = 1): string {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return `${rounded > 0 ? "+" : ""}${rounded}`
}

function formatToxicity(value: number): string {
  return `${Math.round(value)}%`
}

function toxicityAfter(effects: EventEffects, current: number): number {
  if (effects.toxicitySet !== undefined) {
    return clamp(effects.toxicitySet, 0, 100)
  }
  return clamp(current + (effects.toxicity ?? 0), 0, 100)
}

export function previewEventEffects(
  effects: EventEffects,
  ctx: EventContext,
): EventPreview {
  const lines: EventPreviewLine[] = []
  let lethal = false

  if (effects.eco !== undefined) {
    const before = ctx.state.ecoAwareness
    const after = Math.max(0, before + effects.eco)
    const delta = after - before
    const noEffect = Math.abs(delta) < 0.5

    lines.push({
      label: "Eco",
      value: noEffect
        ? "Sin efecto"
        : `${signedInt(delta)} (${formatInt(before)} → ${formatInt(after)})`,
      tone: noEffect ? "neutral" : delta > 0 ? "positive" : "negative",
      noEffect,
    })
  }

  if (effects.toxicitySet !== undefined || effects.toxicity !== undefined) {
    const before = ctx.state.toxicity
    const after = toxicityAfter(effects, before)
    const delta = after - before
    const noEffect = Math.abs(delta) < 0.5

    lines.push({
      label: "Toxicidad",
      value: noEffect
        ? "Sin efecto"
        : `${signedInt(delta)} (${formatToxicity(before)} → ${formatToxicity(after)})`,
      tone: noEffect ? "neutral" : delta > 0 ? "negative" : "positive",
      noEffect,
    })

    if (after >= 100) lethal = true
  }

  if (effects.filterCapacity !== undefined && effects.filterCapacity !== 0) {
    const before = ctx.turtle.stats.filterCapacity
    const after = before + effects.filterCapacity

    lines.push({
      label: "Filtros",
      value: `${before} → ${after}`,
      tone: effects.filterCapacity > 0 ? "positive" : "negative",
    })
  }

  if (effects.collectionRadius !== undefined && effects.collectionRadius !== 0) {
    const before = ctx.turtle.stats.collectionRadius
    const after = before + effects.collectionRadius

    lines.push({
      label: "Radio",
      value: `${before.toFixed(1)} → ${after.toFixed(1)}`,
      tone: effects.collectionRadius > 0 ? "positive" : "negative",
    })
  }

  if (effects.speedMultiplier !== undefined && effects.speedMultiplier !== 1) {
    const percent = Math.round((effects.speedMultiplier - 1) * 100)

    lines.push({
      label: "Velocidad",
      value: `${signedInt(percent)}%`,
      tone: percent > 0 ? "positive" : "negative",
    })
  }

  if (effects.glow !== undefined && effects.glow !== 0) {
    const before = ctx.turtle.getGlowTarget()
    const after = clamp(before + effects.glow, 0, 1)
    const delta = after - before
    const noEffect = Math.abs(delta) < 0.05

    lines.push({
      label: "Bioluminiscencia",
      value: noEffect
        ? "Sin efecto"
        : `${signedDecimal(delta)} (${before.toFixed(1)} → ${after.toFixed(1)})`,
      tone: noEffect ? "neutral" : "positive",
      noEffect,
    })
  }

  if (effects.nextBiomeTimeDelta) {
    lines.push({
      label: "Tiempo siguiente bioma",
      value: `${signedInt(effects.nextBiomeTimeDelta)}s`,
      tone: effects.nextBiomeTimeDelta > 0 ? "positive" : "negative",
    })
  }

  if (effects.nextBiomeToxicityFloor !== undefined) {
    lines.push({
      label: "Inicio siguiente bioma",
      value:
        effects.nextBiomeToxicityFloor === 0
          ? "0% (limpio)"
          : formatToxicity(effects.nextBiomeToxicityFloor),
      tone: effects.nextBiomeToxicityFloor === 0 ? "positive" : "neutral",
    })
  }

  let warning: string | undefined
  if (lethal) {
    warning =
      ctx.run.reviveCharges > 0
        ? "Puede consumir un revive"
        : "Puede matarte"
  }

  return { lines, warning }
}

export function applyEventEffects(
  effects: EventEffects,
  ctx: EventContext,
): AppliedEventEffects {
  const parts: string[] = []

  if (effects.eco !== undefined) {
    const before = ctx.state.ecoAwareness
    const after = Math.max(0, before + effects.eco)
    ctx.state.ecoAwareness = after
    const delta = after - before

    if (Math.abs(delta) >= 0.5) {
      parts.push(`${signedInt(delta)} Eco`)
    }
  }

  if (effects.toxicitySet !== undefined || effects.toxicity !== undefined) {
    const before = ctx.state.toxicity
    const after = toxicityAfter(effects, before)
    ctx.state.toxicity = after
    const delta = after - before

    if (Math.abs(delta) >= 0.5) {
      parts.push(`${signedInt(delta)} toxicidad`)
    }
  }

  if (effects.filterCapacity !== undefined && effects.filterCapacity !== 0) {
    ctx.turtle.stats.filterCapacity += effects.filterCapacity
    parts.push(
      `${signedInt(effects.filterCapacity)} filtro${
        Math.abs(effects.filterCapacity) === 1 ? "" : "s"
      }`,
    )
  }

  if (effects.collectionRadius !== undefined && effects.collectionRadius !== 0) {
    ctx.turtle.stats.collectionRadius += effects.collectionRadius
    parts.push(`${signedDecimal(effects.collectionRadius)} radio`)
  }

  if (effects.speedMultiplier !== undefined && effects.speedMultiplier !== 1) {
    ctx.turtle.stats.speed *= effects.speedMultiplier
    const percent = Math.round((effects.speedMultiplier - 1) * 100)
    parts.push(`${signedInt(percent)}% velocidad`)
  }

  if (effects.glow !== undefined && effects.glow !== 0) {
    const delta = ctx.turtle.addGlow(effects.glow)

    if (Math.abs(delta) >= 0.05) {
      parts.push(`${signedDecimal(delta)} bioluminiscencia`)
    }
  }

  if (effects.nextBiomeTimeDelta) {
    parts.push(`${signedInt(effects.nextBiomeTimeDelta)}s siguiente bioma`)
  }

  if (effects.nextBiomeToxicityFloor !== undefined) {
    parts.push(
      effects.nextBiomeToxicityFloor === 0
        ? "entrada limpia"
        : `${formatToxicity(effects.nextBiomeToxicityFloor)} toxicidad inicial`,
    )
  }

  return {
    nextBiomeTimeDelta: effects.nextBiomeTimeDelta ?? 0,
    nextBiomeToxicityFloor: effects.nextBiomeToxicityFloor,
    summary: parts.length > 0 ? parts.join(" · ") : "Sin efecto",
  }
}
