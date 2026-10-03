// src/TouchControls.ts

import type { InputState } from "./types"

const JOYSTICK_RADIUS = 60 // px que puede desplazarse el stick
const DEADZONE = 0.3

/**
 * Joystick virtual + botones Subir / Bajar / Impulso.
 * Solo aparece cuando se detecta el primer toque en pantalla.
 * Escribe directamente sobre el objeto `input` del juego.
 */
export class TouchControls {
  private root: HTMLElement
  private base: HTMLElement
  private knob: HTMLElement
  private joystickPointer: number | null = null
  private visible = false
  private input: InputState

  constructor(input: InputState) {
    this.input = input
    const container = document.getElementById("game-container")!

    this.root = document.createElement("div")
    this.root.id = "touch-controls"
    this.root.innerHTML = `
      <div id="joystick-base"><div id="joystick-knob"></div></div>
      <div id="touch-buttons">
        <button class="touch-btn" data-key="up">▲</button>
        <button class="touch-btn" data-key="boost">⚡</button>
        <button class="touch-btn" data-key="down">▼</button>
      </div>
    `
    container.appendChild(this.root)

    this.base = this.root.querySelector("#joystick-base")!
    this.knob = this.root.querySelector("#joystick-knob")!

    this.setupJoystick()
    this.setupButtons()

    // Mostrar los controles en cuanto se detecte un toque
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

  private setupJoystick(): void {
    this.base.addEventListener("pointerdown", (e) => {
      if (this.joystickPointer !== null) return
      this.joystickPointer = e.pointerId
      this.base.setPointerCapture(e.pointerId)
      this.moveStick(e)
    })
    this.base.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.joystickPointer) this.moveStick(e)
    })
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointer) return
      this.joystickPointer = null
      this.knob.style.transform = "translate(-50%, -50%)"
      this.input.forward = false
      this.input.backward = false
      this.input.left = false
      this.input.right = false
    }
    this.base.addEventListener("pointerup", release)
    this.base.addEventListener("pointercancel", release)
  }

  private moveStick(e: PointerEvent): void {
    const rect = this.base.getBoundingClientRect()
    let dx = e.clientX - (rect.left + rect.width / 2)
    let dy = e.clientY - (rect.top + rect.height / 2)

    const dist = Math.hypot(dx, dy)
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS
      dy = (dy / dist) * JOYSTICK_RADIUS
    }

    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`

    // Valores normalizados -1..1 (arriba = adelante)
    const x = dx / JOYSTICK_RADIUS
    const y = -dy / JOYSTICK_RADIUS

    this.input.forward = y > DEADZONE
    this.input.backward = y < -DEADZONE
    this.input.left = x < -DEADZONE
    this.input.right = x > DEADZONE
  }

  private setupButtons(): void {
    this.root
      .querySelectorAll<HTMLButtonElement>(".touch-btn")
      .forEach((btn) => {
        const key = btn.dataset.key as "up" | "down" | "boost"

        btn.addEventListener("pointerdown", (e) => {
          btn.setPointerCapture(e.pointerId)
          btn.classList.add("active")
          this.input[key] = true
        })
        const release = () => {
          btn.classList.remove("active")
          this.input[key] = false
        }
        btn.addEventListener("pointerup", release)
        btn.addEventListener("pointercancel", release)
      })

    // Evita el menú contextual por pulsación larga
    this.root.addEventListener("contextmenu", (e) => e.preventDefault())
  }
}
