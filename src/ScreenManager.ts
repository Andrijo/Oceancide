// src/ScreenManager.ts
// Pantallas del juego: Refugio (hub) y resumen de run.

import { BIOME_ORDER, BIOMES, type RunOutcome, type RunSummary } from "./types"
import type { MetaState } from "./MetaState"

export interface ScreenCallbacks {
  onStartRun(): void
  onReturnToHub(): void
  onResetProgress(): void
}

const titleFONT = '"Pogonia", Tahoma, Geneva, Verdana, sans-serif'
const paragraphFONT = '"Geist-SemiBold", Tahoma, Geneva, Verdana, sans-serif'

// Elementos del HUD que se ocultan fuera de la run
const HUD_IDS = [
  "ui-overlay",
  "toxicity-bar",
  "controls-hint",
  "touch-controls",
  "build-hud",
]

const OUTCOME_TITLES: Record<RunOutcome, string> = {
  died: "¡Se acabó! Lo lograron, la toxicidad ganó, el océano.",
  completed: "¡Has limpiado el océano!",
  abandoned: "Has abandonado la run. El océano sigue su curso.",
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.style.cssText = css
  if (text !== undefined) node.textContent = text
  return node
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export class ScreenManager {
  private overlay: HTMLElement
  private callbacks: ScreenCallbacks
  private primaryAction: (() => void) | null = null

  constructor(callbacks: ScreenCallbacks) {
    this.callbacks = callbacks

    this.overlay = el(
      "div",
      `position: absolute; inset: 0; z-index: 400; display: none;
       align-items: center; justify-content: center;
       background: rgba(0, 20, 40, 0.55); backdrop-filter: blur(3px);
       font-family: ${paragraphFONT};`,
    )
    document.getElementById("game-container")!.appendChild(this.overlay)

    // Enter = acción principal de la pantalla abierta
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !e.repeat && this.primaryAction) {
        e.preventDefault()
        this.primaryAction()
      }
    })
  }

  /** Cierra cualquier pantalla y muestra el HUD de la run. */
  public hide(): void {
    this.overlay.style.display = "none"
    this.overlay.replaceChildren()
    this.primaryAction = null
    this.setHudVisible(true)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  public showHub(meta: MetaState): void {
    const bestKey = BIOME_ORDER[meta.bestBiomeIndex]
    const best = bestKey
      ? `${meta.bestBiomeIndex + 1}. ${BIOMES[bestKey].name}`
      : "—"
    const start = () => this.callbacks.onStartRun()

    const card = this.makeCard()
    card.append(
      el(
        "div",
        `font-size: 54px; letter-spacing: 1.2px; text-align: center; font-family: ${titleFONT}; z-index: 2000;`,
        "OCEANCIDE",
      ),
      this.statList([
        ["Conciencia Ecológica", meta.ecoPoints.toLocaleString("es")],
        ["Mejor zona", best],
        [
          "Runs jugadas",
          `${meta.runsPlayed} (${meta.runsCompleted} completadas)`,
        ],
        ["Desechos recolectados", meta.totalDebris.toLocaleString("es")],
      ]),
      this.makeButton("Iniciar run", start),
      this.makeButton(
        "Eliminar progreso",
        () => {
          if (
            window.confirm(
              "¿Está seguro de que desea eliminar todo el progreso guardado?",
            )
          ) {
            this.callbacks.onResetProgress()
          }
        },
        false,
      ),
    )
    this.open(card, start)
  }

  public showSummary(summary: RunSummary, meta: MetaState): void {
    const rows: [string, string][] = [
      ["Zona alcanzada", `${summary.biomeIndex + 1}. ${summary.biomeName}`],
      ["Desechos recolectados", String(summary.debrisCollected)],
      ["Tiempo", formatTime(summary.durationSeconds)],
      ["Conciencia Ecológica", `+${summary.ecoBase}`],
    ]
    if (summary.ecoBonus > 0) {
      rows.push(["Bono por completar", `+${summary.ecoBonus}`])
    }
    rows.push(["Total en el Refugio", meta.ecoPoints.toLocaleString("es")])

    const again = () => this.callbacks.onStartRun()

    const card = this.makeCard()
    card.append(
      el(
        "div",
        `font-size: 24px; font-weight: bold; text-align: center; line-height: 1.70; font-family: ${titleFONT};`,
        OUTCOME_TITLES[summary.outcome],
      ),
      this.statList(rows),
      el(
        "div",
        `font-size: 14px; opacity: 0.8; text-align: center; font-family: ${paragraphFONT};`,
        `Semilla: ${summary.seed}`,
      ),
      this.makeButton("Nueva run", again),
      this.makeButton(
        "Volver al Refugio",
        () => this.callbacks.onReturnToHub(),
        false,
      ),
    )
    this.open(card, again)
  }

  // ---------- Helpers ----------

  private open(card: HTMLElement, primary: () => void): void {
    this.overlay.replaceChildren(card)
    this.overlay.style.display = "flex"
    this.primaryAction = primary
    this.setHudVisible(false)
  }

  private setHudVisible(visible: boolean): void {
    for (const id of HUD_IDS) {
      const node = document.getElementById(id)
      if (node) node.style.display = visible ? "" : "none"
    }
  }

  private makeCard(): HTMLElement {
    return el(
      "div",
      `width: min(420px, 90vw); max-height: 90dvh; overflow-y: auto;
       padding: 25px; display: flex; flex-direction: column; gap: 14px;
       color: #f7f7ff; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
       background: none;`,
    )
  }

  private statList(rows: [string, string][]): HTMLElement {
    const list = el("div", "display: flex; flex-direction: column; gap: 8px;")
    for (const [label, value] of rows) {
      const row = el(
        "div",
        `display: flex; justify-content: space-between; gap: 16px;
         padding: 10px 12px; background: rgba(0, 0, 0, 0.45); border-radius: 8px;`,
      )
      row.append(
        el(
          "span",
          `opacity: 0.85; font-size: 14px; font-family: ${paragraphFONT};`,
          label,
        ),
        el("span", `text-align: right; font-family: ${paragraphFONT};`, value),
      )
      list.append(row)
    }
    return list
  }

  private makeButton(
    label: string,
    onClick: () => void,
    primary = true,
  ): HTMLButtonElement {
    const btn = el(
      "button",
      `min-height: 48px; padding: 12px 22px; cursor: pointer;
       font: bold 16px ${titleFONT}; color: #f7f7ff; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
       background: none; border: none; outline: none;
       border: 2px solid rgba(100, 200, 255, 0.4); border-radius: 10px;`,
      label,
    )
    btn.addEventListener("click", onClick)
    return btn
  }
}
