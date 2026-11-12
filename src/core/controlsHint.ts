// src/core/controlsHint.ts
// Pista de controles de la parte inferior: qué acciones nombra según el modo
// elegido en Ajustes y los controles que el jugador ya ha usado. Lógica pura;
// los textos de cada acción están en ui/controlLabels.

import type { InputState } from "@core/types"

/** Acciones que puede nombrar la pista, en el orden en que aparecen. */
export const HINT_ACTIONS = [
  "move",
  "depth",
  "boost",
  "dash",
  "build",
  "backflip",
  "lookBack",
  "pause",
] as const

export type HintAction = (typeof HINT_ACTIONS)[number]

export function isHintAction(value: unknown): value is HintAction {
  return (
    typeof value === "string" &&
    (HINT_ACTIONS as readonly string[]).includes(value)
  )
}

/**
 * Controles básicos: los que la pista enseña en modo automático hasta que el
 * jugador los usa. Voltereta, mirar atrás y pausa son secundarios: solo salen
 * con la pista fija y en "Cómo jugar".
 */
export const BASIC_CONTROLS = [
  "move",
  "depth",
  "boost",
  "dash",
  "build",
] as const satisfies readonly HintAction[]

export type BasicControl = (typeof BASIC_CONTROLS)[number]

/**
 * "auto" enseña los controles básicos que aún no se han usado; "always" los
 * muestra todos durante toda la inmersión; "off" la oculta.
 */
export type ControlsHintMode = "auto" | "always" | "off"

export const CONTROLS_HINT_MODES: readonly ControlsHintMode[] = [
  "auto",
  "always",
  "off",
]

export function isControlsHintMode(value: unknown): value is ControlsHintMode {
  return CONTROLS_HINT_MODES.includes(value as ControlsHintMode)
}

/** Acciones que la pista debe nombrar con este modo y estos controles usados. */
export function hintActions(
  mode: ControlsHintMode,
  learned: readonly HintAction[],
): HintAction[] {
  if (mode === "off") return []
  if (mode === "always") return [...HINT_ACTIONS]
  return BASIC_CONTROLS.filter((action) => !learned.includes(action))
}

/**
 * Controles táctiles que llevan etiqueta: el impulso (empujar el joystick
 * más allá del borde) y los tres botones, en ese orden.
 */
export const TOUCH_LABEL_ACTIONS = [
  "boost",
  "dash",
  "build",
  "lookBack",
] as const satisfies readonly HintAction[]

export type TouchLabelAction = (typeof TOUCH_LABEL_ACTIONS)[number]

/**
 * Etiquetas táctiles visibles con el modo de la pista: en táctil la pista de
 * texto no se muestra y este mismo ajuste decide las etiquetas. En automático
 * cada una se quita al usar su control (mirar atrás incluido: en pantalla es
 * un botón más).
 */
export function touchLabelActions(
  mode: ControlsHintMode,
  learned: readonly HintAction[],
): TouchLabelAction[] {
  if (mode === "off") return []
  if (mode === "always") return [...TOUCH_LABEL_ACTIONS]
  return TOUCH_LABEL_ACTIONS.filter((action) => !learned.includes(action))
}

/** Controles de mantener que se leen del estado de entrada. */
export const HELD_CONTROLS = [
  "move",
  "depth",
  "boost",
] as const satisfies readonly BasicControl[]

export type HeldControl = (typeof HELD_CONTROLS)[number]

/**
 * ¿El estado de entrada indica que se está usando este control? Vale para
 * teclado, mando y táctil, que escriben en el mismo estado.
 */
export function isHeldControlActive(
  input: InputState,
  control: HeldControl,
): boolean {
  switch (control) {
    case "move":
      return (
        input.forward ||
        input.backward ||
        input.left ||
        input.right ||
        input.moveX !== 0 ||
        input.moveY !== 0
      )
    case "depth":
      return input.up || input.down || input.vertical !== 0
    case "boost":
      return input.boost
  }
}
