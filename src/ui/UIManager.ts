// src/ui/UIManager.ts
// Clase encargada de actualizar los elementos de la interfaz de usuario (HUD) y mostrar mensajes en pantalla.

import type { GameState } from "@core/types"

// El aviso de toxicidad se muestra una vez por run, la primera vez que
// aparece la calavera. No se persiste entre sesiones.
const TOXICITY_HINT_DURATION = 7000 // ms visible

const CLEANSING_DURATION = 600 // ms del flash verde al bajar la toxicidad
// Con el rediseño, cada desecho reduce ~1.2 de toxicidad.
// Threshold bajo para que cada recolección dispare el flash.
const CLEANSING_THRESHOLD = 0.5

export class UIManager {
  private debrisCountEl: HTMLElement
  private ecoAwarenessEl: HTMLElement
  private zoneProgressEl: HTMLElement
  private toxicitySkullEl: HTMLElement
  private toxicitySkullFillEl: SVGRectElement

  private buildHudEl: HTMLElement
  private spinBoostHudEl: HTMLElement
  private lastBuildHud = ""
  private lastSpinBoostVisible = false

  // Estado cacheado para evitar tocar el DOM cada frame
  private lastToxicityLevel: string | null = null
  private lastToxicityVisible = false
  private lastToxicity = 0
  private cleansingTimeout?: number

  // Hint de toxicidad: se resetea al empezar cada run
  private toxicityHintShownThisRun = false
  private toxicityHintEl?: HTMLElement
  private toxicityHintTimeout?: number

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
      btn.blur()
      onClick()
    })
    document.getElementById("game-container")!.appendChild(btn)
  }

  /** Indicador de la estructura que se puede construir. */
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

    const multiplier = 1 + boost * 0.6
    this.spinBoostHudEl.textContent = `DASH ×${multiplier.toFixed(2)}`
  }

  /** Actualiza el HUD con el estado del juego. */
  public updateUI(state: GameState): void {
    this.debrisCountEl.textContent = state.debrisCollected.toString()
    this.ecoAwarenessEl.textContent = state.ecoAwareness.toString()
    this.zoneProgressEl.textContent = `${Math.round(state.zoneProgress)}%`

    // Toxicidad: 0..100
    const toxicity = Math.min(state.toxicity, 100)

    // Primera vez que aparece la calavera en esta run: se explica
    if (!this.toxicityHintShownThisRun && toxicity > 0.5) {
      this.showToxicityHint()
    }

    // Relleno vertical: sube desde abajo.
    // viewBox tiene altura 120. translateY(120) = vacío, translateY(0) = lleno.
    const fillY = 120 - (toxicity / 100) * 120
    this.toxicitySkullFillEl.style.transform = `translateY(${fillY}px)`

    // Visibilidad: solo cambia si el estado cambió
    const visible = toxicity > 0.5
    if (visible !== this.lastToxicityVisible) {
      this.toxicitySkullEl.classList.toggle("active", visible)
      this.lastToxicityVisible = visible
    }

    // Feedback de "limpieza": si la toxicidad bajó de forma notable
    if (
      this.lastToxicity > 1 &&
      toxicity < this.lastToxicity - CLEANSING_THRESHOLD
    ) {
      this.triggerCleansing()
    }
    this.lastToxicity = toxicity

    // Nivel: solo actualiza si cambió
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
  }

  /**
   * Resetea los avisos de "primera vez por run". Llamar al empezar una run.
   * También resetea el estado cacheado para que el próximo bioma se vea limpio.
   */
  public resetRunHints(): void {
    this.toxicityHintShownThisRun = false
    this.hideToxicityHint()

    // Resetear cachés de toxicidad para que no arrastren estado de la run anterior
    this.lastToxicity = 0
    this.lastToxicityLevel = null
    this.lastToxicityVisible = false
    this.toxicitySkullEl.classList.remove(
      "active",
      "level-low",
      "level-mid",
      "level-high",
      "level-crit",
      "cleansing",
    )
  }

  /** Flash verde breve cuando la toxicidad baja. */
  private triggerCleansing(): void {
    this.toxicitySkullEl.classList.add("cleansing")

    window.clearTimeout(this.cleansingTimeout)
    this.cleansingTimeout = window.setTimeout(() => {
      this.toxicitySkullEl.classList.remove("cleansing")
      this.cleansingTimeout = undefined
    }, CLEANSING_DURATION)
  }

  /**
   * Aviso de primera vez bajo la calavera. No pausa el juego, se desvanece solo.
   * Se muestra una vez por run.
   */
  private showToxicityHint(): void {
    this.toxicityHintShownThisRun = true

    const container = document.getElementById("game-container")!

    // Posición fija: debajo de la calavera en desktop, más abajo en móvil.
    // Evita getBoundingClientRect, que es frágil si hay transformaciones.
    const isMobile = window.innerWidth <= 700
    const top = isMobile ? 150 : 130

    const hint = document.createElement("div")
    hint.id = "toxicity-hint"
    hint.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: min(320px, 86vw);
      padding: 10px 16px;
      text-align: center;
      line-height: 1.35;
      font-family: "Geist-Semibold", sans-serif;
      color: #f7f7ff;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 8px;
      pointer-events: none;
      z-index: 160;
      animation: fadeInOut ${TOXICITY_HINT_DURATION}ms ease-in-out forwards;
    `

    const title = document.createElement("div")
    title.textContent = "TOXICIDAD"
    title.style.cssText =
      "font-size: 12px; letter-spacing: 0.12em; color: #ff9a9a; margin-bottom: 4px;"

    const body = document.createElement("div")
    body.textContent =
      "Si se llena, la tortuga muere. Recoge desechos o construye una esfera filtradora para bajarla."
    body.style.cssText = "font-size: 14px;"

    hint.append(title, body)
    container.appendChild(hint)
    this.toxicityHintEl = hint

    this.toxicityHintTimeout = window.setTimeout(() => {
      hint.remove()
      if (this.toxicityHintEl === hint) this.toxicityHintEl = undefined
      this.toxicityHintTimeout = undefined
    }, TOXICITY_HINT_DURATION)
  }

  /** Oculta el aviso de toxicidad si está en pantalla (p. ej. al terminar la run). */
  public hideToxicityHint(): void {
    window.clearTimeout(this.toxicityHintTimeout)
    this.toxicityHintTimeout = undefined
    this.toxicityHintEl?.remove()
    this.toxicityHintEl = undefined
  }

  /** Muestra un mensaje temporal en pantalla. */
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

  /** Limpia timeouts y elementos temporales. Llamar al destruir el juego. */
  public dispose(): void {
    window.clearTimeout(this.messageTimeout)
    window.clearTimeout(this.toxicityHintTimeout)
    window.clearTimeout(this.cleansingTimeout)

    this.currentMessage?.remove()
    this.toxicityHintEl?.remove()
    this.buildHudEl.remove()
    this.spinBoostHudEl.remove()
  }
}
