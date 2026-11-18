// src/core/systems/deathCause.ts
// Qué llevó la toxicidad a 100: se decide en el momento en que cruza el
// máximo (la última subida) y se muestra en el resumen de la run.

export type DeathCauseKind =
  | "passive" // toxicidad pasiva del agua contaminada
  | "time" // toxicidad pasiva multiplicada por agotar el tiempo del bioma
  | "jellyfish" // picadura de medusa
  | "event" // opción de un evento de acto
  | "chaos" // carta de caos (o maldición)

export interface DeathCause {
  kind: DeathCauseKind
  /** Nombre de lo que la causó (opción del evento, carta), si lo hay. */
  source?: string
}

/** Causa de una muerte por toxicidad pasiva según la presión de tiempo. */
export function passiveDeathCause(timePressure: number): DeathCause {
  return { kind: timePressure > 1 ? "time" : "passive" }
}

const CAUSE_TITLES: Record<DeathCauseKind, string> = {
  passive: "Agua contaminada",
  time: "Tiempo agotado",
  jellyfish: "Picadura de medusa",
  event: "Un evento",
  chaos: "Una carta",
}

const CAUSE_DETAILS: Record<DeathCauseKind, string> = {
  passive: "La toxicidad del agua sin limpiar llegó al máximo.",
  time: "Con el tiempo del bioma agotado, la toxicidad sube mucho más rápido.",
  jellyfish: "El último golpe de toxicidad vino de una medusa.",
  event: "La decisión del evento llevó la toxicidad al máximo.",
  chaos: "El efecto de la carta llevó la toxicidad al máximo.",
}

/** Texto de la causa para el resumen: título corto y explicación. */
export function describeDeathCause(cause: DeathCause): {
  title: string
  detail: string
} {
  const title = cause.source
    ? `${CAUSE_TITLES[cause.kind]}: ${cause.source}`
    : CAUSE_TITLES[cause.kind]
  return { title, detail: CAUSE_DETAILS[cause.kind] }
}
