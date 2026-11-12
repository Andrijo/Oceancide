// src/core/settings.ts
// Ajustes del jugador (gráficos, movimiento, controles, avisos) y su guardado.
//
// Viven en su propia clave de localStorage, separada del progreso: "Eliminar
// progreso" (SaveManager.reset) no los toca.

import {
  LEGACY_QUALITY_KEY,
  isQualityChoice,
  type QualityChoice,
} from "@core/quality"
import {
  createDefaultKeyBindings,
  sanitizeKeyBindings,
  type KeyBindings,
} from "@core/keyBindings"
import {
  createDefaultPadBindings,
  sanitizePadBindings,
  type PadBindings,
} from "@core/padBindings"

export const SETTINGS_VERSION = 1
export const SETTINGS_KEY = "oceancide.settings"
/** Clave del progreso: de ahí se rescata `tipsEnabled`, que antes vivía allí. */
const LEGACY_META_KEY = "oceancide.meta"

/** "system" sigue a `prefers-reduced-motion`; "on" y "off" lo fuerzan. */
export type ReduceMotionChoice = "system" | "on" | "off"

/**
 * Modo para daltonismo: cambia la paleta de los colores con significado
 * (mejora, empeora, aviso, fuga) y añade pistas que no dependen del color.
 */
export type ColorVisionMode =
  "off" | "protanopia" | "deuteranopia" | "tritanopia"

export const COLOR_VISION_MODES: readonly ColorVisionMode[] = [
  "off",
  "protanopia",
  "deuteranopia",
  "tritanopia",
]

export interface Settings {
  quality: QualityChoice
  /** Campo de visión vertical de la cámara, en grados. */
  fov: number
  reduceMotion: ReduceMotionChoice
  colorVision: ColorVisionMode
  /** Vibración del dispositivo al hacer el dash. */
  vibration: boolean
  /** Escala de los controles táctiles (1 = tamaño original). */
  touchScale: number
  /** Opacidad de los controles táctiles (0..1). */
  touchOpacity: number
  /** Pista de controles en la parte inferior durante la inmersión. */
  showControlsHint: boolean
  /** Tecla principal de cada acción (reasignable desde Ajustes). */
  keyBindings: KeyBindings
  /** Botón del mando de cada acción (reasignable desde Ajustes). */
  padBindings: PadBindings
  /** Avisos contextuales durante la inmersión. */
  tipsEnabled: boolean
  /** Volumen de la música (0..1). Reservado para cuando haya audio. */
  musicVolume: number
  /** Volumen de los efectos (0..1). Reservado para cuando haya audio. */
  sfxVolume: number
}

export interface RangeLimit {
  min: number
  max: number
  step: number
}

export const SETTING_LIMITS = {
  fov: { min: 60, max: 100, step: 5 },
  touchScale: { min: 0.75, max: 1.5, step: 0.05 },
  touchOpacity: { min: 0.3, max: 1, step: 0.05 },
  volume: { min: 0, max: 1, step: 0.05 },
} satisfies Record<string, RangeLimit>

export function createDefaultSettings(): Settings {
  return {
    quality: "auto",
    fov: 75,
    reduceMotion: "system",
    colorVision: "off",
    vibration: true,
    touchScale: 1,
    touchOpacity: 1,
    showControlsHint: true,
    keyBindings: createDefaultKeyBindings(),
    padBindings: createDefaultPadBindings(),
    tipsEnabled: true,
    musicVolume: 0.8,
    sfxVolume: 0.8,
  }
}

function isReduceMotionChoice(value: unknown): value is ReduceMotionChoice {
  return value === "system" || value === "on" || value === "off"
}

function isColorVisionMode(value: unknown): value is ColorVisionMode {
  return COLOR_VISION_MODES.includes(value as ColorVisionMode)
}

/** Ajusta un número al rango y al paso del control; si no es válido, `fallback`. */
export function clampToLimit(
  value: unknown,
  limit: RangeLimit,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  const clamped = Math.min(limit.max, Math.max(limit.min, value))
  const steps = Math.round((clamped - limit.min) / limit.step)
  // Redondeo a 4 decimales para no arrastrar errores de coma flotante.
  return Math.round((limit.min + steps * limit.step) * 10000) / 10000
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

/** Rellena y sanea unos ajustes leídos de disco (o parciales). */
export function sanitizeSettings(
  raw: unknown,
  defaults: Settings = createDefaultSettings(),
): Settings {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  return {
    quality: isQualityChoice(data.quality) ? data.quality : defaults.quality,
    fov: clampToLimit(data.fov, SETTING_LIMITS.fov, defaults.fov),
    reduceMotion: isReduceMotionChoice(data.reduceMotion)
      ? data.reduceMotion
      : defaults.reduceMotion,
    colorVision: isColorVisionMode(data.colorVision)
      ? data.colorVision
      : defaults.colorVision,
    vibration: bool(data.vibration, defaults.vibration),
    touchScale: clampToLimit(
      data.touchScale,
      SETTING_LIMITS.touchScale,
      defaults.touchScale,
    ),
    touchOpacity: clampToLimit(
      data.touchOpacity,
      SETTING_LIMITS.touchOpacity,
      defaults.touchOpacity,
    ),
    showControlsHint: bool(data.showControlsHint, defaults.showControlsHint),
    keyBindings:
      data.keyBindings === undefined
        ? { ...defaults.keyBindings }
        : sanitizeKeyBindings(data.keyBindings),
    padBindings:
      data.padBindings === undefined
        ? { ...defaults.padBindings }
        : sanitizePadBindings(data.padBindings),
    tipsEnabled: bool(data.tipsEnabled, defaults.tipsEnabled),
    musicVolume: clampToLimit(
      data.musicVolume,
      SETTING_LIMITS.volume,
      defaults.musicVolume,
    ),
    sfxVolume: clampToLimit(
      data.sfxVolume,
      SETTING_LIMITS.volume,
      defaults.sfxVolume,
    ),
  }
}

/** ¿Hay que reducir el movimiento con esta elección y la preferencia del sistema? */
export function resolveReducedMotion(
  choice: ReduceMotionChoice,
  systemPrefersReduced: boolean,
): boolean {
  if (choice === "on") return true
  if (choice === "off") return false
  return systemPrefersReduced
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export class SettingsManager {
  /**
   * Lee los ajustes guardados. La primera vez, los construye a partir de lo
   * que había antes de que existieran (calidad en su propia clave y avisos
   * dentro del progreso) y los guarda, porque el progreso deja de conservar
   * `tipsEnabled` en cuanto se vuelve a guardar.
   */
  public load(): Settings {
    const raw = readStorage(SETTINGS_KEY)

    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        return sanitizeSettings(parsed)
      } catch (error) {
        console.warn("[SettingsManager] Ajustes ilegibles", error)
        return createDefaultSettings()
      }
    }

    const settings = this.fromLegacy()
    this.save(settings)
    return settings
  }

  public save(settings: Settings): void {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ version: SETTINGS_VERSION, ...settings }),
      )
    } catch (error) {
      console.warn(
        "[SettingsManager] No se pudieron guardar los ajustes",
        error,
      )
    }
  }

  private fromLegacy(): Settings {
    const settings = createDefaultSettings()

    const quality = readStorage(LEGACY_QUALITY_KEY)
    if (isQualityChoice(quality)) settings.quality = quality

    const meta = readStorage(LEGACY_META_KEY)
    if (meta) {
      try {
        const parsed: unknown = JSON.parse(meta)
        if (parsed && typeof parsed === "object") {
          const tips = (parsed as Record<string, unknown>).tipsEnabled
          if (typeof tips === "boolean") settings.tipsEnabled = tips
        }
      } catch {
        // progreso ilegible: SaveManager ya se encarga de él
      }
    }

    return settings
  }
}
