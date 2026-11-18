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
  /** Filtro del pad: se abre con la tensión y a lo largo de cada frase. */
  private padFilter: BiquadFilterNode | null = null
  /** Entrada de la reverb larga (pad, arpegio y melodía). */
  private reverbIn: GainNode | null = null
  /** Entrada de la reverb cortada de la caja (sonido de los 80). */
  private gatedIn: GainNode | null = null
  /** Batería: bombo, caja y charles. */
  private drumBus: GainNode | null = null
  /** Arpegio, con eco sincronizado con el tempo. */
  private melodyBus: GainNode | null = null
  private echoDelay: DelayNode | null = null
  /** Melodía lenta. */
  private leadBus: GainNode | null = null
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
  }

  /**
   * Tensión de la música (0..1): entran charles, palmas y arpegio, y se abre
   * el filtro. Se aplica en el siguiente compás.
   */
  public setIntensity(intensity: number): void {
    this.intensity = Math.min(1, Math.max(0, intensity))
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

    // Reverb larga y reverb cortada (respuestas al impulso generadas).
    const reverb = ctx.createConvolver()
    reverb.buffer = this.createImpulse(ctx, 3.2, 0)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.55
    this.reverbIn = ctx.createGain()
    this.reverbIn.connect(reverb)
    reverb.connect(reverbOut)
    reverbOut.connect(this.musicDuck)

    const gated = ctx.createConvolver()
    gated.buffer = this.createImpulse(ctx, 0.32, 0.26)
    const gatedOut = ctx.createGain()
    gatedOut.gain.value = 0.85
    this.gatedIn = ctx.createGain()
    this.gatedIn.connect(gated)
    gated.connect(gatedOut)
    gatedOut.connect(this.musicDuck)

    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = "lowpass"
    this.padFilter.Q.value = 1.2
    this.padFilter.frequency.value = 900
    this.padFilter.connect(this.musicDuck)
    this.padFilter.connect(this.send(ctx, this.reverbIn, 0.8))

    this.drumBus = ctx.createGain()
    this.drumBus.connect(this.musicDuck)

    this.leadBus = ctx.createGain()
    this.leadBus.connect(this.musicDuck)
    this.leadBus.connect(this.send(ctx, this.reverbIn, 0.7))

    // Arpegio con eco: la señal seca y una copia retardada que se realimenta.
    this.melodyBus = ctx.createGain()
    this.melodyBus.connect(this.musicDuck)
    this.melodyBus.connect(this.send(ctx, this.reverbIn, 0.25))
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.39
    this.echoDelay = delay
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

  /** Ganancia intermedia para mandar una señal a una reverb. */
  private send(ctx: AudioContext, target: AudioNode, level: number): GainNode {
    const gain = ctx.createGain()
    gain.gain.value = level
    gain.connect(target)
    return gain
  }

  /**
   * Respuesta al impulso estéreo de ruido. Con `hold` > 0 el ruido se mantiene
   * plano ese tiempo y luego se corta en seco (reverb cortada); si no, decae
   * poco a poco (reverb de sala grande).
   */
  private createImpulse(
    ctx: AudioContext,
    seconds: number,
    hold: number,
  ): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / ctx.sampleRate
        const envelope =
          hold > 0
            ? t < hold
              ? 1 - (t / hold) * 0.3
              : Math.max(0, 1 - (t - hold) / (seconds - hold)) * 0.7
            : Math.pow(1 - i / length, 2.5)
        data[i] = (Math.random() * 2 - 1) * envelope
      }
    }
    return buffer
  }

  private scheduleBar(
    ctx: AudioContext,
    mood: MusicMood,
    bar: MusicBar,
    start: number,
  ): void {
    const { padFilter, drumBus, melodyBus, leadBus, gatedIn } = this
    if (!padFilter || !drumBus || !melodyBus || !leadBus || !gatedIn) return
    const stepSeconds = mood.stepSeconds
    const barSeconds = stepSeconds * STEPS_PER_BAR
    const at = (i: number): number => start + i * stepSeconds

    // El pad se abre o se cierra durante el compás.
    const cutoff = 300 + mood.brightness * bar.filter
    padFilter.frequency.setTargetAtTime(cutoff, start, barSeconds * 0.3)
    // Eco del arpegio a corchea con puntillo del tempo actual.
    this.echoDelay?.delayTime.setValueAtTime(stepSeconds * 3, start)

    for (const freq of bar.chord)
      this.padNote(ctx, padFilter, freq, start, barSeconds)

    for (let i = 0; i < STEPS_PER_BAR; i++) {
      const t = at(i)
      if (bar.kick[i]) this.kick(ctx, drumBus, t)
      if (bar.snare[i]) this.snare(ctx, drumBus, gatedIn, t)
      if (bar.hat[i]) this.hat(ctx, drumBus, t, 0.03, 0.03)

      const bass = bar.bass[i]
      if (bass !== null)
        this.bassNote(ctx, this.musicDuck!, bass, t, stepSeconds * 1.7)

      const arp = bar.arp[i]
      if (arp !== null) {
        this.tone(ctx, melodyBus, "square", arp, t, stepSeconds * 0.9, 0.017)
      }

      const lead = bar.lead[i]
      if (lead !== null) {
        // La nota se sostiene hasta la siguiente (o el final del compás).
        let next = i + 1
        while (next < STEPS_PER_BAR && bar.lead[next] === null) next++
        const tail = next === STEPS_PER_BAR ? 0.3 : 0
        this.leadNote(ctx, leadBus, lead, t, (next - i) * stepSeconds + tail)
      }
    }
  }

  /** Nota del pad: tres sierras desafinadas, entrada lenta y cola larga. */
  private padNote(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    start: number,
    barSeconds: number,
  ): void {
    const end = start + barSeconds
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(0.022, start + barSeconds * 0.25)
    env.gain.setValueAtTime(0.022, end)
    env.gain.exponentialRampToValueAtTime(0.0001, end + barSeconds * 0.5)
    env.connect(destination)
    for (const detune of [-12, 0, 12]) {
      const osc = ctx.createOscillator()
      osc.type = "sawtooth"
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(env)
      osc.start(start)
      osc.stop(end + barSeconds * 0.55)
      osc.onended = () => env.disconnect()
    }
  }

  /** Melodía: dos sierras desafinadas con vibrato suave y entrada lenta. */
  private leadNote(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    t: number,
    duration: number,
  ): void {
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 3200
    filter.Q.value = 2
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(0.048, t + 0.06)
    env.gain.setValueAtTime(0.042, t + duration * 0.7)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    filter.connect(env)
    env.connect(destination)

    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 5
    const depth = ctx.createGain()
    depth.gain.value = 6 // cents
    vibrato.connect(depth)
    vibrato.start(t)
    vibrato.stop(t + duration + 0.05)

    // Dos sierras desafinadas y una cuadrada una octava abajo para dar cuerpo.
    for (const [detune, type, ratio] of [
      [-8, "sawtooth", 1],
      [8, "sawtooth", 1],
      [0, "square", 0.5],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq * ratio
      osc.detune.value = detune
      depth.connect(osc.detune)
      osc.connect(filter)
      osc.start(t)
      osc.stop(t + duration + 0.05)
      osc.onended = () => env.disconnect()
    }
  }

  /** Bombo de caja de ritmos: seno con caída rápida de tono. */
  private kick(ctx: AudioContext, destination: AudioNode, t: number): void {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.7, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
    osc.connect(env)
    env.connect(destination)
    osc.start(t)
    osc.stop(t + 0.4)
    osc.onended = () => env.disconnect()
  }

  /** Ruido filtrado con envolvente corta (caja y charles). */
  private noiseHit(
    ctx: AudioContext,
    destinations: AudioNode[],
    t: number,
    duration: number,
    gain: number,
    type: BiquadFilterType,
    freq: number,
  ): void {
    if (!this.noiseBuffer) return
    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    // Cada golpe empieza en un punto distinto del ruido.
    const offset = Math.random() * (this.noiseBuffer.duration - duration)
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = 1
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    noise.connect(filter)
    filter.connect(env)
    for (const destination of destinations) env.connect(destination)
    noise.start(t, Math.max(0, offset), duration + 0.02)
    noise.onended = () => env.disconnect()
  }

  /** Caja: cuerpo tonal y ruido, con envío a la reverb cortada. */
  private snare(
    ctx: AudioContext,
    destination: AudioNode,
    gated: AudioNode,
    t: number,
  ): void {
    const body = ctx.createOscillator()
    body.type = "triangle"
    body.frequency.setValueAtTime(190, t)
    body.frequency.exponentialRampToValueAtTime(140, t + 0.1)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.24, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    body.connect(env)
    env.connect(destination)
    env.connect(gated)
    body.start(t)
    body.stop(t + 0.15)
    body.onended = () => env.disconnect()
    this.noiseHit(ctx, [destination, gated], t, 0.24, 0.22, "bandpass", 1800)
  }

  private hat(
    ctx: AudioContext,
    destination: AudioNode,
    t: number,
    duration: number,
    gain: number,
  ): void {
    this.noiseHit(ctx, [destination], t, duration, gain, "highpass", 8000)
  }

  /** Bajo: sierra filtrada, pulsante. */
  private bassNote(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    t: number,
    duration: number,
  ): void {
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.value = freq
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.Q.value = 2
    filter.frequency.setValueAtTime(700, t)
    filter.frequency.exponentialRampToValueAtTime(200, t + duration)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(0.11, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(filter)
    filter.connect(env)
    env.connect(destination)
    osc.start(t)
    osc.stop(t + duration + 0.05)
    osc.onended = () => env.disconnect()
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
