import { describe, expect, it } from "vitest"
import {
  applyToxicityDelta,
  computeBiomeToxicityFloor,
  computeDebrisCleanup,
  computeEntryToxicity,
  computeFilterCleanup,
  computePassiveToxicityRate,
} from "@/core/systems/toxicity"

describe("computeBiomeToxicityFloor", () => {
  it("escala con la tasa de toxicidad del bioma", () => {
    expect(computeBiomeToxicityFloor(0)).toBe(0)
    expect(computeBiomeToxicityFloor(0.5)).toBe(15)
    expect(computeBiomeToxicityFloor(1)).toBe(30)
  })
})

describe("computeEntryToxicity", () => {
  it("arrastra la mitad de la toxicidad anterior", () => {
    expect(computeEntryToxicity(100, 0)).toBe(50)
    expect(computeEntryToxicity(80, 20)).toBe(40)
  })

  it("nunca baja del suelo del bioma", () => {
    expect(computeEntryToxicity(10, 30)).toBe(30)
    expect(computeEntryToxicity(100, 60)).toBe(60)
  })

  it("mantiene la toxicidad a cero si no hay arrastre ni suelo", () => {
    expect(computeEntryToxicity(0, 0)).toBe(0)
  })
})

describe("computePassiveToxicityRate", () => {
  it("aplica tasa, escala y contaminación", () => {
    expect(
      computePassiveToxicityRate({
        toxicityRate: 1,
        pollution: 1,
        toxicityResistance: 0,
      }),
    ).toBe(3)
  })

  it("aplica resistencia, multiplicador de mejora y presión de tiempo", () => {
    expect(
      computePassiveToxicityRate({
        toxicityRate: 0.5,
        pollution: 0.4,
        toxicityResistance: 0.2,
        toxicityScaleMult: 1.5,
        timePressure: 2,
      }),
    ).toBeCloseTo(1.44)
  })

  it("clampa la resistencia a 0..1", () => {
    const base = {
      toxicityRate: 1,
      pollution: 1,
      toxicityResistance: 0,
    }

    expect(computePassiveToxicityRate({ ...base, toxicityResistance: 2 })).toBe(
      0,
    )
    expect(
      computePassiveToxicityRate({ ...base, toxicityResistance: -1 }),
    ).toBe(computePassiveToxicityRate(base))
  })

  it("no sube toxicidad si no queda contaminación", () => {
    expect(
      computePassiveToxicityRate({
        toxicityRate: 1,
        pollution: 0,
        toxicityResistance: 0,
      }),
    ).toBe(0)
  })
})

describe("applyToxicityDelta", () => {
  it("suma deltas positivos sin tope superior", () => {
    expect(applyToxicityDelta(10, 5)).toBe(15)
    expect(applyToxicityDelta(90, 20)).toBe(110)
  })

  it("no baja de cero", () => {
    expect(applyToxicityDelta(10, -20)).toBe(0)
  })
})

describe("computeDebrisCleanup", () => {
  it("limpia más cuanto más contaminante es el desecho", () => {
    expect(computeDebrisCleanup(0)).toBe(0.4)
    expect(computeDebrisCleanup(0.2)).toBeCloseTo(0.6)
    expect(computeDebrisCleanup(1)).toBe(1.4)
  })
})

describe("computeFilterCleanup", () => {
  it("escala por cada desecho absorbido", () => {
    expect(computeFilterCleanup(0)).toBe(0)
    expect(computeFilterCleanup(1)).toBe(0.9)
    expect(computeFilterCleanup(3)).toBeCloseTo(2.7)
  })
})
