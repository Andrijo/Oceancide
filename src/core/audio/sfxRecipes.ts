// src/core/audio/sfxRecipes.ts
// Recetas de los efectos de sonido. Todo se sintetiza con Web Audio (sin
// archivos): cada efecto es una o varias capas de oscilador o ruido con su
// envolvente y, opcionalmente, un filtro. Son datos puros para poder probarlos
// sin AudioContext.

export type SfxId =
  | "collect"
  | "collectLeak"
  | "shatter"
  | "relic"
  | "hurt"
  | "sting"
  | "dash"
  | "build"
  | "denied"
  | "cardOpen"
  | "cardPick"
  | "eventOpen"
  | "revive"
  | "death"
  | "transition"
  | "zoneClear"
  | "timeLow"
  | "uiMove"
  | "uiSelect"
  | "shield"
  | "summary"

export type LayerWave = OscillatorType | "noise"

export interface SfxFilter {
  type: BiquadFilterType
  freq: number
  /** Frecuencia final del barrido (si no, fija). */
  freqEnd?: number
  q?: number
}

export interface SfxLayer {
  wave: LayerWave
  /** Frecuencia inicial en Hz (ignorada por el ruido salvo para el filtro). */
  freq: number
  /** Frecuencia final del barrido exponencial (si no, fija). */
  freqEnd?: number
  /** Retardo desde el disparo, en segundos. */
  delay?: number
  /** Duración total de la capa, en segundos. */
  duration: number
  /** Volumen de pico (0..1) antes del volumen de efectos. */
  gain: number
  /** Tiempo de subida, en segundos. */
  attack?: number
  filter?: SfxFilter
}

export interface SfxRecipe {
  layers: SfxLayer[]
  /** Separación mínima entre dos disparos del mismo efecto, en segundos. */
  minInterval: number
  /** Variación aleatoria del tono (±, en semitonos) para que no canse. */
  pitchJitter?: number
}

/** Frecuencia de una nota a `semitones` de `base`. */
export function transpose(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12)
}

export const SFX: Record<SfxId, SfxRecipe> = {
  // Burbuja corta que sube: el sonido más frecuente, tiene que ser suave.
  collect: {
    minInterval: 0.045,
    pitchJitter: 2,
    layers: [
      {
        wave: "sine",
        freq: 520,
        freqEnd: 1040,
        duration: 0.12,
        gain: 0.22,
        attack: 0.005,
      },
      {
        wave: "triangle",
        freq: 1560,
        duration: 0.06,
        delay: 0.03,
        gain: 0.06,
      },
    ],
  },
  // Cerrar una fuga: dos notas limpias, una quinta.
  collectLeak: {
    minInterval: 0.1,
    layers: [
      { wave: "triangle", freq: 660, duration: 0.18, gain: 0.22 },
      {
        wave: "triangle",
        freq: transpose(660, 7),
        duration: 0.26,
        delay: 0.08,
        gain: 0.2,
      },
    ],
  },
  // Un frágil roto: ruido agudo que cae.
  shatter: {
    minInterval: 0.08,
    layers: [
      {
        wave: "noise",
        freq: 0,
        duration: 0.22,
        gain: 0.28,
        filter: { type: "highpass", freq: 3000, freqEnd: 1200, q: 0.7 },
      },
      {
        wave: "square",
        freq: 1800,
        freqEnd: 900,
        duration: 0.08,
        gain: 0.05,
      },
    ],
  },
  // Reliquia: arpegio mayor ascendente.
  relic: {
    minInterval: 0.5,
    layers: [0, 4, 7, 12, 16].map((step, i) => ({
      wave: "sine" as const,
      freq: transpose(523.25, step),
      duration: 0.5,
      delay: i * 0.07,
      gain: 0.16,
      attack: 0.01,
    })),
  },
  // Golpe de una criatura: grave y sordo.
  hurt: {
    minInterval: 0.2,
    layers: [
      {
        wave: "sawtooth",
        freq: 180,
        freqEnd: 60,
        duration: 0.3,
        gain: 0.3,
        filter: { type: "lowpass", freq: 900, freqEnd: 200 },
      },
      {
        wave: "noise",
        freq: 0,
        duration: 0.15,
        gain: 0.18,
        filter: { type: "lowpass", freq: 600 },
      },
    ],
  },
  // Picadura de medusa: zumbido eléctrico.
  sting: {
    minInterval: 0.2,
    layers: [
      {
        wave: "square",
        freq: 340,
        freqEnd: 220,
        duration: 0.25,
        gain: 0.12,
        filter: { type: "bandpass", freq: 1400, q: 4 },
      },
      {
        wave: "sawtooth",
        freq: 347,
        freqEnd: 225,
        duration: 0.25,
        gain: 0.08,
        filter: { type: "bandpass", freq: 1400, q: 4 },
      },
    ],
  },
  // Giro: remolino de agua (ruido con barrido de filtro).
  dash: {
    minInterval: 0.12,
    pitchJitter: 1,
    layers: [
      {
        wave: "noise",
        freq: 0,
        duration: 0.35,
        gain: 0.22,
        attack: 0.04,
        filter: { type: "bandpass", freq: 400, freqEnd: 2200, q: 1.5 },
      },
      {
        wave: "sine",
        freq: 220,
        freqEnd: 440,
        duration: 0.3,
        gain: 0.08,
      },
    ],
  },
  // Esfera filtradora: burbuja grande y campana.
  build: {
    minInterval: 0.2,
    layers: [
      {
        wave: "sine",
        freq: 300,
        freqEnd: 700,
        duration: 0.25,
        gain: 0.22,
      },
      {
        wave: "triangle",
        freq: 880,
        duration: 0.6,
        delay: 0.12,
        gain: 0.1,
        attack: 0.01,
      },
    ],
  },
  // Acción no permitida (sin Eco, máximo de filtros).
  denied: {
    minInterval: 0.25,
    layers: [
      {
        wave: "square",
        freq: 220,
        duration: 0.09,
        gain: 0.08,
        filter: { type: "lowpass", freq: 1200 },
      },
      {
        wave: "square",
        freq: 175,
        duration: 0.12,
        delay: 0.1,
        gain: 0.08,
        filter: { type: "lowpass", freq: 1200 },
      },
    ],
  },
  cardOpen: {
    minInterval: 0.3,
    layers: [
      {
        wave: "triangle",
        freq: 392,
        duration: 0.4,
        gain: 0.14,
        attack: 0.02,
      },
      {
        wave: "triangle",
        freq: transpose(392, 7),
        duration: 0.5,
        delay: 0.1,
        gain: 0.12,
        attack: 0.02,
      },
    ],
  },
  cardPick: {
    minInterval: 0.2,
    layers: [
      { wave: "sine", freq: 659.25, duration: 0.18, gain: 0.18 },
      {
        wave: "sine",
        freq: 987.77,
        duration: 0.35,
        delay: 0.07,
        gain: 0.16,
      },
    ],
  },
  // Evento: acorde suspendido y misterioso.
  eventOpen: {
    minInterval: 0.5,
    layers: [0, 5, 10].map((step, i) => ({
      wave: "sine" as const,
      freq: transpose(220, step),
      duration: 1.2,
      delay: i * 0.12,
      gain: 0.12,
      attack: 0.15,
    })),
  },
  revive: {
    minInterval: 0.5,
    layers: [
      {
        wave: "sine",
        freq: 220,
        freqEnd: 880,
        duration: 0.7,
        gain: 0.2,
        attack: 0.05,
      },
      {
        wave: "triangle",
        freq: 440,
        freqEnd: 1320,
        duration: 0.7,
        gain: 0.08,
        attack: 0.05,
      },
    ],
  },
  // Derrota: cae, lento y grave.
  death: {
    minInterval: 1,
    layers: [
      {
        wave: "sawtooth",
        freq: 220,
        freqEnd: 40,
        duration: 2.2,
        gain: 0.2,
        attack: 0.05,
        filter: { type: "lowpass", freq: 1200, freqEnd: 150 },
      },
      {
        wave: "sine",
        freq: 110,
        freqEnd: 30,
        duration: 2.4,
        gain: 0.25,
      },
    ],
  },
  // Cambio de bioma: inmersión (barrido de ruido hacia abajo).
  transition: {
    minInterval: 1,
    layers: [
      {
        wave: "noise",
        freq: 0,
        duration: 1.4,
        gain: 0.2,
        attack: 0.3,
        filter: { type: "lowpass", freq: 2400, freqEnd: 200, q: 2 },
      },
      {
        wave: "sine",
        freq: 160,
        freqEnd: 55,
        duration: 1.4,
        gain: 0.15,
        attack: 0.2,
      },
    ],
  },
  // Zona limpia: fanfarria corta.
  zoneClear: {
    minInterval: 1,
    layers: [0, 4, 7, 12].map((step, i) => ({
      wave: "triangle" as const,
      freq: transpose(392, step),
      duration: i === 3 ? 0.7 : 0.25,
      delay: i * 0.11,
      gain: 0.15,
    })),
  },
  // Poco tiempo: dos pitidos.
  timeLow: {
    minInterval: 2,
    layers: [
      { wave: "square", freq: 880, duration: 0.08, gain: 0.07 },
      { wave: "square", freq: 880, duration: 0.08, delay: 0.16, gain: 0.07 },
    ],
  },
  uiMove: {
    minInterval: 0.03,
    layers: [{ wave: "sine", freq: 1200, duration: 0.04, gain: 0.05 }],
  },
  uiSelect: {
    minInterval: 0.06,
    layers: [
      { wave: "triangle", freq: 880, duration: 0.06, gain: 0.1 },
      { wave: "triangle", freq: 1320, duration: 0.08, delay: 0.04, gain: 0.08 },
    ],
  },
  // La rémora absorbe un golpe.
  shield: {
    minInterval: 0.3,
    layers: [
      {
        wave: "triangle",
        freq: 1046.5,
        freqEnd: 523.25,
        duration: 0.3,
        gain: 0.14,
      },
    ],
  },
  summary: {
    minInterval: 1,
    layers: [0, 7, 12].map((step, i) => ({
      wave: "sine" as const,
      freq: transpose(261.63, step),
      duration: 1,
      delay: i * 0.15,
      gain: 0.12,
      attack: 0.05,
    })),
  },
}

/** Duración total de un efecto (la capa que más tarda en terminar). */
export function recipeDuration(recipe: SfxRecipe): number {
  return recipe.layers.reduce(
    (max, layer) => Math.max(max, (layer.delay ?? 0) + layer.duration),
    0,
  )
}

/**
 * Limita la repetición de cada efecto: recoger diez desechos en el mismo frame
 * no debe sonar diez veces superpuesto.
 */
export class SfxLimiter {
  private readonly lastPlayed = new Map<SfxId, number>()

  /** `true` si el efecto puede sonar en `now` (y lo apunta como sonado). */
  public tryPlay(id: SfxId, now: number): boolean {
    const last = this.lastPlayed.get(id)
    if (last !== undefined && now - last < SFX[id].minInterval) return false
    this.lastPlayed.set(id, now)
    return true
  }

  public reset(): void {
    this.lastPlayed.clear()
  }
}

/** Escala pentatónica (semitonos) por la que sube una racha de recogidas. */
export const COLLECT_STREAK_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19] as const
/** Segundos sin recoger tras los que la racha vuelve a la nota base. */
export const COLLECT_STREAK_WINDOW = 1.2

/**
 * Racha de recogidas: cada desecho recogido poco después del anterior suena
 * una nota más aguda (pentatónica, para que siempre suene bien).
 */
export class CollectStreak {
  private count = 0
  private lastAt = Number.NEGATIVE_INFINITY

  /** Semitonos del desecho recogido en `time` (segundos de la run). */
  public next(time: number): number {
    this.count =
      time - this.lastAt <= COLLECT_STREAK_WINDOW ? this.count + 1 : 0
    this.lastAt = time
    const steps = COLLECT_STREAK_STEPS
    return steps[Math.min(this.count, steps.length - 1)]
  }

  public reset(): void {
    this.count = 0
    this.lastAt = Number.NEGATIVE_INFINITY
  }
}

/**
 * Volumen del ajuste (0..1, lineal en el slider) a ganancia. Curva cuadrática:
 * el oído percibe el volumen de forma logarítmica y así la mitad del slider
 * suena a "la mitad".
 */
export function volumeToGain(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0
  const v = Math.min(1, volume)
  return v * v
}
