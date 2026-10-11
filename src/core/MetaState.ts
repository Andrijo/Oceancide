// src/MetaState.ts
// Progreso persistente entre runs (Refugio) y su guardado en localStorage.

import type { RunOutcome, RunSummary } from "./types"

export const META_VERSION = 1
const STORAGE_KEY = "oceancide.meta"

/** Bono de Conciencia Ecológica al completar todos los biomas. */
export const COMPLETION_BONUS = 0.25

export interface MetaState {
  version: number
  ecoPoints: number // Conciencia Ecológica disponible para gastar
  lifetimeEco: number // total ganado en toda la historia
  bestBiomeIndex: number // -1 = aún ninguna
  runsPlayed: number
  runsCompleted: number
  totalDebris: number
  upgrades: Record<string, number> // id de mejora => nivel (para el Refugio)
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

export class SaveManager {
  public load(): MetaState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return createDefaultMeta()
      const parsed = JSON.parse(raw) as Partial<MetaState> | null
      if (!parsed || parsed.version !== META_VERSION) return createDefaultMeta()
      return { ...createDefaultMeta(), ...parsed }
    } catch {
      return createDefaultMeta()
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
