import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState, type Card, type CardContext } from "@cards/Card"
import { CARD_POOL } from "@cards/CardPool"
import { CardManager } from "@cards/CardManager"
import {
  cardTags,
  cardValueText,
  combineCardEffects,
  effectiveCardEffects,
  scaleCardEffects,
} from "@cards/CardEffects"
import {
  applyCardRules,
  createDefaultRules,
  dashChainBoost,
  DASH_CHAIN_MAX,
  rerollCost,
  sphereCapacity,
  sphereCost,
} from "@cards/CardRules"
import { previewCard, readBuild } from "@cards/BuildStats"
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

describe("mazo (#60)", () => {
  it("tiene al menos 10 cartas que cambian mecánicas", () => {
    const mechanic = CARD_POOL.filter((card) => card.rules || card.scaling)
    expect(mechanic.length).toBeGreaterThanOrEqual(10)
  })

  it("no hay dos cartas con exactamente el mismo efecto", () => {
    const signature = (card: Card) =>
      JSON.stringify({
        effects: card.effects ?? null,
        rules: card.rules ?? null,
        scaling: card.scaling ?? null,
        // Las de azar se distinguen por su texto.
        random: card.random ? cardValueText(card) : null,
      })
    const seen = new Map<string, string>()
    for (const card of CARD_POOL) {
      const key = signature(card)
      expect(seen.get(key), `${card.id} repite a ${seen.get(key)}`).toBe(
        undefined,
      )
      seen.set(key, card.id)
    }
  })

  it("los ID son únicos", () => {
    const ids = CARD_POOL.map((card) => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("toda sinergia escala con una etiqueta que tienen otras cartas", () => {
    for (const card of CARD_POOL) {
      if (!card.scaling) continue
      const tag = card.scaling.tag
      const others = CARD_POOL.filter(
        (other) => other !== card && cardTags(other).includes(tag),
      )
      expect(others.length, card.id).toBeGreaterThan(2)
    }
  })
})

describe("cardTags", () => {
  it("deduce las etiquetas de los efectos", () => {
    expect(cardTags(getCard("weak_turbo"))).toEqual(["dash"])
    expect(cardTags(getCard("symbiosis"))).toEqual(["filtro"])
    expect(cardTags(getCard("greed"))).toEqual(["eco", "riesgo"])
  })

  it("las declaradas mandan", () => {
    expect(cardTags(getCard("leak_hunter"))).toEqual(["cuidado", "eco"])
  })
})

describe("combinar y escalar efectos", () => {
  it("multiplica los multiplicadores y suma el resto", () => {
    expect(
      combineCardEffects({ eco: 1.5, dash: 0.2 }, { eco: 2, dash: 0.3 }),
    ).toEqual({ eco: 3, dash: 0.5 })
  })

  it("escalar equivale a aplicar varias veces", () => {
    expect(scaleCardEffects({ eco: 1.1, radius: 0.5 }, 3)).toEqual({
      eco: 1.1 ** 3,
      radius: 1.5,
    })
    expect(scaleCardEffects({ eco: 1.1 }, 0)).toEqual({})
  })
})

describe("sinergias", () => {
  it("la carta de sinergia cuenta las de su etiqueta, ella incluida", () => {
    const owned = [getCard("weak_turbo"), getCard("dash_boost")]
    const effects = effectiveCardEffects(getCard("fish_school"), owned)
    expect(effects.dash).toBeCloseTo(0.15 * 3)
  })

  it("las cartas nuevas de la etiqueta reciben la sinergia", () => {
    const owned = [getCard("fish_school")]
    const effects = effectiveCardEffects(getCard("weak_turbo"), owned)
    expect(effects.dash).toBeCloseTo(0.2 + 0.15)
  })

  it("una carta de otra etiqueta no recibe la sinergia", () => {
    const owned = [getCard("fish_school")]
    expect(effectiveCardEffects(getCard("shell_dense"), owned)).toEqual({
      resistance: 0.05,
    })
  })

  it("elegirlas aplica la sinergia de verdad", () => {
    const ctx = makeContext()
    const manager = new CardManager()
    const base = ctx.turtle.getSpinBoostMultiplier()

    manager.pick(getCard("weak_turbo"), ctx) // +0.2
    manager.pick(getCard("fish_school"), ctx) // +0.15 × 2
    manager.pick(getCard("dash_boost"), ctx) // +0.4 +0.15

    expect(ctx.turtle.getSpinBoostMultiplier()).toBeCloseTo(
      base + 0.2 + 0.3 + 0.55,
    )
  })

  it("la vista previa enseña la sinergia", () => {
    const ctx = makeContext()
    const owned = [getCard("fish_school")]
    const [line] = previewCard(getCard("weak_turbo"), readBuild(ctx), owned)
    const base = ctx.turtle.getSpinBoostMultiplier()
    expect(line.after).toBe(`×${(base + 0.35).toFixed(1)}`)
  })
})

describe("reglas", () => {
  it("las cartas activan sus reglas en la run", () => {
    const ctx = makeContext()
    const manager = new CardManager()

    manager.pick(getCard("whirlpool"), ctx)
    manager.pick(getCard("soft_touch"), ctx)
    manager.pick(getCard("endless_tide"), ctx)

    expect(ctx.run.rules).toMatchObject({
      spinCollectRadius: 2,
      fragileSafe: true,
      noTimeLimit: true,
    })
    expect(ctx.run.toxicityMultiplier).toBe(1.5)
  })

  it("elegir una carta de reglas explica qué cambia", () => {
    const outcome = new CardManager().pick(
      getCard("twin_spheres"),
      makeContext(),
    )
    expect(outcome).toBe("ESFERAS ATRAEN 2 A LA VEZ")
  })

  it("las reglas se acumulan", () => {
    const rules = createDefaultRules()
    applyCardRules({ spherePull: 1, sphereBurst: 10 }, rules)
    applyCardRules({ spherePull: 1, sphereBurst: 10 }, rules)
    expect(rules.spherePull).toBe(3)
    expect(rules.sphereBurst).toBe(20)
  })

  it("coste y duración de las esferas", () => {
    const rules = createDefaultRules()
    expect(sphereCost(rules, 40)).toBe(40)
    expect(sphereCapacity(rules, 8)).toBe(8)

    applyCardRules(getCard("cheap_spheres").rules ?? {}, rules)
    expect(sphereCost(rules, 40)).toBe(25)
    expect(sphereCapacity(rules, 8)).toBe(4)
    expect(sphereCapacity({ ...rules, sphereCapacity: 0.01 }, 8)).toBe(1)
  })

  it("los giros encadenados suman fuerza hasta un tope", () => {
    expect(dashChainBoost(0, 0.2)).toBe(0)
    expect(dashChainBoost(2, 0.2)).toBeCloseTo(0.4)
    expect(dashChainBoost(50, 0.2)).toBe(DASH_CHAIN_MAX)
    expect(dashChainBoost(3, 0)).toBe(0)
  })
})

describe("rerollCost", () => {
  it("sube con cada tirada de la run", () => {
    expect(rerollCost(0)).toBe(15)
    expect(rerollCost(1)).toBe(25)
    expect(rerollCost(3)).toBe(45)
  })
})
