// src/BiomeTransition.ts
// Transición entre biomas: una masa negra de borde irregular (con zarcillos) barre la
// pantalla, se mantiene un instante mientras se carga el bioma y se retira.

import { TITLE_FONT } from "@ui/fonts"

type Phase = "idle" | "covering" | "holding" | "revealing"

const COVER_TIME = 0.75 // s que tarda en cubrir la pantalla
const HOLD_TIME = 0.6 // s mínimos totalmente negro (se alarga hasta que termine la carga)
const REVEAL_TIME = 0.95 // s que tarda en retirarse
const SEGMENTS = 72 // puntos del borde (más = contorno más suave)
const AMPLITUDE = 0.3 // irregularidad del borde, como fracción del ancho de pantalla
const MARGIN = 20 // px extra fuera de pantalla

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Perfil irregular del borde [-1, 1]: ondulación + ruido fino + zarcillos; los spikes apuntan hacia spikeSign. */
function makeShape(spikeSign: 1 | -1): Float32Array {
  const shape = new Float32Array(SEGMENTS + 1)

  const coarse: number[] = []
  for (let i = 0; i < 9; i++) coarse.push(Math.random() * 1.2 - 0.6)

  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * (coarse.length - 1)
    const i0 = Math.floor(t)
    const f = t - i0
    const smooth = f * f * (3 - 2 * f)
    const a = coarse[i0]
    const b = coarse[Math.min(i0 + 1, coarse.length - 1)]
    shape[i] = a + (b - a) * smooth + (Math.random() - 0.5) * 0.12
  }

  for (let k = 0; k < 7; k++) {
    const center = Math.floor(Math.random() * (SEGMENTS + 1))
    const height = 0.5 + Math.random() * 0.5
    const half = 2 + Math.floor(Math.random() * 3)
    for (let d = -half; d <= half; d++) {
      const idx = center + d
      if (idx < 0 || idx > SEGMENTS) continue
      shape[idx] += spikeSign * height * (1 - Math.abs(d) / (half + 1))
    }
  }

  for (let i = 0; i <= SEGMENTS; i++) {
    shape[i] = Math.max(-1, Math.min(1, shape[i]))
  }
  return shape
}

export class BiomeTransition {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private phase: Phase = "idle"
  private elapsed = 0
  private time = 0
  private onCovered: (() => void | Promise<void>) | null = null
  private loading = false
  private label: string | null = null
  private coverShape: Float32Array = new Float32Array(0)
  private revealShape: Float32Array = new Float32Array(0)

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 900;
      pointer-events: none;
      display: none;
    `
    this.ctx = this.canvas.getContext("2d")!
    document.getElementById("game-container")!.appendChild(this.canvas)

    this.resize()
    window.addEventListener("resize", () => this.resize())
  }

  /**
   * Inicia la transición; `onCovered` se ejecuta con la pantalla negra. Si
   * devuelve una promesa, el negro se mantiene hasta que se resuelva (con un
   * mínimo de HOLD_TIME). Devuelve false si ya hay una en curso.
   */
  public play(onCovered: () => void | Promise<void>): boolean {
    if (this.phase !== "idle") return false

    this.phase = "covering"
    this.elapsed = 0
    this.time = 0
    this.onCovered = onCovered
    this.loading = false
    this.label = null
    this.coverShape = makeShape(1)
    this.revealShape = makeShape(-1)

    this.resize()
    this.canvas.style.display = "block"
    return true
  }

  /** Texto que se muestra sobre el negro mientras se carga el bioma. */
  public setLabel(label: string | null): void {
    this.label = label
  }

  /** Aborta la transición al instante (p. ej. si termina la run). */
  public cancel(): void {
    this.phase = "idle"
    this.onCovered = null
    this.loading = false
    this.label = null
    this.canvas.style.display = "none"
  }

  /** Hay una transición en curso (cubriendo, en negro o retirándose). */
  public isActive(): boolean {
    return this.phase !== "idle"
  }

  /** Mientras la masa negra cubre la pantalla (cubriendo o en negro) el juego debe estar en pausa. */
  public get blocksGameplay(): boolean {
    return this.phase === "covering" || this.phase === "holding"
  }

  public update(deltaTime: number): void {
    if (this.phase === "idle") return

    this.time += deltaTime
    this.elapsed += deltaTime

    if (this.phase === "covering" && this.elapsed >= COVER_TIME) {
      this.phase = "holding"
      this.elapsed = 0
      const callback = this.onCovered
      this.onCovered = null
      const result = callback?.()
      if (result instanceof Promise) {
        this.loading = true
        const finish = (): void => {
          this.loading = false
        }
        result.then(finish, finish)
      }
    } else if (
      this.phase === "holding" &&
      this.elapsed >= HOLD_TIME &&
      !this.loading
    ) {
      this.phase = "revealing"
      this.elapsed = 0
    } else if (this.phase === "revealing" && this.elapsed >= REVEAL_TIME) {
      this.cancel()
      return
    }

    this.draw()
  }

  private resize(): void {
    // Escala por devicePixelRatio para que los bordes no se vean borrosos en HiDPI.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(window.innerWidth * dpr)
    this.canvas.height = Math.round(window.innerHeight * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private draw(): void {
    const { ctx } = this
    const w = window.innerWidth
    const h = window.innerHeight

    ctx.clearRect(0, 0, w, h)
    // Opaco: la masa debe tapar por completo el cambio de escena.
    ctx.fillStyle = "#000"

    if (this.phase === "holding") {
      ctx.fillRect(0, 0, w, h)
      if (this.label) this.drawLabel(w, h)
      return
    }

    const amp = w * AMPLITUDE
    const covering = this.phase === "covering"
    const shape = covering ? this.coverShape : this.revealShape
    const duration = covering ? COVER_TIME : REVEAL_TIME
    const p = easeInOutCubic(Math.min(1, this.elapsed / duration))

    // El borde recorre la pantalla de izquierda a derecha, con el perfil irregular
    const center = -amp + p * (w + 2 * amp)
    const edgeX = (i: number): number =>
      center + shape[i] * amp + Math.sin(this.time * 3 + i * 0.6) * amp * 0.03
    const edgeY = (i: number): number =>
      -MARGIN + (i / SEGMENTS) * (h + 2 * MARGIN)

    ctx.beginPath()
    if (covering) {
      // Negro desde el borde izquierdo hasta el borde irregular que avanza
      ctx.moveTo(-MARGIN, -MARGIN)
      for (let i = 0; i <= SEGMENTS; i++) ctx.lineTo(edgeX(i), edgeY(i))
      ctx.lineTo(-MARGIN, h + MARGIN)
    } else {
      // Negro desde el borde irregular (que se aleja) hasta el borde derecho
      ctx.moveTo(w + MARGIN, -MARGIN)
      for (let i = 0; i <= SEGMENTS; i++) ctx.lineTo(edgeX(i), edgeY(i))
      ctx.lineTo(w + MARGIN, h + MARGIN)
    }
    ctx.closePath()
    ctx.fill()
  }

  private drawLabel(w: number, h: number): void {
    const { ctx } = this
    ctx.fillStyle = "#f5eedd"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const size = Math.max(20, Math.min(40, w * 0.04))
    ctx.font = `900 ${size}px ${TITLE_FONT}`
    // Admite varias líneas separadas por "\n", centradas en vertical.
    const lines = (this.label ?? "").split("\n")
    const lineHeight = size * 1.3
    const top = h / 2 - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => ctx.fillText(line, w / 2, top + i * lineHeight))
  }
}
