// src/core/audio/music.ts
// Música generativa en clave de synthwave: empieza muy alegre en la superficie
// y se va volviendo darkwave a medida que se baja. Pads amplios con reverb, un arpegio constante en semicorcheas,
// bajo pulsando en corcheas y caja con reverb cortada de los 80. Con la
// tensión entran la caja, el charles y una melodía protagonista. Cada bioma tiene su
// "ánimo" (tónica, modo, tempo, brillo): cuanto más hondo, más grave, más
// lento y más oscuro. Este módulo solo decide las notas (lógica pura); el
// AudioManager las hace sonar.

import type { BiomeKey } from "@core/types"
import type { Rng } from "@core/rng"
import { transpose } from "@core/audio/sfxRecipes"

export interface MusicMood {
  /** Tónica en Hz (octava del pad). */
  root: number
  /** Intervalos del modo en semitonos desde la tónica (7 notas). */
  scale: readonly number[]
  /** Duración de cada semicorchea en segundos (≈ 84-116 BPM). */
  stepSeconds: number
  /** Corte máximo del filtro del pad en Hz: más bajo, más oscuro. */
  brightness: number
  /** Probabilidad base de que un tiempo tenga nota de la melodía. */
  density: number
  /** Grados (0-based) de la progresión de acordes que se repite. */
  progression: readonly number[]
}

/** Modos ordenados de más luminoso a más oscuro. */
export const MODES = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
} as const

/** Semicorcheas por compás (4/4). */
export const STEPS_PER_BAR = 16
/** Compases de una frase: el pad se va abriendo a lo largo de ella. */
export const PHRASE_BARS = 4

/** Semicorchea en segundos a un tempo dado. */
const step = (bpm: number): number => 60 / bpm / 4

// De la superficie al fondo el modo se oscurece paso a paso: lidio (muy
// alegre) → jónico (mayor) → mixolidio → dórico → eólico (menor) → frigio →
// locrio (el más tenso). A la vez bajan la tónica, el tempo y el brillo.
export const BIOME_MOODS: Record<BiomeKey, MusicMood> = {
  epipelagic_upper: {
    root: 261.63, // Do4
    scale: MODES.lydian,
    stepSeconds: step(116),
    brightness: 3600,
    density: 0.55,
    progression: [0, 1, 4, 5], // I–II–V–vi
  },
  pelagic_mid: {
    root: 246.94, // Si3
    scale: MODES.ionian,
    stepSeconds: step(114),
    brightness: 3300,
    density: 0.52,
    progression: [0, 4, 5, 3], // I–V–vi–IV
  },
  subphotic: {
    root: 220, // La3
    scale: MODES.ionian,
    stepSeconds: step(112),
    brightness: 3000,
    density: 0.5,
    progression: [0, 3, 4, 5], // I–IV–V–vi
  },
  mesopelagic_upper: {
    root: 207.65, // Sol#3
    scale: MODES.mixolydian,
    stepSeconds: step(108),
    brightness: 2700,
    density: 0.47,
    progression: [0, 6, 3, 0], // I–bVII–IV–I
  },
  mesopelagic_deep: {
    root: 196, // Sol3
    scale: MODES.dorian,
    stepSeconds: step(104),
    brightness: 2400,
    density: 0.44,
    progression: [0, 3, 0, 6], // i–IV–i–bVII
  },
  bathypelagic_upper: {
    root: 185, // Fa#3
    scale: MODES.dorian,
    stepSeconds: step(100),
    brightness: 2100,
    density: 0.41,
    progression: [0, 5, 2, 6],
  },
  bathypelagic_deep: {
    root: 174.61, // Fa3
    scale: MODES.aeolian,
    stepSeconds: step(96),
    brightness: 1800,
    density: 0.38,
    progression: [0, 5, 2, 6], // i–VI–III–VII
  },
  abyssopelagic: {
    root: 164.81, // Mi3
    scale: MODES.aeolian,
    stepSeconds: step(92),
    brightness: 1500,
    density: 0.35,
    progression: [0, 3, 5, 4], // i–iv–VI–v
  },
  hadopelagic: {
    root: 146.83, // Re3
    scale: MODES.phrygian,
    stepSeconds: step(88),
    brightness: 1250,
    density: 0.32,
    progression: [0, 1, 5, 6],
  },
  deepSea: {
    root: 130.81, // Do3
    scale: MODES.locrian,
    stepSeconds: step(84),
    brightness: 1000,
    density: 0.3,
    progression: [0, 1, 5, 0],
  },
}

/** Ánimo del menú principal: el del primer bioma, algo más relajado. */
export const HUB_MOOD: MusicMood = {
  ...BIOME_MOODS.epipelagic_upper,
  stepSeconds: step(104),
}

/** Frecuencia de un grado del modo (admite grados negativos o > 6). */
export function degreeFrequency(mood: MusicMood, degree: number): number {
  const size = mood.scale.length
  const octave = Math.floor(degree / size)
  const index = ((degree % size) + size) % size
  return transpose(mood.root, mood.scale[index] + octave * 12)
}

export interface MusicBar {
  /** Acorde del pad: tríada más la novena (suena más abierto y triste). */
  chord: number[]
  /** Arpegio en semicorcheas sobre el acorde (frecuencia o `null`). */
  arp: (number | null)[]
  /** Bajo en corcheas (frecuencia o `null`). */
  bass: (number | null)[]
  /** Melodía: frecuencia o `null`; cada nota dura hasta la siguiente. */
  lead: (number | null)[]
  /** Bombo en el 1 y el 3 (y un golpe extra con tensión). */
  kick: boolean[]
  /** Caja con reverb cortada en el 2 y el 4. */
  snare: boolean[]
  /** Charles cerrado (corcheas o semicorcheas). */
  hat: boolean[]
  /** Apertura del filtro del pad en este compás (0..1). */
  filter: number
}

/**
 * Figuras del arpegio: índices sobre las notas del acorde extendido a dos
 * octavas (0-3 primera octava, 4-7 segunda).
 */
const ARP_FIGURES: readonly (readonly number[])[] = [
  [0, 1, 2, 4, 2, 1, 0, 1, 0, 1, 2, 4, 5, 4, 2, 1],
  [0, 2, 4, 2, 1, 2, 4, 6, 0, 2, 4, 2, 1, 2, 5, 4],
  [4, 2, 1, 0, 4, 2, 1, 0, 5, 4, 2, 1, 4, 2, 1, 2],
  [0, 4, 1, 4, 2, 4, 1, 4, 0, 4, 1, 4, 2, 5, 1, 4],
]

const steps = <T>(fill: (i: number) => T): T[] =>
  Array.from({ length: STEPS_PER_BAR }, (_, i) => fill(i))

/**
 * Inventa un compás. `intensity` (0..1) sale de la toxicidad y la prisa: con
 * calma suenan pad, arpegio, bajo y bombo; al subir entran la melodía y la
 * caja, luego el charles en corcheas y, al máximo, en semicorcheas. El pad se
 * abre con la tensión y a lo largo de cada frase de 4 compases.
 */
export function composeBar(
  rng: Rng,
  mood: MusicMood,
  barIndex: number,
  intensity: number,
): MusicBar {
  const level = Math.min(1, Math.max(0, intensity))
  const degree = mood.progression[barIndex % mood.progression.length]
  const chord = [0, 2, 4, 8].map((offset) =>
    degreeFrequency(mood, degree + offset),
  )

  // Arpegio una octava por encima del pad, en dos octavas.
  const arpTones = [
    ...chord.slice(0, 3).map((freq) => freq * 2),
    chord[3] * 2,
    ...chord.slice(0, 3).map((freq) => freq * 4),
    chord[3] * 4,
  ]
  const figure = rng.pick(ARP_FIGURES)
  const arp = steps((i) => arpTones[figure[i]])

  // Bajo pulsando en corcheas; en el último tiempo puede saltar a la quinta.
  const bassRoot = degreeFrequency(mood, degree - 14)
  const bassFifth = degreeFrequency(mood, degree - 10)
  const fifthTail = rng.next() < 0.5
  const bass = steps((i) =>
    i % 2 === 1 ? null : fifthTail && i >= 12 ? bassFifth : bassRoot,
  )

  // Melodía protagonista: notas largas en el 1 y el 3 que saltan entre notas
  // del acorde a lo largo de dos octavas (con la sexta como nota de paso).
  // Con mucha tensión también ataca en el 2 y el 4.
  const melodyOn = level >= 0.3
  const leadTones = [0, 2, 4, 7, 9, 11, 5].map((offset) =>
    degreeFrequency(mood, degree + offset + 7),
  )
  const lead = steps((i) => {
    if (!melodyOn) return null
    const strong = i === 0 || i === 8
    const weak = level >= 0.7 && (i === 4 || i === 12)
    if (!strong && !weak) return null
    const chance = i === 0 ? 0.95 : strong ? mood.density + 0.3 : mood.density
    if (rng.next() >= chance) return null
    return rng.next() < 0.85 ? leadTones[rng.int(6)] : leadTones[6]
  })

  const phrase = (barIndex % PHRASE_BARS) / (PHRASE_BARS - 1)
  const filter = Math.min(1, 0.35 + level * 0.45 + phrase * 0.2)

  return {
    chord,
    arp,
    bass,
    lead,
    kick: steps((i) => i === 0 || i === 8 || (level >= 0.25 && i === 10)),
    snare: steps((i) => level >= 0.25 && (i === 4 || i === 12)),
    hat: steps((i) => level >= 0.75 || (level >= 0.5 && i % 2 === 0)),
    filter,
  }
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
