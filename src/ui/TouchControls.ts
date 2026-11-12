// src/ui/TouchControls.ts

import type { TouchLabelAction } from "@core/controlsHint"
import type { InputState } from "@core/types"
import { EDGE_BOOST_ON, edgeBoostActive } from "@ui/touchGestures"

const EDGE_MARGIN = 10

// Zona muerta de los sticks analógicos (proporción del radio)
const MOVE_DEADZONE = 0.12
const DEPTH_DEADZONE = 0.12

// Gesto de "flick": deslizar rápido en horizontal dispara el dash
const FLICK_DISTANCE = 44 // px desde el punto de apoyo
const FLICK_TIME = 0.25 // segundos

// Medidas a escala 1; el ajuste de tamaño las multiplica (--touch-scale).
// Joystick de movimiento (mitad izquierda)
const BASE_SIZE = 140 // debe coincidir con #joystick-base en el CSS
const STICK_RADIUS = 60

// Stick de profundidad (mitad derecha)
const DEPTH_W = 70 // debe coincidir con #depth-base en el CSS
const DEPTH_H = 160
const DEPTH_RANGE = 50

/** Expresión CSS (para usar dentro de `calc()`) de una medida que sigue la escala. */
const scaled = (px: number): string => `${px}px * var(--touch-scale, 1)`

/** Dirección del giro de 360°. */
export type DashDirection = "left" | "right"

/** Controles cuyo uso táctil se registra (para no enseñar lo ya descubierto). */
export type TouchControl = "move" | "depth" | "boost" | "dash"

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
  /** Impulso por empujar el joystick más allá del borde. */
  private edgeBoosting = false

  // Stick derecho
  private depthZone: HTMLElement
  private depthBase: HTMLElement
  private depthKnob: HTMLElement
  private depthPointer: number | null = null
  private depthCenterY = 0

  // Botón de dash: alterna el sentido del giro en cada pulsación
  private dashFlip = false

  /** Escala elegida en los ajustes (1 = tamaño original). */
  private scale = 1

  /** Controles usados con la pantalla táctil en esta sesión. */
  private used = new Set<TouchControl>()

  /** Etiqueta de cada control con nombre en pantalla. */
  private labels: Record<TouchLabelAction, HTMLElement>

  constructor(input: InputState, actions: TouchActions) {
    this.input = input
    this.actions = actions
    const container = document.getElementById("game-container")!

    this.root = document.createElement("div")
    this.root.id = "touch-controls"
    // El pulgar izquierdo nada (y se impulsa empujando el joystick más allá
    // del borde); los botones rodean el stick de profundidad, al alcance del
    // pulgar derecho: dash encima, mirar atrás en diagonal y el filtro abajo.
    this.root.innerHTML = `
      <div id="joystick-zone"></div>
      <div id="joystick-base">
        <div id="joystick-knob"></div>
        <span class="touch-label" data-label="boost">Al borde: impulso</span>
      </div>

      <div id="depth-zone"></div>
      <div id="depth-base"><div id="depth-knob"></div></div>

      <button id="dash-btn" class="touch-btn" aria-label="Giro de 360° (dash)"
        style="position: absolute; right: calc(${scaled(36)} + env(safe-area-inset-right, 0px)); bottom: calc(var(--touch-bottom, 50px) + ${scaled(186)});">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4.5V9h-4.5" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
        <span class="touch-label" data-label="dash">Dash</span>
      </button>

      <button id="lookback-btn" class="touch-btn" aria-label="Mirar atrás"
        style="position: absolute; right: calc(${scaled(116)} + env(safe-area-inset-right, 0px)); bottom: calc(var(--touch-bottom, 50px) + ${scaled(128)});">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
        <span class="touch-label" data-label="lookBack">Mirar atrás</span>
      </button>

      <button id="build-btn" class="touch-btn" aria-label="Colocar esfera filtradora"
        style="position: absolute; right: calc(${scaled(124)} + env(safe-area-inset-right, 0px)); bottom: calc(var(--touch-bottom, 50px) + ${scaled(36)});">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
        </svg>
        <span class="touch-label" data-label="build">Filtro</span>
      </button>
    `
    container.appendChild(this.root)

    this.moveZone = this.root.querySelector("#joystick-zone")!
    this.moveBase = this.root.querySelector("#joystick-base")!
    this.moveKnob = this.root.querySelector("#joystick-knob")!
    this.depthZone = this.root.querySelector("#depth-zone")!
    this.depthBase = this.root.querySelector("#depth-base")!
    this.depthKnob = this.root.querySelector("#depth-knob")!
    const label = (action: TouchLabelAction): HTMLElement =>
      this.root.querySelector(`[data-label="${action}"]`)!
    this.labels = {
      boost: label("boost"),
      dash: label("dash"),
      build: label("build"),
      lookBack: label("lookBack"),
    }

    this.setupMoveStick()
    this.setupDepthStick()
    this.setupBuildButton()
    this.setupLookBackButton()
    this.setupDashButton()

    this.root.addEventListener("contextmenu", (e) => e.preventDefault())
    window.addEventListener("touchstart", () => this.show(), {
      once: true,
      passive: true,
    })
  }

  /** `true` desde el primer toque: el jugador está usando la pantalla táctil. */
  public isActive(): boolean {
    return this.visible
  }

  /** Tamaño (1 = original) y opacidad (0..1) de los controles, al momento. */
  public setAppearance(scale: number, opacity: number): void {
    this.scale = scale
    // En <html>: el HUD inferior también la usa para no pisar los botones.
    document.documentElement.style.setProperty("--touch-scale", String(scale))
    this.root.style.opacity = String(opacity)
  }

  /** Muestra la etiqueta de estos controles y oculta la del resto. */
  public setLabels(actions: readonly TouchLabelAction[]): void {
    for (const [action, el] of Object.entries(this.labels)) {
      el.hidden = !actions.includes(action as TouchLabelAction)
    }
  }

  /** `true` si el jugador ya usó este control con la pantalla táctil. */
  public hasUsed(control: TouchControl): boolean {
    return this.used.has(control)
  }

  private show(): void {
    if (this.visible) return
    this.visible = true
    this.root.classList.add("visible")
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

      const half = (BASE_SIZE * this.scale) / 2
      // Hacia los bordes de la pantalla debe caber el gesto de impulso, que
      // llega más lejos que la base.
      const reach =
        Math.max(half, STICK_RADIUS * this.scale * EDGE_BOOST_ON) + EDGE_MARGIN
      this.moveCenter.x = this.clamp(
        e.clientX,
        reach,
        window.innerWidth * 0.5 - half,
      )
      this.moveCenter.y = this.clamp(
        e.clientY,
        half + EDGE_MARGIN,
        window.innerHeight - reach,
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
      this.setEdgeBoost(false)

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

    const radius = STICK_RADIUS * this.scale
    const dist = Math.hypot(dx, dy)
    this.setEdgeBoost(edgeBoostActive(dist / radius, this.edgeBoosting))
    if (dist > radius) {
      dx = (dx / dist) * radius
      dy = (dy / dist) * radius
    }

    this.moveKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

    const x = dx / radius
    const y = -dy / radius // arriba = adelante

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
    if (ax !== 0 || ay !== 0) this.used.add("move")

    this.detectFlick(e)
  }

  /** Activa o suelta el impulso del joystick (y su aviso visual en la base). */
  private setEdgeBoost(active: boolean): void {
    if (active === this.edgeBoosting) return
    this.edgeBoosting = active
    this.input.boost = active
    this.moveBase.classList.toggle("boosting", active)
    if (active) this.used.add("boost")
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
      this.used.add("dash")
      this.actions.onDash(dx > 0 ? "right" : "left")
    }
  }

  // ---------- Stick vertical de profundidad ----------

  private setupDepthStick(): void {
    this.depthZone.addEventListener("pointerdown", (e) => {
      if (this.depthPointer !== null) return
      this.depthPointer = e.pointerId
      this.depthZone.setPointerCapture(e.pointerId)

      const halfW = (DEPTH_W * this.scale) / 2
      const halfH = (DEPTH_H * this.scale) / 2
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
    const range = DEPTH_RANGE * this.scale
    const dy = this.clamp(e.clientY - this.depthCenterY, -range, range)
    this.depthKnob.style.transform = `translate(-50%, calc(-50% + ${dy}px))`

    const y = -dy / range // arriba = subir

    const mag = Math.abs(y)
    let v = 0
    if (mag > DEPTH_DEADZONE) {
      const scaled = (mag - DEPTH_DEADZONE) / (1 - DEPTH_DEADZONE)
      v = Math.sign(y) * scaled
    }

    this.input.vertical = v
    this.input.up = v > 0
    this.input.down = v < 0
    if (v !== 0) this.used.add("depth")
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

  // ---------- Botón de dash (giro de 360°) ----------

  private setupDashButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#dash-btn")!

    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId)
      btn.classList.add("active")
      const direction = this.dashFlip ? "left" : "right"
      this.dashFlip = !this.dashFlip
      this.used.add("dash")
      this.actions.onDash(direction)
    })
    const release = () => btn.classList.remove("active")
    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointercancel", release)
  }
}
