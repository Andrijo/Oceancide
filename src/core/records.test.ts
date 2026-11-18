import { describe, expect, it } from "vitest"
import type { RunSummary } from "@core/types"
import {
  applyRunToRecords,
  computeNewRecords,
  createDefaultRecords,
  type RunRecords,
} from "./records"

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    outcome: "died",
    biomeIndex: 0,
    biomeName: "Epipelágico Superior",
    zoneProgress: 0,
    debrisCollected: 0,
    ecoBase: 0,
    ecoBonus: 0,
    ecoLost: 0,
    durationSeconds: 0,
    seed: 1,
    cardsPicked: [],
    endless: false,
    loopsCompleted: 0,
    ...overrides,
  }
}

function records(overrides: Partial<RunRecords> = {}): RunRecords {
  return { ...createDefaultRecords(), ...overrides }
}

describe("computeNewRecords", () => {
  it("la primera run no bate récords", () => {
    const summary = makeSummary({
      biomeIndex: 2,
      debrisCollected: 30,
      ecoBase: 100,
      outcome: "completed",
      durationSeconds: 400,
    })
    expect(
      computeNewRecords(
        { bestBiomeIndex: -1, records: createDefaultRecords() },
        summary,
      ),
    ).toEqual([])
  })

  it("detecta zona, desechos y Eco batidos", () => {
    const before = {
      bestBiomeIndex: 1,
      records: records({ bestDebris: 20, bestEco: 80 }),
    }
    const summary = makeSummary({
      biomeIndex: 3,
      debrisCollected: 21,
      ecoBase: 60,
      ecoBonus: 25,
    })
    expect(computeNewRecords(before, summary)).toEqual([
      "biome",
      "debris",
      "eco",
    ])
  })

  it("igualar un récord no lo bate", () => {
    const before = { bestBiomeIndex: 3, records: records({ bestDebris: 20 }) }
    expect(
      computeNewRecords(
        before,
        makeSummary({ biomeIndex: 3, debrisCollected: 20 }),
      ),
    ).toEqual([])
  })

  it("la run completada más rápida solo cuenta en modo normal", () => {
    const before = {
      bestBiomeIndex: 5,
      records: records({ fastestCompletion: 500 }),
    }
    const fast = makeSummary({
      outcome: "completed",
      biomeIndex: 5,
      durationSeconds: 450,
    })
    expect(computeNewRecords(before, fast)).toEqual(["fastest"])
    expect(
      computeNewRecords(before, { ...fast, outcome: "died" }),
    ).not.toContain("fastest")
  })

  it("la inmersión sin fin tiene su propio récord de biomas", () => {
    const before = {
      bestBiomeIndex: 5,
      records: records({ bestEndlessBiomes: 8 }),
    }
    expect(
      computeNewRecords(before, makeSummary({ endless: true, biomeIndex: 8 })),
    ).toEqual(["endless"])
  })
})

describe("applyRunToRecords", () => {
  it("guarda el mejor valor de cada récord", () => {
    const rec = records({ bestDebris: 50, bestEco: 10, fastestCompletion: 300 })
    applyRunToRecords(
      rec,
      makeSummary({
        outcome: "completed",
        debrisCollected: 40,
        ecoBase: 30,
        durationSeconds: 250,
      }),
    )
    expect(rec).toEqual(
      records({ bestDebris: 50, bestEco: 30, fastestCompletion: 250 }),
    )
  })

  it("una run no completada no fija tiempo", () => {
    const rec = createDefaultRecords()
    applyRunToRecords(rec, makeSummary({ durationSeconds: 100 }))
    expect(rec.fastestCompletion).toBe(0)
  })
})
