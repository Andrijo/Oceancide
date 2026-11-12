// src/core/keyBindings.ts
// Asignación de teclas: qué acciones se pueden reasignar, sus teclas por
// defecto, las alternativas fijas y cómo se resuelve una tecla pulsada.
// Lógica pura (sin DOM); se guarda dentro de los ajustes (`keyBindings`).
//
// Se trabaja con `KeyboardEvent.code` (posición física de la tecla), así que
// los controles no cambian de sitio con la distribución del teclado.

export const KEY_ACTIONS = [
  "forward",
  "backward",
  "left",
  "right",
  "up",
  "down",
  "boost",
  "dashLeft",
  "dashRight",
  "backflip",
  "build",
  "lookBack",
  "abandon",
] as const

export type KeyAction = (typeof KEY_ACTIONS)[number]

/** Tecla principal (reasignable) de cada acción. */
export type KeyBindings = Record<KeyAction, string>

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  forward: "Avanzar",
  backward: "Retroceder",
  left: "Girar a la izquierda",
  right: "Girar a la derecha",
  up: "Subir",
  down: "Bajar",
  boost: "Impulso (mantener)",
  dashLeft: "Dash a la izquierda",
  dashRight: "Dash a la derecha",
  backflip: "Voltereta",
  build: "Colocar esfera filtradora",
  lookBack: "Mirar atrás (mantener)",
  abandon: "Abandonar (pide confirmación)",
}

/**
 * Por defecto, el esquema habitual de los juegos de nado en 3D: WASD, Espacio
 * y C para la profundidad y Shift para el impulso, todo sin soltar el WASD.
 */
export function createDefaultKeyBindings(): KeyBindings {
  return {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    up: "Space",
    down: "KeyC",
    boost: "ShiftLeft",
    dashLeft: "KeyQ",
    dashRight: "KeyE",
    backflip: "KeyF",
    build: "KeyB",
    lookBack: "KeyV",
    abandon: "KeyR",
  }
}

/**
 * Teclas alternativas que siempre funcionan, además de la principal: las
 * flechas y las teclas de las primeras versiones (U/J profundidad, I impulso).
 * Si una de ellas se asigna como principal a otra acción, gana la principal.
 */
export const KEY_ALTERNATES: Partial<Record<KeyAction, readonly string[]>> = {
  forward: ["ArrowUp"],
  backward: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["KeyU"],
  down: ["KeyJ"],
  boost: ["KeyI", "ShiftRight"],
}

/**
 * Teclas que no se pueden asignar: Esc y Enter pausan y navegan los menús, Tab
 * mueve el foco y las de función o de sistema las usa el navegador.
 */
export function isReservedKey(code: string): boolean {
  return (
    code === "" ||
    code === "Escape" ||
    code === "Enter" ||
    code === "NumpadEnter" ||
    code === "Tab" ||
    code === "MetaLeft" ||
    code === "MetaRight" ||
    code === "OSLeft" ||
    code === "OSRight" ||
    code === "ContextMenu" ||
    /^F\d{1,2}$/.test(code)
  )
}

function isKeyAction(value: unknown): value is KeyAction {
  return KEY_ACTIONS.includes(value as KeyAction)
}

/**
 * Sanea unas asignaciones leídas de disco. Cada acción conserva su tecla si es
 * válida; si falta o no vale, recupera la de por defecto. Si dos acciones
 * acabaran con la misma tecla, se vuelve a las teclas por defecto.
 */
export function sanitizeKeyBindings(raw: unknown): KeyBindings {
  const defaults = createDefaultKeyBindings()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults

  const data = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const action of KEY_ACTIONS) {
    const code = data[action]
    if (typeof code === "string" && !isReservedKey(code)) result[action] = code
  }

  const used = new Set(Object.values(result))
  return used.size === KEY_ACTIONS.length ? result : defaults
}

/**
 * Asigna `code` a `action`. Si otra acción la usaba, se intercambian: esa
 * acción se queda con la tecla anterior de `action`, así nunca hay choques.
 */
export function rebindKey(
  bindings: KeyBindings,
  action: KeyAction,
  code: string,
): KeyBindings {
  if (isReservedKey(code) || bindings[action] === code) return bindings

  const next = { ...bindings }
  const previous = next[action]
  for (const other of KEY_ACTIONS) {
    if (other !== action && next[other] === code) next[other] = previous
  }
  next[action] = code
  return next
}

/** Acción de una tecla: primero las principales y después las alternativas. */
export function resolveKeyAction(
  bindings: KeyBindings,
  code: string,
): KeyAction | null {
  for (const action of KEY_ACTIONS) {
    if (bindings[action] === code) return action
  }
  for (const [action, codes] of Object.entries(KEY_ALTERNATES)) {
    if (isKeyAction(action) && codes.includes(code)) return action
  }
  return null
}

const KEY_NAMES: Record<string, string> = {
  Space: "Espacio",
  ShiftLeft: "Shift izq.",
  ShiftRight: "Shift der.",
  ControlLeft: "Ctrl izq.",
  ControlRight: "Ctrl der.",
  AltLeft: "Alt",
  AltRight: "Alt Gr",
  CapsLock: "Bloq Mayús",
  Backspace: "Retroceso",
  Delete: "Supr",
  Insert: "Insert",
  Home: "Inicio",
  End: "Fin",
  PageUp: "Re Pág",
  PageDown: "Av Pág",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backquote: "º",
  Minus: "'",
  Equal: "¡",
  BracketLeft: "`",
  BracketRight: "+",
  Backslash: "ç",
  Semicolon: "Ñ",
  Quote: "´",
  Comma: ",",
  Period: ".",
  Slash: "-",
  IntlBackslash: "<",
  NumpadAdd: "Num +",
  NumpadSubtract: "Num -",
  NumpadMultiply: "Num *",
  NumpadDivide: "Num /",
  NumpadDecimal: "Num .",
}

/**
 * Nombre corto de una tecla para mostrarlo ("KeyW" → "W"). Las teclas de
 * símbolos se nombran como en el teclado español.
 */
export function keyLabel(code: string): string {
  if (code === "") return "—"
  const named = KEY_NAMES[code]
  if (named) return named
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`
  return code
}
