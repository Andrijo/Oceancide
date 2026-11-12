import { describe, expect, it } from "vitest"
import {
  DEATH_DURATION,
  DEATH_DURATION_REDUCED,
  DEATH_MAX_FADE,
  DEATH_MIN_TIME_SCALE,
  deathFade,
  deathProgress,
  deathTimeScale,
} from "@core/systems/deathSequence"

describe("deathProgress", () => {
  it("dura entre 0,8 y 1,5 s con movimiento y es más corto si se reduce", () => {
    expect(DEATH_DURATION).toBeGreaterThanOrEqual(0.8)
    expect(DEATH_DURATION).toBeLessThanOrEqual(1.5)
    expect(DEATH_DURATION_REDUCED).toBeLessThan(DEATH_DURATION)
  })

  it("avanza de 0 a 1 y se queda en 1", () => {
    expect(deathProgress(0, false)).toBe(0)
    expect(deathProgress(DEATH_DURATION / 2, false)).toBeCloseTo(0.5)
    expect(deathProgress(DEATH_DURATION * 3, false)).toBe(1)
    expect(deathProgress(DEATH_DURATION_REDUCED, true)).toBe(1)
  })
})

describe("deathTimeScale", () => {
  it("frena de la velocidad normal a la cámara lenta", () => {
    expect(deathTimeScale(0, false)).toBe(1)
    expect(deathTimeScale(1, false)).toBeCloseTo(DEATH_MIN_TIME_SCALE)
    expect(deathTimeScale(0.5, false)).toBeLessThan(0.5)
  })

  it("es monótona decreciente", () => {
    let previous = Infinity
    for (let i = 0; i <= 10; i++) {
      const scale = deathTimeScale(i / 10, false)
      expect(scale).toBeLessThanOrEqual(previous)
      previous = scale
    }
  })

  it("congela el mundo con el movimiento reducido", () => {
    expect(deathTimeScale(0, true)).toBe(0)
    expect(deathTimeScale(0.7, true)).toBe(0)
  })
})

describe("deathFade", () => {
  it("entra desde transparente hasta el máximo sin pasarse", () => {
    expect(deathFade(0)).toBe(0)
    expect(deathFade(1)).toBeCloseTo(DEATH_MAX_FADE)
    expect(deathFade(2)).toBeCloseTo(DEATH_MAX_FADE)
    expect(deathFade(-1)).toBe(0)
  })
})
