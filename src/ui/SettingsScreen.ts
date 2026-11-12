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

export type SettingsPatch = Partial<Settings>

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

const percent = (value: number): string => `${Math.round(value * 100)} %`

export interface SettingsBodyOptions {
  /** El jugador usa la pantalla táctil: sus controles van primero. */
  touch: boolean
  onChange(patch: SettingsPatch): void
}

/** Cuerpo de la pantalla "Ajustes" con los valores de `settings`. */
export function createSettingsBody(
  settings: Settings,
  { touch, onChange }: SettingsBodyOptions,
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
  const keyboardFields = [
    switchField(
      "Pista de teclas en pantalla",
      settings.showControlsHint,
      (showControlsHint) => onChange({ showControlsHint }),
      "La línea con los controles de teclado en la parte de abajo.",
    ),
  ]
  const controls = section(
    "Controles",
    ...(touch
      ? [...touchFields, ...keyboardFields]
      : [...keyboardFields, ...touchFields]),
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
