// src/TouchControls.ts

import type { InputState } from "@core/types"

const EDGE_MARGIN = 10

// Zona muerta de los sticks analógicos (proporción del radio)
const MOVE_DEADZONE = 0.12
const DEPTH_DEADZONE = 0.12

// Gesto de "flick": deslizar rápido en horizontal dispara el dash
const FLICK_DISTANCE = 44 // px desde el punto de apoyo
const FLICK_TIME = 0.25 // segundos

// Joystick de movimiento (mitad izquierda)
const BASE_SIZE = 140 // debe coincidir con #joystick-base en el CSS
const STICK_RADIUS = 60

// Stick de profundidad (mitad derecha)
const DEPTH_W = 70 // debe coincidir con #depth-base en el CSS
const DEPTH_H = 160
const DEPTH_RANGE = 50

/** Dirección del giro de 360°. */
export type DashDirection = "left" | "right"

/** Acciones puntuales (no mantenidas) que dispara la interfaz táctil. */
export interface TouchActions {
  onBuild(): void
  onLookBack(active: boolean): void // true mientras se mantiene pulsado
  onDash(direction: DashDirection): void
}

/** Controles táctiles de doble stick flotante; los sticks nacen donde pongas el dedo. */
export class TouchControls {
  private root: HTMLElement
  private input: InputState
  private actions: TouchActions
  private visible = false

  // Joystick izquierdo
  private moveZone: HTMLElement
  private moveBase: HTMLElement
  private moveKnob: HTMLElement
  private movePointer: number | null = null
  private moveCenter = { x: 0, y: 0 }
  private moveStart = { x: 0, y: 0, time: 0 }
  private moveFlicked = false

  // Stick derecho
  private depthZone: HTMLElement
  private depthBase: HTMLElement
  private depthKnob: HTMLElement
  private depthPointer: number | null = null
  private depthCenterY = 0

  // Botón de dash: alterna el sentido del giro en cada pulsación
  private dashFlip = false

  constructor(input: InputState, actions: TouchActions) {
    this.input = input
    this.actions = actions
    const container = document.getElementById("game-container")!

    this.root = document.createElement("div")
    this.root.id = "touch-controls"
    this.root.innerHTML = `
      <div id="joystick-zone"></div>
      <div id="joystick-base"><div id="joystick-knob"></div></div>

      <div id="depth-zone"></div>
      <div id="depth-base"><div id="depth-knob"></div></div>

      <button id="boost-btn" class="touch-btn" aria-label="Impulso">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 17a9 9 0 1 1 17 0" />
          <path d="M12 15l4.5-6" />
          <circle cx="12" cy="15" r="1.4" fill="currentColor" />
          <path d="M5.2 12.2l1.2.7M8 8.4l.7 1.2M12 6.5v1.4M16 8.4l-.7 1.2M18.8 12.2l-1.2.7" />
        </svg>
      </button>

      <button id="build-btn" class="touch-btn" aria-label="Construir filtro"
        style="position: absolute; right: calc(36px + env(safe-area-inset-right, 0px)); bottom: calc(var(--touch-bottom, 50px) + 256px);">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
        </svg>
      </button>

      <button id="lookback-btn" class="touch-btn" aria-label="Ver hacia atrás"
        style="position: absolute; right: calc(112px + env(safe-area-inset-right, 0px)); bottom: calc(var(--touch-bottom, 50px) + 180px);">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>

      <button id="dash-btn" class="touch-btn" aria-label="Giro de 360° (dash)"
        style="position: absolute; left: calc(36px + env(safe-area-inset-left, 0px)); bottom: calc(var(--touch-bottom, 50px) + 180px);">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4.5V9h-4.5" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      </button>
    `
    container.appendChild(this.root)

    this.moveZone = this.root.querySelector("#joystick-zone")!
    this.moveBase = this.root.querySelector("#joystick-base")!
    this.moveKnob = this.root.querySelector("#joystick-knob")!
    this.depthZone = this.root.querySelector("#depth-zone")!
    this.depthBase = this.root.querySelector("#depth-base")!
    this.depthKnob = this.root.querySelector("#depth-knob")!

    this.setupMoveStick()
    this.setupDepthStick()
    this.setupBoostButton()
    this.setupBuildButton()
    this.setupLookBackButton()
    this.setupDashButton()

    this.root.addEventListener("contextmenu", (e) => e.preventDefault())
    window.addEventListener("touchstart", () => this.show(), {
      once: true,
      passive: true,
    })
  }

  private show(): void {
    if (this.visible) return
    this.visible = true
    this.root.classList.add("visible")
    document.getElementById("controls-hint")?.classList.add("hidden")
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max)
  }

  // ---------- Joystick de movimiento ----------

  private setupMoveStick(): void {
    this.moveZone.addEventListener("pointerdown", (e) => {
      if (this.movePointer !== null) return
      this.movePointer = e.pointerId
      this.moveZone.setPointerCapture(e.pointerId)

      const half = BASE_SIZE / 2
      this.moveCenter.x = this.clamp(
        e.clientX,
        half + EDGE_MARGIN,
        window.innerWidth * 0.5 - half,
      )
      this.moveCenter.y = this.clamp(
        e.clientY,
        half + EDGE_MARGIN,
        window.innerHeight - half - EDGE_MARGIN,
      )

      this.moveBase.style.left = `${this.moveCenter.x - half}px`
      this.moveBase.style.top = `${this.moveCenter.y - half}px`
      this.moveBase.style.bottom = "auto"
      this.moveBase.classList.add("active")

      this.moveStart = { x: e.clientX, y: e.clientY, time: performance.now() }
      this.moveFlicked = false

      this.moveStick(e)
    })

    this.moveZone.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.movePointer) this.moveStick(e)
    })

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.movePointer) return
      this.movePointer = null

      this.moveBase.style.left = ""
      this.moveBase.style.top = ""
      this.moveBase.style.bottom = ""
      this.moveBase.classList.remove("active")
      this.moveKnob.style.transform = "translate(-50%, -50%)"

      this.input.forward = false
      this.input.backward = false
      this.input.left = false
      this.input.right = false
      this.input.moveX = 0
      this.input.moveY = 0
    }
    this.moveZone.addEventListener("pointerup", release)
    this.moveZone.addEventListener("pointercancel", release)
  }

  private moveStick(e: PointerEvent): void {
    let dx = e.clientX - this.moveCenter.x
    let dy = e.clientY - this.moveCenter.y

    const dist = Math.hypot(dx, dy)
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS
      dy = (dy / dist) * STICK_RADIUS
    }

    this.moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

    const x = dx / STICK_RADIUS
    const y = -dy / STICK_RADIUS // arriba = adelante

    // Ejes analógicos con zona muerta reescalada (aprovecha todo el recorrido)
    const mag = Math.hypot(x, y)
    let ax = 0
    let ay = 0
    if (mag > MOVE_DEADZONE) {
      const scaled = (mag - MOVE_DEADZONE) / (1 - MOVE_DEADZONE)
      ax = (x / mag) * scaled
      ay = (y / mag) * scaled
    }

    this.input.moveX = ax
    this.input.moveY = ay
    this.input.forward = ay > 0
    this.input.backward = ay < 0
    this.input.left = ax < 0
    this.input.right = ax > 0

    this.detectFlick(e)
  }

  /** Deslizamiento rápido en horizontal = giro de 360° (una vez por apoyo). */
  private detectFlick(e: PointerEvent): void {
    if (this.moveFlicked) return

    const elapsed = (performance.now() - this.moveStart.time) / 1000
    const dx = e.clientX - this.moveStart.x
    const dy = e.clientY - this.moveStart.y

    if (
      elapsed <= FLICK_TIME &&
      Math.abs(dx) >= FLICK_DISTANCE &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      this.moveFlicked = true
      this.actions.onDash(dx > 0 ? "right" : "left")
    }
  }

  // ---------- Stick vertical de profundidad ----------

  private setupDepthStick(): void {
    this.depthZone.addEventListener("pointerdown", (e) => {
      if (this.depthPointer !== null) return
      this.depthPointer = e.pointerId
      this.depthZone.setPointerCapture(e.pointerId)

      const halfW = DEPTH_W / 2
      const halfH = DEPTH_H / 2
      const cx = this.clamp(
        e.clientX,
        window.innerWidth * 0.5 + halfW + EDGE_MARGIN,
        window.innerWidth - halfW - EDGE_MARGIN,
      )
      this.depthCenterY = this.clamp(
        e.clientY,
        halfH + EDGE_MARGIN,
        window.innerHeight - halfH - EDGE_MARGIN,
      )

      this.depthBase.style.left = `${cx - halfW}px`
      this.depthBase.style.top = `${this.depthCenterY - halfH}px`
      this.depthBase.style.right = "auto"
      this.depthBase.style.bottom = "auto"
      this.depthBase.classList.add("active")

      this.depthStick(e)
    })

    this.depthZone.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.depthPointer) this.depthStick(e)
    })

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.depthPointer) return
      this.depthPointer = null

      this.depthBase.style.left = ""
      this.depthBase.style.top = ""
      this.depthBase.style.right = ""
      this.depthBase.style.bottom = ""
      this.depthBase.classList.remove("active")
      this.depthKnob.style.transform = "translate(-50%, -50%)"

      this.input.up = false
      this.input.down = false
      this.input.vertical = 0
    }
    this.depthZone.addEventListener("pointerup", release)
    this.depthZone.addEventListener("pointercancel", release)
  }

  private depthStick(e: PointerEvent): void {
    const dy = this.clamp(
      e.clientY - this.depthCenterY,
      -DEPTH_RANGE,
      DEPTH_RANGE,
    )
    this.depthKnob.style.transform = `translate(-50%, calc(-50% + ${dy}px))`

    const y = -dy / DEPTH_RANGE // arriba = subir

    const mag = Math.abs(y)
    let v = 0
    if (mag > DEPTH_DEADZONE) {
      const scaled = (mag - DEPTH_DEADZONE) / (1 - DEPTH_DEADZONE)
      v = Math.sign(y) * scaled
    }

    this.input.vertical = v
    this.input.up = v > 0
    this.input.down = v < 0
  }

  // ---------- Botón de construir ----------

  private setupBuildButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#build-btn")!

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      btn.classList.add("active")
      this.actions.onBuild()
    })
    const release = () => btn.classList.remove("active")
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }

  // ---------- Botón de ver hacia atrás (mantener pulsado) ----------

  private setupLookBackButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#lookback-btn")!

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      btn.classList.add("active")
      this.actions.onLookBack(true)
    })
    const release = () => {
      btn.classList.remove("active")
      this.actions.onLookBack(false)
    }
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }

  // ---------- Botón de impulso ----------

  private setupBoostButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#boost-btn")!

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      btn.classList.add("active")
      this.input.boost = true
    })
    const release = () => {
      btn.classList.remove("active")
      this.input.boost = false
    }
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }

  // ---------- Botón de dash (giro de 360°) ----------

  private setupDashButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#dash-btn")!

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      btn.classList.add("active")
      const direction = this.dashFlip ? "left" : "right"
      this.dashFlip = !this.dashFlip
      this.actions.onDash(direction)
    })
    const release = () => btn.classList.remove("active")
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }
}
