// Momento de derrota: entre que la toxicidad llega a 100 y aparece el resumen,
// el mundo se ralentiza, la pantalla se tiñe de verde tóxico y la tortuga se
// hunde. Con el movimiento reducido solo queda un fundido breve, sin cámara
// lenta ni hundimiento.

/** Duración (s, tiempo real) del momento de derrota. */
export const DEATH_DURATION = 1.3
/** Duración con el movimiento reducido: solo el fundido. */
export const DEATH_DURATION_REDUCED = 0.6
/** Velocidad del mundo al final de la cámara lenta. */
export const DEATH_MIN_TIME_SCALE = 0.2
/** Opacidad máxima del velo tóxico (deja ver la tortuga hundiéndose). */
export const DEATH_MAX_FADE = 0.85

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function deathDuration(reducedMotion: boolean): number {
  return reducedMotion ? DEATH_DURATION_REDUCED : DEATH_DURATION
}

/** Avance (0..1) del momento de derrota tras `elapsed` segundos. */
export function deathProgress(elapsed: number, reducedMotion: boolean): number {
  return clamp01(elapsed / deathDuration(reducedMotion))
}

/**
 * Escala del tiempo del mundo: frena deprisa al principio (ease-out) y se
 * queda en `DEATH_MIN_TIME_SCALE`. Con el movimiento reducido el mundo se
 * congela (escala 0): no hay movimiento que ralentizar.
 */
export function deathTimeScale(
  progress: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0
  const eased = 1 - (1 - clamp01(progress)) ** 3
  return 1 - (1 - DEATH_MIN_TIME_SCALE) * eased
}

/** Opacidad del velo tóxico: entra suave (smoothstep) hasta `DEATH_MAX_FADE`. */
export function deathFade(progress: number): number {
  const t = clamp01(progress)
  return t * t * (3 - 2 * t) * DEATH_MAX_FADE
}
