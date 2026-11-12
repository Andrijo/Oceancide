// src/ui/touchGestures.ts
// Reglas puras de los gestos táctiles (sin DOM), para poder probarlas.

/**
 * El impulso se activa al llevar el dedo más allá del borde del joystick:
 * a esta proporción del radio (el pomo se queda en el borde). Así el pulgar
 * izquierdo nada e impulsa, y el derecho queda libre para la profundidad.
 */
export const EDGE_BOOST_ON = 1.3
/** Por debajo de esta proporción se suelta (histéresis: no parpadea en el límite). */
export const EDGE_BOOST_OFF = 1.15

/**
 * ¿Sigue (o empieza) el impulso con el dedo a `ratio` radios del centro del
 * joystick? `wasBoosting` es el estado anterior.
 */
export function edgeBoostActive(ratio: number, wasBoosting: boolean): boolean {
  return ratio >= (wasBoosting ? EDGE_BOOST_OFF : EDGE_BOOST_ON)
}
