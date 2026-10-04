// src/UIManager.ts
// Clase encargada de actualizar los elementos de la interfaz de usuario (HUD) y mostrar mensajes en pantalla.

import type { GameState } from "./types"

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicityFillEl: HTMLElement
  private currentMessage?: HTMLElement
  private messageTimeout?: number

  constructor() {
    this.debrisCountEl = document.getElementById("debris-count")!
    this.ecoAwarenessEl = document.getElementById("eco-awareness")!
    this.zoneProgressEl = document.getElementById("zone-progress")!
    this.toxicityFillEl = document.getElementById("toxicity-fill")!
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
