// src/ui/controlLabels.ts
// Textos de ayuda de los controles según el dispositivo en uso (teclado,
// táctil o mando), con las teclas y botones asignados y los glifos del mando.

import type { PadStyle } from "@core/gamepad"
import { keyLabel, type KeyBindings } from "@core/keyBindings"
import { PAD_BUTTON, type PadBindings } from "@core/padBindings"

export type InputDevice = "keyboard" | "touch" | "gamepad"

export interface ControlDevice {
  device: InputDevice
  /** Familia del último mando usado (solo importa con `device: "gamepad"`). */
  padStyle: PadStyle
}

/** Asignaciones del jugador: teclas y botones del mando. */
export interface ControlBindings {
  keys: KeyBindings
  pad: PadBindings
}

export interface ControlRow {
  keys: string[]
  action: string
}

/** Nombre de cada botón (índice "standard") en cada familia de mando. */
const PAD_BUTTON_NAMES: Record<PadStyle, Record<number, string>> = {
  xbox: {
    [PAD_BUTTON.a]: "A",
    [PAD_BUTTON.b]: "B",
    [PAD_BUTTON.x]: "X",
    [PAD_BUTTON.y]: "Y",
    [PAD_BUTTON.lb]: "LB",
    [PAD_BUTTON.rb]: "RB",
    [PAD_BUTTON.lt]: "LT",
    [PAD_BUTTON.rt]: "RT",
    [PAD_BUTTON.select]: "View",
    [PAD_BUTTON.start]: "Menu",
    [PAD_BUTTON.l3]: "LS",
    [PAD_BUTTON.r3]: "RS",
    [PAD_BUTTON.up]: "↑",
    [PAD_BUTTON.down]: "↓",
    [PAD_BUTTON.left]: "←",
    [PAD_BUTTON.right]: "→",
  },
  playstation: {
    [PAD_BUTTON.a]: "✕",
    [PAD_BUTTON.b]: "○",
    [PAD_BUTTON.x]: "□",
    [PAD_BUTTON.y]: "△",
    [PAD_BUTTON.lb]: "L1",
    [PAD_BUTTON.rb]: "R1",
    [PAD_BUTTON.lt]: "L2",
    [PAD_BUTTON.rt]: "R2",
    [PAD_BUTTON.select]: "Create",
    [PAD_BUTTON.start]: "Options",
    [PAD_BUTTON.l3]: "L3",
    [PAD_BUTTON.r3]: "R3",
    [PAD_BUTTON.up]: "↑",
    [PAD_BUTTON.down]: "↓",
    [PAD_BUTTON.left]: "←",
    [PAD_BUTTON.right]: "→",
  },
}

/** Nombre de un botón del mando ("A", "R2"...). */
export function padButtonLabel(style: PadStyle, button: number): string {
  return PAD_BUTTON_NAMES[style][button] ?? `Botón ${button}`
}

const LEFT_STICK = "Stick izq."
const RIGHT_STICK = "Stick der."
const DPAD = "Cruceta"

/** "WASD" si son cuatro letras sueltas; si no, "W/A/S/D". */
function moveKeys(bindings: KeyBindings): string {
  const keys = [
    bindings.forward,
    bindings.left,
    bindings.backward,
    bindings.right,
  ].map(keyLabel)
  return keys.every((k) => k.length === 1) ? keys.join("") : keys.join("/")
}

/** Línea de la pista de controles de la parte inferior (sin táctil). */
export function controlsHintText(
  { device, padStyle }: ControlDevice,
  { keys, pad }: ControlBindings,
): string {
  if (device === "gamepad") {
    const b = (button: number): string => padButtonLabel(padStyle, button)
    return [
      `${LEFT_STICK} mover`,
      `${RIGHT_STICK} profundidad`,
      `${b(pad.boost)} impulso`,
      `${b(pad.dashLeft)}/${b(pad.dashRight)} dash`,
      `${b(pad.backflip)} voltereta`,
      `${b(pad.build)} filtro`,
      `${b(pad.lookBack)} mirar atrás`,
      `${b(pad.pause)} pausa`,
    ].join(" · ")
  }

  const k = (code: string): string => keyLabel(code)
  return [
    `${moveKeys(keys)} mover`,
    `${k(keys.up)}/${k(keys.down)} profundidad`,
    `${k(keys.boost)} impulso`,
    `${k(keys.dashLeft)}/${k(keys.dashRight)} dash`,
    `${k(keys.backflip)} voltereta`,
    `${k(keys.build)} filtro`,
    `${k(keys.lookBack)} mirar atrás`,
    "Esc pausa",
  ].join(" · ")
}

/** Tecla o botón que coloca el filtro; `null` en táctil (es un botón en pantalla). */
export function buildControlLabel(
  { device, padStyle }: ControlDevice,
  { keys, pad }: ControlBindings,
): string | null {
  if (device === "touch") return null
  if (device === "gamepad") return padButtonLabel(padStyle, pad.build)
  return keyLabel(keys.build)
}

export function keyboardControlRows(bindings: KeyBindings): ControlRow[] {
  const k = (code: string): string => keyLabel(code)
  return [
    {
      keys: [k(bindings.forward), k(bindings.backward)],
      action: "Avanzar y retroceder (o ↑ ↓)",
    },
    { keys: [k(bindings.left), k(bindings.right)], action: "Girar (o ← →)" },
    {
      keys: [k(bindings.up), k(bindings.down)],
      action: "Subir y bajar (o U J)",
    },
    { keys: [k(bindings.boost)], action: "Impulso (mantener)" },
    {
      keys: [k(bindings.dashLeft), k(bindings.dashRight)],
      action: "Giro de 360° con dash",
    },
    { keys: [k(bindings.backflip)], action: "Voltereta" },
    { keys: [k(bindings.build)], action: "Colocar esfera filtradora" },
    { keys: [k(bindings.lookBack)], action: "Mirar atrás (mantener)" },
    { keys: ["Esc", "Enter"], action: "Pausa" },
    { keys: [k(bindings.abandon)], action: "Abandonar (pide confirmación)" },
  ]
}

export function gamepadControlRows(
  style: PadStyle,
  bindings: PadBindings,
): ControlRow[] {
  const b = (button: number): string => padButtonLabel(style, button)
  return [
    { keys: [LEFT_STICK], action: "Avanzar y girar" },
    { keys: [RIGHT_STICK], action: "Subir y bajar (o cruceta ↑ ↓)" },
    { keys: [b(bindings.boost)], action: "Impulso (mantener)" },
    {
      keys: [b(bindings.dashLeft), b(bindings.dashRight)],
      action: "Giro de 360° con dash",
    },
    { keys: [b(bindings.backflip)], action: "Voltereta" },
    { keys: [b(bindings.build)], action: "Colocar esfera filtradora" },
    { keys: [b(bindings.lookBack)], action: "Mirar atrás (mantener)" },
    { keys: [b(bindings.pause)], action: "Pausa" },
    {
      keys: [DPAD, b(PAD_BUTTON.a), b(PAD_BUTTON.b)],
      action: "Menús: moverse, elegir y volver",
    },
  ]
}
