// src/ScreenManager.ts
import {
  BIOME_ORDER,
  BIOMES,
  type RunOutcome,
  type RunSummary,
} from "@core/types"
import type { MetaState } from "@core/MetaState"

export interface ScreenCallbacks {
  onStartRun(): void
  onReturnToHub(): void
  onResetProgress(): void
}

const titleFONT = '"Pogonia", Tahoma, Geneva, Verdana, sans-serif'
const paragraphFONT = '"Geist-SemiBold", Tahoma, Geneva, Verdana, sans-serif'

const HUD_IDS = [
  "ui-overlay",
  "toxicity-bar",
  "controls-hint",
  "touch-controls",
  "build-hud",
  "pause-btn",
]

const OUTCOME_TITLES: Record<RunOutcome, string> = {
  died: "¡Se acabó! La toxicidad ganó.",
  completed: "¡Felicidades, has limpiado el océano!",
  abandoned: "Has abandonado la run. El océano seguirá su curso.",
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.style.cssText = css

  if (text !== undefined) {
    node.textContent = text
  }

  return node
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainingSeconds = total % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export class ScreenManager {
  private overlay: HTMLElement
  private callbacks: ScreenCallbacks
  private primaryAction: (() => void) | null = null

  constructor(callbacks: ScreenCallbacks) {
    this.callbacks = callbacks

    this.ensureBubbleAnimation()

    this.overlay = el(
      "div",
      `position: absolute;
      inset: 0;
      z-index: 400;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      box-sizing: border-box;
      background:
        radial-gradient(
          circle at 50% 20%,
          rgba(24, 121, 156, 0.20),
          transparent 48%
        ),
        rgba(0, 12, 30, 0.46);
      backdrop-filter: blur(4px);
      font-family: ${paragraphFONT};`,
    )

    document.getElementById("game-container")!.appendChild(this.overlay)

    window.addEventListener("keydown", (event) => {
      if (
        event.code === "Enter" &&
        !event.repeat &&
        !event.defaultPrevented &&
        this.primaryAction
      ) {
        event.preventDefault()
        this.primaryAction()
      }
    })
  }

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

    const bestBiome = bestKey
      ? `${meta.bestBiomeIndex + 1}. ${BIOMES[bestKey].name}`
      : "—"

    const start = () => this.callbacks.onStartRun()

    const title = el(
      "div",
      `width: 100%;
      box-sizing: border-box;
      overflow: visible;
      margin-bottom: 50px;
      font-family: ${titleFONT};
      font-size: clamp(68px, 10vw, 142px);
      font-weight: 900;
      font-stretch: condensed;
      line-height: 0.72;
      letter-spacing: -0.045em;
      text-align: center;
      white-space: nowrap;`,
    )

    const ocean = el(
      "span",
      `color: #efffff;
      text-shadow:
        0 5px 0 rgba(0, 44, 70, 0.72),
        0 11px 18px rgba(0, 5, 18, 0.65),
        0 0 14px rgba(220, 252, 255, 0.35);`,
      "OCEAN",
    )

    const cide = el(
      "span",
      `color: #efffff;
      background:
        linear-gradient(
          180deg,
          #ffffff 0%,
          #d8fbff 25%,
          #7cecff 55%,
          #129ec5 100%
        );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow:
        0 5px 0 rgba(0, 62, 94, 0.92),
        0 10px 0 rgba(0, 40, 65, 0.72),
        0 16px 20px rgba(7, 26, 73, 0.68),
        0 0 20px rgba(102, 241, 255, 0.42);`,
      "CIDE",
    )

    title.append(ocean, cide)

    const card = this.makeCard()

    card.append(
      title,
      this.statList([
        ["Conciencia ecológica", meta.ecoPoints.toLocaleString("es")],
        ["Mejor zona", bestBiome],
        [
          "Runs jugadas",
          `${meta.runsPlayed} (${meta.runsCompleted} completadas)`,
        ],
        ["Desechos recolectados", meta.totalDebris.toLocaleString("es")],
      ]),
      this.makeButton("Empezar", start),
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
      ["Tiempo de inmersión", formatTime(summary.durationSeconds)],
      ["Conciencia ecológica", `+${summary.ecoBase}`],
    ]

    if (summary.ecoBonus > 0) {
      rows.push(["Bono por completar", `+${summary.ecoBonus}`])
    }

    rows.push(["Total en el refugio", meta.ecoPoints.toLocaleString("es")])

    const again = () => this.callbacks.onStartRun()

    const card = this.makeCard()

    card.append(
      el(
        "div",
        `font-size: clamp(32px, 5vw, 52px);
        font-weight: bold;
        text-align: center;
        line-height: 1.1;
        font-family: ${titleFONT};
        color: #d9fbff;`,
        OUTCOME_TITLES[summary.outcome],
      ),
      this.statList(rows),
      el(
        "div",
        `font-size: 13px;
        opacity: 0.78;
        text-align: center;
        color: #bcebf6;
        font-family: ${paragraphFONT};`,
        `Semilla: ${summary.seed}`,
      ),
      this.makeButton("Nueva inmersión", again),
      this.makeButton(
        "Volver al inicio",
        () => this.callbacks.onReturnToHub(),
        false,
      ),
    )

    this.open(card, again)
  }

  public showPause(onResume: () => void, onAbandon: () => void): void {
    const card = this.makeCard()

    card.append(
      el(
        "div",
        `font-size: clamp(52px, 8vw, 78px);
        line-height: 0.9;
        letter-spacing: 0.12em;
        text-align: center;
        font-family: ${titleFONT};
        color: #d9fbff;
        text-shadow:
          0 0 12px rgba(83, 226, 255, 0.55),
          0 6px 16px rgba(0, 0, 0, 0.75);`,
        "PAUSA",
      ),
      el(
        "div",
        `text-align: center;
        font: 16px ${paragraphFONT};
        letter-spacing: 0.13em;
        color: rgba(204, 245, 255, 0.72);`,
        "El juego está detenido",
      ),
      this.makeButton("Reanudar", onResume),
      this.makeButton("Abandonar", onAbandon, false),
    )

    this.open(card, onResume)
  }

  private ensureBubbleAnimation(): void {
    if (document.getElementById("menu-bubble-animation")) return

    const style = document.createElement("style")
    style.id = "menu-bubble-animation"

    style.textContent = `
      @keyframes menuBubbleFloat {
        0% {
          transform: translate3d(0, 0, 0) scale(0.92);
          opacity: 0;
        }

        15% {
          opacity: 0.55;
        }

        80% {
          opacity: 0.42;
        }

        100% {
          transform: translate3d(18px, -170px, 0) scale(1.12);
          opacity: 0;
        }
      }
    `

    document.head.appendChild(style)
  }

  private makeCornerBubbles(): HTMLElement {
    const layer = el(
      "div",
      `position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;`,
    )

    const bubbles = [
      { size: 94, left: "4%", bottom: "8%", delay: "0s", duration: "7s" },
      { size: 48, left: "10%", bottom: "20%", delay: "-2s", duration: "6s" },
      { size: 82, left: "2%", bottom: "-4%", delay: "-4s", duration: "9s" },
      { size: 52, left: "18%", bottom: "2%", delay: "-1s", duration: "7s" },
      { size: 44, left: "24%", bottom: "14%", delay: "-5s", duration: "6s" },
      { size: 60, left: "31%", bottom: "-3%", delay: "-3s", duration: "8s" },
      { size: 46, left: "40%", bottom: "9%", delay: "-6s", duration: "6s" },
      { size: 60, left: "48%", bottom: "-5%", delay: "-2s", duration: "9s" },
      { size: 42, left: "57%", bottom: "17%", delay: "-4s", duration: "5s" },
      { size: 56, left: "65%", bottom: "3%", delay: "-7s", duration: "8s" },
      { size: 48, left: "74%", bottom: "12%", delay: "-1s", duration: "6s" },
      { size: 58, left: "83%", bottom: "-4%", delay: "-5s", duration: "10s" },

      { size: 38, right: "6%", bottom: "8%", delay: "-1s", duration: "8s" },
      { size: 56, right: "13%", bottom: "21%", delay: "-3s", duration: "6s" },
    ]

    for (const bubble of bubbles) {
      const position = [
        bubble.left ? `left: ${bubble.left};` : "",
        bubble.right ? `right: ${bubble.right};` : "",
        bubble.bottom ? `bottom: ${bubble.bottom};` : "",
      ].join(" ")

      const node = el(
        "div",
        `position: absolute;
      ${position}
      width: ${bubble.size}px;
      height: ${bubble.size}px;
      border-radius: 50%;
      box-sizing: border-box;
      opacity: 0.55;
      background:
        radial-gradient(
          circle at 30% 25%,
          rgba(255, 255, 255, 0.95) 0%,
          rgba(23, 75, 164, 0.28) 18%,
          rgba(71, 211, 238, 0.12) 48%,
          rgba(6, 107, 144, 0.05) 72%,
          transparent 73%
        );
      border: 1px solid rgba(196, 250, 255, 0.72);
      box-shadow:
        inset -3px -4px 7px rgba(0, 77, 110, 0.22),
        inset 2px 2px 5px rgba(255, 255, 255, 0.35),
        0 0 12px rgba(91, 236, 255, 0.28);
      animation:
        menuBubbleFloat ${bubble.duration} ease-in-out ${bubble.delay} infinite;`,
      )

      layer.append(node)
    }

    return layer
  }

  private open(container: HTMLElement, primary: () => void): void {
    this.overlay.replaceChildren(this.makeCornerBubbles(), container)

    this.overlay.style.display = "flex"
    this.primaryAction = primary
    this.setHudVisible(false)
  }

  private setHudVisible(visible: boolean): void {
    for (const id of HUD_IDS) {
      const node = document.getElementById(id)

      if (node) {
        node.style.display = visible ? "" : "none"
      }
    }
  }

  private makeCard(): HTMLElement {
    return el(
      "div",
      `position: relative;
      z-index: 1;
      width: min(900px, 92vw);
      max-height: 88dvh;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      padding: clamp(20px, 4vw, 48px);
      display: flex;
      flex-direction: column;
      gap: 18px;
      color: #f7f7ff;
      background: transparent;
      border: none;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: none;`,
    )
  }

  private statList(rows: [string, string][]): HTMLElement {
    const list = el(
      "div",
      `display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 40px;
      padding: 12px 0 6px;
      margin-bottom: 18px;
      `,
    )

    for (const [label, value] of rows) {
      const row = el(
        "div",
        `display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
        font-family: ${paragraphFONT};`,
      )

      row.append(
        el(
          "span",
          `min-width: 0;
          font-size: 16px;
          color: rgba(227, 249, 255, 0.82);`,
          label,
        ),
        el(
          "span",
          `min-width: 0;
          text-align: right;
          overflow-wrap: anywhere;
          font-size: 16px;
          color: #9cf3ff;
          font-weight: bold;`,
          value,
        ),
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
      `width: 100%;
      min-height: 58px;
      padding: 12px 22px;
      border-radius: 30px 60px;
      cursor: pointer;
       background:  rgba(0, 44, 70, 0.52);
      font: bold 19px ${titleFONT};
      letter-spacing: 0.04em;
      color: ${primary ? "#d9f8ff" : "#d9f8ff"};
      transition:
        transform 150ms ease,
        filter 150ms ease,
        background 150ms ease;`,
      label,
    )

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)"
      btn.style.filter = "brightness(1.32)"
    })

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)"
      btn.style.filter = "brightness(1)"
    })

    btn.addEventListener("focus", () => {
      btn.style.outline = "2px solid #baf8ff"
      btn.style.outlineOffset = "3px"
    })

    btn.addEventListener("blur", () => {
      btn.style.outline = "none"
    })

    btn.addEventListener("click", onClick)

    return btn
  }
}
