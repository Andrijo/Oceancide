// src/core/audio/AudioManager.ts
// Sonido del juego con Web Audio: efectos sintetizados (sfxRecipes) y música
// generativa por bioma (music). No hay archivos de audio que cargar.
//
// Los navegadores no dejan sonar nada hasta el primer gesto del jugador: el
// contexto se crea (o se reanuda) en `unlock()`, que se llama desde el primer
// toque, clic o tecla. Hasta entonces, todo es un no-op silencioso.

import { Rng, randomSeed } from "@core/rng"
import {
  SFX,
  SfxLimiter,
  volumeToGain,
  type SfxId,
  type SfxLayer,
} from "@core/audio/sfxRecipes"
import {
  STEPS_PER_BAR,
  composeBar,
  type MusicBar,
  type MusicMood,
} from "@core/audio/music"

/** Ganancia de la música respecto a los efectos (la música va de fondo). */
const MUSIC_LEVEL = 0.45
/** Cuánto se anticipa la programación de la música, en segundos. */
const SCHEDULE_AHEAD = 0.4
const SCHEDULER_INTERVAL_MS = 60
/** Corte del filtro de la música con la partida en pausa (suena "lejos"). */
const DUCK_CUTOFF = 420
const DUCK_GAIN = 0.55
const RAMP = 0.25

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export interface PlayOptions {
  /** Desplazamiento de tono en semitonos (p. ej. para encadenar recogidas). */
  pitch?: number
  /** Multiplicador del volumen de este disparo (0..1). */
  volume?: number
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  /** Filtro de toda la música: se cierra en pausa. */
  private musicDuck: BiquadFilterNode | null = null
  /** Filtro del pad: su corte sigue el brillo del bioma y la intensidad. */
  private padFilter: BiquadFilterNode | null = null
  /** Eco de la melodía (suena a agua). */
  private melodyBus: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private readonly limiter = new SfxLimiter()
  private musicVolume: number
  private sfxVolume: number
  private ducked = false

  private mood: MusicMood | null = null
  private intensity = 0
  private readonly rng = new Rng(randomSeed())
  private barIndex = 0
  private nextBarTime = 0
  private schedulerId: ReturnType<typeof setInterval> | null = null

  constructor(volumes: { musicVolume: number; sfxVolume: number }) {
    this.musicVolume = volumes.musicVolume
    this.sfxVolume = volumes.sfxVolume
  }

  /** `true` si el navegador permite crear el contexto de audio. */
  public get supported(): boolean {
    return audioContextCtor() !== null
  }

  /**
   * Crea el contexto o lo reanuda. Debe llamarse desde un gesto del jugador
   * (pointerdown, keydown); fuera de uno, el navegador lo deja suspendido.
   */
  public unlock(): void {
    if (!this.ctx) this.createGraph()
    const ctx = this.ctx
    if (ctx && ctx.state === "suspended" && !this.isHidden()) {
      void ctx.resume().catch(() => undefined)
    }
  }

  /** Suspende o reanuda todo el audio (pestaña oculta). */
  public setSuspended(suspended: boolean): void {
    const ctx = this.ctx
    if (!ctx) return
    if (suspended && ctx.state === "running") {
      void ctx.suspend().catch(() => undefined)
    } else if (!suspended && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined)
    }
  }

  public setVolumes(musicVolume: number, sfxVolume: number): void {
    this.musicVolume = musicVolume
    this.sfxVolume = sfxVolume
    const ctx = this.ctx
    if (!ctx) return
    this.sfxBus?.gain.setTargetAtTime(
      volumeToGain(sfxVolume),
      ctx.currentTime,
      0.05,
    )
    this.musicBus?.gain.setTargetAtTime(this.musicGain(), ctx.currentTime, 0.05)
  }

  /**
   * Música que debe sonar (`null` = silencio). El cambio entra en el siguiente
   * compás para no cortar notas.
   */
  public setMood(mood: MusicMood | null): void {
    if (mood === this.mood) return
    const starting = this.mood === null
    this.mood = mood
    if (starting) this.barIndex = 0
    this.updatePadFilter()
  }

  /** Tensión de la música (0..1): densidad de la melodía y brillo del pad. */
  public setIntensity(intensity: number): void {
    const next = Math.min(1, Math.max(0, intensity))
    if (Math.abs(next - this.intensity) < 0.02) return
    this.intensity = next
    this.updatePadFilter()
  }

  /** Con la partida en pausa la música se oye amortiguada. */
  public setDucked(ducked: boolean): void {
    if (ducked === this.ducked) return
    this.ducked = ducked
    const ctx = this.ctx
    if (!ctx || !this.musicDuck || !this.musicBus) return
    this.musicDuck.frequency.setTargetAtTime(
      ducked ? DUCK_CUTOFF : 20000,
      ctx.currentTime,
      RAMP,
    )
    this.musicBus.gain.setTargetAtTime(this.musicGain(), ctx.currentTime, RAMP)
  }

  /** Dispara un efecto. Se ignora si suena demasiado seguido o sin audio. */
  public play(id: SfxId, options: PlayOptions = {}): void {
    const ctx = this.ctx
    const bus = this.sfxBus
    if (!ctx || !bus || ctx.state !== "running") return
    if (this.sfxVolume <= 0) return
    if (!this.limiter.tryPlay(id, ctx.currentTime)) return

    const recipe = SFX[id]
    const jitter = recipe.pitchJitter
      ? (Math.random() * 2 - 1) * recipe.pitchJitter
      : 0
    const ratio = Math.pow(2, ((options.pitch ?? 0) + jitter) / 12)
    const volume = Math.min(1, Math.max(0, options.volume ?? 1))
    const now = ctx.currentTime + 0.01
    for (const layer of recipe.layers) {
      this.playLayer(ctx, bus, layer, now, ratio, volume)
    }
  }

  public dispose(): void {
    if (this.schedulerId !== null) clearInterval(this.schedulerId)
    this.schedulerId = null
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
  }

  // --- Montaje ---

  private createGraph(): void {
    const Ctor = audioContextCtor()
    if (!Ctor) return
    let ctx: AudioContext
    try {
      ctx = new Ctor()
    } catch (error) {
      console.warn("[AudioManager] Sin audio", error)
      return
    }
    this.ctx = ctx

    const master = ctx.createDynamicsCompressor()
    master.threshold.value = -12
    master.ratio.value = 4
    master.connect(ctx.destination)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = volumeToGain(this.sfxVolume)
    this.sfxBus.connect(master)

    this.musicDuck = ctx.createBiquadFilter()
    this.musicDuck.type = "lowpass"
    this.musicDuck.frequency.value = this.ducked ? DUCK_CUTOFF : 20000
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicGain()
    this.musicDuck.connect(this.musicBus)
    this.musicBus.connect(master)

    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = "lowpass"
    this.padFilter.Q.value = 0.8
    this.padFilter.connect(this.musicDuck)
    this.updatePadFilter()

    // Melodía con eco: la señal seca y una copia retardada que se realimenta.
    this.melodyBus = ctx.createGain()
    this.melodyBus.connect(this.musicDuck)
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.39
    const feedback = ctx.createGain()
    feedback.gain.value = 0.38
    const echoTone = ctx.createBiquadFilter()
    echoTone.type = "lowpass"
    echoTone.frequency.value = 1800
    this.melodyBus.connect(delay)
    delay.connect(echoTone)
    echoTone.connect(feedback)
    feedback.connect(delay)
    echoTone.connect(this.musicDuck)

    this.noiseBuffer = this.createNoise(ctx)
    this.nextBarTime = ctx.currentTime + 0.1
    this.schedulerId = setInterval(
      () => this.scheduleMusic(),
      SCHEDULER_INTERVAL_MS,
    )
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private musicGain(): number {
    return (
      volumeToGain(this.musicVolume) *
      MUSIC_LEVEL *
      (this.ducked ? DUCK_GAIN : 1)
    )
  }

  private isHidden(): boolean {
    return typeof document !== "undefined" && document.hidden
  }

  private updatePadFilter(): void {
    const ctx = this.ctx
    if (!ctx || !this.padFilter || !this.mood) return
    const cutoff = this.mood.brightness * (0.75 + this.intensity * 0.9)
    this.padFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.8)
  }

  // --- Efectos ---

  private playLayer(
    ctx: AudioContext,
    bus: AudioNode,
    layer: SfxLayer,
    start: number,
    pitchRatio: number,
    volume: number,
  ): void {
    const t0 = start + (layer.delay ?? 0)
    const t1 = t0 + layer.duration
    const attack = Math.min(layer.attack ?? 0.005, layer.duration * 0.5)

    let source: AudioScheduledSourceNode
    if (layer.wave === "noise") {
      if (!this.noiseBuffer) return
      const noise = ctx.createBufferSource()
      noise.buffer = this.noiseBuffer
      noise.loop = true
      source = noise
    } else {
      const osc = ctx.createOscillator()
      osc.type = layer.wave
      osc.frequency.setValueAtTime(layer.freq * pitchRatio, t0)
      if (layer.freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, layer.freqEnd * pitchRatio),
          t1,
        )
      }
      source = osc
    }

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, t0)
    envelope.gain.linearRampToValueAtTime(layer.gain * volume, t0 + attack)
    envelope.gain.exponentialRampToValueAtTime(0.0001, t1)

    let tail: AudioNode = source
    if (layer.filter) {
      const filter = ctx.createBiquadFilter()
      filter.type = layer.filter.type
      filter.Q.value = layer.filter.q ?? 1
      filter.frequency.setValueAtTime(layer.filter.freq * pitchRatio, t0)
      if (layer.filter.freqEnd !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(1, layer.filter.freqEnd * pitchRatio),
          t1,
        )
      }
      source.connect(filter)
      tail = filter
    }
    tail.connect(envelope)
    envelope.connect(bus)

    source.start(t0)
    source.stop(t1 + 0.05)
    source.onended = () => envelope.disconnect()
  }

  // --- Música ---

  private scheduleMusic(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== "running") return
    const mood = this.mood
    if (!mood) return

    // Tras una suspensión, el reloj ha seguido: se retoma desde ahora.
    if (this.nextBarTime < ctx.currentTime) {
      this.nextBarTime = ctx.currentTime + 0.05
    }
    while (this.nextBarTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const bar = composeBar(this.rng, mood, this.barIndex, this.intensity)
      this.scheduleBar(ctx, mood, bar, this.nextBarTime)
      this.barIndex++
      this.nextBarTime += mood.stepSeconds * STEPS_PER_BAR
    }
  }

  private scheduleBar(
    ctx: AudioContext,
    mood: MusicMood,
    bar: MusicBar,
    start: number,
  ): void {
    if (!this.padFilter || !this.melodyBus || !this.musicDuck) return
    const barSeconds = mood.stepSeconds * STEPS_PER_BAR
    const end = start + barSeconds

    // Pad: cada nota con dos sierras desafinadas, entrada y salida lentas
    // que se solapan con el compás siguiente.
    for (const freq of bar.chord) {
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, start)
      env.gain.linearRampToValueAtTime(0.05, start + barSeconds * 0.35)
      env.gain.linearRampToValueAtTime(0.04, end)
      env.gain.exponentialRampToValueAtTime(0.0001, end + barSeconds * 0.4)
      env.connect(this.padFilter)
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator()
        osc.type = "sawtooth"
        osc.frequency.value = freq
        osc.detune.value = detune
        osc.connect(env)
        osc.start(start)
        osc.stop(end + barSeconds * 0.45)
        osc.onended = () => env.disconnect()
      }
    }

    // Bajo: una nota larga al empezar el compás.
    this.tone(ctx, this.musicDuck, "sine", bar.bass, start, barSeconds, 0.12)

    // Melodía: notas cortas, con eco.
    bar.melody.forEach((freq, step) => {
      if (freq === null) return
      const at = start + step * mood.stepSeconds
      this.tone(ctx, this.melodyBus!, "triangle", freq, at, 0.6, 0.05)
    })

    // Pulso de peligro: un golpe grave en cada tiempo.
    if (bar.pulse) {
      for (let beat = 0; beat < STEPS_PER_BAR; beat += 2) {
        const at = start + beat * mood.stepSeconds
        this.tone(ctx, this.musicDuck, "sine", bar.bass / 2, at, 0.25, 0.2)
      }
    }
  }

  private tone(
    ctx: AudioContext,
    destination: AudioNode,
    type: OscillatorType,
    freq: number,
    start: number,
    duration: number,
    gain: number,
  ): void {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(gain, start + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(env)
    env.connect(destination)
    osc.start(start)
    osc.stop(start + duration + 0.05)
    osc.onended = () => env.disconnect()
  }
}
