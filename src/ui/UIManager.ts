// src/ui/UIManager.ts
import type { GameState } from "@core/types"

const CLEANSING_DURATION = 600
const CLEANSING_THRESHOLD = 0.5
const TUTORIAL_SEEN_KEY = "oceancide.tutorial.seen"

function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1")
  } catch {}
}

type HintData = { id: string; title: string; body: string }

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicitySkullEl: HTMLElement
  private toxicitySkullFillEl: SVGRectElement
  private toxicityTrendEl: HTMLElement
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

  // Sistema de tutoriales pasivos (Toasts)
  private tutorialSeen = hasSeenTutorial()
  private hintQueue: HintData[] = []
  private activeHintEl: HTMLElement | null = null
  private hintTimeout?: number
  private hintQueueRunning = false
  private toxicityHintQueuedThisRun = false

  // Sistema de tutoriales interactivos (Action Hints)
  private activeActionHintId: string | null = null
  private actionHintEl?: HTMLElement

  private currentMessage?: HTMLElement
  private messageTimeout?: number

  constructor() {
    this.debrisCountEl = document.getElementById("debris-count")!
    this.ecoAwarenessEl = document.getElementById("eco-awareness")!
    this.zoneProgressEl = document.getElementById("zone-progress")!
    this.toxicitySkullEl = document.getElementById("toxicity-skull")!
    this.toxicitySkullFillEl = document.querySelector<SVGRectElement>(
      "#toxicity-skull-fill",
    )!

    // Cluster de peligro (arriba centro)
    this.dangerClusterEl = document.createElement("div")
    this.dangerClusterEl.id = "danger-cluster"

    this.biomeTimerEl = document.createElement("div")
    this.biomeTimerEl.id = "biome-timer"
    this.biomeTimerEl.style.cssText = `
      position: relative;
      padding: 4px 12px;
      font-family: "Geist-Semibold", sans-serif;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 0.06em;
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

    // HUD del boost de giro
    this.spinBoostHudEl = document.createElement("div")
    this.spinBoostHudEl.id = "spin-boost-hud"
    this.spinBoostHudEl.style.cssText = `
      position: absolute;
      bottom: 100px;
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
    this.debrisCountEl.textContent = state.debrisCollected.toString()
    this.ecoAwarenessEl.textContent = Math.floor(state.ecoAwareness).toString()
    this.zoneProgressEl.textContent = `${Math.round(state.zoneProgress)}%`

    const toxicity = Math.min(state.toxicity, 100)

    const toxicityDelta = toxicity - this.lastToxicity
    this.toxicityTrend += (toxicityDelta - this.toxicityTrend) * 0.2

    if (!this.toxicityHintQueuedThisRun && toxicity > 0.5) {
      this.toxicityHintQueuedThisRun = true
      this.enqueueHint(
        "toxicity",
        "TOXICIDAD",
        "Si se llena, la tortuga muere. Recoge desechos o construye una esfera filtradora para bajarla.",
      )
    }

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

  public resetRunHints(): void {
    this.toxicityHintQueuedThisRun = false
    this.lastToxicity = 0
    this.lastToxicityLevel = null
    this.lastToxicityVisible = false
    this.toxicityTrend = 0
    this.trendHoldUntil = 0
    this.lastTrendClass = ""
    this.toxicityTrendEl.classList.remove("up", "down")
    this.toxicityTrendEl.textContent = ""
    this.toxicitySkullEl.classList.remove(
      "active",
      "level-low",
      "level-mid",
      "level-high",
      "level-crit",
      "cleansing",
    )
  }

  public markTutorialComplete(): void {
    this.tutorialSeen = true
    markTutorialSeen()
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
  // Tutoriales Pasivos (Toasts)
  // ---------------------------------------------
  public enqueueHint(id: string, title: string, body: string): void {
    if (
      this.tutorialSeen ||
      this.hintQueue.some((h) => h.id === id) ||
      this.activeHintEl?.dataset.id === id
    ) {
      return
    }

    this.hintQueue.push({ id, title, body })
    this.processHintQueue()
  }

  private processHintQueue(): void {
    if (this.hintQueueRunning || this.hintQueue.length === 0) return
    this.hintQueueRunning = true
    const hint = this.hintQueue.shift()!
    this.showHintToast(hint)
  }

  private showHintToast(hint: HintData): void {
    const container = document.getElementById("game-container")!

    const el = document.createElement("div")
    el.dataset.id = hint.id
    el.style.cssText = `
    position: absolute;
    top: 20%;
    left: 50%;
    transform: translate(-50%, -20px);
    width: max-content;
    max-width: min(380px, 90vw);
    padding: 12px 18px;
    background: rgba(0, 15, 25, 0.85);
    border: 1px solid rgba(124, 247, 212, 0.4);
    border-radius: 12px;
    color: #f7f7ff;
    font-family: "Geist-SemiBold", sans-serif;
    text-align: center;
    backdrop-filter: blur(4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(124, 247, 212, 0.1);
    pointer-events: none;
    z-index: 2000;
    opacity: 0;
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  `

    const titleEl = document.createElement("div")
    titleEl.textContent = hint.title
    titleEl.style.cssText = `
    color: #7cf7d4;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 4px;
  `

    const bodyEl = document.createElement("div")
    bodyEl.textContent = hint.body
    bodyEl.style.cssText = "font-size: 14px; line-height: 1.4; opacity: 0.9;"

    el.append(titleEl, bodyEl)
    container.appendChild(el)
    this.activeHintEl = el

    requestAnimationFrame(() => {
      el.style.opacity = "1"
      el.style.transform = "translate(-50%, 0)"
    })

    this.hintTimeout = window.setTimeout(() => {
      this.hideCurrentHint()
    }, 4500)
  }

  private hideCurrentHint(): void {
    if (!this.activeHintEl) return

    window.clearTimeout(this.hintTimeout)
    this.activeHintEl.style.opacity = "0"
    this.activeHintEl.style.transform = "translate(-50%, -10px)"

    const elToRemove = this.activeHintEl
    this.activeHintEl = null

    setTimeout(() => {
      elToRemove.remove()
      setTimeout(() => {
        this.hintQueueRunning = false
        this.processHintQueue()
      }, 500)
    }, 400)
  }

  // ---------------------------------------------
  // Tutoriales Interactivos (Action Hints)
  // ---------------------------------------------

  /** Inyecta las animaciones necesarias si no existen */
  private ensureActionHintAnimation(): void {
    if (document.getElementById("action-hint-anim")) return
    const style = document.createElement("style")
    style.id = "action-hint-anim"
    style.textContent = `
      @keyframes popIn {
        to { transform: scale(1); }
      }
      @keyframes pulseKey {
        0%, 100% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.05); filter: brightness(1.2); }
      }
    `
    document.head.appendChild(style)
  }

  /** Muestra un cartel en el centro y congela el juego hasta que se complete la acción. */
  public showActionHint(
    id: string,
    title: string,
    body: string,
    keycap: string,
  ): void {
    if (this.activeActionHintId || this.tutorialSeen) return

    this.ensureActionHintAnimation()
    this.activeActionHintId = id
    const container = document.getElementById("game-container")!

    const overlay = document.createElement("div")
    overlay.id = "action-hint-overlay"
    overlay.style.cssText = `
    position: absolute;
    inset: 0;
    background: rgba(0, 10, 20, 0.4);
    backdrop-filter: blur(2px);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none; /* Permite mover la tortuga detrás */
    animation: fadeInOut 300ms ease-out forwards;
  `

    const card = document.createElement("div")
    card.style.cssText = `
    background: rgba(0, 20, 30, 0.95);
    border: 2px solid #7cf7d4;
    border-radius: 16px;
    padding: 24px 40px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), inset 0 0 30px rgba(124, 247, 212, 0.15);
    font-family: "Geist-SemiBold", sans-serif;
    color: #f7f7ff;
    transform: scale(0.9);
    animation: popIn 400ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  `

    const titleEl = document.createElement("div")
    titleEl.textContent = title
    titleEl.style.cssText = `
    color: #7cf7d4;
    font-size: 14px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 8px;
  `

    const bodyEl = document.createElement("div")
    bodyEl.textContent = body
    bodyEl.style.cssText =
      "font-size: 18px; line-height: 1.4; margin-bottom: 20px;"

    const keyEl = document.createElement("div")
    keyEl.textContent = keycap
    keyEl.style.cssText = `
    display: inline-block;
    padding: 10px 20px;
    font-family: "Pogonia", sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: #0a1306;
    background: #7cf7d4;
    border-radius: 8px;
    box-shadow: 0 4px 0 #005f73;
    animation: pulseKey 1.5s infinite;
  `

    card.append(titleEl, bodyEl, keyEl)
    overlay.appendChild(card)
    container.appendChild(overlay)
    this.actionHintEl = overlay
  }

  /** Comprueba si el juego está congelado esperando una acción. */
  public hasActiveActionHint(): boolean {
    return this.activeActionHintId !== null
  }

  /** El jugador hizo la acción, quitamos el cartel y despausamos. */
  public resolveActionHint(id: string): void {
    if (this.activeActionHintId !== id || !this.actionHintEl) return

    this.actionHintEl.style.opacity = "0"
    this.actionHintEl.style.transition = "opacity 300ms ease"

    const elToRemove = this.actionHintEl
    this.activeActionHintId = null
    this.actionHintEl = undefined

    setTimeout(() => elToRemove.remove(), 300)
  }

  // ---------------------------------------------
  // Utilidades
  // ---------------------------------------------
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

  public showFloatingEco(
    value: number,
    screenX: number,
    screenY: number,
  ): void {
    const size = Math.min(34, 16 + value * 0.6)
    const color = value >= 20 ? "#ffd166" : value >= 12 ? "#7cf7d4" : "#a5f3fc"
    const duration = 1.1 + Math.min(0.5, value * 0.015)

    const el = document.createElement("div")
    el.textContent = `+${value}`
    el.style.cssText = `
      position: fixed;
      left: ${screenX}px;
      top: ${screenY}px;
      transform: translate(-50%, -50%);
      font-family: "Geist-Semibold", sans-serif;
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
    window.clearTimeout(this.hintTimeout)

    this.currentMessage?.remove()
    this.activeHintEl?.remove()
    this.actionHintEl?.remove()
    this.buildHudEl.remove()
    this.spinBoostHudEl.remove()
    this.boostBarEl.remove()
    this.dangerClusterEl.remove()
  }
}
