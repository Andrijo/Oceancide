// src/ui/SettingsScreen.ts
// Formulario de la pantalla "Ajustes". Usa controles nativos (radios, sliders
// y casillas) para que todo se pueda manejar con teclado: Tab entre campos,
// flechas dentro de cada grupo o slider, Espacio para las casillas. Los
// estilos están en styles.css (.settings-*).

import { QUALITY_LABELS, type QualityChoice } from "@core/quality"
import {
  SETTING_LIMITS,
  type ColorVisionMode,
  type RangeLimit,
  type ReduceMotionChoice,
  type Settings,
} from "@core/settings"
import {
  KEY_ACTIONS,
  KEY_ACTION_LABELS,
  createDefaultKeyBindings,
  isReservedKey,
  keyLabel,
  rebindKey,
  type KeyAction,
  type KeyBindings,
} from "@core/keyBindings"
import {
  PAD_ACTIONS,
  PAD_ACTION_LABELS,
  createDefaultPadBindings,
  rebindPadButton,
  type PadAction,
  type PadBindings,
} from "@core/padBindings"
import type { ControlsHintMode } from "@core/controlsHint"
import type { PadStyle } from "@core/gamepad"
import { padButtonLabel, type InputDevice } from "@ui/controlLabels"

export type SettingsPatch = Partial<Settings>

/** Cierra la escucha de la tecla o botón que se está reasignando, si la hay. */
let stopKeyCapture: (() => void) | null = null

/**
 * `true` mientras se espera la nueva tecla o botón del mando de una acción:
 * esa pulsación (Esc incluido, que cancela) es de la reasignación, no del
 * juego ni de los menús.
 */
export function isKeyCaptureActive(): boolean {
  return stopKeyCapture !== null
}

/** Cancela la reasignación en curso (al cerrar la pantalla o con el mando). */
export function cancelKeyCapture(): void {
  const stop = stopKeyCapture
  stopKeyCapture = null
  stop?.()
}

interface Choice<T extends string> {
  value: T
  label: string
}

const QUALITY_CHOICES: Choice<QualityChoice>[] = (
  ["auto", "low", "medium", "high"] as const
).map((value) => ({ value, label: QUALITY_LABELS[value] }))

const COLOR_VISION_CHOICES: Choice<ColorVisionMode>[] = [
  { value: "off", label: "No" },
  { value: "protanopia", label: "Protanopía" },
  { value: "deuteranopia", label: "Deuteranopía" },
  { value: "tritanopia", label: "Tritanopía" },
]

/** Muestra de los colores con significado, con la paleta activa. */
function colorPreview(): HTMLElement {
  const row = node("div", "settings-swatches")
  row.setAttribute("aria-hidden", "true")
  const swatches: [string, string, string][] = [
    ["good", "Mejora", "tone-mark-good"],
    ["bad", "Empeora", "tone-mark-bad"],
    ["warn", "Aviso", ""],
    ["leak", "Fuga", ""],
    ["debris", "Desecho", ""],
  ]
  for (const [token, label, mark] of swatches) {
    const swatch = node("span", `settings-swatch ${mark}`.trim(), label)
    swatch.style.setProperty("--swatch", `var(--c-${token})`)
    row.append(swatch)
  }
  return row
}

const MOTION_CHOICES: Choice<ReduceMotionChoice>[] = [
  { value: "system", label: "Como el sistema" },
  { value: "on", label: "Sí" },
  { value: "off", label: "No" },
]

const CONTROLS_HINT_CHOICES: Choice<ControlsHintMode>[] = [
  { value: "auto", label: "Hasta usarlos" },
  { value: "always", label: "Siempre" },
  { value: "off", label: "Nunca" },
]

let fieldCounter = 0
const nextId = (name: string): string => `settings-${name}-${++fieldCounter}`

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function section(title: string, ...fields: HTMLElement[]): HTMLElement {
  const wrap = node("section", "settings-section")
  wrap.append(node("h2", "settings-heading", title), ...fields)
  return wrap
}

/** Texto de ayuda bajo un campo, enlazado con `aria-describedby`. */
function describe(field: HTMLElement, target: HTMLElement, hint?: string) {
  if (!hint) return
  const p = node("p", "settings-hint", hint)
  p.id = nextId("hint")
  target.setAttribute("aria-describedby", p.id)
  field.append(p)
}

/** Grupo de opciones excluyentes (radios con aspecto de botones segmentados). */
function choiceField<T extends string>(
  label: string,
  choices: Choice<T>[],
  current: T,
  onChange: (value: T) => void,
  hint?: string,
): HTMLElement {
  const field = node("fieldset", "settings-field")
  field.append(node("legend", "settings-label", label))

  const name = nextId("choice")
  const segments = node("div", "settings-segments")
  for (const choice of choices) {
    const option = node("label", "settings-segment")
    const input = document.createElement("input")
    input.type = "radio"
    input.name = name
    input.value = choice.value
    input.checked = choice.value === current
    input.addEventListener("change", () => {
      if (input.checked) onChange(choice.value)
    })
    option.append(input, node("span", "settings-segment-text", choice.label))
    segments.append(option)
  }

  field.append(segments)
  describe(field, field, hint)
  return field
}

/** Slider con el valor actual a la derecha de la etiqueta. */
function rangeField(
  label: string,
  limit: RangeLimit,
  current: number,
  format: (value: number) => string,
  onChange: (value: number) => void,
  hint?: string,
): HTMLElement {
  const field = node("div", "settings-field")
  const id = nextId("range")

  const row = node("div", "settings-row")
  const labelEl = node("label", "settings-label", label)
  labelEl.htmlFor = id
  const output = node("output", "settings-value", format(current))
  output.htmlFor.add(id)
  row.append(labelEl, output)

  const input = node("input", "settings-range")
  input.type = "range"
  input.id = id
  input.min = String(limit.min)
  input.max = String(limit.max)
  input.step = String(limit.step)
  input.value = String(current)
  input.setAttribute("aria-valuetext", format(current))
  input.addEventListener("input", () => {
    const value = Number(input.value)
    const text = format(value)
    output.textContent = text
    input.setAttribute("aria-valuetext", text)
    onChange(value)
  })

  field.append(row, input)
  describe(field, input, hint)
  return field
}

/** Interruptor de sí/no (casilla nativa con `role="switch"`). */
function switchField(
  label: string,
  current: boolean,
  onChange: (value: boolean) => void,
  hint?: string,
): HTMLElement {
  const field = node("div", "settings-field")
  const row = node("label", "settings-row settings-switch")

  const input = node("input", "settings-toggle")
  input.type = "checkbox"
  input.setAttribute("role", "switch")
  input.checked = current
  input.addEventListener("change", () => onChange(input.checked))

  row.append(node("span", "settings-label", label), input)
  field.append(row)
  describe(field, input, hint)
  return field
}

/** Respuesta a la espera de una tecla o botón nuevos. */
type CaptureResult<V> =
  | { value: V }
  | { cancelled: true; message?: string }
  /** No vale (tecla reservada): se avisa y se sigue esperando. */
  | { rejected: string }

interface BindingFieldConfig<A extends string, V> {
  title: string
  note: string
  actions: readonly A[]
  labels: Record<A, string>
  initial: Record<A, V>
  defaults(): Record<A, V>
  format(value: V): string
  rebind(bindings: Record<A, V>, action: A, value: V): Record<A, V>
  /** Texto del botón mientras espera ("Pulsa una tecla…"). */
  waiting: string
  /** Aviso mientras espera, con el nombre de la acción. */
  prompt(label: string): string
  resetLabel: string
  resetDone: string
  /** Empieza a escuchar; `done` recibe la respuesta. Devuelve cómo parar. */
  listen(done: (result: CaptureResult<V>) => void): () => void
  onChange(bindings: Record<A, V>): void
}

/**
 * Lista de acciones con su tecla o botón. Al pulsar el de una acción se espera
 * la nueva tecla o botón; si ya lo usaba otra acción, se intercambian.
 */
function bindingField<A extends string, V>(
  config: BindingFieldConfig<A, V>,
): HTMLElement {
  let bindings = config.initial
  const field = node("div", "settings-field")
  const list = node("div", "settings-keys")
  const status = node("p", "settings-hint settings-key-status")
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")

  const buttons = new Map<A, HTMLButtonElement>()
  const refresh = (): void => {
    for (const [action, button] of buttons) {
      const value = config.format(bindings[action])
      button.textContent = value
      // Los glifos sueltos (✕ ○ □ △, flechas) salen diminutos con la fuente
      // de la interfaz: se dibujan más grandes.
      button.classList.toggle(
        "settings-key-symbol",
        /^[^\p{L}\p{N}]$/u.test(value),
      )
      button.setAttribute(
        "aria-label",
        `${config.labels[action]}: ${value}. Pulsa para cambiarlo.`,
      )
    }
  }

  const startCapture = (action: A, button: HTMLButtonElement): void => {
    cancelKeyCapture()
    const label = config.labels[action]
    button.textContent = config.waiting
    button.classList.add("settings-key-capturing")
    button.setAttribute("aria-pressed", "true")
    status.textContent = config.prompt(label)

    const stopListening = config.listen((result) => {
      if ("rejected" in result) {
        status.textContent = result.rejected
        return
      }
      cancelKeyCapture()
      if ("cancelled" in result) {
        status.textContent = result.message ?? "Sin cambios."
      } else {
        const next = config.rebind(bindings, action, result.value)
        const swapped = config.actions.find(
          (other) => other !== action && next[other] !== bindings[other],
        )
        bindings = next
        config.onChange(next)
        refresh()
        const value = config.format(next[action])
        status.textContent = swapped
          ? `${label}: ${value}. «${config.labels[swapped]}» pasa a ${config.format(next[swapped])}.`
          : `${label}: ${value}.`
      }
      button.focus()
    })
    // Pulsar fuera del botón cancela la espera.
    const onPointer = (event: PointerEvent): void => {
      if (event.target !== button) cancelKeyCapture()
    }

    window.addEventListener("pointerdown", onPointer, true)
    stopKeyCapture = () => {
      stopListening()
      window.removeEventListener("pointerdown", onPointer, true)
      button.classList.remove("settings-key-capturing")
      button.setAttribute("aria-pressed", "false")
      refresh()
    }
  }

  for (const action of config.actions) {
    const row = node("div", "settings-row settings-key-row")
    const button = node("button", "settings-key")
    button.type = "button"
    button.setAttribute("aria-pressed", "false")
    button.addEventListener("click", () => startCapture(action, button))
    buttons.set(action, button)
    row.append(node("span", "settings-label", config.labels[action]), button)
    list.append(row)
  }
  refresh()

  const reset = node("button", "settings-key-reset", config.resetLabel)
  reset.type = "button"
  reset.addEventListener("click", () => {
    cancelKeyCapture()
    bindings = config.defaults()
    config.onChange(bindings)
    refresh()
    status.textContent = config.resetDone
  })

  field.append(
    node("p", "settings-label", config.title),
    node("p", "settings-hint", config.note),
    list,
    status,
    reset,
  )
  return field
}

/** Escucha la siguiente tecla. En captura y sin propagar: no llega al juego. */
function listenForKey(
  done: (result: CaptureResult<string>) => void,
): () => void {
  const onKey = (event: KeyboardEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    if (event.code === "Escape") done({ cancelled: true })
    else if (isReservedKey(event.code)) {
      done({
        rejected: `${keyLabel(event.code)} está reservada: elige otra o pulsa Esc.`,
      })
    } else done({ value: event.code })
  }
  window.addEventListener("keydown", onKey, true)
  return () => window.removeEventListener("keydown", onKey, true)
}

/** Segundos que se espera un botón del mando antes de rendirse. */
const PAD_CAPTURE_TIMEOUT_MS = 8000

function keyBindingsField(
  initial: KeyBindings,
  onChange: (bindings: KeyBindings) => void,
): HTMLElement {
  return bindingField<KeyAction, string>({
    title: "Teclas",
    note: "Esc y Enter pausan y no se pueden cambiar. Las flechas y U, J, I siguen funcionando como alternativa.",
    actions: KEY_ACTIONS,
    labels: KEY_ACTION_LABELS,
    initial,
    defaults: createDefaultKeyBindings,
    format: keyLabel,
    rebind: rebindKey,
    waiting: "Pulsa una tecla…",
    prompt: (label) => `Pulsa la nueva tecla para «${label}». Esc cancela.`,
    resetLabel: "Restablecer teclas",
    resetDone: "Teclas por defecto restablecidas.",
    listen: listenForKey,
    onChange,
  })
}

function padBindingsField(
  initial: PadBindings,
  padStyle: PadStyle,
  capturePadButton: SettingsBodyOptions["capturePadButton"],
  onChange: (bindings: PadBindings) => void,
): HTMLElement {
  return bindingField<PadAction, number>({
    title: "Botones del mando",
    note: "El stick izquierdo mueve y el derecho sube y baja. La cruceta, A y B sirven para los menús.",
    actions: PAD_ACTIONS,
    labels: PAD_ACTION_LABELS,
    initial,
    defaults: createDefaultPadBindings,
    format: (button) => padButtonLabel(padStyle, button),
    rebind: rebindPadButton,
    waiting: "Pulsa un botón…",
    prompt: (label) =>
      `Pulsa en el mando el nuevo botón para «${label}». La cruceta o Esc cancelan.`,
    resetLabel: "Restablecer botones",
    resetDone: "Botones por defecto restablecidos.",
    listen: (done) => {
      const stopPad = capturePadButton((button) =>
        done(button === null ? { cancelled: true } : { value: button }),
      )
      const onKey = (event: KeyboardEvent): void => {
        if (event.code !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        done({ cancelled: true })
      }
      const timer = setTimeout(
        () =>
          done({
            cancelled: true,
            message: "No se ha pulsado ningún botón del mando. Sin cambios.",
          }),
        PAD_CAPTURE_TIMEOUT_MS,
      )
      window.addEventListener("keydown", onKey, true)
      return () => {
        stopPad()
        clearTimeout(timer)
        window.removeEventListener("keydown", onKey, true)
      }
    },
    onChange,
  })
}

const percent = (value: number): string => `${Math.round(value * 100)} %`

export interface SettingsBodyOptions {
  /** Dispositivo en uso: sus controles van primero. */
  device: InputDevice
  /** Familia del último mando usado, para nombrar sus botones. */
  padStyle: PadStyle
  /**
   * Escucha el siguiente botón del mando (`null` si se cancela con la
   * cruceta). Devuelve la función que deja de escuchar.
   */
  capturePadButton(onButton: (button: number | null) => void): () => void
  onChange(patch: SettingsPatch): void
}

/** Cuerpo de la pantalla "Ajustes" con los valores de `settings`. */
export function createSettingsBody(
  settings: Settings,
  { device, padStyle, capturePadButton, onChange }: SettingsBodyOptions,
): HTMLElement {
  const body = node("div", "settings-body")

  const graphics = section(
    "Gráficos",
    choiceField(
      "Calidad gráfica",
      QUALITY_CHOICES,
      settings.quality,
      (quality) => onChange({ quality }),
      "Auto elige según el dispositivo y baja la calidad si el juego va lento.",
    ),
    rangeField(
      "Campo de visión",
      SETTING_LIMITS.fov,
      settings.fov,
      (fov) => `${fov}°`,
      (fov) => onChange({ fov }),
      "Más amplio muestra más alrededor de la tortuga; más estrecho, la acerca.",
    ),
  )

  const motion = section(
    "Movimiento",
    choiceField(
      "Reducir movimiento",
      MOTION_CHOICES,
      settings.reduceMotion,
      (reduceMotion) => onChange({ reduceMotion }),
      "Quita las animaciones decorativas de la interfaz y el giro de la cámara en los menús.",
    ),
  )

  const colorField = choiceField(
    "Modo para daltonismo",
    COLOR_VISION_CHOICES,
    settings.colorVision,
    (colorVision) => onChange({ colorVision }),
    "Cambia los colores que indican mejora, empeora, aviso y fuga, y añade símbolos (▲ ▼) y formas para no depender solo del color.",
  )
  colorField.append(colorPreview())
  const color = section("Color", colorField)

  const touchFields = [
    rangeField(
      "Tamaño de los controles táctiles",
      SETTING_LIMITS.touchScale,
      settings.touchScale,
      percent,
      (touchScale) => onChange({ touchScale }),
    ),
    rangeField(
      "Opacidad de los controles táctiles",
      SETTING_LIMITS.touchOpacity,
      settings.touchOpacity,
      percent,
      (touchOpacity) => onChange({ touchOpacity }),
    ),
    switchField(
      "Vibración",
      settings.vibration,
      (vibration) => onChange({ vibration }),
      "Una vibración corta al hacer el dash, en los dispositivos que la admiten.",
    ),
  ]
  const hintField = choiceField(
    "Pista de controles en pantalla",
    CONTROLS_HINT_CHOICES,
    settings.controlsHint,
    (controlsHint) => onChange({ controlsHint }),
    "La línea con los controles del teclado o del mando en la parte de abajo. «Hasta usarlos» quita cada control básico en cuanto lo usas; «Siempre» los muestra todos.",
  )
  const keyboardFields = [
    keyBindingsField(settings.keyBindings, (keyBindings) =>
      onChange({ keyBindings }),
    ),
  ]
  const gamepadFields = [
    padBindingsField(
      settings.padBindings,
      padStyle,
      capturePadButton,
      (padBindings) => onChange({ padBindings }),
    ),
  ]
  // Primero, los controles del dispositivo en uso.
  const groups = {
    keyboard: keyboardFields,
    gamepad: gamepadFields,
    touch: touchFields,
  }
  const order: InputDevice[] = ["keyboard", "gamepad", "touch"]
  const controls = section(
    "Controles",
    hintField,
    ...groups[device],
    ...order.filter((d) => d !== device).flatMap((d) => groups[d]),
  )

  const notices = section(
    "Avisos",
    switchField(
      "Consejos durante la inmersión",
      settings.tipsEnabled,
      (tipsEnabled) => onChange({ tipsEnabled }),
      "Pistas que salen la primera vez que te encuentras algo nuevo.",
    ),
  )

  body.append(graphics, motion, color, controls, notices)
  return body
}
