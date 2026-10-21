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

  return { turtle: new Turtle(), state, run: createRunState(), rng: new Rng(1) }
}

function getCard(id: string): Card {
  const card = CARD_POOL.find((candidate) => candidate.id === id)
  if (!card) throw new Error(`Carta no encontrada: ${id}`)
  return card
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

  it("devuelve el resultado de las cartas aleatorias", () => {
    const ctx = makeContext()

    const outcome = new CardManager().pick(getCard("double_or_nothing"), ctx)

    expect(typeof outcome).toBe("string")
    expect([0.5, 2]).toContain(ctx.run.ecoMultiplier)
  })

  it("Mutación cambia dos stats distintos y explica el resultado", () => {
    const ctx = makeContext()
    const before = {
      speed: ctx.turtle.stats.speed,
      radius: ctx.turtle.stats.collectionRadius,
      filters: ctx.turtle.stats.filterCapacity,
      resistance: ctx.turtle.stats.toxicityResistance,
      eco: ctx.run.ecoMultiplier,
    }

    const outcome = new CardManager().pick(getCard("mutation"), ctx)

    const changed = [
      ctx.turtle.stats.speed !== before.speed,
      ctx.turtle.stats.collectionRadius !== before.radius,
      ctx.turtle.stats.filterCapacity !== before.filters,
      ctx.turtle.stats.toxicityResistance !== before.resistance,
      ctx.run.ecoMultiplier !== before.eco,
    ].filter(Boolean)

    expect(typeof outcome).toBe("string")
    expect(changed.length).toBeGreaterThanOrEqual(2)
  })

  it("Pacto de la Medusa añade un revivir y medusas extra", () => {
    const ctx = makeContext()

    new CardManager().pick(getCard("medusa_pact"), ctx)

    expect(ctx.run.reviveCharges).toBe(1)
    expect(ctx.run.enemyCountBonus).toBe(2)
  })

  it("Eco Inestable duplica el eco y sube la toxicidad pasiva", () => {
    const ctx = makeContext()

    new CardManager().pick(getCard("unstable_eco"), ctx)

    expect(ctx.run.ecoMultiplier).toBe(2)
    expect(ctx.run.toxicityMultiplier).toBe(1.5)
  })

  it("Marea Negra sube la toxicidad al instante", () => {
    const ctx = makeContext()
    ctx.state.toxicity = 50

    new CardManager().pick(getCard("black_tide"), ctx)

    expect(ctx.state.toxicity).toBe(70)
    expect(ctx.turtle.stats.speed).toBeCloseTo(11.25)
    expect(ctx.turtle.stats.filterCapacity).toBe(6)
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
