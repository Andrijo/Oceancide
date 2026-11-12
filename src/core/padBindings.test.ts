import { describe, expect, it } from "vitest"
import {
  PAD_ACTIONS,
  PAD_BUTTON,
  createDefaultPadBindings,
  isAssignableButton,
  rebindPadButton,
  sanitizePadBindings,
} from "@core/padBindings"

describe("createDefaultPadBindings", () => {
  it("impulso en RT / R2 y sin botones repetidos", () => {
    const bindings = createDefaultPadBindings()

    expect(bindings.boost).toBe(PAD_BUTTON.rt)
    expect(new Set(Object.values(bindings)).size).toBe(PAD_ACTIONS.length)
    expect(Object.values(bindings).every(isAssignableButton)).toBe(true)
  })
})

describe("isAssignableButton", () => {
  it("admite frontales, laterales, gatillos, Select/Start y sticks", () => {
    expect(isAssignableButton(PAD_BUTTON.a)).toBe(true)
    expect(isAssignableButton(PAD_BUTTON.lt)).toBe(true)
    expect(isAssignableButton(PAD_BUTTON.r3)).toBe(true)
  })

  it("deja fuera la cruceta y lo que no es un botón", () => {
    expect(isAssignableButton(PAD_BUTTON.up)).toBe(false)
    expect(isAssignableButton(16)).toBe(false)
    expect(isAssignableButton(-1)).toBe(false)
    expect(isAssignableButton(1.5)).toBe(false)
    expect(isAssignableButton("0")).toBe(false)
  })
})

describe("rebindPadButton", () => {
  it("asigna un botón libre", () => {
    const after = rebindPadButton(
      createDefaultPadBindings(),
      "build",
      PAD_BUTTON.a,
    )

    expect(after.build).toBe(PAD_BUTTON.a)
  })

  it("intercambia si el botón ya estaba en uso", () => {
    const after = rebindPadButton(
      createDefaultPadBindings(),
      "boost",
      PAD_BUTTON.x,
    )

    expect(after.boost).toBe(PAD_BUTTON.x)
    expect(after.build).toBe(PAD_BUTTON.rt)
  })

  it("rechaza la cruceta", () => {
    const before = createDefaultPadBindings()

    expect(rebindPadButton(before, "boost", PAD_BUTTON.down)).toBe(before)
  })
})

describe("sanitizePadBindings", () => {
  it("sin datos válidos devuelve los botones por defecto", () => {
    expect(sanitizePadBindings(undefined)).toEqual(createDefaultPadBindings())
    expect(sanitizePadBindings([3])).toEqual(createDefaultPadBindings())
  })

  it("conserva los válidos y descarta el resto", () => {
    const bindings = sanitizePadBindings({ build: PAD_BUTTON.a, boost: 13 })

    expect(bindings.build).toBe(PAD_BUTTON.a)
    expect(bindings.boost).toBe(PAD_BUTTON.rt)
  })

  it("si dos acciones comparten botón vuelve a los de por defecto", () => {
    expect(sanitizePadBindings({ build: PAD_BUTTON.rt })).toEqual(
      createDefaultPadBindings(),
    )
  })
})
