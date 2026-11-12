// src/core/gamepad.ts
// Soporte de mando (Gamepad API). El navegador no avisa de los cambios de un
// mando: hay que leer `navigator.getGamepads()` cada frame (`update`).
//
// En la inmersión rellena los mismos ejes analógicos que el táctil (moveX,
// moveY, vertical) y dispara las acciones; en los menús mueve el foco, activa
// y vuelve atrás. Supone la distribución "standard" de la Gamepad API, la que
// usan los mandos de Xbox y PlayStation y casi todos los genéricos.

import type { InputState } from "@core/types"
import {
  PAD_BUTTON,
  createDefaultPadBindings,
  isAssignableButton,
  type PadBindings,
} from "@core/padBindings"

export { PAD_BUTTON }

/** Familia del mando, para mostrar sus glifos (A/B/X/Y o ✕/○/□/△). */
export type PadStyle = "xbox" | "playstation"

export type NavDirection = "up" | "down" | "left" | "right"

/** Qué controla el mando ahora mismo. */
export type GamepadMode = "gameplay" | "menu" | "none"

export const STICK_DEADZONE = 0.2
export const TRIGGER_DEADZONE = 0.1
/** Recorrido del gatillo derecho (tras la zona muerta) que activa el impulso. */
export const BOOST_TRIGGER_THRESHOLD = 0.3
/** Inclinación del stick a partir de la cual cuenta como dirección en menús. */
export const NAV_STICK_THRESHOLD = 0.5
/** Segundos con la dirección mantenida antes de repetir, y entre repeticiones. */
export const NAV_REPEAT_DELAY = 0.4
export const NAV_REPEAT_INTERVAL = 0.12
/** Píxeles por segundo que desplaza el stick derecho en los menús. */
export const MENU_SCROLL_SPEED = 900

/**
 * Zona muerta radial reescalada: por debajo de `deadzone` no hay entrada y por
 * encima se aprovecha todo el recorrido (igual que el joystick táctil).
 */
export function radialDeadzone(
  x: number,
  y: number,
  deadzone: number = STICK_DEADZONE,
): { x: number; y: number } {
  const mag = Math.hypot(x, y)
  if (mag <= deadzone) return { x: 0, y: 0 }
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone))
  return { x: (x / mag) * scaled, y: (y / mag) * scaled }
}

/** Gatillo analógico (0..1) con zona muerta reescalada. */
export function triggerValue(
  value: number,
  deadzone: number = TRIGGER_DEADZONE,
): number {
  if (value <= deadzone) return 0
  return Math.min(1, (value - deadzone) / (1 - deadzone))
}

/** Reconoce los mandos de PlayStation por su nombre o su id de fabricante. */
export function padStyleFromId(id: string): PadStyle {
  return /054c|playstation|dualshock|dualsense|sony/i.test(id)
    ? "playstation"
    : "xbox"
}

/** Dirección de la cruceta o del stick izquierdo, si hay una clara. */
export function navDirection(
  buttons: readonly boolean[],
  axes: readonly number[],
): NavDirection | null {
  if (buttons[PAD_BUTTON.up]) return "up"
  if (buttons[PAD_BUTTON.down]) return "down"
  if (buttons[PAD_BUTTON.left]) return "left"
  if (buttons[PAD_BUTTON.right]) return "right"

  const x = axes[0] ?? 0
  const y = axes[1] ?? 0
  if (Math.max(Math.abs(x), Math.abs(y)) < NAV_STICK_THRESHOLD) return null
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left"
  return y > 0 ? "down" : "up"
}

export interface GamepadHooks {
  getMode(): GamepadMode
  /** El jugador ha tocado el mando (para mostrar sus glifos). */
  onActivity(style: PadStyle): void
  togglePause(): void
  // --- Inmersión ---
  dash(direction: "left" | "right"): void
  backflip(): void
  build(): void
  setLookBack(active: boolean): void
  // --- Menús ---
  navigate(direction: NavDirection): void
  activate(): void
  back(): void
  /** Desplaza la pantalla abierta `pixels` en vertical. */
  scroll(pixels: number): void
}

type PadSource = () => ArrayLike<Gamepad | null>

function defaultPads(): ArrayLike<Gamepad | null> {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return []
  return navigator.getGamepads()
}

/** El mando conectado que se usó más recientemente. */
function pickPad(pads: ArrayLike<Gamepad | null>): Gamepad | null {
  let best: Gamepad | null = null
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i]
    if (!pad || !pad.connected) continue
    if (!best || pad.timestamp > best.timestamp) best = pad
  }
  return best
}

export class GamepadController {
  private readonly input: InputState
  private readonly hooks: GamepadHooks
  private readonly getPads: PadSource

  /** `null` hasta la primera lectura de un mando (y tras desconectarse). */
  private mode: GamepadMode | null = null
  private previous: boolean[] = []
  /**
   * Botones que venían pulsados al cambiar de modo: no cuentan hasta que se
   * suelten. Así el A del impulso no elige carta al abrirse la elección, ni
   * el A que elige la carta lanza un impulso al volver al juego.
   */
  private readonly suppressed = new Set<number>()

  // Campos de InputState que escribe el mando: solo los pone a cero al
  // soltarlos, para no pisar lo que haga el teclado o el táctil.
  private ownsMove = false
  private ownsVertical = false
  private ownsBoost = false
  private lookBack = false

  private navHeld: NavDirection | null = null
  private navTimer = 0

  private readonly getBindings: () => PadBindings
  /** Reasignación en curso: recibe el siguiente botón (o `null` si se cancela). */
  private capture: ((button: number | null) => void) | null = null

  constructor(
    input: InputState,
    hooks: GamepadHooks,
    getPads: PadSource = defaultPads,
    getBindings: () => PadBindings = createDefaultPadBindings,
  ) {
    this.input = input
    this.hooks = hooks
    this.getPads = getPads
    this.getBindings = getBindings
  }

  /**
   * Escucha el siguiente botón asignable que se pulse (para reasignarlo) y se
   * lo pasa a `onButton`. La cruceta cancela (`null`). Mientras escucha, el
   * mando no navega por los menús. Devuelve la función que deja de escuchar.
   */
  public captureButton(onButton: (button: number | null) => void): () => void {
    this.capture = onButton
    // El botón que abrió la captura (el A del menú) no vale como respuesta
    // hasta que se suelte.
    this.previous.forEach((down, i) => {
      if (down) this.suppressed.add(i)
    })
    return () => {
      if (this.capture === onButton) this.capture = null
    }
  }

  public update(deltaTime: number): void {
    const pad = pickPad(this.getPads())
    if (!pad) {
      this.release()
      this.mode = null
      this.previous = []
      this.suppressed.clear()
      this.navHeld = null
      return
    }

    const buttons = Array.from(pad.buttons, (b) => b.pressed)
    const values = Array.from(pad.buttons, (b) => b.value)
    const axes = Array.from(pad.axes)

    if (
      buttons.some(Boolean) ||
      axes.some((a) => Math.abs(a) > NAV_STICK_THRESHOLD)
    ) {
      this.hooks.onActivity(padStyleFromId(pad.id))
    }

    const mode = this.hooks.getMode()
    if (mode !== this.mode) {
      if (this.mode === "gameplay") this.release()
      // La primera lectura no suprime nada: el navegador solo enseña el mando
      // tras pulsar un botón, y esa pulsación debe contar.
      const firstRead = this.mode === null
      this.mode = mode
      this.suppressed.clear()
      if (!firstRead) {
        buttons.forEach((down, i) => {
          if (down) this.suppressed.add(i)
        })
      }
      this.navHeld = null
    }
    for (const i of this.suppressed) {
      if (!buttons[i]) this.suppressed.delete(i)
    }

    const live = buttons.map((down, i) => down && !this.suppressed.has(i))
    const pressedNow = (i: number): boolean =>
      (live[i] ?? false) && !this.previous[i]

    if (this.capture) {
      this.updateCapture(pressedNow)
    } else if (mode === "gameplay") {
      this.updateGameplay(live, values, axes, pressedNow)
    } else if (mode === "menu") {
      this.updateMenu(deltaTime, live, axes, pressedNow)
    }

    this.previous = buttons
  }

  /** Suelta todo lo que el mando estuviera manteniendo. */
  public release(): void {
    if (this.ownsMove) {
      this.input.moveX = 0
      this.input.moveY = 0
      this.ownsMove = false
    }
    if (this.ownsVertical) {
      this.input.vertical = 0
      this.ownsVertical = false
    }
    if (this.ownsBoost) {
      this.input.boost = false
      this.ownsBoost = false
    }
    if (this.lookBack) {
      this.lookBack = false
      this.hooks.setLookBack(false)
    }
  }

  private updateGameplay(
    live: boolean[],
    values: number[],
    axes: number[],
    pressedNow: (i: number) => boolean,
  ): void {
    const stick = radialDeadzone(axes[0] ?? 0, axes[1] ?? 0)
    if (stick.x !== 0 || stick.y !== 0 || this.ownsMove) {
      this.input.moveX = stick.x
      // En la Gamepad API, el eje Y es positivo hacia abajo.
      this.input.moveY = stick.y === 0 ? 0 : -stick.y
      this.ownsMove = stick.x !== 0 || stick.y !== 0
    }

    // Profundidad con el stick derecho (arriba = subir); la cruceta también.
    const rightStick = radialDeadzone(0, axes[3] ?? 0).y
    const dpad = (live[PAD_BUTTON.up] ? 1 : 0) - (live[PAD_BUTTON.down] ? 1 : 0)
    const vertical = Math.max(-1, Math.min(1, dpad - rightStick))
    if (vertical !== 0 || this.ownsVertical) {
      this.input.vertical = vertical
      this.ownsVertical = vertical !== 0
    }

    const bindings = this.getBindings()
    // Un gatillo cuenta como mantenido a partir de cierto recorrido, para que
    // un roce no active el impulso (RT / R2 por defecto).
    const held = (i: number): boolean => {
      if (!live[i]) return false
      if (i !== PAD_BUTTON.lt && i !== PAD_BUTTON.rt) return true
      return triggerValue(values[i] ?? 1) >= BOOST_TRIGGER_THRESHOLD
    }

    const boost = held(bindings.boost)
    if (boost || this.ownsBoost) {
      this.input.boost = boost
      this.ownsBoost = boost
    }

    const lookBack = held(bindings.lookBack)
    if (lookBack !== this.lookBack) {
      this.lookBack = lookBack
      this.hooks.setLookBack(lookBack)
    }

    if (pressedNow(bindings.dashLeft)) this.hooks.dash("left")
    if (pressedNow(bindings.dashRight)) this.hooks.dash("right")
    if (pressedNow(bindings.backflip)) this.hooks.backflip()
    if (pressedNow(bindings.build)) this.hooks.build()
    // Select también pausa, salvo que se haya asignado a otra acción.
    const selectFree = !Object.values(bindings).includes(PAD_BUTTON.select)
    if (
      pressedNow(bindings.pause) ||
      (selectFree && pressedNow(PAD_BUTTON.select))
    ) {
      this.hooks.togglePause()
    }
  }

  private updateCapture(pressedNow: (i: number) => boolean): void {
    // El botón que responde no actúa después en el menú hasta que se suelte
    // (la cruceta que cancela movería el foco en los frames siguientes).
    const finish = (pressed: number, button: number | null): void => {
      this.suppressed.add(pressed)
      const done = this.capture
      this.capture = null
      done?.(button)
    }

    for (let i = PAD_BUTTON.a; i <= PAD_BUTTON.r3; i++) {
      if (isAssignableButton(i) && pressedNow(i)) {
        finish(i, i)
        return
      }
    }
    for (let i = PAD_BUTTON.up; i <= PAD_BUTTON.right; i++) {
      if (pressedNow(i)) {
        finish(i, null)
        return
      }
    }
  }

  private updateMenu(
    deltaTime: number,
    live: boolean[],
    axes: number[],
    pressedNow: (i: number) => boolean,
  ): void {
    const direction = navDirection(live, axes)
    if (direction !== this.navHeld) {
      this.navHeld = direction
      this.navTimer = NAV_REPEAT_DELAY
      if (direction) this.hooks.navigate(direction)
    } else if (direction) {
      this.navTimer -= deltaTime
      if (this.navTimer <= 0) {
        this.navTimer = NAV_REPEAT_INTERVAL
        this.hooks.navigate(direction)
      }
    }

    const scroll = radialDeadzone(0, axes[3] ?? 0).y
    if (scroll !== 0) this.hooks.scroll(scroll * MENU_SCROLL_SPEED * deltaTime)

    if (pressedNow(PAD_BUTTON.a)) this.hooks.activate()
    if (pressedNow(PAD_BUTTON.b)) this.hooks.back()
    if (pressedNow(PAD_BUTTON.start)) this.hooks.togglePause()
  }
}
