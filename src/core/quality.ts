// src/core/quality.ts
// Presets de calidad gráfica y calidad automática.
//
// La elección del jugador ("auto" o un preset fijo) se guarda en localStorage.
// En "auto" se parte de un preset según el dispositivo y, si el tiempo de frame
// se mantiene alto, se baja de preset (ver AdaptiveQuality).

export type QualityPreset = "low" | "medium" | "high"
export type QualityChoice = "auto" | QualityPreset
export type BloomMode = "off" | "half" | "full"

export interface QualitySettings {
  preset: QualityPreset
  /** Tope de devicePixelRatio del renderer. */
  maxPixelRatio: number
  bloom: BloomMode
  /** Multiplicador del número de partículas (ambiente y nieve marina). */
  particleScale: number
  /** Fracción de props decorativos que se dibujan. */
  propScale: number
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySettings> = {
  low: {
    preset: "low",
    maxPixelRatio: 1,
    bloom: "off",
    particleScale: 0.4,
    propScale: 0.6,
  },
  medium: {
    preset: "medium",
    maxPixelRatio: 1.5,
    bloom: "half",
    particleScale: 0.7,
    propScale: 0.85,
  },
  high: {
    preset: "high",
    maxPixelRatio: 2,
    bloom: "full",
    particleScale: 1,
    propScale: 1,
  },
}

export const QUALITY_LABELS: Record<QualityChoice, string> = {
  auto: "Auto",
  low: "Baja",
  medium: "Media",
  high: "Alta",
}

const CHOICE_KEY = "oceancide.quality"
/** Preset al que bajó el modo automático en este dispositivo (para no repetir el tirón). */
const AUTO_KEY = "oceancide.quality.auto"

const ORDER: QualityPreset[] = ["low", "medium", "high"]

function isPreset(value: unknown): value is QualityPreset {
  return value === "low" || value === "medium" || value === "high"
}

function isChoice(value: unknown): value is QualityChoice {
  return value === "auto" || isPreset(value)
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // sin acceso a localStorage: la elección dura solo esta sesión
  }
}

/**
 * Dispositivo táctil (móvil o tablet). No usa el user agent: los iPad con
 * iPadOS se identifican como Mac y se colaban como escritorio.
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  return coarse && (navigator.maxTouchPoints ?? 0) > 0
}

/** Elección guardada del jugador. `?quality=low|medium|high|auto` la sobreescribe (pruebas). */
export function loadQualityChoice(): QualityChoice {
  if (typeof location !== "undefined") {
    const fromUrl = new URLSearchParams(location.search).get("quality")
    if (isChoice(fromUrl)) return fromUrl
  }
  const stored = readStorage(CHOICE_KEY)
  return isChoice(stored) ? stored : "auto"
}

export function saveQualityChoice(choice: QualityChoice): void {
  writeStorage(CHOICE_KEY, choice)
}

/** Preset de partida del modo automático en este dispositivo. */
export function detectAutoPreset(): QualityPreset {
  const device: QualityPreset = isTouchDevice() ? "medium" : "high"
  const remembered = readStorage(AUTO_KEY)
  // Solo se recuerda para bajar: nunca se sube por encima del preset del dispositivo.
  if (
    isPreset(remembered) &&
    ORDER.indexOf(remembered) < ORDER.indexOf(device)
  ) {
    return remembered
  }
  return device
}

export function rememberAutoPreset(preset: QualityPreset): void {
  writeStorage(AUTO_KEY, preset)
}

export function resolveQuality(choice: QualityChoice): QualitySettings {
  return QUALITY_PRESETS[choice === "auto" ? detectAutoPreset() : choice]
}

/** Preset inmediatamente inferior, o `null` si ya es el más bajo. */
export function lowerPreset(preset: QualityPreset): QualityPreset | null {
  const index = ORDER.indexOf(preset)
  return index > 0 ? ORDER[index - 1] : null
}

/** Con un pixel ratio alto el MSAA apenas se nota y dispara el fill-rate. */
export function wantsAntialias(pixelRatio: number): boolean {
  return pixelRatio < 2
}

export function effectivePixelRatio(
  settings: QualitySettings,
  devicePixelRatio: number,
): number {
  return Math.min(devicePixelRatio || 1, settings.maxPixelRatio)
}

// ---------------------------------------------------------------------------
// Calidad adaptativa
// ---------------------------------------------------------------------------

/** Tiempo de frame medio a partir del cual se considera que el preset no aguanta. */
export const ADAPTIVE_FRAME_BUDGET_MS = 20
const WINDOW_SECONDS = 2
/** Ventanas lentas seguidas necesarias para bajar (evita reaccionar a un tirón puntual). */
const SLOW_WINDOWS_TO_DOWNGRADE = 2
/** Tras un cambio de preset o de bioma se ignoran los primeros segundos (compilación de shaders). */
const WARMUP_SECONDS = 1.5

/**
 * Mide el tiempo de frame medio y avisa cuando hay que bajar de preset.
 * Solo se le pasan frames de juego real (no pausa, menús ni transiciones).
 */
export class AdaptiveQuality {
  private elapsed = 0
  private frames = 0
  private slowWindows = 0
  private warmup = WARMUP_SECONDS

  /** Descarta la medición en curso (cambio de bioma, de preset o pausa larga). */
  public reset(): void {
    this.elapsed = 0
    this.frames = 0
    this.slowWindows = 0
    this.warmup = WARMUP_SECONDS
  }

  /**
   * @param frameSeconds duración real del frame (sin recortar)
   * @returns `true` si el rendimiento es sostenidamente malo y conviene bajar de preset
   */
  public sample(frameSeconds: number): boolean {
    if (this.warmup > 0) {
      this.warmup -= frameSeconds
      return false
    }

    this.elapsed += frameSeconds
    this.frames++
    if (this.elapsed < WINDOW_SECONDS) return false

    const averageMs = (this.elapsed / this.frames) * 1000
    this.elapsed = 0
    this.frames = 0

    if (averageMs > ADAPTIVE_FRAME_BUDGET_MS) {
      this.slowWindows++
    } else {
      this.slowWindows = 0
    }

    if (this.slowWindows >= SLOW_WINDOWS_TO_DOWNGRADE) {
      this.slowWindows = 0
      this.warmup = WARMUP_SECONDS
      return true
    }
    return false
  }
}
