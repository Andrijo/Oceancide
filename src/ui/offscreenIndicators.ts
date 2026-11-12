// src/ui/offscreenIndicators.ts
// Lógica pura de los indicadores en el borde de pantalla (sin DOM ni Three).

export interface EdgeIndicator {
  /** Posición en píxeles dentro de la ventana. */
  x: number
  y: number
  /** Ángulo en radianes (0 = derecha, sentido horario en pantalla). */
  angle: number
}

/**
 * Convierte unas coordenadas NDC proyectadas (x,y en -1..1; `behind` si el punto
 * está detrás de la cámara) en una posición sobre el borde de la pantalla.
 * Devuelve null si el punto ya es visible.
 */
export function computeEdgeIndicator(
  ndcX: number,
  ndcY: number,
  behind: boolean,
  width: number,
  height: number,
  margin = 36,
): EdgeIndicator | null {
  let x = ndcX
  let y = ndcY
  if (behind) {
    // Al proyectar un punto trasero los signos se invierten.
    x = -x
    y = -y
  } else if (Math.abs(x) <= 1 && Math.abs(y) <= 1) {
    return null
  }

  // Un punto justo detrás de la cámara puede dar (0,0): lo empujamos hacia abajo.
  if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) y = -1

  const scale = 1 / Math.max(Math.abs(x), Math.abs(y))
  const edgeX = x * scale
  const edgeY = y * scale

  const halfW = width / 2 - margin
  const halfH = height / 2 - margin
  const px = width / 2 + edgeX * halfW
  // NDC y crece hacia arriba; en pantalla crece hacia abajo.
  const py = height / 2 - edgeY * halfH

  return { x: px, y: py, angle: Math.atan2(-edgeY, edgeX) }
}

export interface IndicatorCandidate {
  distanceSq: number
  leak: boolean
}

/**
 * Elige qué candidatos mostrar: las fugas más cercanas tienen prioridad y el
 * resto de huecos se llena con los desechos normales más cercanos.
 */
export function pickIndicatorSlots<T extends IndicatorCandidate>(
  candidates: readonly T[],
  maxSlots: number,
  maxLeaks = 2,
): T[] {
  const byDistance = [...candidates].sort((a, b) => a.distanceSq - b.distanceSq)
  const leaks = byDistance.filter((c) => c.leak).slice(0, maxLeaks)
  const rest = byDistance.filter((c) => !c.leak)
  return [...leaks, ...rest].slice(0, Math.max(maxSlots, leaks.length))
}

/** Cuántos indicadores mostrar según lo cerca que está el final de la zona. */
export function indicatorSlotCount(
  remainingDebris: number,
  timeRatio: number,
): number {
  const urgent = remainingDebris <= 8 || timeRatio < 0.3
  return urgent ? 4 : 1
}

/** Opacidad (0..1) de un muro según la distancia del jugador a él. */
export function wallOpacity(distance: number, fadeStart = 10): number {
  if (distance >= fadeStart) return 0
  const t = 1 - Math.max(0, distance) / fadeStart
  return t * t * 0.15
}
