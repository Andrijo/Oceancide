import { describe, expect, it } from "vitest"
import {
  closeSegment,
  openSegment,
  visibleSegments,
  type BiomeSegment,
} from "./runTimeline"

describe("runTimeline", () => {
  it("cierra un tramo con las diferencias de los contadores", () => {
    const open = openSegment(1, "Subfótico", { time: 30, debris: 10, eco: 50 })
    expect(closeSegment(open, { time: 75.5, debris: 32, eco: 120.4 })).toEqual({
      biomeIndex: 1,
      biomeName: "Subfótico",
      seconds: 45.5,
      debris: 22,
      eco: 70,
    })
  })

  it("no copia por referencia los contadores de inicio", () => {
    const start = { time: 0, debris: 0, eco: 0 }
    const open = openSegment(0, "A", start)
    start.debris = 99
    expect(closeSegment(open, { time: 1, debris: 5, eco: 0 }).debris).toBe(5)
  })

  it("nunca da valores negativos", () => {
    const open = openSegment(0, "A", { time: 10, debris: 5, eco: 5 })
    const seg = closeSegment(open, { time: 5, debris: 0, eco: 0 })
    expect(seg.seconds).toBe(0)
    expect(seg.debris).toBe(0)
    expect(seg.eco).toBe(0)
  })

  it("muestra solo los últimos tramos y cuenta los omitidos", () => {
    const segs: BiomeSegment[] = Array.from({ length: 10 }, (_, i) => ({
      biomeIndex: i,
      biomeName: `B${i}`,
      seconds: 1,
      debris: 1,
      eco: 1,
    }))
    const { hidden, shown } = visibleSegments(segs, 4)
    expect(hidden).toBe(6)
    expect(shown.map((s) => s.biomeIndex)).toEqual([6, 7, 8, 9])
    expect(visibleSegments(segs.slice(0, 3), 4).hidden).toBe(0)
  })
})
