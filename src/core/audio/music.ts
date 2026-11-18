// src/core/audio/music.ts
// Música generativa: cada bioma tiene un "ánimo" (tónica, modo, tempo, brillo)
// y la partitura se inventa compás a compás. Cuanto más hondo, más grave, más
// lenta y más oscura. Este módulo solo decide las notas (lógica pura); el
// AudioManager las hace sonar.

import type { BiomeKey } from "@core/types"
import type { Rng } from "@core/rng"
import { transpose } from "@core/audio/sfxRecipes"

export interface MusicMood {
  /** Tónica en Hz (octava del pad). */
  root: number
  /** Intervalos del modo en semitonos desde la tónica (7 notas). */
  scale: readonly number[]
  /** Duración de cada paso (semicorchea) en segundos. */
  stepSeconds: number
  /** Corte del filtro del pad en Hz: más bajo, más oscuro. */
  brightness: number
  /** Probabilidad base de que un paso tenga nota de melodía. */
  density: number
  /** Grados (0-based) de la progresión de acordes que se repite. */
  progression: readonly number[]
}

const MODES = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
} as const

export const STEPS_PER_BAR = 8

export const BIOME_MOODS: Record<BiomeKey, MusicMood> = {
  epipelagic_upper: {
    root: 261.63, // Do4
    scale: MODES.lydian,
    stepSeconds: 0.26,
    brightness: 2600,
    density: 0.42,
    progression: [0, 4, 5, 3],
  },
  pelagic_mid: {
    root: 246.94, // Si3
    scale: MODES.ionian,
    stepSeconds: 0.28,
    brightness: 2200,
    density: 0.38,
    progression: [0, 5, 3, 4],
  },
  subphotic: {
    root: 220, // La3
    scale: MODES.dorian,
    stepSeconds: 0.3,
    brightness: 1800,
    density: 0.34,
    progression: [0, 3, 6, 4],
  },
  mesopelagic_upper: {
    root: 207.65, // Sol#3
    scale: MODES.dorian,
    stepSeconds: 0.32,
    brightness: 1500,
    density: 0.3,
    progression: [0, 6, 3, 4],
  },
  mesopelagic_deep: {
    root: 196, // Sol3
    scale: MODES.aeolian,
    stepSeconds: 0.34,
    brightness: 1250,
    density: 0.28,
    progression: [0, 5, 6, 4],
  },
  bathypelagic_upper: {
    root: 185, // Fa#3
    scale: MODES.aeolian,
    stepSeconds: 0.36,
    brightness: 1050,
    density: 0.25,
    progression: [0, 5, 3, 6],
  },
  bathypelagic_deep: {
    root: 174.61, // Fa3
    scale: MODES.phrygian,
    stepSeconds: 0.38,
    brightness: 900,
    density: 0.22,
    progression: [0, 1, 5, 0],
  },
  abyssopelagic: {
    root: 164.81, // Mi3
    scale: MODES.phrygian,
    stepSeconds: 0.4,
    brightness: 780,
    density: 0.2,
    progression: [0, 1, 6, 5],
  },
  hadopelagic: {
    root: 155.56, // Re#3
    scale: MODES.locrian,
    stepSeconds: 0.42,
    brightness: 680,
    density: 0.18,
    progression: [0, 1, 4, 1],
  },
  deepSea: {
    root: 146.83, // Re3
    scale: MODES.locrian,
    stepSeconds: 0.44,
    brightness: 600,
    density: 0.16,
    progression: [0, 4, 1, 0],
  },
}

/** Ánimo del menú principal: el del primer bioma, algo más lento. */
export const HUB_MOOD: MusicMood = {
  ...BIOME_MOODS.epipelagic_upper,
  stepSeconds: 0.34,
  density: 0.25,
}

/** Frecuencia de un grado del modo (admite grados negativos o > 6). */
export function degreeFrequency(mood: MusicMood, degree: number): number {
  const size = mood.scale.length
  const octave = Math.floor(degree / size)
  const index = ((degree % size) + size) % size
  return transpose(mood.root, mood.scale[index] + octave * 12)
}

export interface MusicBar {
  /** Notas del pad (tríada sobre el grado del compás). */
  chord: number[]
  /** Nota grave al empezar el compás. */
  bass: number
  /** Melodía: una frecuencia o `null` (silencio) por paso. */
  melody: (number | null)[]
  /** Pulso grave en cada tiempo (solo con intensidad alta). */
  pulse: boolean
}

/**
 * Inventa un compás. `intensity` (0..1) sale de la toxicidad y la presión del
 * tiempo: sube la densidad de la melodía y, por encima de 0,6, añade un pulso
 * grave que marca el peligro.
 */
export function composeBar(
  rng: Rng,
  mood: MusicMood,
  barIndex: number,
  intensity: number,
): MusicBar {
  const level = Math.min(1, Math.max(0, intensity))
  const degree = mood.progression[barIndex % mood.progression.length]
  const chord = [0, 2, 4].map((offset) =>
    degreeFrequency(mood, degree + offset),
  )
  const bass = degreeFrequency(mood, degree - 7)

  const density = Math.min(0.85, mood.density + level * 0.35)
  const melody: (number | null)[] = []
  // Paseo aleatorio por el modo, una octava por encima del pad, que tiende a
  // volver a las notas del acorde.
  let current = degree + 7
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    // Los tiempos fuertes suenan más a menudo.
    const strong = step % 4 === 0
    const chance = strong ? density + 0.15 : density * 0.8
    if (rng.next() >= chance) {
      melody.push(null)
      continue
    }
    const move = rng.pick([-2, -1, -1, 0, 1, 1, 2])
    current = Math.min(degree + 11, Math.max(degree + 4, current + move))
    if (strong) {
      // En los tiempos fuertes, encaja en una nota del acorde.
      const fromChord = (((current - degree) % 7) + 7) % 7
      if (fromChord % 2 === 1) current -= 1
    }
    melody.push(degreeFrequency(mood, current))
  }

  return { chord, bass, melody, pulse: level >= 0.6 }
}

/** Fracción de tiempo restante por debajo de la cual la música se acelera. */
export const MUSIC_URGENT_TIME_RATIO = 0.25

/**
 * Intensidad musical a partir del estado de la inmersión (0..1): la toxicidad
 * y, en el último cuarto del tiempo del bioma, la prisa.
 * @param timeLeftRatio Tiempo restante del bioma / tiempo total (0..1).
 */
export function musicIntensity(
  toxicity: number,
  timeLeftRatio: number,
): number {
  const tox = Math.min(1, Math.max(0, toxicity / 100))
  const left = Math.min(1, Math.max(0, timeLeftRatio))
  const urgency =
    left >= MUSIC_URGENT_TIME_RATIO
      ? 0
      : (MUSIC_URGENT_TIME_RATIO - left) / MUSIC_URGENT_TIME_RATIO
  return Math.min(1, tox * 0.8 + urgency * 0.5)
}
