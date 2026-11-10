import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState } from "@cards/Card"
import { applyEventEffects, previewEventEffects } from "@/events/EventEffects"
import { RELICS, pickRelic, pickRelicCarrier } from "@/relics/RelicPool"
import { Rng } from "@core/rng"
import type { GameState } from "@core/types"

function makeContext() {
  const state: GameState = {
    debrisCollected: 0,
    ecoAwareness: 500,
    toxicity: 50,
    zoneProgress: 0,
    isRunning: true,
  }

  return { turtle: new Turtle(), state, run: createRunState(), rng: new Rng(1) }
}

describe("RELICS", () => {
  it("tienen ids y nombres únicos, y texto", () => {
    expect(new Set(RELICS.map((relic) => relic.id)).size).toBe(RELICS.length)
    expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length)

    for (const relic of RELICS) {
      expect(relic.name.length, relic.id).toBeGreaterThan(0)
      expect(relic.description.length, relic.id).toBeGreaterThan(0)
    }
  })

  it("toda reliquia es una recompensa: hace algo y nada perjudica", () => {
    for (const relic of RELICS) {
      const ctx = makeContext()
      const preview = previewEventEffects(relic.effects, ctx)

      expect(preview.lines.length, relic.id).toBeGreaterThan(0)
      expect(preview.warning, relic.id).toBeUndefined()
      for (const line of preview.lines) {
        expect(line.tone, `${relic.id}: ${line.label}`).toBe("positive")
      }

      expect(applyEventEffects(relic.effects, ctx).summary, relic.id).not.toBe(
        "Sin efecto",
      )
    }
  })
})

describe("pickRelic", () => {
  it("es determinista con la misma semilla", () => {
    expect(pickRelic(new Rng(7)).id).toBe(pickRelic(new Rng(7)).id)
  })

  it("no repite las reliquias ya encontradas", () => {
    const found = RELICS.slice(0, RELICS.length - 1).map((relic) => relic.id)
    const last = RELICS[RELICS.length - 1]

    for (let seed = 1; seed <= 20; seed++) {
      expect(pickRelic(new Rng(seed), found).id).toBe(last.id)
    }
  })

  it("vuelve a sortear entre todas cuando ya se han encontrado todas", () => {
    const found = RELICS.map((relic) => relic.id)
    const ids = new Set(found)

    expect(ids.has(pickRelic(new Rng(3), found).id)).toBe(true)
  })
})

describe("pickRelicCarrier", () => {
  const free = { isFragment: false, removed: false, claimed: false }

  it("devuelve null si no hay desechos válidos", () => {
    expect(pickRelicCarrier([], new Rng(1))).toBeNull()
    expect(
      pickRelicCarrier(
        [
          { ...free, isFragment: true },
          { ...free, removed: true },
          { ...free, claimed: true },
        ],
        new Rng(1),
      ),
    ).toBeNull()
  })

  it("solo elige desechos libres que cuentan para la zona", () => {
    const valid = { ...free }
    const candidates = [
      { ...free, isFragment: true },
      valid,
      { ...free, claimed: true },
    ]

    for (let seed = 1; seed <= 20; seed++) {
      expect(pickRelicCarrier(candidates, new Rng(seed))).toBe(valid)
    }
  })
})
