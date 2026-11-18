import { describe, expect, it } from "vitest"
import {
  COLLECT_STREAK_STEPS,
  COLLECT_STREAK_WINDOW,
  CollectStreak,
  SFX,
  SfxLimiter,
  recipeDuration,
  transpose,
  volumeToGain,
  type SfxId,
} from "@core/audio/sfxRecipes"
import {
  BIOME_MOODS,
  HUB_MOOD,
  MODES,
  PHRASE_BARS,
  STEPS_PER_BAR,
  composeBar,
  degreeFrequency,
  musicIntensity,
} from "@core/audio/music"
import { AudioManager } from "@core/audio/AudioManager"
import { BIOMES, type BiomeKey } from "@core/types"
import { Rng } from "@core/rng"

describe("recetas de efectos", () => {
  it("todas las capas son audibles, cortas y con volumen sensato", () => {
    for (const [id, recipe] of Object.entries(SFX)) {
      expect(recipe.layers.length, id).toBeGreaterThan(0)
      expect(recipe.minInterval, id).toBeGreaterThan(0)
      expect(recipeDuration(recipe), id).toBeLessThanOrEqual(3)
      for (const layer of recipe.layers) {
        expect(layer.duration, id).toBeGreaterThan(0)
        expect(layer.gain, id).toBeGreaterThan(0)
        expect(layer.gain, id).toBeLessThanOrEqual(0.4)
        if (layer.wave !== "noise") expect(layer.freq, id).toBeGreaterThan(20)
        if (layer.freqEnd !== undefined) {
          expect(layer.freqEnd, id).toBeGreaterThan(0)
        }
      }
    }
  })

  it("transpose sube una octava con 12 semitonos", () => {
    expect(transpose(440, 12)).toBeCloseTo(880)
    expect(transpose(440, -12)).toBeCloseTo(220)
  })

  it("recipeDuration cuenta el retardo de las capas", () => {
    expect(
      recipeDuration({
        minInterval: 0.1,
        layers: [
          { wave: "sine", freq: 100, duration: 0.2, gain: 0.1 },
          { wave: "sine", freq: 100, duration: 0.3, delay: 0.5, gain: 0.1 },
        ],
      }),
    ).toBeCloseTo(0.8)
  })
})

describe("SfxLimiter", () => {
  it("no deja repetir un efecto antes de su intervalo mínimo", () => {
    const limiter = new SfxLimiter()
    const id: SfxId = "collect"
    expect(limiter.tryPlay(id, 1)).toBe(true)
    expect(limiter.tryPlay(id, 1 + SFX.collect.minInterval / 2)).toBe(false)
    expect(limiter.tryPlay(id, 1.001 + SFX.collect.minInterval)).toBe(true)
  })

  it("cada efecto lleva su propia cuenta y reset la borra", () => {
    const limiter = new SfxLimiter()
    expect(limiter.tryPlay("collect", 0)).toBe(true)
    expect(limiter.tryPlay("dash", 0)).toBe(true)
    expect(limiter.tryPlay("dash", 0.01)).toBe(false)
    limiter.reset()
    expect(limiter.tryPlay("dash", 0.01)).toBe(true)
  })
})

describe("CollectStreak", () => {
  it("sube por la pentatónica mientras se recoge seguido", () => {
    const streak = new CollectStreak()
    expect(streak.next(0)).toBe(0)
    expect(streak.next(0.5)).toBe(COLLECT_STREAK_STEPS[1])
    expect(streak.next(1)).toBe(COLLECT_STREAK_STEPS[2])
  })

  it("se queda en la nota más alta y vuelve a la base tras una pausa", () => {
    const streak = new CollectStreak()
    let pitch = 0
    for (let i = 0; i < 30; i++) pitch = streak.next(i * 0.1)
    expect(pitch).toBe(COLLECT_STREAK_STEPS[COLLECT_STREAK_STEPS.length - 1])
    expect(streak.next(3 + COLLECT_STREAK_WINDOW + 0.1)).toBe(0)
  })

  it("reset empieza de nuevo", () => {
    const streak = new CollectStreak()
    streak.next(0)
    streak.next(0.1)
    streak.reset()
    expect(streak.next(0.2)).toBe(0)
  })
})

describe("volumeToGain", () => {
  it("es cuadrática y está acotada", () => {
    expect(volumeToGain(0)).toBe(0)
    expect(volumeToGain(0.5)).toBeCloseTo(0.25)
    expect(volumeToGain(1)).toBe(1)
    expect(volumeToGain(2)).toBe(1)
    expect(volumeToGain(-1)).toBe(0)
    expect(volumeToGain(Number.NaN)).toBe(0)
  })
})

describe("música", () => {
  const keys = Object.keys(BIOMES) as BiomeKey[]

  it("hay un ánimo para cada bioma, más grave y lento cuanto más hondo", () => {
    const byDepth = [...keys].sort((a, b) => BIOMES[a].depth - BIOMES[b].depth)
    for (let i = 1; i < byDepth.length; i++) {
      const shallow = BIOME_MOODS[byDepth[i - 1]]
      const deep = BIOME_MOODS[byDepth[i]]
      expect(deep.root).toBeLessThan(shallow.root)
      expect(deep.stepSeconds).toBeGreaterThan(shallow.stepSeconds)
      expect(deep.brightness).toBeLessThan(shallow.brightness)
    }
    for (const key of keys) {
      expect(BIOME_MOODS[key].scale).toHaveLength(7)
    }
  })

  it("degreeFrequency recorre octavas", () => {
    const mood = HUB_MOOD
    expect(degreeFrequency(mood, 0)).toBeCloseTo(mood.root)
    expect(degreeFrequency(mood, 7)).toBeCloseTo(mood.root * 2)
    expect(degreeFrequency(mood, -7)).toBeCloseTo(mood.root / 2)
  })

  it("el tempo va de 116 BPM en la superficie a 84 en el fondo", () => {
    for (const key of keys) {
      const bpm = 60 / BIOME_MOODS[key].stepSeconds / 4
      expect(bpm).toBeGreaterThanOrEqual(83.9)
      expect(bpm).toBeLessThanOrEqual(116.1)
    }
  })

  it("empieza en mayor y el modo se oscurece con la profundidad", () => {
    const byDepth = [...keys].sort((a, b) => BIOMES[a].depth - BIOMES[b].depth)
    // Suma de los intervalos del modo: cuanto menor, más oscuro.
    const light = (key: BiomeKey): number =>
      BIOME_MOODS[key].scale.reduce((sum, semis) => sum + semis, 0)
    for (let i = 1; i < byDepth.length; i++) {
      expect(light(byDepth[i])).toBeLessThanOrEqual(light(byDepth[i - 1]))
    }
    expect(BIOME_MOODS[byDepth[0]].scale).toEqual(MODES.lydian)
    expect(BIOME_MOODS[byDepth[byDepth.length - 1]].scale).toEqual(
      MODES.locrian,
    )
    // Tercera mayor en el menú y en la superficie.
    expect(HUB_MOOD.scale[2]).toBe(4)
  })

  const hits = (track: boolean[]): number[] =>
    track.map((hit, i) => (hit ? i : -1)).filter((i) => i >= 0)

  it("composeBar da 16 semicorcheas con arpegio continuo y bajo en corcheas", () => {
    const bar = composeBar(new Rng(1), BIOME_MOODS.subphotic, 0, 0)
    expect(bar.chord).toHaveLength(4)
    for (const track of [
      bar.arp,
      bar.bass,
      bar.lead,
      bar.kick,
      bar.snare,
      bar.hat,
    ]) {
      expect(track).toHaveLength(STEPS_PER_BAR)
    }
    // El arpegio no para y va por encima del pad.
    for (const note of bar.arp) {
      expect(note).not.toBeNull()
      expect(note!).toBeGreaterThan(bar.chord[0])
    }
    // El bajo pulsa en corcheas, por debajo del pad.
    bar.bass.forEach((note, i) => {
      if (i % 2 === 1) expect(note).toBeNull()
      else expect(note!).toBeLessThan(bar.chord[0])
    })
  })

  it("con calma: pad, arpegio, bajo y bombo, sin caja, charles ni melodía", () => {
    const bar = composeBar(new Rng(3), BIOME_MOODS.deepSea, 0, 0)
    expect(hits(bar.kick)).toEqual([0, 8])
    expect(bar.snare.some(Boolean)).toBe(false)
    expect(bar.hat.some(Boolean)).toBe(false)
    expect(bar.lead.some((note) => note !== null)).toBe(false)
    expect(bar.filter).toBeLessThan(0.5)
  })

  it("con tensión media entran la melodía y la caja en 2 y 4", () => {
    const bar = composeBar(new Rng(3), BIOME_MOODS.deepSea, 0, 0.4)
    expect(hits(bar.snare)).toEqual([4, 12])
    expect(bar.hat.some(Boolean)).toBe(false)
    let notes = 0
    for (let i = 0; i < 50; i++) {
      const lead = composeBar(new Rng(i), BIOME_MOODS.deepSea, i, 0.4).lead
      notes += lead.filter((note) => note !== null).length
      // Notas largas: solo en el 1 y el 3.
      lead.forEach((note, step) => {
        if (step !== 0 && step !== 8) expect(note).toBeNull()
      })
    }
    expect(notes).toBeGreaterThan(0)
  })

  it("al máximo: charles en semicorcheas y melodía también en 2 y 4", () => {
    const bar = composeBar(new Rng(3), BIOME_MOODS.deepSea, 0, 1)
    expect(hits(bar.kick)).toEqual([0, 8, 10])
    expect(hits(bar.hat)).toHaveLength(STEPS_PER_BAR)
    const onsets = new Set<number>()
    for (let i = 0; i < 100; i++) {
      composeBar(new Rng(i), BIOME_MOODS.deepSea, i, 1).lead.forEach(
        (note, step) => {
          if (note !== null) onsets.add(step)
        },
      )
    }
    expect([...onsets].sort((a, b) => a - b)).toEqual([0, 4, 8, 12])
  })

  it("el filtro se abre con la intensidad y a lo largo de la frase", () => {
    const mood = BIOME_MOODS.subphotic
    const filter = (bar: number, level: number): number =>
      composeBar(new Rng(1), mood, bar, level).filter
    expect(filter(0, 1)).toBeGreaterThan(filter(0, 0))
    expect(filter(PHRASE_BARS - 1, 0)).toBeGreaterThan(filter(0, 0))
    expect(filter(PHRASE_BARS - 1, 1)).toBeLessThanOrEqual(1)
  })

  it("composeBar es determinista con la misma semilla", () => {
    const mood = BIOME_MOODS.abyssopelagic
    expect(composeBar(new Rng(7), mood, 3, 0.5)).toEqual(
      composeBar(new Rng(7), mood, 3, 0.5),
    )
  })

  it("musicIntensity combina toxicidad y prisa del último cuarto", () => {
    expect(musicIntensity(0, 1)).toBe(0)
    expect(musicIntensity(0, 0.5)).toBe(0)
    expect(musicIntensity(50, 1)).toBeCloseTo(0.4)
    expect(musicIntensity(0, 0)).toBeCloseTo(0.5)
    expect(musicIntensity(100, 0)).toBe(1)
    expect(musicIntensity(-20, 2)).toBe(0)
  })
})

describe("AudioManager sin Web Audio", () => {
  it("todas las llamadas son no-ops seguros", () => {
    const audio = new AudioManager({ musicVolume: 0.5, sfxVolume: 0.5 })
    expect(audio.supported).toBe(false)
    expect(() => {
      audio.unlock()
      audio.play("collect")
      audio.setMood(BIOME_MOODS.subphotic)
      audio.setIntensity(0.7)
      audio.setDucked(true)
      audio.setVolumes(0, 1)
      audio.setSuspended(true)
      audio.dispose()
    }).not.toThrow()
  })
})
