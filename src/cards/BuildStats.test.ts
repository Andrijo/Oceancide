import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState, type Card, type CardContext } from "@cards/Card"
import { applyCardEffects, describeCardEffects } from "@cards/CardEffects"
import {
  STAT_INFO,
  STAT_KEYS,
  buildStatLines,
  previewCard,
  previewLineText,
  projectBuild,
  readBuild,
} from "@cards/BuildStats"
import { CARD_POOL } from "@cards/CardPool"
import { Rng } from "@core/rng"
import type { GameState } from "@core/types"

function makeContext(): CardContext {
  const state: GameState = {
    debrisCollected: 0,
    ecoAwareness: 0,
    toxicity: 30,
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

describe("readBuild", () => {
  it("lee los valores iniciales de la tortuga y de la run", () => {
    expect(readBuild(makeContext())).toEqual({
      speed: 9,
      resistance: 0.1,
      radius: 3,
      filters: 5,
      eco: 1,
      dash: 1.6,
      ecoPerSecond: 0,
      revives: 0,
      glow: 0,
      enemies: 0,
      passiveToxicity: 1,
      toxicity: 30,
    })
  })
})

describe("projectBuild", () => {
  it("predice exactamente lo que aplica cada carta declarativa", () => {
    const declarative = CARD_POOL.filter((card) => card.effects)
    expect(declarative.length).toBeGreaterThan(40)

    for (const card of declarative) {
      const ctx = makeContext()
      const predicted = projectBuild(readBuild(ctx), card.effects!)
      applyCardEffects(card.effects!, ctx)
      const actual = readBuild(ctx)

      for (const key of STAT_KEYS) {
        expect(predicted[key], `${card.id} · ${key}`).toBeCloseTo(
          actual[key],
          10,
        )
      }
    }
  })

  it("sigue acertando con cartas acumuladas (rendimientos decrecientes y topes)", () => {
    const ctx = makeContext()
    const stack = ["mirror_shell", "bioluminescence", "fragility"].map(getCard)

    for (let round = 0; round < 3; round++) {
      for (const card of stack) {
        const predicted = projectBuild(readBuild(ctx), card.effects!)
        applyCardEffects(card.effects!, ctx)
        const actual = readBuild(ctx)

        for (const key of STAT_KEYS) {
          expect(predicted[key], `${card.id} · ${key}`).toBeCloseTo(
            actual[key],
            10,
          )
        }
      }
    }
  })

  it("no modifica la build original", () => {
    const build = readBuild(makeContext())
    const copy = { ...build }
    projectBuild(build, { speed: 2, toxicity: 50 })
    expect(build).toEqual(copy)
  })
})

describe("previewCard", () => {
  it("muestra el antes y el después de cada efecto, en orden", () => {
    const lines = previewCard(getCard("reflexes"), readBuild(makeContext()))

    expect(lines).toEqual([
      {
        key: "speed",
        label: "Velocidad",
        before: "9.0",
        after: "9.5",
        tone: "positive",
        noEffect: false,
      },
      {
        key: "radius",
        label: "Radio de recogida",
        before: "3.0",
        after: "3.3",
        tone: "positive",
        noEffect: false,
      },
    ])
  })

  it("tiene una línea por cada tramo declarado de la carta", () => {
    for (const card of CARD_POOL) {
      const lines = previewCard(card, readBuild(makeContext()))
      const declared = card.effects ? describeCardEffects(card.effects) : []
      expect(lines.length, card.id).toBe(declared.length)
    }
  })

  it("pinta en rojo lo que empeora", () => {
    const build = readBuild(makeContext())
    const curse = previewCard(getCard("fragility"), build)
    const chaos = previewCard(getCard("black_tide"), build)

    expect(curse.map((line) => line.tone)).toEqual(["positive", "negative"])
    expect(curse[1]).toMatchObject({ before: "10%", after: "0%" })
    expect(chaos[2]).toMatchObject({
      key: "toxicity",
      before: "30%",
      after: "50%",
      tone: "negative",
    })
  })

  it("refleja los rendimientos decrecientes de la resistencia", () => {
    const ctx = makeContext()
    const mirror = getCard("mirror_shell")

    const first = previewCard(mirror, readBuild(ctx))[0]
    expect(first).toMatchObject({ before: "10%", after: "46%" })

    applyCardEffects(mirror.effects!, ctx)
    const second = previewCard(mirror, readBuild(ctx))[0]
    expect(second).toMatchObject({ before: "46%", after: "68%" })
  })

  it("marca como sin efecto lo que ya está en el tope", () => {
    const ctx = makeContext()
    ctx.turtle.setGlow(1)

    const line = previewCard(
      {
        id: "x",
        name: "X",
        description: "",
        rarity: "epic",
        effects: { glow: 0.5 },
      },
      readBuild(ctx),
    )[0]

    expect(line).toMatchObject({ noEffect: true, tone: "neutral" })
    expect(previewLineText(line)).toBe("Brillo: sin cambio (100%)")
  })

  it("no inventa líneas para las cartas de azar", () => {
    expect(previewCard(getCard("mutation"), readBuild(makeContext()))).toEqual(
      [],
    )
  })
})

describe("previewLineText", () => {
  it("describe el cambio en texto plano", () => {
    const line = previewCard(
      getCard("fins_agiles"),
      readBuild(makeContext()),
    )[0]
    expect(previewLineText(line)).toBe("Velocidad: de 9.0 a 9.9")
  })
})

describe("buildStatLines", () => {
  it("oculta la toxicidad y los atributos perjudiciales en neutro", () => {
    const keys = buildStatLines(readBuild(makeContext())).map((l) => l.key)

    expect(keys).toEqual([
      "speed",
      "resistance",
      "radius",
      "filters",
      "eco",
      "dash",
      "ecoPerSecond",
      "revives",
      "glow",
    ])
  })

  it("enseña medusas extra y toxicidad pasiva cuando una carta las activa", () => {
    const ctx = makeContext()
    applyCardEffects(getCard("medusa_pact").effects!, ctx)
    applyCardEffects(getCard("unstable_eco").effects!, ctx)

    const lines = buildStatLines(readBuild(ctx))
    const enemies = lines.find((line) => line.key === "enemies")
    const passive = lines.find((line) => line.key === "passiveToxicity")

    expect(enemies).toMatchObject({ value: "+2", warning: true })
    expect(passive).toMatchObject({ value: "×1.50", warning: true })
    expect(lines.find((line) => line.key === "eco")?.value).toBe("×2.00")
    expect(lines.find((line) => line.key === "revives")?.value).toBe("1")
  })
})

describe("STAT_INFO", () => {
  it("usa los mismos nombres que muestran las cartas", () => {
    const text = describeCardEffects({
      speed: 1.1,
      resistance: 0.05,
      radius: 0.5,
      filters: 1,
      eco: 1.1,
      dash: 0.2,
      ecoPerSecond: 1,
      revives: 1,
      glow: 0.5,
      enemies: 2,
      passiveToxicity: 1.5,
      toxicity: 20,
    }).map((part) => part.text)

    STAT_KEYS.forEach((key, index) => {
      expect(text[index], key).toContain(STAT_INFO[key].term)
    })
  })

  it("no usa abreviaturas en los valores de las cartas", () => {
    for (const key of STAT_KEYS) {
      expect(STAT_INFO[key].term, key).not.toMatch(/\b(VEL|RES|TOX)\b|\/S\b/)
    }
  })
})
