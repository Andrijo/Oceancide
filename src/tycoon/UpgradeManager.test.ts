import { describe, expect, it } from "vitest"
import { createDefaultMeta, type MetaState } from "@core/MetaState"
import type { TurtleStats } from "@core/types"
import { UpgradeManager } from "@/tycoon/UpgradeManager"

function makeMeta(overrides: Partial<MetaState> = {}): MetaState {
  return { ...createDefaultMeta(), ecoPoints: 10_000, ...overrides }
}

function makeStats(overrides: Partial<TurtleStats> = {}): TurtleStats {
  return {
    speed: 10,
    collectionRadius: 2,
    toxicityResistance: 0.1,
    filterCapacity: 1,
    ...overrides,
  }
}

describe("UpgradeManager.canBuy", () => {
  it("no permite comprar mejoras inexistentes", () => {
    expect(new UpgradeManager().canBuy(makeMeta(), "nope")).toBe(false)
  })

  it("no permite comprar sin eco suficiente", () => {
    const meta = makeMeta({ ecoPoints: 0 })

    expect(new UpgradeManager().canBuy(meta, "speed")).toBe(false)
  })

  it("no permite comprar una mejora al máximo", () => {
    const meta = makeMeta({ upgrades: { speed: 5 } })

    expect(new UpgradeManager().canBuy(meta, "speed")).toBe(false)
  })

  it("permite comprar si hay eco y queda margen", () => {
    expect(new UpgradeManager().canBuy(makeMeta(), "speed")).toBe(true)
  })
})

describe("UpgradeManager.buy", () => {
  it("descuenta el coste y sube el nivel", () => {
    const meta = makeMeta()
    const manager = new UpgradeManager()

    expect(manager.buy(meta, "speed")).toBe(true)
    expect(meta.ecoPoints).toBe(9_500)
    expect(meta.upgrades.speed).toBe(1)
  })

  it("no modifica nada si la compra no es válida", () => {
    const meta = makeMeta({ ecoPoints: 0 })
    const manager = new UpgradeManager()

    expect(manager.buy(meta, "speed")).toBe(false)
    expect(meta.ecoPoints).toBe(0)
    expect(meta.upgrades.speed).toBeUndefined()
  })
})

describe("UpgradeManager.applyAll", () => {
  it("no toca las stats sin mejoras", () => {
    const stats = makeStats()

    const bonuses = new UpgradeManager().applyAll(makeMeta(), stats)

    expect(stats).toEqual(makeStats())
    expect(bonuses).toEqual({ ecoMult: 1, toxScaleMult: 1 })
  })

  it("aplica todas las mejoras compradas y devuelve sus multiplicadores", () => {
    const meta = makeMeta({
      upgrades: {
        speed: 2,
        resistance: 3,
        magnet: 1,
        filters: 1,
        eco: 5,
        immune: 2,
      },
    })
    const stats = makeStats()

    const bonuses = new UpgradeManager().applyAll(meta, stats)

    expect(stats.speed).toBeCloseTo(11)
    expect(stats.toxicityResistance).toBeCloseTo(0.19)
    expect(stats.collectionRadius).toBeCloseTo(2.3)
    expect(stats.filterCapacity).toBe(2)
    expect(bonuses.ecoMult).toBeCloseTo(1.5)
    expect(bonuses.toxScaleMult).toBeCloseTo(0.9)
  })

  it("la resistencia nunca supera el 90%", () => {
    const meta = makeMeta({ upgrades: { resistance: 5 } })
    const stats = makeStats({ toxicityResistance: 0.8 })

    new UpgradeManager().applyAll(meta, stats)

    expect(stats.toxicityResistance).toBe(0.9)
  })
})
