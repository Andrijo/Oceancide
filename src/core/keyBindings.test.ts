import { describe, expect, it } from "vitest"
import {
  KEY_ACTIONS,
  createDefaultKeyBindings,
  isReservedKey,
  keyLabel,
  rebindKey,
  resolveKeyAction,
  sanitizeKeyBindings,
} from "@core/keyBindings"

describe("createDefaultKeyBindings", () => {
  it("usa el esquema estándar sin soltar el WASD", () => {
    const bindings = createDefaultKeyBindings()

    expect(bindings).toMatchObject({
      forward: "KeyW",
      up: "Space",
      down: "KeyC",
      boost: "ShiftLeft",
    })
  })

  it("no repite teclas ni usa teclas reservadas", () => {
    const codes = Object.values(createDefaultKeyBindings())

    expect(new Set(codes).size).toBe(KEY_ACTIONS.length)
    expect(codes.some(isReservedKey)).toBe(false)
  })
})

describe("resolveKeyAction", () => {
  it("conserva las teclas antiguas como alternativa", () => {
    const bindings = createDefaultKeyBindings()

    expect(resolveKeyAction(bindings, "KeyU")).toBe("up")
    expect(resolveKeyAction(bindings, "KeyJ")).toBe("down")
    expect(resolveKeyAction(bindings, "KeyI")).toBe("boost")
    expect(resolveKeyAction(bindings, "ArrowLeft")).toBe("left")
  })

  it("devuelve null con una tecla sin acción", () => {
    expect(resolveKeyAction(createDefaultKeyBindings(), "KeyZ")).toBeNull()
  })
})

describe("rebindKey", () => {
  it("asigna una tecla libre sin tocar el resto", () => {
    const before = createDefaultKeyBindings()
    const after = rebindKey(before, "build", "KeyG")

    expect(after.build).toBe("KeyG")
    expect({ ...after, build: before.build }).toEqual(before)
    expect(before.build).toBe("KeyB")
  })

  it("intercambia las teclas si la nueva ya estaba en uso", () => {
    const after = rebindKey(createDefaultKeyBindings(), "up", "KeyC")

    expect(after.up).toBe("KeyC")
    expect(after.down).toBe("Space")
  })

  it("rechaza las teclas reservadas", () => {
    const before = createDefaultKeyBindings()

    expect(rebindKey(before, "up", "Escape")).toBe(before)
    expect(rebindKey(before, "up", "Tab")).toBe(before)
    expect(rebindKey(before, "up", "F5")).toBe(before)
  })
})

describe("sanitizeKeyBindings", () => {
  it("sin datos válidos devuelve las teclas por defecto", () => {
    expect(sanitizeKeyBindings(undefined)).toEqual(createDefaultKeyBindings())
    expect(sanitizeKeyBindings("WASD")).toEqual(createDefaultKeyBindings())
    expect(sanitizeKeyBindings([1])).toEqual(createDefaultKeyBindings())
  })

  it("conserva las teclas válidas y rellena las que faltan", () => {
    const bindings = sanitizeKeyBindings({ build: "KeyG", up: 3 })

    expect(bindings.build).toBe("KeyG")
    expect(bindings.up).toBe("Space")
  })

  it("descarta las teclas reservadas", () => {
    expect(sanitizeKeyBindings({ boost: "Escape" }).boost).toBe("ShiftLeft")
  })

  it("si dos acciones comparten tecla vuelve a las de por defecto", () => {
    const bindings = sanitizeKeyBindings({ build: "KeyW" })

    expect(bindings).toEqual(createDefaultKeyBindings())
  })
})

describe("keyLabel", () => {
  it("da nombres cortos y en español", () => {
    expect(keyLabel("KeyW")).toBe("W")
    expect(keyLabel("Digit4")).toBe("4")
    expect(keyLabel("Space")).toBe("Espacio")
    expect(keyLabel("ShiftLeft")).toBe("Shift izq.")
    expect(keyLabel("ArrowUp")).toBe("↑")
    expect(keyLabel("Numpad7")).toBe("Num 7")
    expect(keyLabel("Semicolon")).toBe("Ñ")
  })

  it("muestra el código tal cual si no lo conoce", () => {
    expect(keyLabel("Lang1")).toBe("Lang1")
  })
})
