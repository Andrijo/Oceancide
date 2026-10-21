import { describe, expect, it } from "vitest"
import type { BiomeKey } from "@core/types"
import { BIOME_DEBRIS, type OceanDebrisType } from "./debrisCatalog"

const DEEP_BIOMES: BiomeKey[] = [
  "bathypelagic_deep",
  "abyssopelagic",
  "deepSea",
]

function totalWeight(items: OceanDebrisType[]): number {
  return items.reduce((sum, item) => sum + (item.weight ?? 1), 0)
}

describe("BIOME_DEBRIS", () => {
  it("deja suficiente peso en la columna de agua en las fosas", () => {
    for (const biome of DEEP_BIOMES) {
      const items = BIOME_DEBRIS[biome]
      const bottomWeight = items
        .filter((item) => item.motion === "reposa" || item.motion === "hunde")
        .reduce((sum, item) => sum + (item.weight ?? 1), 0)

      // Si casi todo reposa o se hunde, los controles verticales dejan de ser
      // útiles: se puede limpiar la zona quedándose pegado al fondo.
      expect(bottomWeight / totalWeight(items)).toBeLessThanOrEqual(0.55)
    }
  })
})
