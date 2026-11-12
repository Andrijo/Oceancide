import { describe, expect, it } from "vitest"
import { createDefaultMeta, type MetaState } from "@core/MetaState"
import type { RunSummary } from "@core/types"
import { buildNextGoals } from "@ui/nextGoals"

type Summary = Pick<RunSummary, "outcome" | "biomeName" | "zoneProgress">

const died: Summary = {
  outcome: "died",
  biomeName: "Subfótico",
  zoneProgress: 65,
}

function makeMeta(overrides: Partial<MetaState> = {}): MetaState {
  return { ...createDefaultMeta(), bestBiomeIndex: 1, ...overrides }
}

function goal(view: ReturnType<typeof buildNextGoals>, kind: string) {
  return view.goals.find((g) => g.kind === kind)
}

describe("buildNextGoals: zona", () => {
  it("dice cuánto faltaba de la zona en la que se murió", () => {
    const zone = goal(buildNextGoals(died, makeMeta()), "zone")
    expect(zone?.text).toBe("Te quedó un 35 % del Subfótico por limpiar")
    expect(zone?.progress).toBeCloseTo(0.65)
  })

  it("nunca dice 0 % si la zona no estaba limpia", () => {
    const zone = goal(
      buildNextGoals({ ...died, zoneProgress: 99.8 }, makeMeta()),
      "zone",
    )
    expect(zone?.text).toContain("un 1 %")
  })

  it("también sale al abandonar, pero no al completar la run", () => {
    const meta = makeMeta()
    expect(
      goal(buildNextGoals({ ...died, outcome: "abandoned" }, meta), "zone"),
    ).toBeDefined()
    expect(
      goal(buildNextGoals({ ...died, outcome: "completed" }, meta), "zone"),
    ).toBeUndefined()
  })
})

describe("buildNextGoals: mejoras", () => {
  it("dice cuánto Eco falta para la mejora más barata", () => {
    const view = buildNextGoals(died, makeMeta({ ecoPoints: 470 }))
    const upgrade = goal(view, "upgrade")
    expect(upgrade?.text).toBe("Te faltan 30 Eco para Aletas Mejoradas")
    expect(upgrade?.progress).toBeCloseTo(0.94)
    expect(view.affordableCount).toBe(0)
  })

  it("nombra la mejora más barata que ya se puede comprar y cuenta el resto", () => {
    const view = buildNextGoals(died, makeMeta({ ecoPoints: 900 }))
    expect(goal(view, "upgrade")?.text).toBe(
      "Ya puedes comprar Aletas Mejoradas (500 Eco) y 2 más",
    )
    expect(view.affordableCount).toBe(3)
  })

  it("tiene en cuenta los niveles ya comprados", () => {
    const view = buildNextGoals(
      died,
      makeMeta({ ecoPoints: 600, upgrades: { speed: 1 } }),
    )
    expect(goal(view, "upgrade")?.text).toBe(
      "Ya puedes comprar Caparazón Curtido (600 Eco)",
    )
    expect(view.affordableCount).toBe(1)
  })

  it("no propone mejoras si están todas al máximo", () => {
    const upgrades = {
      speed: 5,
      resistance: 5,
      magnet: 3,
      filters: 3,
      eco: 5,
      immune: 3,
    }
    const view = buildNextGoals(died, makeMeta({ ecoPoints: 99_999, upgrades }))
    expect(goal(view, "upgrade")).toBeUndefined()
    expect(view.affordableCount).toBe(0)
  })
})

describe("buildNextGoals: biomas", () => {
  it("nombra el siguiente bioma sin descubrir", () => {
    const biome = goal(buildNextGoals(died, makeMeta()), "biome")
    expect(biome?.text).toBe(
      "Siguiente bioma por descubrir: Mesopelágico Profundo · 1000 m",
    )
  })

  it("no sale si ya se han descubierto todos", () => {
    const view = buildNextGoals(died, makeMeta({ bestBiomeIndex: 5 }))
    expect(goal(view, "biome")).toBeUndefined()
  })

  it("siempre hay al menos un objetivo al morir", () => {
    const view = buildNextGoals(died, makeMeta({ bestBiomeIndex: 5 }))
    expect(view.goals.length).toBeGreaterThan(0)
  })
})
