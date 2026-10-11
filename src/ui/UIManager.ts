// src/UIManager.ts
import type { GameState } from "@core/types"

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicityFillEl: HTMLElement
  private buildHudEl: HTMLElement
  private spinBoostHudEl: HTMLElement
  private lastBuildHud = ""
  private lastSpinBoostVisible = false
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

    // HUD del boost de giro (aparece solo cuando está activo)
    this.spinBoostHudEl = document.createElement("div")
    this.spinBoostHudEl.id = "spin-boost-hud"
    this.spinBoostHudEl.style.cssText = `
      position: absolute;
      bottom: 110px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 18px;
      font-family: "Geist-Semibold", sans-serif;
      font-size: 13px;
      letter-spacing: 0.08em;
      color: #0ff;
      background: rgba(0, 40, 60, 0.65);
      border: 1px solid rgba(0, 255, 255, 0.5);
      border-radius: 8px;
      pointer-events: none;
      z-index: 100;
      display: none;
      text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
    `
    document.getElementById("game-container")!.appendChild(this.spinBoostHudEl)
  }

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
      btn.blur()
      onClick()
    })
    document.getElementById("game-container")!.appendChild(btn)
  }

  public updateBuildHud(text: string, available: boolean): void {
    const key = `${available}|${text}`
    if (key === this.lastBuildHud) return
    this.lastBuildHud = key
    this.buildHudEl.textContent = text
    this.buildHudEl.style.color = available ? "#f7f7ff" : "#ff9a9a"
  }

  /**
   * Actualiza el HUD del boost de giro.
   * @param boost 0..1 (fracción del boost restante respecto al máximo)
   * @param active si el boost está activo
   */
  public updateSpinBoostHud(boost: number, active: boolean): void {
    if (active !== this.lastSpinBoostVisible) {
      this.spinBoostHudEl.style.display = active ? "block" : "none"
      this.lastSpinBoostVisible = active
    }

    if (!active) return

    // Mostrar el multiplicador aproximado (1 + boost*0.6 aprox)
    const multiplier = 1 + boost * 0.6
    this.spinBoostHudEl.textContent = `DASH ×${multiplier.toFixed(2)}`
  }

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

  public showMessage(message: string, duration: number = 2000): void {
    this.currentMessage?.remove()
    window.clearTimeout(this.messageTimeout)
    this.messageTimeout = undefined

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
      this.messageTimeout = undefined
    }, duration)
  }
}
