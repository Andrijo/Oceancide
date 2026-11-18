// src/meta/daily.ts
// Desafío diario: la misma semilla para todos durante un día (según la fecha
// local) y un récord local por día.

import type { RunSummary } from "@core/types"

export interface DailyRecord {
  /** Día del desafío ("2026-11-17"). */
  date: string
  /** Intentos ese día. */
  attempts: number
  /** Mejor Eco conseguido ese día. */
  bestEco: number
  /** Bioma más profundo alcanzado ese día (índice). */
  bestBiome: number
  completed: boolean
}

/** Clave del día en hora local ("AAAA-MM-DD"). */
export function dailyKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Semilla de un día (FNV-1a de la clave): igual para todos los jugadores. */
export function dailySeed(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Récord del día tras una run del desafío. Si el récord guardado es de otro
 * día, se empieza de cero. Devuelve el récord nuevo y si se ha mejorado.
 */
export function applyDailyResult(
  record: DailyRecord | null,
  key: string,
  summary: RunSummary,
): { record: DailyRecord; improved: boolean } {
  const base: DailyRecord =
    record && record.date === key
      ? record
      : { date: key, attempts: 0, bestEco: 0, bestBiome: -1, completed: false }
  const eco = summary.ecoBase + summary.ecoBonus
  const improved = eco > base.bestEco
  return {
    record: {
      date: key,
      attempts: base.attempts + 1,
      bestEco: Math.max(base.bestEco, eco),
      bestBiome: Math.max(base.bestBiome, summary.biomeIndex),
      completed: base.completed || summary.outcome === "completed",
    },
    improved,
  }
}

/** Sanea un récord diario leído del guardado (`null` si no vale). */
export function sanitizeDailyRecord(raw: unknown): DailyRecord | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
    return null
  }
  const num = (value: unknown, min: number): number =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.floor(value))
      : min
  return {
    date: r.date,
    attempts: num(r.attempts, 0),
    bestEco: num(r.bestEco, 0),
    bestBiome: num(r.bestBiome, -1),
    completed: r.completed === true,
  }
}
