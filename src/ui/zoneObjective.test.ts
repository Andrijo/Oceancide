import { describe, expect, it } from "vitest"
import {
  clampObjective,
  zoneObjectiveRatio,
  zoneObjectiveText,
} from "./zoneObjective"

describe("objetivo de zona en el HUD", () => {
  it("nombra lo que hay que hacer, no un porcentaje", () => {
    expect(zoneObjectiveText({ kind: "debris", done: 12, total: 30 })).toBe(
      "Desechos 12/30",
    )
    expect(zoneObjectiveText({ kind: "leaks", done: 1, total: 3 })).toBe(
      "Fugas cerradas 1/3",
    )
  })

  it("redondea hacia arriba lo que pide el objetivo", () => {
    // 31 desechos × 60% = 18.6: hacen falta 19 para completar la zona.
    expect(clampObjective({ kind: "debris", done: 5, total: 18.6 }).total).toBe(
      19,
    )
  })

  it("no pasa del total ni baja de cero", () => {
    expect(zoneObjectiveText({ kind: "debris", done: 40, total: 30 })).toBe(
      "Desechos 30/30",
    )
    expect(zoneObjectiveText({ kind: "leaks", done: -2, total: 0 })).toBe(
      "Fugas cerradas 0/1",
    )
    expect(zoneObjectiveRatio({ kind: "debris", done: 15, total: 30 })).toBe(
      0.5,
    )
  })
})
