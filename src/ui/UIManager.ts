// src/ui/UIManager.ts
import type { GameState } from "@core/types"
import { PARAGRAPH_FONT, TITLE_FONT } from "@ui/fonts"

const CLEANSING_DURATION = 600
const CLEANSING_THRESHOLD = 0.5

const TOXICITY_LEVEL_LABELS: Record<string, string> = {
  "level-low": "baja",
  "level-mid": "media",
  "level-high": "alta",
  "level-crit": "crítica",
}

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicitySkullEl: HTMLElement
  private toxicitySkullFillEl: SVGRectElement
  private toxicityTrendEl: HTMLElement
  private toxicityStatusEl: HTMLElement
  private dangerClusterEl: HTMLElement

  private biomeTimerEl: HTMLElement
  private boostBarEl: HTMLElement
  private boostBarFillEl: HTMLElement

  private buildHudEl: HTMLElement
  private spinBoostHudEl: HTMLElement
  private lastBuildHud = ""
  private lastSpinBoostVisible = false
  private lastBoostVisible = false
  private lastBiomeTimerText = ""

  private lastToxicityLevel: string | null = null
  private lastToxicityVisible = false
  private lastToxicity = 0
  private cleansingTimeout?: number

  // Tendencia de toxicidad
  private toxicityTrend = 0
  private trendHoldUntil = 0 // En segundos
  private lastTrendClass = ""

  private currentMessage?: HTMLElement
  private messageTimeout?: number
  private liveRegion: HTMLElement

  constructor() {
    this.debrisCountEl = document.getElementById("debris-count")!
    this.ecoAwarenessEl = document.getElementById("eco-awareness")!
    this.zoneProgressEl = document.getElementById("zone-progress")!
    this.toxicitySkullEl = document.getElementById("toxicity-skull")!
    this.toxicitySkullFillEl = document.querySelector<SVGRectElement>(
      "#toxicity-skull-fill",
    )!
    this.toxicityStatusEl = document.getElementById("toxicity-status")!

    // Cluster de peligro (arriba centro)
    this.dangerClusterEl = document.createElement("div")
    this.dangerClusterEl.id = "danger-cluster"

    this.biomeTimerEl = document.createElement("div")
    this.biomeTimerEl.id = "biome-timer"
    this.biomeTimerEl.style.cssText = `
      position: relative;
      padding: 4px 12px;
      font-family: ${PARAGRAPH_FONT};
      font-size: 17px;
      font-weight: bold;
      color: #f7f7ff;
      background: rgba(0, 0, 0, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-radius: 10px;
      pointer-events: none;
      text-shadow: 0 0 10px rgba(0, 0, 0, 0.9);
      transition: color 0.3s ease, border-color 0.3s ease;
    `
    this.dangerClusterEl.appendChild(this.biomeTimerEl)

    this.dangerClusterEl.appendChild(this.toxicitySkullEl)

    this.toxicityTrendEl = document.createElement("div")
    this.toxicityTrendEl.id = "toxicity-trend"
    this.toxicityTrendEl.className = "toxicity-trend"
    this.toxicitySkullEl.appendChild(this.toxicityTrendEl)

    document.getElementById("game-container")!.appendChild(this.dangerClusterEl)

    // Barra de energía del boost
    this.boostBarEl = document.createElement("div")
    this.boostBarEl.id = "boost-energy-bar"
    this.boostBarEl.style.cssText = `
      position: absolute;
      bottom: 130px;
      left: 50%;
      transform: translateX(-50%);
      width: 180px;
      height: 8px;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 4px;
      overflow: hidden;
      pointer-events: none;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.3s ease;
    `
    this.boostBarFillEl = document.createElement("div")
    this.boostBarFillEl.style.cssText = `
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #22d3ee, #38bdf8, #a78bfa);
      transition: width 0.08s linear, background 0.2s ease;
    `
    this.boostBarEl.appendChild(this.boostBarFillEl)
    document.getElementById("game-container")!.appendChild(this.boostBarEl)

    // HUD de construcción
    this.buildHudEl = document.createElement("div")
    this.buildHudEl.id = "build-hud"
    this.buildHudEl.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 14px;
      font-family: ${PARAGRAPH_FONT};
      font-size: 15px;
      white-space: nowrap;
      color: #f7f7ff;
      background: rgba(0, 0, 0, 0.45);
      border-radius: 8px;
      pointer-events: none;
      z-index: 100;
    `
    document.getElementById("game-container")!.appendChild(this.buildHudEl)

    // HUD del boost de giro
    this.spinBoostHudEl = document.createElement("div")
    this.spinBoostHudEl.id = "spin-boost-hud"
    this.spinBoostHudEl.style.cssText = `
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 18px;
      font-family: ${PARAGRAPH_FONT};
      font-size: 14px;
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

    // Región viva para anunciar resultados de eventos sin tapar la interfaz.
    this.liveRegion = document.createElement("div")
    this.liveRegion.setAttribute("role", "status")
    this.liveRegion.setAttribute("aria-live", "polite")
    this.liveRegion.setAttribute("aria-atomic", "true")
    this.liveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.getElementById("game-container")!.appendChild(this.liveRegion)
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

  public updateSpinBoostHud(boost: number, active: boolean): void {
    if (active !== this.lastSpinBoostVisible) {
      this.spinBoostHudEl.style.display = active ? "block" : "none"
      this.lastSpinBoostVisible = active
    }
    if (!active) return
    const multiplier = 1 + boost * 0.6
    this.spinBoostHudEl.textContent = `DASH ×${multiplier.toFixed(2)}`
  }

  public updateBoostEnergy(energy: number, active: boolean): void {
    const percent = Math.round(energy * 100)
    this.boostBarFillEl.style.width = `${percent}%`

    if (energy < 0.2) {
      this.boostBarFillEl.style.background = "#ef4444"
    } else if (energy < 0.5) {
      this.boostBarFillEl.style.background = "#f97316"
    } else {
      this.boostBarFillEl.style.background =
        "linear-gradient(90deg, #22d3ee, #38bdf8, #a78bfa)"
    }

    const visible = active || energy < 0.99
    if (visible !== this.lastBoostVisible) {
      this.boostBarEl.style.opacity = visible ? "1" : "0"
      this.lastBoostVisible = visible
    }
  }

  public updateBiomeTimer(remaining: number, limit: number): void {
    const empty = remaining <= 0
    const text = empty ? "PRESIÓN" : `${Math.ceil(remaining)}s`

    if (text !== this.lastBiomeTimerText) {
      this.biomeTimerEl.textContent = text
      this.lastBiomeTimerText = text
    }

    if (empty) {
      this.biomeTimerEl.style.color = "#ef4444"
      this.biomeTimerEl.style.borderColor = "rgba(239, 68, 68, 0.9)"
      return
    }

    const ratio = remaining / limit
    if (remaining <= 10) {
      this.biomeTimerEl.style.color = "#ef4444"
      this.biomeTimerEl.style.borderColor = "rgba(239, 68, 68, 0.9)"
    } else if (ratio < 0.3) {
      this.biomeTimerEl.style.color = "#f97316"
      this.biomeTimerEl.style.borderColor = "rgba(249, 115, 22, 0.7)"
    } else {
      this.biomeTimerEl.style.color = "#f7f7ff"
      this.biomeTimerEl.style.borderColor = "rgba(255, 255, 255, 0.35)"
    }
  }

  public updateUI(state: GameState, deltaTime: number): void {
    this.setText(this.debrisCountEl, state.debrisCollected.toString())
    this.setText(this.ecoAwarenessEl, Math.floor(state.ecoAwareness).toString())
    this.setText(this.zoneProgressEl, `${Math.round(state.zoneProgress)}%`)

    const toxicity = Math.min(state.toxicity, 100)

    const toxicityDelta = toxicity - this.lastToxicity
    this.toxicityTrend += (toxicityDelta - this.toxicityTrend) * 0.2

    const fillY = 120 - (toxicity / 100) * 120
    this.toxicitySkullFillEl.style.transform = `translateY(${fillY}px)`

    const visible = toxicity > 0.5
    if (visible !== this.lastToxicityVisible) {
      this.toxicitySkullEl.classList.toggle("active", visible)
      this.lastToxicityVisible = visible
    }

    if (
      this.lastToxicity > 1 &&
      toxicity < this.lastToxicity - CLEANSING_THRESHOLD
    ) {
      this.triggerCleansing()
    }
    this.lastToxicity = toxicity

    const level =
      toxicity > 75
        ? "level-crit"
        : toxicity > 50
          ? "level-high"
          : toxicity > 25
            ? "level-mid"
            : visible
              ? "level-low"
              : null

    if (level !== this.lastToxicityLevel) {
      this.toxicitySkullEl.classList.remove(
        "level-low",
        "level-mid",
        "level-high",
        "level-crit",
      )
      if (level) this.toxicitySkullEl.classList.add(level)
      this.lastToxicityLevel = level
      this.announceToxicity(level, toxicity)
    }

    this.updateToxicityTrend(visible, deltaTime)
  }

  private updateToxicityTrend(visible: boolean, deltaTime: number): void {
    const threshold = 0.02
    let cls = ""

    if (this.trendHoldUntil > 0) {
      this.trendHoldUntil -= deltaTime
    }

    if (visible && this.toxicityTrend > threshold) {
      cls = "up"
    } else if (visible && this.toxicityTrend < -threshold) {
      cls = "down"
      this.trendHoldUntil = 0.4
    } else if (this.trendHoldUntil > 0) {
      cls = "down"
    }

    if (cls === this.lastTrendClass) return
    this.lastTrendClass = cls
    this.toxicityTrendEl.classList.remove("up", "down")
    if (cls) this.toxicityTrendEl.classList.add(cls)
    this.toxicityTrendEl.textContent =
      cls === "up" ? "▲" : cls === "down" ? "▼" : ""
  }

  /** Anuncia el nivel de toxicidad solo cuando cambia, para no saturar al lector de pantalla. */
  private announceToxicity(level: string | null, toxicity: number): void {
    const label = level ? TOXICITY_LEVEL_LABELS[level] : null
    const text = label
      ? `Toxicidad ${label}: ${Math.round(toxicity)} por ciento`
      : "Toxicidad despejada"

    this.setText(this.toxicityStatusEl, text)
  }

  private setText(element: HTMLElement, text: string): void {
    if (element.textContent !== text) element.textContent = text
  }

  public resetRunHud(): void {
    this.lastToxicity = 0
    this.lastToxicityLevel = null
    this.lastToxicityVisible = false
    this.toxicityTrend = 0
    this.trendHoldUntil = 0
    this.lastTrendClass = ""
    this.toxicityTrendEl.classList.remove("up", "down")
    this.toxicityTrendEl.textContent = ""
    this.setText(this.toxicityStatusEl, "")
    this.toxicitySkullEl.classList.remove(
      "active",
      "level-low",
      "level-mid",
      "level-high",
      "level-crit",
      "cleansing",
    )
  }

  private triggerCleansing(): void {
    this.toxicitySkullEl.classList.add("cleansing")
    window.clearTimeout(this.cleansingTimeout)
    this.cleansingTimeout = window.setTimeout(() => {
      this.toxicitySkullEl.classList.remove("cleansing")
      this.cleansingTimeout = undefined
    }, CLEANSING_DURATION)
  }

  // ---------------------------------------------
  // Utilidades
  // ---------------------------------------------
  public announce(message: string): void {
    this.liveRegion.textContent = message
  }

  public showMessage(message: string, duration: number = 2000): void {
    this.currentMessage?.remove()
    window.clearTimeout(this.messageTimeout)
    this.messageTimeout = undefined

    const msgEl = document.createElement("div")
    msgEl.textContent = message
    msgEl.setAttribute("role", "status")
    msgEl.setAttribute("aria-live", "polite")
    msgEl.setAttribute("aria-atomic", "true")
    msgEl.style.cssText = `
      position: absolute;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #f7f7ff;
      font-family: ${TITLE_FONT};
      font-size: 38px;
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

  public showFloatingEco(
    value: number,
    screenX: number,
    screenY: number,
  ): void {
    const size = Math.min(36, 17 + value * 0.6)
    const color = value >= 20 ? "#ffd166" : value >= 12 ? "#7cf7d4" : "#a5f3fc"
    const duration = 1.1 + Math.min(0.5, value * 0.015)

    const el = document.createElement("div")
    el.textContent = `+${value}`
    el.style.cssText = `
      position: fixed;
      left: ${screenX}px;
      top: ${screenY}px;
      transform: translate(-50%, -50%);
      font-family: ${PARAGRAPH_FONT};
      font-size: ${size}px;
      font-weight: bold;
      color: ${color};
      text-shadow:
        0 0 6px rgba(0, 0, 0, 0.9),
        0 0 14px ${color}99;
      pointer-events: none;
      z-index: 1000;
      animation: floatUpFade ${duration}s ease-out forwards;
      will-change: transform, opacity;
    `

    document.body.appendChild(el)
    window.setTimeout(() => el.remove(), duration * 1000)
  }

  public dispose(): void {
    window.clearTimeout(this.messageTimeout)
    window.clearTimeout(this.cleansingTimeout)

    this.currentMessage?.remove()
    this.buildHudEl.remove()
    this.spinBoostHudEl.remove()
    this.boostBarEl.remove()
    this.dangerClusterEl.remove()
    this.liveRegion.remove()
  }
}
