import { describe, expect, it } from "vitest"
import { pickNeighbor, type Rect } from "@ui/focusNav"

const box = (left: number, top: number): Rect => ({
  left,
  top,
  width: 100,
  height: 40,
})

// Cuadrícula de 2×2 más un botón ancho debajo:
//   a b
//   c d
//   e
const items = {
  a: box(0, 0),
  b: box(120, 0),
  c: box(0, 60),
  d: box(120, 60),
  e: box(0, 120),
}

function neighbor(
  from: keyof typeof items,
  direction: "up" | "down" | "left" | "right",
) {
  const candidates = Object.entries(items)
    .filter(([name]) => name !== from)
    .map(([item, rect]) => ({ item, rect }))
  return pickNeighbor(items[from], candidates, direction)
}

describe("pickNeighbor", () => {
  it("elige el vecino alineado en la dirección pedida", () => {
    expect(neighbor("a", "right")).toBe("b")
    expect(neighbor("a", "down")).toBe("c")
    expect(neighbor("d", "left")).toBe("c")
    expect(neighbor("d", "up")).toBe("b")
  })

  it("prefiere el alineado aunque haya otro algo más cerca en diagonal", () => {
    expect(neighbor("b", "down")).toBe("d")
  })

  it("devuelve undefined si no hay nada en esa dirección", () => {
    expect(neighbor("a", "up")).toBeUndefined()
    expect(neighbor("b", "right")).toBeUndefined()
  })
})
