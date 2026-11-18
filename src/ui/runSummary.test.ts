import { describe, expect, it } from "vitest"
import { CARD_POOL } from "@cards/CardPool"
import type { CardRarity } from "@cards/Card"
import { seedShareUrl, summaryCardChips } from "./runSummary"

function cardOf(rarity: CardRarity) {
  const card = CARD_POOL.find((c) => c.rarity === rarity)
  if (!card) throw new Error(`No hay cartas ${rarity}`)
  return card
}

describe("seedShareUrl", () => {
  it("añade la semilla conservando ruta y parámetros", () => {
    expect(seedShareUrl("https://x.dev/juego/?dev#top", 42)).toBe(
      "https://x.dev/juego/?dev=&seed=42",
    )
  })

  it("sustituye una semilla anterior", () => {
    expect(seedShareUrl("https://x.dev/?seed=1", 7)).toBe(
      "https://x.dev/?seed=7",
    )
  })

  it("normaliza a entero sin signo", () => {
    expect(seedShareUrl("https://x.dev/", -1)).toBe(
      "https://x.dev/?seed=4294967295",
    )
  })
})

describe("summaryCardChips", () => {
  it("agrupa repetidas y ordena por rareza", () => {
    const common = cardOf("common")
    const legendary = cardOf("legendary")
    const curse = cardOf("curse")

    const chips = summaryCardChips(
      [common.id, curse.id, legendary.id, common.id],
      CARD_POOL,
    )

    expect(chips.map((c) => [c.card.id, c.count])).toEqual([
      [legendary.id, 1],
      [common.id, 2],
      [curse.id, 1],
    ])
  })

  it("descarta ID desconocidos", () => {
    expect(summaryCardChips(["no-existe"], CARD_POOL)).toEqual([])
  })
})
