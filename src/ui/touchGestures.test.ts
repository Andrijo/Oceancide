import { describe, expect, it } from "vitest"
import {
  EDGE_BOOST_OFF,
  EDGE_BOOST_ON,
  edgeBoostActive,
} from "@ui/touchGestures"

describe("edgeBoostActive", () => {
  it("dentro del joystick no impulsa", () => {
    expect(edgeBoostActive(0.5, false)).toBe(false)
    expect(edgeBoostActive(1, false)).toBe(false)
  })

  it("impulsa al pasar del borde", () => {
    expect(edgeBoostActive(EDGE_BOOST_ON, false)).toBe(true)
    expect(edgeBoostActive(2, false)).toBe(true)
  })

  it("con histéresis: no se suelta justo bajo el umbral de entrada", () => {
    const between = (EDGE_BOOST_ON + EDGE_BOOST_OFF) / 2
    expect(edgeBoostActive(between, false)).toBe(false)
    expect(edgeBoostActive(between, true)).toBe(true)
    expect(edgeBoostActive(EDGE_BOOST_OFF - 0.01, true)).toBe(false)
  })
})
