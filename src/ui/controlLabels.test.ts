import { describe, expect, it } from "vitest"
import { createDefaultKeyBindings, rebindKey } from "@core/keyBindings"
import {
  PAD_BUTTON,
  createDefaultPadBindings,
  rebindPadButton,
} from "@core/padBindings"
import {
  buildControlLabel,
  controlsHintText,
  gamepadControlRows,
  keyboardControlRows,
  padButtonLabel,
  type ControlBindings,
} from "@ui/controlLabels"

const keyboard = { device: "keyboard", padStyle: "xbox" } as const
const xbox = { device: "gamepad", padStyle: "xbox" } as const
const playstation = { device: "gamepad", padStyle: "playstation" } as const
const touch = { device: "touch", padStyle: "xbox" } as const

function defaults(): ControlBindings {
  return { keys: createDefaultKeyBindings(), pad: createDefaultPadBindings() }
}

describe("controlsHintText", () => {
  it("con teclado muestra las teclas asignadas", () => {
    const text = controlsHintText(keyboard, defaults())

    expect(text).toContain("WASD mover")
    expect(text).toContain("Espacio/C profundidad")
    expect(text).toContain("Shift izq. impulso")
  })

  it("refleja las teclas reasignadas", () => {
    const bindings = defaults()
    bindings.keys = rebindKey(bindings.keys, "build", "KeyG")

    expect(controlsHintText(keyboard, bindings)).toContain("G filtro")
  })

  it("separa las teclas de movimiento si no son letras sueltas", () => {
    const bindings = defaults()
    bindings.keys = rebindKey(bindings.keys, "forward", "Space")

    expect(controlsHintText(keyboard, bindings)).toContain("Espacio/A/S/D")
  })

  it("con mando: stick derecho para la profundidad y gatillo para el impulso", () => {
    const xboxText = controlsHintText(xbox, defaults())
    expect(xboxText).toContain("Stick der. profundidad")
    expect(xboxText).toContain("RT impulso")

    expect(controlsHintText(playstation, defaults())).toContain("R2 impulso")
  })

  it("con mando refleja los botones reasignados", () => {
    const bindings = defaults()
    bindings.pad = rebindPadButton(bindings.pad, "build", PAD_BUTTON.a)

    expect(controlsHintText(playstation, bindings)).toContain("✕ filtro")
  })
})

describe("padButtonLabel", () => {
  it("nombra los botones según la familia del mando", () => {
    expect(padButtonLabel("xbox", PAD_BUTTON.rt)).toBe("RT")
    expect(padButtonLabel("playstation", PAD_BUTTON.rt)).toBe("R2")
    expect(padButtonLabel("playstation", PAD_BUTTON.x)).toBe("□")
  })
})

describe("buildControlLabel", () => {
  it("nombra la tecla, el botón del mando o nada en táctil", () => {
    expect(buildControlLabel(keyboard, defaults())).toBe("B")
    expect(buildControlLabel(xbox, defaults())).toBe("X")
    expect(buildControlLabel(playstation, defaults())).toBe("□")
    expect(buildControlLabel(touch, defaults())).toBeNull()
  })
})

describe("filas de controles", () => {
  it("el teclado muestra las teclas actuales", () => {
    const rows = keyboardControlRows(createDefaultKeyBindings())

    expect(rows.find((r) => r.action === "Voltereta")?.keys).toEqual(["F"])
  })

  it("el mando muestra sus botones e incluye la navegación de menús", () => {
    const rows = gamepadControlRows("xbox", createDefaultPadBindings())

    expect(rows.find((r) => r.action.startsWith("Impulso"))?.keys).toEqual([
      "RT",
    ])
    expect(rows.some((r) => r.action.startsWith("Menús"))).toBe(true)
  })
})
