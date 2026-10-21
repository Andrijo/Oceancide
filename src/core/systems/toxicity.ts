// src/core/systems/toxicity.ts
// Fórmulas puras de toxicidad: entrada al bioma, subida pasiva y limpieza.

const TOXICITY_SCALE = 3
const TOXICITY_CARRYOVER = 0.5
const TOXICITY_FLOOR_SCALE = 30

const CLEANUP_BASE = 0.4
const CLEANUP_PER_POLLUTION = 1
const FILTER_CLEANUP_PER_DEBRIS = CLEANUP_BASE + 0.5 * CLEANUP_PER_POLLUTION

export interface PassiveToxicityParams {
  /** Tasa de toxicidad del bioma (0..1). */
  toxicityRate: number
  /** Contaminación restante del bioma (0..1). */
  pollution: number
  /** Resistencia de la tortuga (0..1). */
  toxicityResistance: number
  /** Multiplicador de la mejora "Sistema Inmune" (1 = sin mejora). */
  toxicityScaleMult?: number
  /** Multiplicador por agotar el tiempo del bioma (1 o 5). */
  timePressure?: number
}

/** Suelo de toxicidad natural del bioma. */
export function computeBiomeToxicityFloor(toxicityRate: number): number {
  return toxicityRate * TOXICITY_FLOOR_SCALE
}

/** Toxicidad al entrar en un bioma: arrastra la mitad y respeta el suelo. */
export function computeEntryToxicity(current: number, floor: number): number {
  return Math.max(current * TOXICITY_CARRYOVER, floor)
}

/** Toxicidad por segundo que sube sola según la contaminación restante. */
export function computePassiveToxicityRate({
  toxicityRate,
  pollution,
  toxicityResistance,
  toxicityScaleMult = 1,
  timePressure = 1,
}: PassiveToxicityParams): number {
  const resistance = Math.min(1, Math.max(0, toxicityResistance))

  return (
    toxicityRate *
    TOXICITY_SCALE *
    toxicityScaleMult *
    pollution *
    (1 - resistance) *
    timePressure
  )
}

/** Aplica un delta de toxicidad sin bajar de 0 (el tope superior lo pone la muerte). */
export function applyToxicityDelta(current: number, delta: number): number {
  return Math.max(0, current + delta)
}

/** Toxicidad que limpia un desecho al recogerlo. */
export function computeDebrisCleanup(pollution: number): number {
  return CLEANUP_BASE + pollution * CLEANUP_PER_POLLUTION
}

/** Toxicidad que limpia un filtro por cada desecho absorbido. */
export function computeFilterCleanup(debrisCount: number): number {
  return debrisCount * FILTER_CLEANUP_PER_DEBRIS
}
