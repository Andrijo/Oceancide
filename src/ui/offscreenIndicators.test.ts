import { describe, expect, it } from "vitest"
import {
  computeEdgeIndicator,
  indicatorSlotCount,
  pickIndicatorSlots,
  wallOpacity,
} from "./offscreenIndicators"

describe("computeEdgeIndicator", () => {
  it("devuelve null si el punto es visible", () => {
    expect(computeEdgeIndicator(0.2, -0.5, false, 1000, 600)).toBeNull()
  })

  it("coloca en el borde derecho un punto a la derecha", () => {
    const r = computeEdgeIndicator(3, 0, false, 1000, 600, 36)!
    expect(r.x).toBeCloseTo(1000 - 36)
    expect(r.y).toBeCloseTo(300)
    expect(r.angle).toBeCloseTo(0)
  })

  it("coloca en el borde superior un punto por encima", () => {
    const r = computeEdgeIndicator(0, 2, false, 1000, 600, 36)!
    expect(r.y).toBeCloseTo(36)
    expect(r.angle).toBeCloseTo(-Math.PI / 2)
  })

  it("invierte los signos si el punto está detrás de la cámara", () => {
    const r = computeEdgeIndicator(0.5, 0, true, 1000, 600, 36)!
    expect(r.x).toBeLessThan(500)
  })

  it("no falla con un punto justo detrás en el centro", () => {
    const r = computeEdgeIndicator(0, 0, true, 1000, 600, 36)!
    expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true)
  })
})

describe("pickIndicatorSlots", () => {
  const items = [
    { id: "a", distanceSq: 100, leak: false },
    { id: "b", distanceSq: 400, leak: true },
    { id: "c", distanceSq: 25, leak: false },
    { id: "d", distanceSq: 900, leak: true },
    { id: "e", distanceSq: 1600, leak: true },
  ]

  it("prioriza las fugas más cercanas", () => {
    const ids = pickIndicatorSlots(items, 3).map((i) => i.id)
    expect(ids).toEqual(["b", "d", "c"])
  })

  it("con un solo hueco muestra la fuga aunque haya un desecho más cerca", () => {
    const ids = pickIndicatorSlots(items, 1).map((i) => i.id)
    expect(ids).toEqual(["b", "d"])
  })

  it("sin candidatos devuelve vacío", () => {
    expect(pickIndicatorSlots([], 4)).toEqual([])
  })
})

describe("indicatorSlotCount", () => {
  it("muestra 1 con mucho tiempo y muchos desechos", () => {
    expect(indicatorSlotCount(30, 0.9)).toBe(1)
  })
  it("muestra 4 con pocos desechos o poco tiempo", () => {
    expect(indicatorSlotCount(5, 0.9)).toBe(4)
    expect(indicatorSlotCount(30, 0.2)).toBe(4)
  })
})

describe("wallOpacity", () => {
  it("es 0 lejos y crece al acercarse", () => {
    expect(wallOpacity(30)).toBe(0)
    expect(wallOpacity(7)).toBeGreaterThan(0)
    expect(wallOpacity(0)).toBeGreaterThan(wallOpacity(7))
  })
})
