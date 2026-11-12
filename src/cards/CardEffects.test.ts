import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState, type Card, type CardContext } from "@cards/Card"
import {
  applyCard,
  applyCardEffects,
  cardValueParts,
  cardValueText,
  describeCardEffects,
} from "@cards/CardEffects"
import { CARD_POOL } from "@cards/CardPool"
import { UPGRADES } from "@/tycoon/Upgrades"
import { Rng } from "@core/rng"
import type { GameState } from "@core/types"

function makeContext(): CardContext {
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

describe("describeCardEffects", () => {
  it("genera el texto de cada efecto en el orden declarado", () => {
    const parts = describeCardEffects({
      speed: 1.1,
      resistance: 0.05,
      radius: 0.5,
      filters: 1,
      eco: 1.08,
      dash: 0.2,
      ecoPerSecond: 1.5,
      revives: 1,
      glow: 0.5,
    })

    expect(parts.map((part) => part.text)).toEqual([
      "+10% VELOCIDAD",
      "+5% RESISTENCIA",
      "+0.5 RADIO",
      "+1 FILTRO",
      "+8% ECO",
      "+0.2 DASH",
      "+1.5 ECO POR FILTRO",
      "+1 REVIVIR",
      "+50% BRILLO",
    ])
    expect(parts.every((part) => part.tone === "positive")).toBe(true)
  })

  it("usa el plural cuando toca", () => {
    expect(describeCardEffects({ filters: 2, enemies: 1 })).toEqual([
      { text: "+2 FILTROS", tone: "positive" },
      { text: "+1 MEDUSA", tone: "negative" },
    ])
  })

  it("marca como negativo lo que perjudica al jugador", () => {
    expect(
      describeCardEffects({
        speed: 0.8,
        resistance: -0.5,
        enemies: 2,
        passiveToxicity: 1.5,
        toxicity: 20,
      }),
    ).toEqual([
      { text: "-20% VELOCIDAD", tone: "negative" },
      { text: "-50% RESISTENCIA", tone: "negative" },
      { text: "+2 MEDUSAS", tone: "negative" },
      { text: "+50% TOXICIDAD PASIVA", tone: "negative" },
      { text: "+20 TOXICIDAD", tone: "negative" },
    ])
  })

  it("bajar la toxicidad es positivo y un efecto nulo es neutro", () => {
    expect(describeCardEffects({ toxicity: -10, speed: 1 })).toEqual([
      { text: "-10 TOXICIDAD", tone: "positive" },
      { text: "0% VELOCIDAD", tone: "neutral" },
    ])
  })
})

describe("applyCardEffects", () => {
  it("aplica cada efecto declarado", () => {
    const ctx = makeContext()
    const { speed, collectionRadius, filterCapacity, toxicityResistance } = {
      ...ctx.turtle.stats,
    }
    const dash = ctx.turtle.getSpinBoostMultiplier()

    applyCardEffects(
      {
        speed: 1.1,
        resistance: 0.05,
        radius: 0.5,
        filters: 2,
        eco: 1.5,
        dash: 0.4,
        ecoPerSecond: 2,
        revives: 1,
        glow: 0.5,
        enemies: 2,
        passiveToxicity: 1.5,
        toxicity: 20,
      },
      ctx,
    )

    expect(ctx.turtle.stats.speed).toBeCloseTo(speed * 1.1)
    expect(ctx.turtle.stats.toxicityResistance).toBeCloseTo(
      1 - (1 - toxicityResistance) * 0.95,
    )
    expect(ctx.turtle.stats.collectionRadius).toBeCloseTo(
      collectionRadius + 0.5,
    )
    expect(ctx.turtle.stats.filterCapacity).toBe(filterCapacity + 2)
    expect(ctx.run.ecoMultiplier).toBeCloseTo(1.5)
    expect(ctx.turtle.getSpinBoostMultiplier()).toBeCloseTo(dash + 0.4)
    expect(ctx.run.filterEcoPerSecond).toBe(2)
    expect(ctx.run.reviveCharges).toBe(1)
    expect(ctx.turtle.getGlowTarget()).toBe(0.5)
    expect(ctx.run.enemyCountBonus).toBe(2)
    expect(ctx.run.toxicityMultiplier).toBe(1.5)
    expect(ctx.state.toxicity).toBe(20)
  })

  it("la resistencia negativa resta sin bajar de 0", () => {
    const ctx = makeContext()

    applyCardEffects({ resistance: -0.5 }, ctx)

    expect(ctx.turtle.stats.toxicityResistance).toBe(0)
  })

  it("la toxicidad instantánea se queda entre 0 y 100", () => {
    const ctx = makeContext()
    ctx.state.toxicity = 95

    applyCardEffects({ toxicity: 20 }, ctx)
    expect(ctx.state.toxicity).toBe(100)

    applyCardEffects({ toxicity: -500 }, ctx)
    expect(ctx.state.toxicity).toBe(0)
  })
})

describe("mazo: texto y efectos coherentes", () => {
  it("toda carta declara sus efectos o trae un efecto con azar", () => {
    for (const card of CARD_POOL) {
      expect(card.effects ?? card.random, card.id).toBeDefined()
      expect(cardValueParts(card).length, card.id).toBeGreaterThan(0)
    }
  })

  it("solo las cartas de caos dependen del azar", () => {
    for (const card of CARD_POOL) {
      if (card.random) expect(card.rarity, card.id).toBe("chaos")
    }
  })

  it("Bioluminiscencia muestra todo lo que hace, brillo incluido", () => {
    const card = getCard("bioluminescence")
    const ctx = makeContext()
    const speed = ctx.turtle.stats.speed

    expect(cardValueText(card)).toBe("+30% ECO / +5% VELOCIDAD / +50% BRILLO")

    expect(applyCard(card, ctx)).toBeUndefined()
    expect(ctx.run.ecoMultiplier).toBeCloseTo(1.3)
    expect(ctx.turtle.stats.speed).toBeCloseTo(speed * 1.05)
    expect(ctx.turtle.getGlowTarget()).toBe(0.5)
  })

  it("las maldiciones tienen un tramo positivo y otro negativo", () => {
    const curses = CARD_POOL.filter((card) => card.rarity === "curse")
    expect(curses.length).toBeGreaterThan(0)

    for (const card of curses) {
      const tones = cardValueParts(card).map((part) => part.tone)
      expect(tones, card.id).toContain("positive")
      expect(tones, card.id).toContain("negative")
    }

    expect(cardValueParts(getCard("greed"))).toEqual([
      { text: "+50% ECO", tone: "positive" },
      { text: "-20% VELOCIDAD", tone: "negative" },
    ])
  })

  it("las cartas con azar usan su propio texto y separador", () => {
    expect(cardValueText(getCard("double_or_nothing"))).toBe("ECO ×2 O ×0.5")
    expect(cardValueText(getCard("mutation"))).toBe("↑ AL AZAR / ↓ AL AZAR")
  })

  it("ninguna carta comparte nombre con otra ni con una mejora permanente", () => {
    const names = [
      ...CARD_POOL.map((card) => card.name),
      ...UPGRADES.map((upgrade) => upgrade.name),
    ]

    expect(new Set(names).size).toBe(names.length)
  })
})
