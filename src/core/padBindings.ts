// src/core/padBindings.ts
// Asignación de los botones del mando: qué acciones se pueden reasignar, sus
// botones por defecto y cómo se reasignan. Lógica pura (sin DOM); se guarda
// dentro de los ajustes (`padBindings`).
//
// Los sticks no se reasignan (el izquierdo mueve y el derecho sube y baja) ni
// la cruceta (profundidad en la inmersión y navegación en los menús). Los
// botones son índices de la distribución "standard" de la Gamepad API.

/** Índices de los botones en la distribución "standard". */
export const PAD_BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const

export const PAD_ACTIONS = [
  "boost",
  "dashLeft",
  "dashRight",
  "backflip",
  "build",
  "lookBack",
  "pause",
] as const

export type PadAction = (typeof PAD_ACTIONS)[number]

/** Botón (índice "standard") de cada acción. */
export type PadBindings = Record<PadAction, number>

export const PAD_ACTION_LABELS: Record<PadAction, string> = {
  boost: "Impulso (mantener)",
  dashLeft: "Dash a la izquierda",
  dashRight: "Dash a la derecha",
  backflip: "Voltereta",
  build: "Colocar esfera filtradora",
  lookBack: "Mirar atrás (mantener)",
  pause: "Pausa",
}

export function createDefaultPadBindings(): PadBindings {
  return {
    boost: PAD_BUTTON.rt,
    dashLeft: PAD_BUTTON.lb,
    dashRight: PAD_BUTTON.rb,
    backflip: PAD_BUTTON.y,
    build: PAD_BUTTON.x,
    lookBack: PAD_BUTTON.b,
    pause: PAD_BUTTON.start,
  }
}

/**
 * Botones que se pueden asignar: los frontales, los laterales, los gatillos,
 * Select/Start y la pulsación de los sticks. La cruceta queda fuera.
 */
export function isAssignableButton(button: unknown): button is number {
  return (
    typeof button === "number" &&
    Number.isInteger(button) &&
    button >= PAD_BUTTON.a &&
    button <= PAD_BUTTON.r3
  )
}

/**
 * Sanea unas asignaciones leídas de disco. Cada acción conserva su botón si es
 * válido; si no, recupera el de por defecto. Si dos acciones acabaran con el
 * mismo botón, se vuelve a los botones por defecto.
 */
export function sanitizePadBindings(raw: unknown): PadBindings {
  const defaults = createDefaultPadBindings()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults

  const data = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const action of PAD_ACTIONS) {
    const button = data[action]
    if (isAssignableButton(button)) result[action] = button
  }

  const used = new Set(Object.values(result))
  return used.size === PAD_ACTIONS.length ? result : defaults
}

/**
 * Asigna `button` a `action`. Si otra acción lo usaba, se intercambian: esa
 * acción se queda con el botón anterior de `action`.
 */
export function rebindPadButton(
  bindings: PadBindings,
  action: PadAction,
  button: number,
): PadBindings {
  if (!isAssignableButton(button) || bindings[action] === button) {
    return bindings
  }

  const next = { ...bindings }
  const previous = next[action]
  for (const other of PAD_ACTIONS) {
    if (other !== action && next[other] === button) next[other] = previous
  }
  next[action] = button
  return next
}
