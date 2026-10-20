import { describe, expect, it } from "vitest"
import { Turtle } from "@entities/Turtle"
import { createRunState } from "@cards/Card"
import { Rng } from "@core/rng"
import type { GameState } from "@core/types"
import {
  applyEventEffects,
  previewEventEffects,
  type EventContext,
} from "@/events/EventEffects"

function makeContext(overrides: Partial<GameState> = {}): EventContext {
  const state: GameState = {
    debrisCollected: 0,
    ecoAwareness: 100,
    toxicity: 20,
    zoneProgress: 0,
    isRunning: true,
    ...overrides,
  }

  return {
    turtle: new Turtle(),
    state,
    run: createRunState(),
    rng: new Rng(1),
  }
}

describe("applyEventEffects", () => {
  it("suma eco y lo clampa a 0", () => {
    const ctx = makeContext()

    expect(applyEventEffects({ eco: 250 }, ctx).summary).toBe("+250 Eco")
    expect(ctx.state.ecoAwareness).toBe(350)

    expect(applyEventEffects({ eco: -500 }, ctx).summary).toBe("-350 Eco")
    expect(ctx.state.ecoAwareness).toBe(0)
  })

  it("suma toxicidad y la clampa a 0..100", () => {
    const ctx = makeContext({ toxicity: 90 })

    expect(applyEventEffects({ toxicity: 25 }, ctx).summary).toBe(
      "+10 toxicidad",
    )
    expect(ctx.state.toxicity).toBe(100)

    ctx.state.toxicity = 10

    expect(applyEventEffects({ toxicity: -30 }, ctx).summary).toBe(
      "-10 toxicidad",
    )
    expect(ctx.state.toxicity).toBe(0)
  })

  it("toxicitySet fija el valor absoluto", () => {
    const ctx = makeContext({ toxicity: 80 })

    expect(applyEventEffects({ toxicitySet: 0 }, ctx).summary).toBe(
      "-80 toxicidad",
    )
    expect(ctx.state.toxicity).toBe(0)
  })

  it("aplica filtros, radio y multiplicador de velocidad", () => {
    const ctx = makeContext()
    const { speed, collectionRadius, filterCapacity } = ctx.turtle.stats

    const result = applyEventEffects(
      { filterCapacity: 1, collectionRadius: 0.5, speedMultiplier: 0.85 },
      ctx,
    )

    expect(ctx.turtle.stats.filterCapacity).toBe(filterCapacity + 1)
    expect(ctx.turtle.stats.collectionRadius).toBeCloseTo(
      collectionRadius + 0.5,
    )
    expect(ctx.turtle.stats.speed).toBeCloseTo(speed * 0.85)
    expect(result.summary).toBe("+1 filtro · +0.5 radio · -15% velocidad")
  })

  it("suma glow con clamp y devuelve el incremento real", () => {
    const ctx = makeContext()
    ctx.turtle.addGlow(0.9)

    expect(applyEventEffects({ glow: 0.5 }, ctx).summary).toBe(
      "+0.1 bioluminiscencia",
    )
    expect(ctx.turtle.getGlowTarget()).toBe(1)
  })

  it("no anuncia glow si ya está al máximo", () => {
    const ctx = makeContext()
    ctx.turtle.addGlow(1)

    expect(applyEventEffects({ glow: 0.5 }, ctx).summary).toBe("Sin efecto")
  })

  it("devuelve los efectos diferidos para el siguiente bioma", () => {
    const ctx = makeContext()

    const result = applyEventEffects(
      { nextBiomeTimeDelta: -20, nextBiomeToxicityFloor: 40 },
      ctx,
    )

    expect(result.nextBiomeTimeDelta).toBe(-20)
    expect(result.nextBiomeToxicityFloor).toBe(40)
    expect(result.summary).toBe("-20s siguiente bioma · 40% toxicidad inicial")
  })

  it("resume una entrada limpia al siguiente bioma", () => {
    const ctx = makeContext()

    expect(applyEventEffects({ nextBiomeToxicityFloor: 0 }, ctx).summary).toBe(
      "entrada limpia",
    )
  })

  it("devuelve 'Sin efecto' si no hay efectos", () => {
    const ctx = makeContext()

    expect(applyEventEffects({}, ctx).summary).toBe("Sin efecto")
    expect(applyEventEffects({}, ctx).nextBiomeTimeDelta).toBe(0)
  })
})

describe("previewEventEffects", () => {
  it("previsualiza el eco antes y después", () => {
    const ctx = makeContext()

    expect(previewEventEffects({ eco: 250 }, ctx).lines).toEqual([
      {
        label: "Eco",
        value: "+250 (100 → 350)",
        tone: "positive",
        noEffect: false,
      },
    ])
  })

  it("marca como sin efecto los cambios que no llegan al umbral", () => {
    const ctx = makeContext({ ecoAwareness: 0 })

    expect(previewEventEffects({ eco: -100 }, ctx).lines[0]).toMatchObject({
      value: "Sin efecto",
      tone: "neutral",
      noEffect: true,
    })
  })

  it("avisa si la toxicidad puede matarte", () => {
    const ctx = makeContext({ toxicity: 90 })

    const preview = previewEventEffects({ toxicity: 25 }, ctx)

    expect(preview.lines[0]).toEqual({
      label: "Toxicidad",
      value: "+10 (90% → 100%)",
      tone: "negative",
      noEffect: false,
    })
    expect(preview.warning).toBe("Puede matarte")
    expect(ctx.state.toxicity).toBe(90)
  })

  it("avisa si la toxicidad puede consumir un revive", () => {
    const ctx = makeContext({ toxicity: 90 })
    ctx.run.reviveCharges = 1

    expect(previewEventEffects({ toxicity: 25 }, ctx).warning).toBe(
      "Puede consumir un revive",
    )
  })

  it("no avisa si la toxicidad se queda por debajo de 100", () => {
    const ctx = makeContext({ toxicity: 20 })

    expect(previewEventEffects({ toxicity: 25 }, ctx).warning).toBeUndefined()
  })

  it("previsualiza toxicidad absoluta", () => {
    const ctx = makeContext({ toxicity: 20 })

    expect(previewEventEffects({ toxicitySet: 0 }, ctx).lines[0]).toMatchObject(
      {
        value: "-20 (20% → 0%)",
        tone: "positive",
      },
    )
  })

  it("previsualiza filtros y radio", () => {
    const ctx = makeContext()
    const { filterCapacity, collectionRadius } = ctx.turtle.stats

    const { lines } = previewEventEffects(
      { filterCapacity: 1, collectionRadius: 0.5 },
      ctx,
    )

    expect(lines[0]).toMatchObject({
      label: "Filtros",
      value: `${filterCapacity} → ${filterCapacity + 1}`,
      tone: "positive",
    })
    expect(lines[1]).toMatchObject({
      label: "Radio",
      value: `${collectionRadius.toFixed(1)} → ${(
        collectionRadius + 0.5
      ).toFixed(1)}`,
      tone: "positive",
    })
  })

  it("previsualiza el porcentaje de velocidad", () => {
    const ctx = makeContext()

    expect(
      previewEventEffects({ speedMultiplier: 0.85 }, ctx).lines[0],
    ).toEqual({
      label: "Velocidad",
      value: "-15%",
      tone: "negative",
    })
  })

  it("previsualiza el glow con el valor real tras el clamp", () => {
    const ctx = makeContext()
    ctx.turtle.addGlow(0.9)

    expect(previewEventEffects({ glow: 0.5 }, ctx).lines[0]).toEqual({
      label: "Bioluminiscencia",
      value: "+0.1 (0.9 → 1.0)",
      tone: "positive",
      noEffect: false,
    })
  })

  it("marca el glow como sin efecto si ya está al máximo", () => {
    const ctx = makeContext()
    ctx.turtle.addGlow(1)

    expect(previewEventEffects({ glow: 0.5 }, ctx).lines[0]).toEqual({
      label: "Bioluminiscencia",
      value: "Sin efecto",
      tone: "neutral",
      noEffect: true,
    })
  })

  it("previsualiza los efectos del siguiente bioma", () => {
    const ctx = makeContext()

    const { lines } = previewEventEffects(
      { nextBiomeTimeDelta: -20, nextBiomeToxicityFloor: 0 },
      ctx,
    )

    expect(lines).toEqual([
      {
        label: "Tiempo siguiente bioma",
        value: "-20s",
        tone: "negative",
      },
      {
        label: "Inicio siguiente bioma",
        value: "0% (limpio)",
        tone: "positive",
      },
    ])
  })

  it("no devuelve líneas para efectos vacíos", () => {
    const preview = previewEventEffects({}, makeContext())

    expect(preview.lines).toEqual([])
    expect(preview.warning).toBeUndefined()
  })
})
