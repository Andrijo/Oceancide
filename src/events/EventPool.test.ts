import { describe, expect, it } from "vitest"
import { ACT_EVENTS } from "@/events/EventPool"

describe("ACT_EVENTS", () => {
  it("tiene eventos con id único", () => {
    const ids = ACT_EVENTS.map((event) => event.id)

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("cada evento tiene al menos dos opciones con id único", () => {
    for (const event of ACT_EVENTS) {
      const optionIds = event.options.map((option) => option.id)

      expect(event.title.length).toBeGreaterThan(0)
      expect(event.description.length).toBeGreaterThan(0)
      expect(event.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(optionIds).size).toBe(optionIds.length)
    }
  })

  it("cada opción describe sus efectos como datos", () => {
    for (const event of ACT_EVENTS) {
      for (const option of event.options) {
        expect(option.label.length).toBeGreaterThan(0)
        expect(option.description.length).toBeGreaterThan(0)
        expect(option.effects).toBeTypeOf("object")
        expect(option.effects).not.toBeNull()
      }
    }
  })
})
