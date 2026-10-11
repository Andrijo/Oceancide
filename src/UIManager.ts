// src/UIManager.ts
// Clase encargada de actualizar los elementos de la interfaz de usuario (HUD) y mostrar mensajes en pantalla.

import type { GameState } from "./types"

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicityFillEl: HTMLElement
  private buildHudEl: HTMLElement
  private lastBuildHud = ""
  private currentMessage?: HTMLElement
  private messageTimeout?: number

  constructor() {
    this.debrisCountEl = document.getElementById("debris-count")!
    this.ecoAwarenessEl = document.getElementById("eco-awareness")!
    this.zoneProgressEl = document.getElementById("zone-progress")!
    this.toxicityFillEl = document.getElementById("toxicity-fill")!

    this.buildHudEl = document.createElement("div")
    this.buildHudEl.id = "build-hud"
    this.buildHudEl.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 14px;
      font-family: "Geist-Semibold", sans-serif;
      font-size: 14px;
      white-space: nowrap;
      color: #f7f7ff;
      background: rgba(0, 0, 0, 0.45);
      border-radius: 8px;
      pointer-events: none;
      z-index: 100;
    `
    document.getElementById("game-container")!.appendChild(this.buildHudEl)
  }

  /** Botón de pausa del HUD (círculo con dos barras, arriba a la derecha). */
  public createPauseButton(onClick: () => void): void {
    const btn = document.createElement("button")
    btn.id = "pause-btn"
    btn.setAttribute("aria-label", "Pausa")
    btn.style.cssText = `
      position: absolute;
      top: calc(12px + env(safe-area-inset-top, 0px));
      right: calc(12px + env(safe-area-inset-right, 0px));
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f7f7ff;
      background: none;
      border: 2px solid #f7f7ff;
      border-radius: 50%;
      cursor: pointer;
      z-index: 300;
      -webkit-tap-highlight-color: transparent;
    `
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    `
    btn.addEventListener("click", () => {
      btn.blur() // que Enter/Espacio no vuelvan a activarlo
      onClick()
    })
    document.getElementById("game-container")!.appendChild(btn)
  }

  // Indicador de la estructura que se puede construir (rojo si no es posible ahora).
  public updateBuildHud(text: string, available: boolean): void {
    const key = `${available}|${text}`
    if (key === this.lastBuildHud) return
    this.lastBuildHud = key
    this.buildHudEl.textContent = text
    this.buildHudEl.style.color = available ? "#f7f7ff" : "#ff9a9a"
  }

  // Método para actualizar la interfaz de usuario con el estado actual del juego.
  public updateUI(state: GameState): void {
    this.debrisCountEl.textContent = state.debrisCollected.toString()
    this.ecoAwarenessEl.textContent = state.ecoAwareness.toString()
    this.zoneProgressEl.textContent = `${Math.round(state.zoneProgress)}%`

    this.toxicityFillEl.style.width = `${Math.min(state.toxicity, 100)}%`

    if (state.toxicity > 70) {
      this.toxicityFillEl.style.background = "#ff0000"
    } else if (state.toxicity > 40) {
      this.toxicityFillEl.style.background = "#ff6600"
    } else {
      this.toxicityFillEl.style.background =
        "linear-gradient(90deg, #00ff88, #ff6600, #ff0000)"
    }
  }

  // Método para mostrar un mensaje en pantalla durante un tiempo determinado.
  public showMessage(message: string, duration: number = 2000): void {
    // Evita que se apilen mensajes
    this.currentMessage?.remove()
    window.clearTimeout(this.messageTimeout)

    const msgEl = document.createElement("div")
    msgEl.textContent = message
    msgEl.style.cssText = `
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #f7f7ff;
      font-family: "Pogonia", sans-serif;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.6);
      background: none;
      padding: 20px 40px;
      border-radius: 10px;
      pointer-events: none;
      z-index: 1000;
      animation: fadeInOut ${duration}ms ease-in-out forwards;
    `

    document.getElementById("game-container")!.appendChild(msgEl)
    this.currentMessage = msgEl

    this.messageTimeout = window.setTimeout(() => {
      msgEl.remove()
      if (this.currentMessage === msgEl) this.currentMessage = undefined
    }, duration)
  }
}
