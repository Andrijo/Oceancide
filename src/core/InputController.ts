// src/core/InputController.ts
// Traduce el teclado a InputState y acciones de juego (pausa, dash, build...).
// Las teclas de cada acción salen de las asignaciones de los ajustes.

import type { InputState } from "@core/types"
import {
  createDefaultKeyBindings,
  resolveKeyAction,
  type KeyAction,
  type KeyBindings,
} from "@core/keyBindings"

export interface InputControllerActions {
  /** Hay un evento o una elección de carta abiertos. */
  isOverlayActive(): boolean
  isPaused(): boolean
  /** La pantalla actual es la de juego. */
  isPlaying(): boolean
  /** Una transición de bioma bloquea el gameplay. */
  blocksGameplay(): boolean
  togglePause(): void
  setPaused(paused: boolean): void
  backflip(): void
  requestAbandon(): void
  build(): void
  dash(direction: "left" | "right"): void
  setLookBack(active: boolean): void
}

const INTERACTIVE_SELECTOR =
  "button, a[href], [role='button'], input, select, textarea"

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    target.closest(INTERACTIVE_SELECTOR) !== null
  )
}

type HoldField =
  "forward" | "backward" | "left" | "right" | "up" | "down" | "boost"

const HOLD_FIELDS: Partial<Record<KeyAction, HoldField>> = {
  forward: "forward",
  backward: "backward",
  left: "left",
  right: "right",
  up: "up",
  down: "down",
  boost: "boost",
}

/**
 * Aplica una acción de mantener (movimiento o impulso) al estado. Devuelve
 * `true` si la acción era de ese tipo, para distinguirla de una acción puntual.
 */
export function applyHoldAction(
  input: InputState,
  action: KeyAction,
  pressed: boolean,
): boolean {
  const field = HOLD_FIELDS[action]
  if (!field) return false
  input[field] = pressed
  return true
}

export class InputController {
  private readonly input: InputState
  private readonly actions: InputControllerActions
  private readonly getBindings: () => KeyBindings

  constructor(
    input: InputState,
    actions: InputControllerActions,
    getBindings: () => KeyBindings = createDefaultKeyBindings,
  ) {
    this.input = input
    this.actions = actions
    this.getBindings = getBindings
  }

  public handleKeyDown(e: KeyboardEvent): void {
    // Durante un evento o una elección de carta, el overlay controla la
    // interacción (botones, Tab y teclas numéricas). No dejamos que el juego
    // procese movimiento, pausa, dash, construcción ni la voltereta.
    if (this.actions.isOverlayActive()) return

    if (e.code === "Escape") {
      if (!e.repeat) this.actions.togglePause()
      return
    }

    if (e.code === "Enter") {
      if (
        e.repeat ||
        e.defaultPrevented ||
        this.actions.isPaused() ||
        !this.actions.isPlaying()
      ) {
        return
      }

      // Si hay un control enfocado, Enter debe activarlo a él.
      if (isInteractiveTarget(e.target)) return

      this.actions.setPaused(true)
      e.preventDefault()
      return
    }

    const action = resolveKeyAction(this.getBindings(), e.code)
    if (!action || this.actions.isPaused()) return

    const playing = this.actions.isPlaying()
    // En la inmersión, las teclas del juego no hacen lo que harían en la
    // página (Espacio pulsaría el botón de pausa enfocado, por ejemplo).
    if (playing) e.preventDefault()

    if (applyHoldAction(this.input, action, true)) return

    switch (action) {
      case "lookBack":
        this.actions.setLookBack(true)
        return
      case "backflip":
        if (!e.repeat && playing && !this.actions.blocksGameplay()) {
          this.actions.backflip()
        }
        return
      case "abandon":
        if (!e.repeat && playing) this.actions.requestAbandon()
        return
      case "build":
        if (!e.repeat) this.actions.build()
        return
      case "dashLeft":
      case "dashRight":
        if (!e.repeat) {
          this.actions.dash(action === "dashLeft" ? "left" : "right")
        }
        return
    }
  }

  public handleKeyUp(e: KeyboardEvent): void {
    if (this.actions.isOverlayActive()) return

    const action = resolveKeyAction(this.getBindings(), e.code)
    if (!action) return

    if (action === "lookBack") {
      this.actions.setLookBack(false)
      return
    }

    applyHoldAction(this.input, action, false)
  }

  public clear(): void {
    this.actions.setLookBack(false)
    this.input.forward = false
    this.input.backward = false
    this.input.left = false
    this.input.right = false
    this.input.up = false
    this.input.down = false
    this.input.boost = false
    this.input.moveX = 0
    this.input.moveY = 0
    this.input.vertical = 0
  }
}
