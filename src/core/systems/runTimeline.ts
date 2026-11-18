// src/core/systems/runTimeline.ts
// Línea de tiempo de la run: cuánto tiempo, desechos y Eco dejó cada bioma.
// Cada tramo guarda los contadores al entrar y se cierra al salir del bioma o
// al terminar la run.

export interface BiomeSegment {
  /** Índice del bioma en la run (en modo sin fin sigue creciendo). */
  biomeIndex: number
  biomeName: string
  seconds: number
  debris: number
  eco: number
}

/** Contadores de la run en un instante. */
export interface RunCounters {
  time: number
  debris: number
  eco: number
}

export interface OpenSegment {
  biomeIndex: number
  biomeName: string
  start: RunCounters
}

export function openSegment(
  biomeIndex: number,
  biomeName: string,
  start: RunCounters,
): OpenSegment {
  return { biomeIndex, biomeName, start: { ...start } }
}

export function closeSegment(
  segment: OpenSegment,
  end: RunCounters,
): BiomeSegment {
  return {
    biomeIndex: segment.biomeIndex,
    biomeName: segment.biomeName,
    seconds: Math.max(0, end.time - segment.start.time),
    debris: Math.max(0, end.debris - segment.start.debris),
    eco: Math.max(0, Math.round(end.eco - segment.start.eco)),
  }
}

/**
 * Tramos que caben en el resumen: los últimos `max`, y cuántos se omiten
 * antes (una inmersión sin fin larga puede pasar por decenas de biomas).
 */
export function visibleSegments(
  segments: readonly BiomeSegment[],
  max: number,
): { hidden: number; shown: BiomeSegment[] } {
  const hidden = Math.max(0, segments.length - max)
  return { hidden, shown: segments.slice(hidden) }
}
