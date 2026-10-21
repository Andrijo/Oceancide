// src/core/InputController.ts
// Traduce el teclado a InputState y acciones de juego (pausa, dash, build...).

import type { InputState } from "@core/types"

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
  abandonRun(): void
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

/**
 * Aplica una tecla de movimiento al estado. Devuelve `true` si la tecla era de
 * movimiento, para que el llamador pueda distinguirla de una acción.
 */
export function applyMovementKey(
  input: InputState,
  code: string,
  pressed: boolean,
): boolean {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      input.forward = pressed
      return true
    case "KeyS":
    case "ArrowDown":
      input.backward = pressed
      return true
    case "KeyA":
    case "ArrowLeft":
      input.left = pressed
      return true
    case "KeyD":
    case "ArrowRight":
      input.right = pressed
      return true
    case "KeyU":
      input.up = pressed
      return true
    case "KeyJ":
      input.down = pressed
      return true
    case "KeyI":
      input.boost = pressed
      return true
    default:
      return false
  }
}

export class InputController {
  private readonly input: InputState
  private readonly actions: InputControllerActions

  constructor(input: InputState, actions: InputControllerActions) {
    this.input = input
    this.actions = actions
  }

  public handleKeyDown(e: KeyboardEvent): void {
    // Durante un evento o una elección de carta, el overlay controla la
    // interacción (botones, Tab y teclas numéricas). No dejamos que el juego
    // procese movimiento, pausa, dash, construcción ni el backflip.
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

    if (e.code === "Space") {
      if (
        !e.repeat &&
        this.actions.isPlaying() &&
        !this.actions.blocksGameplay()
      ) {
        this.actions.backflip()
        e.preventDefault()
      }
      return
    }

    if (this.actions.isPaused()) return

    if (e.code === "KeyR") {
      if (!e.repeat && this.actions.isPlaying()) this.actions.abandonRun()
      return
    }

    if (e.code === "KeyB") {
      if (!e.repeat) this.actions.build()
      return
    }

    if (e.code === "KeyC") {
      this.actions.setLookBack(true)
      return
    }

    if (e.code === "KeyQ" || e.code === "KeyE") {
      if (!e.repeat) {
        this.actions.dash(e.code === "KeyQ" ? "left" : "right")
      }
      return
    }

    applyMovementKey(this.input, e.code, true)
  }

  public handleKeyUp(e: KeyboardEvent): void {
    if (this.actions.isOverlayActive()) return

    if (e.code === "KeyC") {
      this.actions.setLookBack(false)
      return
    }

    applyMovementKey(this.input, e.code, false)
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
