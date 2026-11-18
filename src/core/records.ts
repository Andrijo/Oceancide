// src/core/records.ts
// Récords personales entre runs. La zona más profunda del modo normal ya vive
// en `MetaState.bestBiomeIndex`; aquí van los demás.

import { BIOME_ORDER, type RunSummary } from "@core/types"

export interface RunRecords {
  /** Más desechos recogidos en una sola run. */
  bestDebris: number
  /** Más Eco ganado en una sola run (base + bono). */
  bestEco: number
  /** Más biomas sobrevividos en una inmersión sin fin. */
  bestEndlessBiomes: number
  /** Run normal completada más rápida, en segundos (0 = ninguna). */
  fastestCompletion: number
}

export type RecordKind = "biome" | "debris" | "eco" | "endless" | "fastest"

export function createDefaultRecords(): RunRecords {
  return {
    bestDebris: 0,
    bestEco: 0,
    bestEndlessBiomes: 0,
    fastestCompletion: 0,
  }
}

/** Biomas que cuenta una inmersión sin fin (el resumen dice lo mismo). */
export function endlessBiomes(summary: Pick<RunSummary, "biomeIndex">): number {
  return summary.biomeIndex + 1
}

/** Índice de bioma que cuenta para la zona más profunda del modo normal. */
export function normalBiomeIndex(
  summary: Pick<RunSummary, "biomeIndex">,
): number {
  return Math.min(summary.biomeIndex, BIOME_ORDER.length - 1)
}

interface RecordState {
  bestBiomeIndex: number
  records: RunRecords
}

/**
 * Récords que bate esta run frente a los anteriores. Solo cuenta si ya había
 * una marca: la primera run no se anuncia como récord en todo.
 */
export function computeNewRecords(
  before: RecordState,
  summary: RunSummary,
): RecordKind[] {
  const { records } = before
  const result: RecordKind[] = []
  const eco = summary.ecoBase + summary.ecoBonus

  if (summary.endless) {
    const biomes = endlessBiomes(summary)
    if (records.bestEndlessBiomes > 0 && biomes > records.bestEndlessBiomes) {
      result.push("endless")
    }
  } else if (
    before.bestBiomeIndex >= 0 &&
    normalBiomeIndex(summary) > before.bestBiomeIndex
  ) {
    result.push("biome")
  }

  if (records.bestDebris > 0 && summary.debrisCollected > records.bestDebris) {
    result.push("debris")
  }
  if (records.bestEco > 0 && eco > records.bestEco) result.push("eco")

  if (
    !summary.endless &&
    summary.outcome === "completed" &&
    records.fastestCompletion > 0 &&
    summary.durationSeconds < records.fastestCompletion
  ) {
    result.push("fastest")
  }

  return result
}

/** Actualiza los récords con el resultado de la run (modifica `records`). */
export function applyRunToRecords(
  records: RunRecords,
  summary: RunSummary,
): void {
  records.bestDebris = Math.max(records.bestDebris, summary.debrisCollected)
  records.bestEco = Math.max(
    records.bestEco,
    summary.ecoBase + summary.ecoBonus,
  )
  if (summary.endless) {
    records.bestEndlessBiomes = Math.max(
      records.bestEndlessBiomes,
      endlessBiomes(summary),
    )
  } else if (summary.outcome === "completed") {
    records.fastestCompletion =
      records.fastestCompletion > 0
        ? Math.min(records.fastestCompletion, summary.durationSeconds)
        : summary.durationSeconds
  }
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0
}

/** Lee los récords de un guardado; lo que falte o no valga vuelve a 0. */
export function sanitizeRecords(raw: unknown): RunRecords {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    bestDebris: finite(data.bestDebris),
    bestEco: finite(data.bestEco),
    bestEndlessBiomes: finite(data.bestEndlessBiomes),
    fastestCompletion: finite(data.fastestCompletion),
  }
}
