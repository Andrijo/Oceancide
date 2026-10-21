// src/core/systems/progression.ts
// Fórmulas puras de progresión: tiempo de bioma, limpieza de zona y revives.

const BIOME_TIME_BASE = 120
const BIOME_TIME_DECAY = 2
const BIOME_TIME_MIN = 80
const BIOME_TIME_PRESSURE = 4
const MIN_BIOME_TIME_AFTER_EVENT = 30

const ZONE_COMPLETION_RATIO = 0.6

const REVIVE_TOXICITY_BASE = 50
const REVIVE_TOXICITY_STEP = 10
const REVIVE_TOXICITY_MAX = 90
const REVIVE_MIN_TIME = 20

/**
 * Límite de tiempo del bioma. El reloj base baja según la posición dentro de
 * la vuelta y los eventos pueden recortarlo hasta el mínimo de emergencia.
 */
export function computeBiomeTimeLimit(
  biomeIndex: number,
  biomesPerLoop: number,
  pendingTimeDelta = 0,
): number {
  const slot = biomesPerLoop > 0 ? biomeIndex % biomesPerLoop : 0
  const baseTime = Math.max(
    BIOME_TIME_MIN,
    BIOME_TIME_BASE - slot * BIOME_TIME_DECAY,
  )

  return Math.max(MIN_BIOME_TIME_AFTER_EVENT, baseTime + pendingTimeDelta)
}

/** Multiplicador de toxicidad pasiva cuando se agota el tiempo del bioma. */
export function computeTimePressure(biomeTimeRemaining: number): number {
  return biomeTimeRemaining <= 0 ? 1 + BIOME_TIME_PRESSURE : 1
}

/** Desechos necesarios para completar una zona (mínimo 1). */
export function computeZoneRequirement(initialDebrisCount: number): number {
  return Math.max(1, initialDebrisCount * ZONE_COMPLETION_RATIO)
}

/** Progreso de la zona en porcentaje, capado a 100. */
export function computeZoneProgress(
  collectedInZone: number,
  initialDebrisCount: number,
): number {
  return Math.min(
    100,
    (collectedInZone / computeZoneRequirement(initialDebrisCount)) * 100,
  )
}

/** Toxicidad con la que se revive, creciente con cada revive usado. */
export function computeReviveToxicity(revivesUsed: number): number {
  return Math.min(
    REVIVE_TOXICITY_MAX,
    REVIVE_TOXICITY_BASE + revivesUsed * REVIVE_TOXICITY_STEP,
  )
}

/** Al revivir se garantizan unos segundos mínimos en el bioma actual. */
export function computeReviveTimeRemaining(currentSeconds: number): number {
  return Math.max(currentSeconds, REVIVE_MIN_TIME)
}
