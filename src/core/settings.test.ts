import { afterEach, describe, expect, it, vi } from "vitest"
import {
  COLOR_VISION_MODES,
  SETTINGS_KEY,
  SETTING_LIMITS,
  SettingsManager,
  clampToLimit,
  createDefaultSettings,
  resolveReducedMotion,
  sanitizeSettings,
} from "@core/settings"
import { SaveManager, createDefaultMeta } from "@core/MetaState"

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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("sanitizeSettings", () => {
  it("sin datos devuelve los ajustes por defecto", () => {
    expect(sanitizeSettings(undefined)).toEqual(createDefaultSettings())
    expect(sanitizeSettings("basura")).toEqual(createDefaultSettings())
    expect(sanitizeSettings([1, 2])).toEqual(createDefaultSettings())
  })

  it("el FOV por defecto es el de siempre (75°)", () => {
    expect(createDefaultSettings().fov).toBe(75)
  })

  it("el modo para daltonismo está desactivado por defecto", () => {
    expect(createDefaultSettings().colorVision).toBe("off")
  })

  it("acepta los modos para daltonismo conocidos y descarta el resto", () => {
    for (const mode of COLOR_VISION_MODES) {
      expect(sanitizeSettings({ colorVision: mode }).colorVision).toBe(mode)
    }
    expect(sanitizeSettings({ colorVision: "acromatopsia" }).colorVision).toBe(
      "off",
    )
  })

  it("descarta valores de tipo o rango incorrecto", () => {
    const settings = sanitizeSettings({
      quality: "ultra",
      reduceMotion: "a veces",
      vibration: "sí",
      fov: Number.NaN,
      touchScale: "grande",
    })

    expect(settings).toEqual(createDefaultSettings())
  })

  it("ajusta los números al rango y al paso del control", () => {
    const settings = sanitizeSettings({
      fov: 150,
      touchScale: 0.1,
      touchOpacity: 0.62,
      sfxVolume: -3,
    })

    expect(settings.fov).toBe(SETTING_LIMITS.fov.max)
    expect(settings.touchScale).toBe(SETTING_LIMITS.touchScale.min)
    expect(settings.touchOpacity).toBe(0.6)
    expect(settings.sfxVolume).toBe(0)
  })

  it("conserva los valores válidos", () => {
    const settings = sanitizeSettings({
      quality: "low",
      fov: 90,
      reduceMotion: "on",
      vibration: false,
      touchScale: 1.25,
      touchOpacity: 0.5,
      showControlsHint: false,
      tipsEnabled: false,
    })

    expect(settings).toMatchObject({
      quality: "low",
      fov: 90,
      reduceMotion: "on",
      vibration: false,
      touchScale: 1.25,
      touchOpacity: 0.5,
      showControlsHint: false,
      tipsEnabled: false,
    })
  })

  it("rellena lo que falta con los valores de referencia", () => {
    const base = { ...createDefaultSettings(), fov: 95 }

    expect(sanitizeSettings({ vibration: false }, base).fov).toBe(95)
  })
})

describe("clampToLimit", () => {
  it("evita errores de coma flotante al redondear al paso", () => {
    expect(clampToLimit(0.85, SETTING_LIMITS.touchScale, 1)).toBe(0.85)
    expect(clampToLimit(1.1, SETTING_LIMITS.touchScale, 1)).toBe(1.1)
  })
})

describe("resolveReducedMotion", () => {
  it("'system' sigue a la preferencia del sistema", () => {
    expect(resolveReducedMotion("system", true)).toBe(true)
    expect(resolveReducedMotion("system", false)).toBe(false)
  })

  it("'on' y 'off' la fuerzan", () => {
    expect(resolveReducedMotion("on", false)).toBe(true)
    expect(resolveReducedMotion("off", true)).toBe(false)
  })
})

describe("SettingsManager", () => {
  it("guarda y recupera los ajustes entre sesiones", () => {
    stubStorage()
    const settings = { ...createDefaultSettings(), fov: 90, vibration: false }

    new SettingsManager().save(settings)

    expect(new SettingsManager().load()).toEqual(settings)
  })

  it("usa su propia clave en localStorage", () => {
    const storage = stubStorage()

    new SettingsManager().save(createDefaultSettings())

    expect(storage.has(SETTINGS_KEY)).toBe(true)
    expect(JSON.parse(storage.get(SETTINGS_KEY)!)).toMatchObject({
      version: 1,
    })
  })

  it("eliminar el progreso no borra los ajustes", () => {
    const storage = stubStorage()
    const settings = { ...createDefaultSettings(), fov: 60 }
    new SettingsManager().save(settings)
    new SaveManager().save(createDefaultMeta())

    new SaveManager().reset()

    expect(storage.get("oceancide.meta")).toBeUndefined()
    expect(new SettingsManager().load()).toEqual(settings)
  })

  it("la primera vez rescata la calidad y los avisos de antes", () => {
    const storage = stubStorage({
      "oceancide.quality": "medium",
      "oceancide.meta": JSON.stringify({ version: 1, tipsEnabled: false }),
    })

    const settings = new SettingsManager().load()

    expect(settings.quality).toBe("medium")
    expect(settings.tipsEnabled).toBe(false)
    // Se guardan ya: el progreso deja de conservar tipsEnabled.
    expect(JSON.parse(storage.get(SETTINGS_KEY)!)).toMatchObject({
      quality: "medium",
      tipsEnabled: false,
    })
  })

  it("con ajustes ya guardados, ignora los valores antiguos", () => {
    stubStorage({
      "oceancide.quality": "low",
      [SETTINGS_KEY]: JSON.stringify({ version: 1, quality: "high" }),
    })

    expect(new SettingsManager().load().quality).toBe("high")
  })

  it("unos ajustes ilegibles vuelven a los valores por defecto", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    stubStorage({ [SETTINGS_KEY]: "{no es json" })

    expect(new SettingsManager().load()).toEqual(createDefaultSettings())
  })

  it("no rompe si localStorage no está disponible", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denegado")
      },
      setItem: () => {
        throw new Error("denegado")
      },
    })

    const manager = new SettingsManager()
    expect(manager.load()).toEqual(createDefaultSettings())
    expect(() => manager.save(createDefaultSettings())).not.toThrow()
  })
})
