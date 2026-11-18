// src/events/EventSelection.ts
// Cuándo sale un evento, cuál sale, qué opciones están bloqueadas, cómo se
// resuelven las tiradas de riesgo y las consecuencias diferidas. Lógica pura:
// Game solo la llama con el estado de la run.

import type { Rng } from "@core/rng"
import {
  describeEffects,
  mergeEffects,
  previewEventEffects,
  type EventContext,
  type EventEffects,
  type EventPreview,
  type EventPreviewLine,
} from "@/events/EventEffects"
import type {
  DeferredConsequence,
  EventConditionContext,
  EventOption,
  GameEvent,
} from "@/events/EventPool"

/** Biomas (índice del que se acaba de limpiar) tras los que hay evento en el modo normal. */
export const NORMAL_EVENT_BIOMES: readonly number[] = [1, 3]
/** En la inmersión sin fin, un evento cada tantos biomas. */
export const ENDLESS_EVENT_EVERY = 2

/** ¿Toca evento al terminar el bioma `biomeIndex`? */
export function isEventBiome(biomeIndex: number, endless: boolean): boolean {
  if (endless)
    return biomeIndex % ENDLESS_EVENT_EVERY === ENDLESS_EVENT_EVERY - 1
  return NORMAL_EVENT_BIOMES.includes(biomeIndex)
}

/** Eventos que pueden salir: no vistos en la run y con la condición cumplida. */
export function availableEvents(
  pool: readonly GameEvent[],
  ctx: EventConditionContext,
  seen: readonly string[],
): GameEvent[] {
  return pool.filter(
    (event) =>
      !seen.includes(event.id) && (!event.condition || event.condition(ctx)),
  )
}

/**
 * Sortea un evento entre los disponibles (por peso). `null` si ya no queda
 * ninguno: en una inmersión sin fin muy larga se pueden agotar.
 */
export function pickEvent(
  rng: Rng,
  pool: readonly GameEvent[],
  ctx: EventConditionContext,
  seen: readonly string[],
): GameEvent | null {
  const candidates = availableEvents(pool, ctx, seen)
  if (candidates.length === 0) return null
  return rng.pickWeighted(candidates, (event) => event.weight ?? 1)
}

/** Motivo por el que una opción está bloqueada, o `null` si se puede elegir. */
export function optionLockReason(
  option: EventOption,
  ctx: EventConditionContext,
): string | null {
  const req = option.requires
  if (!req) return null
  const ok =
    (!req.anyCard || req.anyCard.some((id) => ctx.cardIds.includes(id))) &&
    (!req.upgrade ||
      (ctx.upgrades[req.upgrade.id] ?? 0) >= req.upgrade.level) &&
    (req.minEco === undefined || ctx.eco >= req.minEco) &&
    (req.minRevives === undefined || ctx.reviveCharges >= req.minRevives)
  return ok ? null : req.label
}

export interface ResolvedOption {
  /** Efectos totales a aplicar (los seguros más el resultado de la tirada). */
  effects: EventEffects
  /** Resultado de la tirada, si la opción tiene riesgo. */
  roll?: "success" | "failure"
}

/** Resuelve una opción: si tiene riesgo, tira con la semilla de la run. */
export function resolveOption(option: EventOption, rng: Rng): ResolvedOption {
  if (!option.risk) return { effects: option.effects }
  const success = rng.next() < option.risk.chance
  const outcome = success ? option.risk.success : option.risk.failure
  return {
    effects: mergeEffects(option.effects, outcome),
    roll: success ? "success" : "failure",
  }
}

/** Probabilidad en porcentaje entero, como se enseña ("60%"). */
export function riskPercent(chance: number): number {
  return Math.round(Math.min(1, Math.max(0, chance)) * 100)
}

interface ScheduledConsequence extends DeferredConsequence {
  /** Índice del bioma al entrar en el cual llega. */
  dueBiome: number
}

/** Consecuencias diferidas pendientes de la run. */
export class DeferredQueue {
  private items: ScheduledConsequence[] = []

  /** Programa `later` desde el bioma `biomeIndex` (el del evento). */
  public schedule(later: DeferredConsequence, biomeIndex: number): void {
    this.items.push({
      ...later,
      dueBiome: biomeIndex + Math.max(1, Math.floor(later.afterBiomes)),
    })
  }

  /** Saca las que llegan al entrar en `biomeIndex` (o antes, si se saltó alguno). */
  public takeDue(biomeIndex: number): DeferredConsequence[] {
    const due = this.items.filter((item) => item.dueBiome <= biomeIndex)
    this.items = this.items.filter((item) => item.dueBiome > biomeIndex)
    return due.map((item) => ({
      afterBiomes: item.afterBiomes,
      title: item.title,
      message: item.message,
      effects: item.effects,
    }))
  }

  public get size(): number {
    return this.items.length
  }

  public clear(): void {
    this.items = []
  }
}

/**
 * Vista previa de una opción: sus efectos seguros y, si tiene riesgo, una
 * línea por resultado con su probabilidad ("60%: +300 Eco").
 */
export function previewOption(
  option: EventOption,
  ctx: EventContext,
): EventPreview {
  const base = previewEventEffects(option.effects, ctx)
  const risk = option.risk
  if (!risk) return base

  const win = riskPercent(risk.chance)
  const lines: EventPreviewLine[] = [
    ...base.lines,
    {
      label: `${win}%`,
      value: describeEffects(risk.success),
      tone: "positive",
    },
    {
      label: `${100 - win}%`,
      value: describeEffects(risk.failure),
      tone: "negative",
    },
  ]
  // El aviso de muerte mira el peor caso.
  const worst = previewEventEffects(
    mergeEffects(option.effects, risk.failure),
    ctx,
  )
  return { lines, warning: base.warning ?? worst.warning }
}
