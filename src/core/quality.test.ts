import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ADAPTIVE_FRAME_BUDGET_MS,
  AdaptiveQuality,
  QUALITY_PRESETS,
  detectAutoPreset,
  effectivePixelRatio,
  isTouchDevice,
  loadQualityChoice,
  lowerPreset,
  rememberAutoPreset,
  resolveQuality,
  saveQualityChoice,
  wantsAntialias,
} from "@core/quality"

function stubStorage(
  initial: Record<string, string> = {},
): Map<string, string> {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  })
  return data
}

function stubDevice(options: { coarse: boolean; touchPoints: number }): void {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: options.coarse }),
  })
  vi.stubGlobal("navigator", {
    maxTouchPoints: options.touchPoints,
    // Un iPad con iPadOS se anuncia como Mac: el UA no debe influir.
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  })
}

/** Alimenta `seconds` de juego a un tiempo de frame fijo; devuelve si pidió bajar. */
function feed(adaptive: AdaptiveQuality, frameMs: number, seconds: number) {
  let downgrades = 0
  const frames = Math.ceil((seconds * 1000) / frameMs)
  for (let i = 0; i < frames; i++) {
    if (adaptive.sample(frameMs / 1000)) downgrades++
  }
  return downgrades
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("presets de calidad", () => {
  it("cada preset es más barato que el siguiente", () => {
    const { low, medium, high } = QUALITY_PRESETS

    expect(low.maxPixelRatio).toBe(1)
    expect(medium.maxPixelRatio).toBe(1.5)
    expect(high.maxPixelRatio).toBe(2)
    expect([low.bloom, medium.bloom, high.bloom]).toEqual([
      "off",
      "half",
      "full",
    ])
    expect(low.particleScale).toBeLessThan(medium.particleScale)
    expect(medium.particleScale).toBeLessThan(high.particleScale)
    expect(high.propScale).toBe(1)
  })

  it("limita el pixel ratio al tope del preset", () => {
    expect(effectivePixelRatio(QUALITY_PRESETS.low, 3)).toBe(1)
    expect(effectivePixelRatio(QUALITY_PRESETS.medium, 3)).toBe(1.5)
    expect(effectivePixelRatio(QUALITY_PRESETS.high, 3)).toBe(2)
    expect(effectivePixelRatio(QUALITY_PRESETS.high, 1)).toBe(1)
  })

  it("desactiva el antialias con pixel ratio ≥ 2", () => {
    expect(wantsAntialias(1)).toBe(true)
    expect(wantsAntialias(1.5)).toBe(true)
    expect(wantsAntialias(2)).toBe(false)
  })

  it("lowerPreset baja un escalón y se detiene en el más bajo", () => {
    expect(lowerPreset("high")).toBe("medium")
    expect(lowerPreset("medium")).toBe("low")
    expect(lowerPreset("low")).toBeNull()
  })
})

describe("detección de dispositivo", () => {
  it("un iPad (UA de Mac, puntero táctil) cuenta como táctil", () => {
    stubDevice({ coarse: true, touchPoints: 5 })

    expect(isTouchDevice()).toBe(true)
  })

  it("un portátil con ratón no cuenta como táctil aunque tenga pantalla táctil", () => {
    stubDevice({ coarse: false, touchPoints: 10 })

    expect(isTouchDevice()).toBe(false)
  })

  it("el modo auto parte de Alta en escritorio y de Media en táctil", () => {
    stubStorage()

    stubDevice({ coarse: false, touchPoints: 0 })
    expect(detectAutoPreset()).toBe("high")

    stubDevice({ coarse: true, touchPoints: 5 })
    expect(detectAutoPreset()).toBe("medium")
  })
})

describe("persistencia", () => {
  it("por defecto es auto y recuerda la elección del jugador", () => {
    stubStorage()
    expect(loadQualityChoice()).toBe("auto")

    saveQualityChoice("low")

    expect(loadQualityChoice()).toBe("low")
    expect(resolveQuality(loadQualityChoice())).toBe(QUALITY_PRESETS.low)
  })

  it("ignora valores guardados no válidos", () => {
    stubStorage({ "oceancide.quality": "ultra" })

    expect(loadQualityChoice()).toBe("auto")
  })

  it("el modo auto recuerda el preset al que bajó, pero nunca sube por ello", () => {
    stubStorage()
    stubDevice({ coarse: true, touchPoints: 5 })

    rememberAutoPreset("low")
    expect(detectAutoPreset()).toBe("low")

    rememberAutoPreset("high")
    expect(detectAutoPreset()).toBe("medium")
  })

  it("no rompe si localStorage no está disponible", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denegado")
      },
      setItem: () => {
        throw new Error("denegado")
      },
    })

    expect(loadQualityChoice()).toBe("auto")
    expect(() => saveQualityChoice("high")).not.toThrow()
  })
})

describe("AdaptiveQuality", () => {
  it("no pide bajar a 60 fps", () => {
    expect(feed(new AdaptiveQuality(), 16.7, 30)).toBe(0)
  })

  it("pide bajar cuando el frame medio supera el presupuesto de forma sostenida", () => {
    const slow = ADAPTIVE_FRAME_BUDGET_MS + 10

    expect(feed(new AdaptiveQuality(), slow, 10)).toBeGreaterThan(0)
  })

  it("un tirón puntual no baja la calidad", () => {
    const adaptive = new AdaptiveQuality()

    feed(adaptive, 16.7, 5)
    // Un frame de 400 ms (carga) dentro de una ventana por lo demás fluida.
    expect(adaptive.sample(0.4)).toBe(false)
    expect(feed(adaptive, 16.7, 10)).toBe(0)
  })

  it("reset() descarta la medición en curso", () => {
    const adaptive = new AdaptiveQuality()
    const slow = (ADAPTIVE_FRAME_BUDGET_MS + 10) / 1000

    // Casi dos ventanas lentas...
    for (let t = 0; t < 4.5; t += slow) adaptive.sample(slow)
    adaptive.reset()

    // ...pero tras el reset hace falta volver a acumularlas.
    let asked = false
    for (let t = 0; t < 2.5; t += slow) asked = adaptive.sample(slow) || asked
    expect(asked).toBe(false)
  })
})
