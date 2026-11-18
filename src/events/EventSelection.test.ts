import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState } from "@cards/Card"
import { CARD_POOL } from "@cards/CardPool"
import { UPGRADES } from "@tycoon/Upgrades"
import { Rng } from "@core/rng"
import {
  ACT_EVENTS,
  type EventConditionContext,
  type EventOption,
  type GameEvent,
} from "@/events/EventPool"
import {
  DeferredQueue,
  availableEvents,
  isEventBiome,
  optionLockReason,
  pickEvent,
  previewOption,
  resolveOption,
  riskPercent,
} from "@/events/EventSelection"
import type { EventContext } from "@/events/EventEffects"

function conditions(
  overrides: Partial<EventConditionContext> = {},
): EventConditionContext {
  return {
    toxicity: 20,
    eco: 0,
    reviveCharges: 0,
    biomeKey: "subphotic",
    depth: 200,
    endless: false,
    cardIds: [],
    cardRarities: [],
    upgrades: {},
    ...overrides,
  }
}

function effectContext(eco = 100, toxicity = 20): EventContext {
  return {
    turtle: new Turtle(),
    state: {
      debrisCollected: 0,
      ecoAwareness: eco,
      toxicity,
      zoneProgress: 0,
      isRunning: true,
    },
    run: createRunState(),
    rng: new Rng(1),
  }
}

describe("pool de eventos", () => {
  it("tiene al menos 15 eventos", () => {
    expect(ACT_EVENTS.length).toBeGreaterThanOrEqual(15)
  })

  it("ningún evento tiene más de 3 opciones (teclas 1-3)", () => {
    for (const event of ACT_EVENTS) {
      expect(event.options.length, event.id).toBeLessThanOrEqual(3)
    }
  })

  it("las tiradas tienen probabilidades válidas y los diferidos llegan después", () => {
    for (const event of ACT_EVENTS) {
      for (const option of event.options) {
        if (option.risk) {
          expect(option.risk.chance).toBeGreaterThan(0)
          expect(option.risk.chance).toBeLessThan(1)
        }
        if (option.later) {
          expect(option.later.afterBiomes).toBeGreaterThanOrEqual(1)
          expect(option.later.message.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it("los requisitos apuntan a cartas y mejoras que existen", () => {
    const cardIds = new Set(CARD_POOL.map((card) => card.id))
    const upgradeIds = new Set(UPGRADES.map((upgrade) => upgrade.id))
    for (const event of ACT_EVENTS) {
      for (const option of event.options) {
        for (const id of option.requires?.anyCard ?? []) {
          expect(cardIds.has(id), id).toBe(true)
        }
        if (option.requires?.upgrade) {
          expect(upgradeIds.has(option.requires.upgrade.id)).toBe(true)
        }
      }
    }
  })

  it("cada evento deja siempre al menos una opción sin requisito", () => {
    for (const event of ACT_EVENTS) {
      expect(
        event.options.some((option) => !option.requires),
        event.id,
      ).toBe(true)
    }
  })

  it("hay eventos condicionados por toxicidad, caos, revives y profundidad", () => {
    const base = availableEvents(ACT_EVENTS, conditions(), []).map((e) => e.id)
    const toxic = availableEvents(ACT_EVENTS, conditions({ toxicity: 90 }), [])
    const chaos = availableEvents(
      ACT_EVENTS,
      conditions({ cardRarities: ["chaos"] }),
      [],
    )
    const revive = availableEvents(
      ACT_EVENTS,
      conditions({ reviveCharges: 1 }),
      [],
    )
    const deep = availableEvents(ACT_EVENTS, conditions({ depth: 6000 }), [])
    expect(base).not.toContain("toxic_bloom")
    expect(toxic.map((e) => e.id)).toContain("toxic_bloom")
    expect(base).not.toContain("chaos_rift")
    expect(chaos.map((e) => e.id)).toContain("chaos_rift")
    expect(revive.map((e) => e.id)).toContain("jelly_offering")
    expect(deep.map((e) => e.id)).toContain("hydrothermal_garden")
    expect(deep.map((e) => e.id)).not.toContain("bleached_reef")
  })
})

describe("isEventBiome", () => {
  it("en el modo normal, tras los biomas 2 y 4", () => {
    const hits = [0, 1, 2, 3, 4, 5].filter((i) => isEventBiome(i, false))
    expect(hits).toEqual([1, 3])
  })

  it("en el modo sin fin, uno cada 2 biomas", () => {
    const hits = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => isEventBiome(i, true))
    expect(hits).toEqual([1, 3, 5, 7])
  })
})

describe("pickEvent", () => {
  it("no repite eventos en la misma run", () => {
    const seen: string[] = []
    const ctx = conditions()
    for (let i = 0; i < 50; i++) {
      const event = pickEvent(new Rng(i), ACT_EVENTS, ctx, seen)
      if (!event) break
      expect(seen).not.toContain(event.id)
      seen.push(event.id)
    }
    expect(new Set(seen).size).toBe(seen.length)
    expect(pickEvent(new Rng(99), ACT_EVENTS, ctx, seen)).toBeNull()
  })

  it("es determinista con la misma semilla", () => {
    const ctx = conditions()
    expect(pickEvent(new Rng(5), ACT_EVENTS, ctx, [])?.id).toBe(
      pickEvent(new Rng(5), ACT_EVENTS, ctx, [])?.id,
    )
  })

  it("respeta la condición del evento", () => {
    const pool: GameEvent[] = [
      {
        id: "never",
        title: "x",
        description: "x",
        options: [],
        condition: () => false,
      },
    ]
    expect(pickEvent(new Rng(1), pool, conditions(), [])).toBeNull()
  })
})

describe("optionLockReason", () => {
  const option = (requires: EventOption["requires"]): EventOption => ({
    id: "o",
    label: "o",
    description: "o",
    effects: {},
    requires,
  })

  it("sin requisito, nunca bloquea", () => {
    expect(optionLockReason(option(undefined), conditions())).toBeNull()
  })

  it("comprueba cartas, mejoras, Eco y revives", () => {
    const card = option({ anyCard: ["coral_shield"], label: "carta" })
    expect(optionLockReason(card, conditions())).toBe("carta")
    expect(
      optionLockReason(card, conditions({ cardIds: ["coral_shield"] })),
    ).toBeNull()

    const upgrade = option({ upgrade: { id: "filters", level: 2 }, label: "m" })
    expect(
      optionLockReason(upgrade, conditions({ upgrades: { filters: 1 } })),
    ).toBe("m")
    expect(
      optionLockReason(upgrade, conditions({ upgrades: { filters: 2 } })),
    ).toBeNull()

    const eco = option({ minEco: 100, label: "eco" })
    expect(optionLockReason(eco, conditions({ eco: 99 }))).toBe("eco")
    expect(optionLockReason(eco, conditions({ eco: 100 }))).toBeNull()

    const revive = option({ minRevives: 1, label: "r" })
    expect(optionLockReason(revive, conditions())).toBe("r")
    expect(
      optionLockReason(revive, conditions({ reviveCharges: 1 })),
    ).toBeNull()
  })
})

describe("resolveOption", () => {
  const risky: EventOption = {
    id: "r",
    label: "r",
    description: "r",
    effects: { nextBiomeTimeDelta: -5 },
    risk: { chance: 0.6, success: { eco: 300 }, failure: { toxicity: 30 } },
  }

  it("sin riesgo devuelve los efectos tal cual", () => {
    const plain: EventOption = { ...risky, risk: undefined }
    expect(resolveOption(plain, new Rng(1))).toEqual({
      effects: plain.effects,
    })
  })

  it("con riesgo suma el resultado de la tirada a los efectos seguros", () => {
    let wins = 0
    for (let seed = 0; seed < 500; seed++) {
      const resolved = resolveOption(risky, new Rng(seed))
      expect(resolved.effects.nextBiomeTimeDelta).toBe(-5)
      if (resolved.roll === "success") {
        wins++
        expect(resolved.effects.eco).toBe(300)
      } else {
        expect(resolved.effects.toxicity).toBe(30)
      }
    }
    // ~60% de éxitos.
    expect(wins / 500).toBeGreaterThan(0.5)
    expect(wins / 500).toBeLessThan(0.7)
  })

  it("es determinista con la semilla de la run", () => {
    expect(resolveOption(risky, new Rng(42))).toEqual(
      resolveOption(risky, new Rng(42)),
    )
  })

  it("riskPercent redondea y acota", () => {
    expect(riskPercent(0.6)).toBe(60)
    expect(riskPercent(0.355)).toBe(36)
    expect(riskPercent(2)).toBe(100)
  })
})

describe("previewOption", () => {
  it("enseña cada resultado de la tirada con su probabilidad", () => {
    const option = ACT_EVENTS.find((e) => e.id === "poachers")!.options[0]
    const preview = previewOption(option, effectContext())
    const labels = preview.lines.map((line) => `${line.label}: ${line.value}`)
    expect(labels).toContain("60%: +300 Eco")
    expect(labels).toContain("40%: +30 toxicidad")
  })

  it("avisa si el peor caso puede matar", () => {
    const option = ACT_EVENTS.find((e) => e.id === "poachers")!.options[0]
    expect(previewOption(option, effectContext(0, 80)).warning).toBe(
      "Puede matarte",
    )
    expect(previewOption(option, effectContext(0, 10)).warning).toBeUndefined()
  })
})

describe("DeferredQueue", () => {
  const later = {
    afterBiomes: 2,
    title: "t",
    message: "m",
    effects: { eco: 100 },
  }

  it("entrega la consecuencia al entrar en el bioma que toca", () => {
    const queue = new DeferredQueue()
    queue.schedule(later, 1)
    expect(queue.takeDue(2)).toEqual([])
    expect(queue.takeDue(3)).toEqual([later])
    expect(queue.size).toBe(0)
  })

  it("no pierde consecuencias si se salta un bioma y clear las borra", () => {
    const queue = new DeferredQueue()
    queue.schedule(later, 0)
    expect(queue.takeDue(5)).toHaveLength(1)
    queue.schedule(later, 0)
    queue.clear()
    expect(queue.takeDue(5)).toEqual([])
  })
})
