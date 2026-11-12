import { describe, expect, it } from "vitest"
import {
  BASIC_CONTROLS,
  HINT_ACTIONS,
  hintActions,
  isControlsHintMode,
  isHeldControlActive,
  isHintAction,
} from "@core/controlsHint"
import type { InputState } from "@core/types"

function idle(): InputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    moveX: 0,
    moveY: 0,
    vertical: 0,
  }
}

describe("hintActions", () => {
  it("en automático enseña los controles básicos que faltan por usar", () => {
    expect(hintActions("auto", [])).toEqual([...BASIC_CONTROLS])
    expect(hintActions("auto", ["move", "dash"])).toEqual([
      "depth",
      "boost",
      "build",
    ])
  })

  it("en automático no nombra los controles secundarios", () => {
    const actions = hintActions("auto", [])

    expect(actions).not.toContain("backflip")
    expect(actions).not.toContain("lookBack")
    expect(actions).not.toContain("pause")
  })

  it("tras usar todos los controles básicos, la pista se queda vacía", () => {
    expect(hintActions("auto", [...BASIC_CONTROLS])).toEqual([])
  })

  it("fija muestra todas las acciones aunque ya se hayan usado", () => {
    expect(hintActions("always", [...BASIC_CONTROLS])).toEqual([
      ...HINT_ACTIONS,
    ])
  })

  it("desactivada no muestra nada", () => {
    expect(hintActions("off", [])).toEqual([])
  })
})

describe("isHeldControlActive", () => {
  it("sin entrada no hay ningún control en uso", () => {
    const input = idle()

    expect(isHeldControlActive(input, "move")).toBe(false)
    expect(isHeldControlActive(input, "depth")).toBe(false)
    expect(isHeldControlActive(input, "boost")).toBe(false)
  })

  it("detecta el movimiento con teclas o con stick", () => {
    expect(isHeldControlActive({ ...idle(), left: true }, "move")).toBe(true)
    expect(isHeldControlActive({ ...idle(), moveY: 0.4 }, "move")).toBe(true)
  })

  it("detecta la profundidad con teclas o con stick", () => {
    expect(isHeldControlActive({ ...idle(), down: true }, "depth")).toBe(true)
    expect(isHeldControlActive({ ...idle(), vertical: -1 }, "depth")).toBe(true)
    expect(isHeldControlActive({ ...idle(), forward: true }, "depth")).toBe(
      false,
    )
  })

  it("detecta el impulso", () => {
    expect(isHeldControlActive({ ...idle(), boost: true }, "boost")).toBe(true)
  })
})

describe("validadores", () => {
  it("reconocen solo los valores conocidos", () => {
    expect(isHintAction("dash")).toBe(true)
    expect(isHintAction("volar")).toBe(false)
    expect(isControlsHintMode("always")).toBe(true)
    expect(isControlsHintMode(true)).toBe(false)
  })
})
