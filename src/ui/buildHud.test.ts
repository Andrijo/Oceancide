import { describe, expect, it } from "vitest"
import { buildHudView, type BuildHudInput } from "@ui/buildHud"

const base: BuildHudInput = {
  name: "Esfera filtradora",
  control: "B",
  cost: 40,
  eco: 100,
  active: 0,
  max: 5,
}

describe("buildHudView", () => {
  it("muestra coste y activas sin bloqueo cuando se puede colocar", () => {
    const view = buildHudView(base)
    expect(view).toMatchObject({
      control: "B",
      cost: "40",
      count: "0/5",
      blocker: null,
    })
    expect(view.label).toBe(
      "Esfera filtradora, tecla B. cuesta 40 de Eco. activas 0 de 5",
    )
  })

  it("señala el Eco cuando no alcanza", () => {
    const view = buildHudView({ ...base, eco: 39 })
    expect(view.blocker).toBe("eco")
    expect(view.label).toContain("te falta Eco")
  })

  it("señala el tope de esferas antes que el Eco", () => {
    const view = buildHudView({ ...base, eco: 0, active: 5 })
    expect(view.blocker).toBe("capacity")
    expect(view.label).toContain("no puedes colocar más")
  })

  it("no nombra ninguna tecla en táctil", () => {
    const view = buildHudView({ ...base, control: null })
    expect(view.control).toBeNull()
    expect(view.label).not.toContain("tecla")
  })
})
