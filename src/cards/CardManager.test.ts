import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState, type Card } from "@cards/Card"
import { CARD_POOL } from "@cards/CardPool"
import { CardManager } from "@cards/CardManager"
import { Rng } from "@core/rng"
import type { GameState } from "@core/types"

function makeContext() {
  const state: GameState = {
    debrisCollected: 0,
    ecoAwareness: 0,
    toxicity: 0,
    zoneProgress: 0,
    isRunning: true,
  }

  return { turtle: new Turtle(), state, run: createRunState() }
}

describe("CardManager.rollChoices", () => {
  it("devuelve cartas únicas del mazo", () => {
    const manager = new CardManager()
    const ids = new Set(CARD_POOL.map((card) => card.id))

    for (let seed = 1; seed <= 50; seed++) {
      const cards = manager.rollChoices(3, new Rng(seed))

      expect(cards).toHaveLength(3)
      expect(new Set(cards.map((card) => card.id)).size).toBe(3)
      for (const card of cards) expect(ids.has(card.id)).toBe(true)
    }
  })

  it("devuelve una lista vacía si se piden 0 cartas", () => {
    expect(new CardManager().rollChoices(0, new Rng(1))).toEqual([])
  })
})

describe("CardManager.pick", () => {
  it("aplica la carta y la guarda en la run", () => {
    const card: Card = {
      id: "test",
      name: "Test",
      description: "",
      rarity: "common",
      value: "",
      apply: (ctx) => {
        ctx.run.ecoMultiplier = 2
      },
    }
    const ctx = makeContext()

    new CardManager().pick(card, ctx)

    expect(ctx.run.ecoMultiplier).toBe(2)
    expect(ctx.run.cards).toEqual([card])
  })
})

describe("CardManager pity", () => {
  it("empieza a cero y resetPity() lo devuelve a cero", () => {
    const manager = new CardManager()

    expect(manager.getPityState()).toEqual({
      rare: 0,
      epic: 0,
      legendary: 0,
      ultra: 0,
    })

    manager.rollChoices(3, new Rng(1))
    manager.resetPity()

    expect(manager.getPityState()).toEqual({
      rare: 0,
      epic: 0,
      legendary: 0,
      ultra: 0,
    })
  })
})
