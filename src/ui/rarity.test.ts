import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { CardRarity } from "@cards/Card"
import { RARITY_ICON_PATHS, RARITY_LABELS, rarityClass } from "@ui/rarity"

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8")
const rarities = Object.keys(RARITY_LABELS) as CardRarity[]

describe("rarezas", () => {
  it("cada rareza tiene un icono con forma propia", () => {
    const paths = rarities.map((r) => RARITY_ICON_PATHS[r])
    expect(paths.every((d) => d.length > 0)).toBe(true)
    expect(new Set(paths).size).toBe(rarities.length)
  })

  it("cada rareza tiene su clase con color y fondo en styles.css", () => {
    for (const rarity of rarities) {
      const pattern = new RegExp(
        `\\.${rarityClass(rarity)}\\s*\\{[^}]*--rarity:[^}]*--rarity-bg:`,
      )
      expect(css, rarity).toMatch(pattern)
    }
  })
})
