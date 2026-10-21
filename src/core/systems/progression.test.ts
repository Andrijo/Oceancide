import { describe, expect, it } from "vitest"
import {
  computeBiomeTimeLimit,
  computeReviveTimeRemaining,
  computeReviveToxicity,
  computeTimePressure,
  computeZoneProgress,
  computeZoneRequirement,
} from "@/core/systems/progression"

describe("computeBiomeTimeLimit", () => {
  it("baja 2 segundos por cada bioma de la vuelta", () => {
    expect(computeBiomeTimeLimit(0, 6)).toBe(120)
    expect(computeBiomeTimeLimit(1, 6)).toBe(118)
    expect(computeBiomeTimeLimit(5, 6)).toBe(110)
  })

  it("vuelve al reloj base al empezar otra vuelta", () => {
    expect(computeBiomeTimeLimit(6, 6)).toBe(120)
    expect(computeBiomeTimeLimit(100, 6)).toBe(112)
  })

  it("suma el delta pendiente de los eventos", () => {
    expect(computeBiomeTimeLimit(0, 6, -20)).toBe(100)
    expect(computeBiomeTimeLimit(0, 6, 10)).toBe(130)
  })

  it("respeta el mínimo de emergencia tras un evento", () => {
    expect(computeBiomeTimeLimit(5, 6, -100)).toBe(30)
    expect(computeBiomeTimeLimit(0, 6, -1000)).toBe(30)
  })

  it("usa el primer slot si no hay biomas por vuelta", () => {
    expect(computeBiomeTimeLimit(10, 0)).toBe(120)
    expect(computeBiomeTimeLimit(10, -1)).toBe(120)
  })
})

describe("computeTimePressure", () => {
  it("multiplica por 5 cuando se agota el tiempo", () => {
    expect(computeTimePressure(0)).toBe(5)
    expect(computeTimePressure(-1)).toBe(5)
  })

  it("no cambia mientras queda tiempo", () => {
    expect(computeTimePressure(0.01)).toBe(1)
    expect(computeTimePressure(120)).toBe(1)
  })
})

describe("computeZoneRequirement", () => {
  it("pide el 60% de los desechos iniciales", () => {
    expect(computeZoneRequirement(200)).toBe(120)
    expect(computeZoneRequirement(10)).toBe(6)
  })

  it("nunca pide menos de un desecho", () => {
    expect(computeZoneRequirement(0)).toBe(1)
    expect(computeZoneRequirement(1)).toBe(1)
  })
})

describe("computeZoneProgress", () => {
  it("calcula el porcentaje limpiado", () => {
    expect(computeZoneProgress(0, 200)).toBe(0)
    expect(computeZoneProgress(60, 200)).toBe(50)
    expect(computeZoneProgress(120, 200)).toBe(100)
  })

  it("capa el progreso a 100", () => {
    expect(computeZoneProgress(200, 200)).toBe(100)
  })

  it("no divide por cero si el bioma no tiene desechos", () => {
    expect(computeZoneProgress(0, 0)).toBe(0)
    expect(computeZoneProgress(1, 0)).toBe(100)
  })
})

describe("computeReviveToxicity", () => {
  it("sube 10 puntos por revive y se capa en 90", () => {
    expect(computeReviveToxicity(0)).toBe(50)
    expect(computeReviveToxicity(1)).toBe(60)
    expect(computeReviveToxicity(4)).toBe(90)
    expect(computeReviveToxicity(10)).toBe(90)
  })
})

describe("computeReviveTimeRemaining", () => {
  it("garantiza al menos 20 segundos", () => {
    expect(computeReviveTimeRemaining(0)).toBe(20)
    expect(computeReviveTimeRemaining(5)).toBe(20)
    expect(computeReviveTimeRemaining(20)).toBe(20)
    expect(computeReviveTimeRemaining(30)).toBe(30)
  })
})
