// src/core/MetaState.ts
// Progreso persistente entre runs y su guardado en localStorage.

import type { RunOutcome, RunSummary } from "@core/types"
import { UPGRADES } from "@tycoon/Upgrades"
import { isTipId, type TipId } from "@core/tips"

export const META_VERSION = 1
const STORAGE_KEY = "oceancide.meta"
const BACKUP_KEY = "oceancide.meta.backup"

/**
 * Migraciones del guardado: `MIGRATIONS[v]` convierte un guardado de la
 * versión `v` en uno de la versión `v + 1`. Al subir `META_VERSION` hay que
 * añadir aquí la migración de la versión anterior.
 */
export type MetaMigration = (
  old: Record<string, unknown>,
) => Record<string, unknown>
export const MIGRATIONS: Record<number, MetaMigration> = {}

/** Bono de Conciencia Ecológica al completar todos los biomas. */
export const COMPLETION_BONUS = 0.25

export interface MetaState {
  version: number
  ecoPoints: number
  lifetimeEco: number
  bestBiomeIndex: number
  runsPlayed: number
  runsCompleted: number
  totalDebris: number
  upgrades: Record<string, number>
  /** Avisos contextuales que el jugador ya vio (no se repiten). */
  seenTips: TipId[]
  /** Avisos contextuales activados. */
  tipsEnabled: boolean
}

export function createDefaultMeta(): MetaState {
  return {
    version: META_VERSION,
    ecoPoints: 0,
    lifetimeEco: 0,
    bestBiomeIndex: -1,
    runsPlayed: 0,
    runsCompleted: 0,
    totalDebris: 0,
    upgrades: {},
    seenTips: [],
    tipsEnabled: true,
  }
}

/** Conversión de la Conciencia Ecológica de la run en la que se guarda. */
export function computeEco(
  ecoAwareness: number,
  outcome: RunOutcome,
): { base: number; bonus: number } {
  const base = Math.round(ecoAwareness)
  const bonus =
    outcome === "completed" ? Math.round(base * COMPLETION_BONUS) : 0
  return { base, bonus }
}

/** Suma el resultado de una run al progreso persistente (modifica `meta`). */
export function applyRunToMeta(meta: MetaState, summary: RunSummary): void {
  const earned = summary.ecoBase + summary.ecoBonus
  meta.ecoPoints += earned
  meta.lifetimeEco += earned
  meta.totalDebris += summary.debrisCollected
  meta.runsPlayed += 1
  if (summary.outcome === "completed") meta.runsCompleted += 1
  meta.bestBiomeIndex = Math.max(meta.bestBiomeIndex, summary.biomeIndex)
}

function finiteNumber(value: unknown, fallback: number, min = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, value)
    : fallback
}

/** Rellena y sanea los campos de un guardado ya migrado a la versión actual. */
export function sanitizeMeta(raw: Record<string, unknown>): MetaState {
  const defaults = createDefaultMeta()
  const upgrades: Record<string, number> = {}

  if (raw.upgrades && typeof raw.upgrades === "object") {
    for (const [id, level] of Object.entries(raw.upgrades)) {
      const def = UPGRADES.find((upgrade) => upgrade.id === id)
      if (!def || typeof level !== "number" || !Number.isFinite(level)) continue
      upgrades[id] = Math.min(def.maxLevel, Math.max(0, Math.floor(level)))
    }
  }

  // Los campos añadidos después de la v1 con un valor por defecto seguro no
  // necesitan migración: un guardado antiguo simplemente no los trae.
  const seenTips = Array.isArray(raw.seenTips)
    ? [...new Set(raw.seenTips.filter(isTipId))]
    : defaults.seenTips

  return {
    version: META_VERSION,
    ecoPoints: finiteNumber(raw.ecoPoints, defaults.ecoPoints),
    lifetimeEco: finiteNumber(raw.lifetimeEco, defaults.lifetimeEco),
    bestBiomeIndex: finiteNumber(
      raw.bestBiomeIndex,
      defaults.bestBiomeIndex,
      -1,
    ),
    runsPlayed: finiteNumber(raw.runsPlayed, defaults.runsPlayed),
    runsCompleted: finiteNumber(raw.runsCompleted, defaults.runsCompleted),
    totalDebris: finiteNumber(raw.totalDebris, defaults.totalDebris),
    upgrades,
    seenTips,
    tipsEnabled:
      typeof raw.tipsEnabled === "boolean"
        ? raw.tipsEnabled
        : defaults.tipsEnabled,
  }
}

/**
 * Aplica las migraciones en orden hasta `META_VERSION`. Devuelve `null` si el
 * guardado no se puede migrar (versión inválida, futura o migración ausente).
 */
export function migrateMeta(
  raw: unknown,
  migrations: Record<number, MetaMigration> = MIGRATIONS,
  targetVersion: number = META_VERSION,
): MetaState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  let data = raw as Record<string, unknown>
  let version = data.version
  if (typeof version !== "number" || !Number.isInteger(version)) return null
  if (version > targetVersion || version < 1) return null

  while (version < targetVersion) {
    const migrate: MetaMigration | undefined = migrations[version]
    if (!migrate) return null
    data = { ...migrate(data), version: version + 1 }
    version += 1
  }

  return sanitizeMeta(data)
}

export class SaveManager {
  public load(): MetaState {
    let raw: string | null
    try {
      raw = localStorage.getItem(STORAGE_KEY)
    } catch {
      return createDefaultMeta()
    }
    if (!raw) return createDefaultMeta()

    try {
      const migrated = migrateMeta(JSON.parse(raw))
      if (migrated) return migrated
    } catch (error) {
      console.warn("[SaveManager] Guardado ilegible", error)
    }

    // No se pudo leer ni migrar: se conserva el original antes de que el
    // siguiente save() lo sobrescriba.
    this.backup(raw)
    return createDefaultMeta()
  }

  private backup(raw: string): void {
    try {
      localStorage.setItem(BACKUP_KEY, raw)
    } catch (error) {
      console.warn(
        "[SaveManager] No se pudo crear la copia de seguridad",
        error,
      )
    }
  }

  public save(meta: MetaState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
    } catch (error) {
      console.warn("[SaveManager] No se pudo guardar el progreso", error)
    }
  }

  public reset(): MetaState {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // sin acceso a localStorage: se ignora
    }
    return createDefaultMeta()
  }
}
