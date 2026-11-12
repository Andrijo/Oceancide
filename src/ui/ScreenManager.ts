import {
  BIOME_ORDER,
  BIOMES,
  type RunOutcome,
  type RunSummary,
} from "@core/types"
import { computeEndlessEco, type MetaState } from "@core/MetaState"
import type { Card, CardRarity } from "@cards/Card"
import {
  cardValueParts,
  cardValueSeparator,
  cardValueText,
  type CardTone,
} from "@cards/CardEffects"
import { CARD_POOL } from "@cards/CardPool"
import {
  previewLineText,
  type BuildStatLine,
  type CardPreviewLine,
} from "@cards/BuildStats"
import { revealCards } from "@ui/animations"
import { ChoiceGuard, isRepeatedActivation } from "@ui/choiceGuard"
import { PARAGRAPH_FONT, TITLE_FONT, TITULO_FONT } from "@ui/fonts"
import { MIST } from "@ui/palette"
import { createHowToPlayBody } from "@ui/HowToPlay"
import {
  cancelKeyCapture,
  createSettingsBody,
  isKeyCaptureActive,
  type SettingsPatch,
} from "@ui/SettingsScreen"
import type { ControlDevice } from "@ui/controlLabels"
import {
  activateFocused,
  moveFocus,
  pickNeighbor,
  scrollFocused,
  type Direction,
} from "@ui/focusNav"
import { createDefaultSettings, type Settings } from "@core/settings"
import { SEMANTIC, tint } from "@ui/colorVision"

/** Clase que añade ▲ o ▼ con el modo para daltonismo (ver styles.css). */
function toneMarkClass(tone: "positive" | "negative"): string {
  return tone === "positive" ? "tone-mark-good" : "tone-mark-bad"
}
import { UPGRADES } from "@/tycoon/Upgrades"
import { UpgradeManager } from "@/tycoon/UpgradeManager"
import { type GameEvent, type EventOption } from "@/events/EventPool"
import type { EventPreview } from "@/events/EventEffects"

export interface ScreenCallbacks {
  onStartRun(): void
  onStartEndless(): void
  onReturnToHub(): void
  onResetProgress(): void
  onSaveMeta(): void
  /** Estado que necesita la pantalla "Cómo jugar". */
  getHelpState(): HelpState
  onSetTipsEnabled(enabled: boolean): void
  /** Olvida los avisos vistos para que vuelvan a salir. */
  onResetTips(): void
  getSettings(): Settings
  /** Cambia (y guarda) los ajustes indicados; se aplican al momento. */
  onUpdateSettings(patch: SettingsPatch): void
  /**
   * Escucha el siguiente botón del mando para reasignarlo (`null` si se
   * cancela). Devuelve la función que deja de escuchar.
   */
  capturePadButton(onButton: (button: number | null) => void): () => void
}

export interface HelpState {
  /** Dispositivo con el que juega (teclado, táctil o mando). */
  controls: ControlDevice
  tipsEnabled: boolean
  /** Cuántos avisos ha visto ya. */
  seenTips: number
}

export interface RunInfo {
  biomeIndex: number
  biomeName: string
  depth: number
  ecoAwareness: number
  /** Inmersión sin fin: Eco asegurado al cerrar la última vuelta. */
  ecoBanked?: number
  /** Atributos actuales de la tortuga, listos para pintar. */
  stats: BuildStatLine[]
  /** Cartas elegidas en esta run, en orden. */
  cards: Card[]
  /** Nombres de las reliquias encontradas, en orden. */
  relics: string[]
}

const RARITY_COLORS: Record<CardRarity, string> = {
  common: "#94a3b8",
  rare: "#38bdf8",
  epic: "#a855f7",
  legendary: "#fbbf24",
  curse: "#ef4444",
  ultra_legendary: "#0a9396",
  chaos: "#fb923c",
}

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Común",
  rare: "Rara",
  epic: "Épica",
  legendary: "Legendaria",
  curse: "Maldición",
  ultra_legendary: "Ultra Legendaria",
  chaos: "Caos",
}

const RARITY_BACKGROUNDS: Record<CardRarity, string> = {
  common: "#2b3542",
  rare: "#17456b",
  epic: "#4a1f6e",
  legendary: "#6e4a10",
  curse: "#6e1c1c",
  ultra_legendary: "#003d4d",
  chaos: "#2a1008",
}

const HUD_IDS = [
  "ui-overlay",
  "toxicity-skull",
  "biome-timer",
  "hud-bottom", // impulso, dash y filtro
  "controls-hint",
  "touch-controls",
  "pause-btn",
  "tip-toast",
  "revive-hud",
]

const OUTCOME_TITLES: Record<RunOutcome, string> = {
  died: "La toxicidad ganó",
  completed: "Océano limpio",
  abandoned: "Inmersión abandonada",
}

const OUTCOME_COLORS: Record<RunOutcome, string> = {
  died: "#ff7a6b",
  completed: "#7cf7d4",
  abandoned: "#f5eedd",
}

const CARD_KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
}

/** Dirección de cada flecha. */
const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
}

const HUB_ACCENT = MIST
const UPGRADE_ACCENT = HUB_ACCENT
const UPGRADE_TEXT = MIST

const ICONS = {
  trash: [
    "M3 6h18",
    "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
    "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
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

function icon(paths: string[], size = 20, fill = false): HTMLElement {
  const span = el(
    "span",
    `display: inline-flex;
    flex: none;
    width: ${size}px;
    height: ${size}px;`,
  )

  span.setAttribute("aria-hidden", "true")

  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    width="${size}" height="${size}"
    fill="${fill ? "currentColor" : "none"}"
    stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    ${paths.map((d) => `<path d="${d}"/>`).join("")}
  </svg>`

  return span
}

function formatTime(seconds: number): string {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainingSeconds = total % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

type ActionVariant = "primary" | "danger" | "neutral" | "upgrade"

export class ScreenManager {
  private overlay: HTMLElement
  private callbacks: ScreenCallbacks
  private primaryAction: (() => void) | null = null
  private cardChoiceActive = false
  private cardChoiceHandler: ((index: number) => void) | null = null
  private eventActive = false
  private eventChoiceHandler: ((index: number) => void) | null = null
  /** Bloqueo breve al abrir cartas o eventos contra elecciones accidentales. */
  private choiceGuard = new ChoiceGuard()
  /**
   * Durante el keyup de un Espacio/Enter "viejo" (pulsado antes de abrir la
   * elección o durante el bloqueo): el clic que genera el navegador no elige.
   */
  private suppressActivation = false
  /** Pantalla de ajustes abierta: el juego no debe reaccionar al teclado. */
  private settingsActive = false
  /** Qué hace Esc en la pantalla actual (volver), si hace algo. */
  private escapeAction: (() => void) | null = null
  /** Qué hace el botón "volver" del mando en la pantalla actual. */
  private backAction: (() => void) | null = null

  constructor(callbacks: ScreenCallbacks) {
    this.callbacks = callbacks

    this.ensureBubbleAnimation()
    this.ensureUltraGlowAnimation()
    this.ensureChaosGlitchAnimation()
    this.ensureEventStyles()

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return

      const handler = this.cardChoiceActive
        ? this.cardChoiceHandler
        : this.eventActive
          ? this.eventChoiceHandler
          : null
      if (!handler) return

      const idx = CARD_KEYS[e.code]
      if (idx === undefined) return

      e.preventDefault()
      handler(idx)
    })

    this.overlay = el(
      "div",
      `position: absolute;
      inset: 0;
      z-index: 400;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0;
      box-sizing: border-box;
      background: rgba(0, 12, 30, 0.55);
      backdrop-filter: blur(4px);
      font-family: ${PARAGRAPH_FONT};`,
    )

    this.overlay.setAttribute("role", "dialog")
    this.overlay.setAttribute("aria-modal", "true")

    document.getElementById("game-container")!.appendChild(this.overlay)

    // En cartas y eventos, Enter o Espacio mantenidos no activan el botón
    // enfocado: una tecla que viniera pulsada elegiría sin leer. En captura,
    // para registrar la tecla antes de que el botón reaccione.
    window.addEventListener(
      "keydown",
      (event) => {
        if (!this.cardChoiceActive && !this.eventActive) return
        this.choiceGuard.keyDown(event.key, event.repeat)
        if (isRepeatedActivation(event)) event.preventDefault()
      },
      true,
    )

    // El Espacio activa el botón al soltarse: si se pulsó antes de abrir la
    // elección (backflip) o durante el bloqueo, ese clic no cuenta.
    window.addEventListener(
      "keyup",
      (event) => {
        if (!this.cardChoiceActive && !this.eventActive) return
        if (!this.choiceGuard.keyUp(event.key)) return
        event.preventDefault()
        this.suppressActivation = true
        setTimeout(() => {
          this.suppressActivation = false
        }, 0)
      },
      true,
    )

    // Mantener el foco dentro del diálogo mientras haya una elección abierta.
    this.overlay.addEventListener("keydown", (event) => {
      if (this.overlay.style.display === "none" || event.key !== "Tab") {
        return
      }

      const focusable = Array.from(
        this.overlay.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    })

    // Esc vuelve atrás en las subpantallas que lo permiten (ajustes). En
    // captura y sin propagar: si no, el juego lo recibiría después como
    // "alternar pausa" y reanudaría la inmersión.
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.code !== "Escape" || !this.escapeAction) return
        // Esc cancela la reasignación de una tecla, no cierra los ajustes.
        if (isKeyCaptureActive()) return
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) this.escapeAction()
      },
      true,
    )

    window.addEventListener("keydown", (event) => {
      if (
        event.code !== "Enter" ||
        event.repeat ||
        event.defaultPrevented ||
        !this.primaryAction
      ) {
        return
      }

      // Si hay un control enfocado, Enter debe activarlo a él (o no hacer
      // nada, en un slider o una casilla), no la acción principal del overlay.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest(
          "button, a[href], [role='button'], input, select, textarea",
        )
      ) {
        return
      }

      event.preventDefault()
      this.primaryAction()
    })
  }

  public hide(): void {
    cancelKeyCapture()
    this.overlay.style.display = "none"
    this.overlay.replaceChildren()
    this.primaryAction = null
    this.cardChoiceActive = false
    this.cardChoiceHandler = null
    this.eventActive = false
    this.eventChoiceHandler = null
    this.settingsActive = false
    this.escapeAction = null
    this.backAction = null
    this.overlay.removeAttribute("aria-labelledby")
    this.overlay.removeAttribute("aria-describedby")
    this.setHudVisible(true)

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  public isCardChoiceActive(): boolean {
    return this.cardChoiceActive
  }

  public isEventActive(): boolean {
    return this.eventActive
  }

  public isSettingsActive(): boolean {
    return this.settingsActive
  }

  /** Hay una pantalla abierta (menú, pausa, cartas, evento...). */
  public isOpen(): boolean {
    return this.overlay.style.display !== "none"
  }

  // --- Mando: navegación por la pantalla abierta ---

  public navigateFocus(direction: Direction): void {
    if (!this.isOpen() || isKeyCaptureActive()) return
    moveFocus(this.overlay, direction)
  }

  public activateFocus(): void {
    if (!this.isOpen() || isKeyCaptureActive()) return
    activateFocused(this.overlay)
  }

  /** Vuelve a la pantalla anterior (o reanuda, en la pausa), si se puede. */
  public goBack(): void {
    if (!this.isOpen()) return
    // Esperando una tecla nueva, "volver" solo cancela la espera.
    if (isKeyCaptureActive()) {
      cancelKeyCapture()
      return
    }
    this.backAction?.()
  }

  public scrollBy(pixels: number): void {
    if (this.isOpen()) scrollFocused(this.overlay, pixels)
  }

  /**
   * @param focus Botón que recibe el foco al volver de una subpantalla, para
   *   no perder la posición al navegar con teclado. Por defecto, "Empezar".
   */
  public showHub(
    meta: MetaState,
    focus?: "upgrades" | "help" | "settings",
  ): void {
    this.ensureHubAnimation()

    const bestIndex = meta.bestBiomeIndex
    const bestKey = BIOME_ORDER[bestIndex]
    const bestBiome = bestKey
      ? `${bestIndex + 1}. ${BIOMES[bestKey].name}`
      : "—"

    const start = () => this.callbacks.onStartRun()

    const reset = () => {
      if (
        window.confirm(
          "¿Seguro que quieres eliminar todo el progreso guardado?",
        )
      ) {
        this.callbacks.onResetProgress()
      }
    }

    const enter = <T extends HTMLElement>(node: T, delayMs: number): T => {
      node.style.animation = `hubFadeUp 640ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms both`
      node.dataset.hubAnim = ""
      return node
    }

    const { root, content } = this.makeWindowFrame()

    const topBar = el(
      "div",
      `position: absolute;
      top: 0;
      right: 0;
      z-index: 3;
      display: flex;
      justify-content: flex-end;
      font-family: ${PARAGRAPH_FONT};
      align-items: center;
      padding: 18px 20px;`,
    )
    topBar.append(this.makeGhostTrashButton("Eliminar progreso", reset))

    const title = el(
      "div",
      `width: 100%;
      overflow: visible;
      font-family: ${TITULO_FONT};
      font-size: clamp(28px, 8vw, 112px);
      font-weight: 500;
      font-stretch: condensed;
      letter-spacing: 0.25rem;
      line-height: 0.8;
      white-space: nowrap;`,
    )

    title.append(
      el(
        "span",
        `color: #f5eedd;
        text-shadow:
          0 5px 0 rgba(0, 44, 70, 0.72),
          0 11px 18px rgba(0, 5, 18, 0.65),
          0 0 14px rgba(220, 252, 255, 0.35);`,
        "OCEAN",
      ),
      el(
        "span",
        `color: #f5eedd;
        background: linear-gradient(
          180deg,
          #f5eedd 0%,
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
      ),
    )

    const stats = this.makeBentoGrid(
      [
        {
          label: "Eco",
          value: meta.ecoPoints.toLocaleString("es"),
          highlight: true,
        },
        { label: "Mejor zona", value: bestBiome },
        {
          label: "Inmersiones jugadas",
          value: String(meta.runsPlayed),
          sub: `${meta.runsCompleted} completadas`,
        },
        {
          label: "Desechos recolectados",
          value: meta.totalDebris.toLocaleString("es"),
        },
      ],
      true,
    )

    const endless = () => this.callbacks.onStartEndless()

    // Fila de botones de acción
    const actionsRow = el(
      "div",
      `display: flex;
      align-items: stretch;
      gap: 12px;
      width: 100%;
      max-width: 640px;`,
    )

    const primary = this.makeHubCta("Empezar", start, true)
    primary.style.flex = "65 1 0"
    primary.style.width = "auto"

    const secondary = this.makeGhostAction(
      "Inmersión sin fin",
      endless,
      "neutral",
      true,
    )
    secondary.style.flex = "35 1 0"
    secondary.style.width = "auto"

    actionsRow.append(secondary, primary)

    // Fila secundaria (debajo de la principal): mejoras y ayuda
    const secondaryRow = el(
      "div",
      `display: flex;
      align-items: stretch;
      gap: 12px;
      width: 100%;
      max-width: 640px;
      margin-top: 8px;`,
    )

    const upgradesBtn = this.makeGhostAction(
      "Mejoras",
      () => this.showUpgrades(meta, () => this.showHub(meta, "upgrades")),
      "upgrade",
      true,
    )
    upgradesBtn.style.flex = "1 1 0"
    upgradesBtn.style.width = "auto"

    const helpBtn = this.makeGhostAction(
      "Cómo jugar",
      () =>
        this.showHowToPlay("Volver al inicio", () =>
          this.showHub(meta, "help"),
        ),
      "neutral",
      true,
    )
    helpBtn.style.flex = "1 1 0"
    helpBtn.style.width = "auto"

    const settingsBtn = this.makeGhostAction(
      "Ajustes",
      () =>
        this.showSettings("Volver al inicio", () =>
          this.showHub(meta, "settings"),
        ),
      "neutral",
      true,
    )
    settingsBtn.style.flex = "1 1 0"
    settingsBtn.style.width = "auto"

    secondaryRow.append(upgradesBtn, helpBtn, settingsBtn)

    content.append(
      enter(title, 0),
      enter(stats, 180),
      enter(this.makeZoneProgress(bestIndex), 280),
      enter(actionsRow, 380),
      enter(secondaryRow, 440),
    )

    // Flechas entre los botones (dos filas). "Eliminar progreso" queda fuera
    // a propósito: solo se llega a él con Tab, y es el último.
    this.enableArrowNav(content, "grid")

    root.append(topBar)
    this.open(root, start)

    const focusTargets = {
      upgrades: upgradesBtn,
      help: helpBtn,
      settings: settingsBtn,
    }
    const focusTarget = focus ? focusTargets[focus] : primary
    focusTarget.focus()
  }

  public showEvent(
    event: GameEvent,
    onChoose: (opt: EventOption) => void,
    getPreview?: (opt: EventOption) => EventPreview,
  ): void {
    const { root, content } = this.makeWindowFrame()

    const title = this.makeScreenTitle(event.title)
    title.id = "event-dialog-title"

    const desc = el(
      "div",
      `font-size: 16px; line-height: 1.5; color: #f5eedd; max-width: 600px; margin-bottom: 20px; text-align: center; font-family: ${PARAGRAPH_FONT};`,
      event.description,
    )
    desc.id = "event-dialog-desc"

    const optionsCol = el(
      "div",
      `display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 600px;`,
    )

    const optionButtons: HTMLButtonElement[] = []

    const choose = (index: number): void => {
      if (!this.eventActive || !this.canActivateChoice()) return
      const opt = event.options[index]
      if (!opt) return
      this.hide()
      onChoose(opt)
    }

    event.options.forEach((opt, index) => {
      const btn = el(
        "button",
        `display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
       width: 100%; padding: 16px 20px; text-align: left; cursor: pointer;
       background: rgba(245, 238, 221, 0.03); border: 1px solid rgba(245, 238, 221, 0.15);
       border-radius: 12px; transition: background 160ms ease, border-color 160ms ease;`,
      )
      btn.type = "button"
      btn.classList.add("event-option")
      btn.setAttribute("aria-keyshortcuts", String(index + 1))

      const header = el(
        "div",
        "display: flex; align-items: center; gap: 10px; width: 100%;",
      )
      const keyHint = el(
        "span",
        `flex: none; display: inline-flex; align-items: center; justify-content: center;
         min-width: 22px; height: 22px; padding: 0 6px; border-radius: 6px;
         border: 1px solid rgba(132, 179, 195, 0.38);
         background: rgba(245, 238, 221, 0.08);
         color: rgba(245, 238, 221, 0.75);
         font-family: ${PARAGRAPH_FONT}; font-size: 12px; font-weight: bold;`,
        String(index + 1),
      )
      keyHint.setAttribute("aria-hidden", "true")
      keyHint.className = "keyboard-only" // las teclas 1-3 no existen en táctil

      const btnTitle = el(
        "div",
        `flex: 1; font-family: ${TITLE_FONT}; font-size: 20px; color: #f5eedd;`,
        opt.label,
      )
      const btnDesc = el(
        "div",
        `font-size: 13px; color: rgba(245, 238, 221, 0.7);`,
        opt.description,
      )

      header.append(keyHint, btnTitle)
      btn.append(header, btnDesc)

      const preview = getPreview?.(opt)
      if (preview && preview.lines.length > 0) {
        const previewBox = el(
          "div",
          `display: flex; flex-wrap: wrap; gap: 6px; width: 100%; margin-top: 8px;`,
        )

        for (const line of preview.lines) {
          const tone =
            line.tone === "positive"
              ? SEMANTIC.good
              : line.tone === "negative"
                ? SEMANTIC.bad
                : null
          // Texto aclarado hacia el crema para que se lea sobre el fondo oscuro.
          const palette = tone
            ? {
                color: `color-mix(in srgb, ${tone} 70%, #f5eedd)`,
                border: tint(tone, 35),
                background: tint(tone, 10),
              }
            : {
                color: "rgba(245, 238, 221, 0.72)",
                border: "rgba(132, 179, 195, 0.27)",
                background: "rgba(245, 238, 221, 0.04)",
              }

          const chip = el(
            "span",
            `display: inline-flex; align-items: center; gap: 4px;
             padding: 3px 8px; border-radius: 999px; border: 1px solid ${palette.border};
             background: ${palette.background}; color: ${palette.color};
             font-family: ${PARAGRAPH_FONT}; font-size: 12px; line-height: 1.3;
             ${line.noEffect ? "opacity: 0.55;" : ""}`,
            `${line.label}: ${line.value}`,
          )
          if (line.tone !== "neutral" && !line.noEffect) {
            chip.classList.add(toneMarkClass(line.tone))
          }
          previewBox.append(chip)
        }

        if (preview.warning) {
          previewBox.append(
            el(
              "div",
              `width: 100%; font-size: 12px; font-weight: bold;
               color: color-mix(in srgb, ${SEMANTIC.bad} 45%, #f5eedd);`,
              preview.warning,
            ),
          )
        }

        btn.append(previewBox)
      }

      // Mismo resaltado con ratón y con teclado.
      const highlight = (): void => {
        btn.style.background = "rgba(245, 238, 221, 0.10)"
        btn.style.borderColor = "rgba(132, 179, 195, 0.83)"
      }
      const unhighlight = (): void => {
        if (btn.matches(":hover") || document.activeElement === btn) return
        btn.style.background = "rgba(245, 238, 221, 0.03)"
        btn.style.borderColor = "rgba(245, 238, 221, 0.15)"
      }
      btn.addEventListener("mouseenter", highlight)
      btn.addEventListener("mouseleave", unhighlight)
      btn.addEventListener("focus", highlight)
      btn.addEventListener("blur", () => queueMicrotask(unhighlight))
      btn.addEventListener("click", () => choose(index))

      optionButtons.push(btn)
      optionsCol.append(btn)
    })

    this.enableArrowNav(optionsCol, "vertical")

    content.append(title, desc, optionsCol)
    this.open(root, () => {})
    this.eventActive = true
    this.eventChoiceHandler = choose
    this.choiceGuard.open()
    this.showChoiceLock(optionButtons, content)
    this.overlay.setAttribute("aria-labelledby", title.id)
    this.overlay.setAttribute("aria-describedby", desc.id)
    optionButtons[0]?.focus()
  }

  /**
   * @param focusId Mejora cuyo botón recupera el foco tras redibujar (al
   *   comprar), para no perder la posición al navegar con teclado.
   */
  public showUpgrades(
    meta: MetaState,
    onClose: () => void,
    focusId?: string,
  ): void {
    const { root, content } = this.makeWindowFrame()
    const manager = new UpgradeManager()
    const buyButtons = new Map<string, HTMLButtonElement>()

    const title = this.makeScreenTitle("Mejoras permanentes")
    const subtitle = el(
      "div",
      `font-size: 16px; color: ${UPGRADE_TEXT}; margin-bottom: 20px; font-family: ${TITLE_FONT}; font-weight: bold;`,
      `Eco disponible: ${meta.ecoPoints.toLocaleString("es")}`,
    )

    const grid = el(
      "div",
      `display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      width: 100%;
      max-width: 960px;
      margin-bottom: 20px;
      text-align: left;`,
    )

    UPGRADES.forEach((upgrade) => {
      const level = meta.upgrades[upgrade.id] || 0
      const isMax = level >= upgrade.maxLevel
      const cost = isMax ? 0 : upgrade.costs[level]
      const canBuy = manager.canBuy(meta, upgrade.id)

      const card = el(
        "div",
        `display: flex;
        flex-direction: column;
        background: rgba(245, 238, 221, 0.03);
        border: 1px solid ${isMax ? UPGRADE_ACCENT : "rgba(245, 238, 221, 0.1)"};
        border-radius: 14px;
        padding: 16px;
        gap: 12px;`,
      )

      const header = el(
        "div",
        `display: flex; justify-content: space-between; align-items: flex-start;`,
      )

      const name = el(
        "div",
        `font-family: ${TITLE_FONT}; font-size: 18px; color: #f5eedd;`,
        upgrade.name,
      )

      const badge = el(
        "div",
        `font-size: 12px; padding: 2px 8px; border-radius: 4px; background: rgba(245, 238, 221, 0.1); color: #ddd; white-space: nowrap;`,
        `${level} / ${upgrade.maxLevel}`,
      )

      header.append(name, badge)

      const desc = el(
        "div",
        `font-size: 13px; color: rgba(245, 238, 221, 0.7); line-height: 1.4; flex: 1;`,
        upgrade.description,
      )

      const btn = this.makeGhostAction(
        isMax ? "Nivel Máximo" : `Comprar · ${cost} Eco`,
        () => {
          if (manager.buy(meta, upgrade.id)) {
            this.callbacks.onSaveMeta() // Guardar en localStorage
            this.showUpgrades(meta, onClose, upgrade.id) // Redibujar
          }
        },
        isMax ? "upgrade" : canBuy ? "primary" : "neutral",
        true,
      )

      if (!canBuy) {
        // `disabled` (no solo pointer-events) para que Tab y Enter tampoco
        // lleguen a él.
        btn.disabled = true
        btn.style.opacity = "0.5"
        btn.style.cursor = "default"
        if (!isMax) btn.title = "No tienes suficiente Eco"
      }
      buyButtons.set(upgrade.id, btn)

      card.append(header, desc, btn)
      grid.append(card)
    })

    const backBtn = this.makeGhostAction(
      "Volver al inicio",
      onClose,
      "neutral",
      true,
    )
    backBtn.style.maxWidth = "400px"

    this.enableArrowNav(grid, "grid")

    content.append(title, subtitle, grid, backBtn)
    this.open(root, onClose, onClose)

    // Foco: la mejora recién comprada si aún se puede subir; si no, la primera
    // comprable; si no queda ninguna, el botón de volver.
    const enabled = [...buyButtons.values()].filter((b) => !b.disabled)
    const target = focusId ? buyButtons.get(focusId) : undefined
    const toFocus =
      target && !target.disabled ? target : (enabled[0] ?? backBtn)
    toFocus.focus()
  }

  /**
   * Pantalla "Cómo jugar": controles, fichas de desechos y peligros, y el
   * interruptor de los avisos. `onBack` vuelve a la pantalla que la abrió.
   */
  public showHowToPlay(backLabel: string, onBack: () => void): void {
    const help = this.callbacks.getHelpState()
    const { root, content } = this.makeWindowFrame()
    // Contenido largo: empieza arriba para que el scroll llegue al título.
    content.style.justifyContent = "flex-start"

    const title = this.makeScreenTitle("Cómo jugar")
    title.style.marginBottom = "4px"

    const reopen = (): void => this.showHowToPlay(backLabel, onBack)

    const tipsRow = el(
      "div",
      `display: flex; flex-wrap: wrap; align-items: stretch; gap: 12px;
      width: 100%; max-width: 960px;`,
    )

    const tipsToggle = this.makeGhostAction(
      help.tipsEnabled
        ? "Avisos durante la inmersión: activados"
        : "Avisos durante la inmersión: desactivados",
      () => {
        this.callbacks.onSetTipsEnabled(!help.tipsEnabled)
        reopen()
      },
      help.tipsEnabled ? "upgrade" : "neutral",
      true,
    )
    tipsToggle.setAttribute("role", "switch")
    tipsToggle.setAttribute("aria-checked", String(help.tipsEnabled))
    tipsToggle.style.flex = "1 1 260px"
    tipsToggle.style.width = "auto"

    const tipsReset = this.makeGhostAction(
      "Volver a mostrar los avisos",
      () => {
        this.callbacks.onResetTips()
        reopen()
      },
      "neutral",
      true,
    )
    tipsReset.style.flex = "1 1 260px"
    tipsReset.style.width = "auto"
    if (help.seenTips === 0) {
      tipsReset.disabled = true
      tipsReset.style.opacity = "0.5"
      tipsReset.style.cursor = "default"
      tipsReset.style.pointerEvents = "none"
    }

    tipsRow.append(tipsToggle, tipsReset)

    const backBtn = this.makeGhostAction(backLabel, onBack, "primary", true)
    backBtn.style.maxWidth = "400px"
    backBtn.style.flex = "none"

    content.append(
      title,
      createHowToPlayBody(help.controls, {
        keys: this.callbacks.getSettings().keyBindings,
        pad: this.callbacks.getSettings().padBindings,
      }),
      tipsRow,
      backBtn,
    )
    this.open(root, onBack, onBack)
  }

  /**
   * Pantalla "Ajustes". Cada cambio se guarda y se aplica al momento; Esc o
   * `backLabel` vuelven a la pantalla que la abrió (`onBack`).
   */
  public showSettings(
    backLabel: string,
    onBack: () => void,
    focus?: "reset",
  ): void {
    const { root, content } = this.makeWindowFrame()
    content.style.justifyContent = "flex-start"

    const title = this.makeScreenTitle("Ajustes")
    title.id = "settings-dialog-title"
    title.style.marginBottom = "4px"

    const { controls } = this.callbacks.getHelpState()
    const body = createSettingsBody(this.callbacks.getSettings(), {
      device: controls.device,
      padStyle: controls.padStyle,
      capturePadButton: (onButton) => this.callbacks.capturePadButton(onButton),
      onChange: (patch) => this.callbacks.onUpdateSettings(patch),
    })

    const buttons = el(
      "div",
      `width: 100%; max-width: 640px; display: flex; flex-wrap: wrap;
      align-items: stretch; gap: 12px; margin-top: 4px;`,
    )

    const resetBtn = this.makeGhostAction(
      "Restablecer ajustes",
      () => {
        this.callbacks.onUpdateSettings(createDefaultSettings())
        this.showSettings(backLabel, onBack, "reset")
      },
      "neutral",
      true,
    )
    resetBtn.style.flex = "1 1 200px"
    resetBtn.style.width = "auto"

    const backBtn = this.makeGhostAction(backLabel, onBack, "primary", true)
    backBtn.style.flex = "1 1 200px"
    backBtn.style.width = "auto"

    buttons.append(resetBtn, backBtn)
    this.enableArrowNav(buttons)

    content.append(title, body, buttons)
    this.open(root, onBack, onBack)
    this.settingsActive = true
    this.escapeAction = onBack
    this.overlay.setAttribute("aria-labelledby", title.id)

    // Foco en la opción marcada del primer grupo (calidad gráfica).
    const first =
      body.querySelector<HTMLElement>("input:checked") ??
      body.querySelector<HTMLElement>("input")
    ;(focus === "reset" ? resetBtn : (first ?? backBtn)).focus()
  }

  public showSummary(summary: RunSummary, meta: MetaState): void {
    const again = () => this.callbacks.onStartRun()
    const { root, content } = this.makeWindowFrame()

    const titleText = summary.endless
      ? "Fin de la inmersión"
      : OUTCOME_TITLES[summary.outcome]
    const titleColor = summary.endless
      ? "#7cf7d4"
      : OUTCOME_COLORS[summary.outcome]
    const title = this.makeScreenTitle(titleText, titleColor)

    const zoneLabel = summary.endless
      ? `Bioma ${summary.biomeIndex + 1} (vuelta ${summary.loopsCompleted + 1})`
      : `${summary.biomeIndex + 1}. ${summary.biomeName}`

    const bentoItems: Array<{
      label: string
      value: string
      sub?: string
      highlight?: boolean
    }> = [
      {
        label: summary.endless ? "Biomas sobrevividos" : "Zona alcanzada",
        value: summary.endless ? String(summary.biomeIndex + 1) : zoneLabel,
      },
      {
        label: "Desechos recolectados",
        value: summary.debrisCollected.toLocaleString("es"),
      },
      {
        label: "Tiempo de inmersión",
        value: formatTime(summary.durationSeconds),
      },
      {
        label: "Cartas elegidas",
        value: String(summary.cardsPicked.length),
      },
      {
        label: "Eco total",
        value: meta.ecoPoints.toLocaleString("es"),
      },
    ]

    const totalEarned = summary.ecoBase + summary.ecoBonus
    bentoItems.push({
      label: "Eco de esta inmersión",
      value: `+${totalEarned.toLocaleString("es")}`,
      sub:
        summary.ecoBonus > 0
          ? `Incluye +${summary.ecoBonus} de bono`
          : summary.ecoLost > 0
            ? `${summary.ecoLost.toLocaleString("es")} perdido por no cerrar la vuelta`
            : undefined,
      highlight: true,
    })

    content.append(title, this.makeBentoGrid(bentoItems))

    if (summary.cardsPicked.length > 0) {
      const names = summary.cardsPicked
        .map((id) => CARD_POOL.find((c) => c.id === id)?.name ?? id)
        .join(" · ")

      content.append(
        el(
          "div",
          `font-size: 13px; opacity: 0.85; color: #bcebf6; text-align: center;
          font-family: ${PARAGRAPH_FONT}; line-height: 1.6; max-width: 720px;`,
          names,
        ),
      )
    }

    const buttons = el(
      "div",
      `width: 100%; max-width: 640px; display: flex; flex-direction: row;
      align-items: stretch; gap: 12px; margin-top: 4px;`,
    )

    const againBtn = this.makeGhostAction(
      summary.endless ? "Otra inmersión sin fin" : "Nueva inmersión",
      again,
      "primary",
      true,
    )
    againBtn.style.flex = "65 1 0"
    againBtn.style.width = "auto"

    const hubBtn = this.makeGhostAction(
      "Volver al inicio",
      () => this.callbacks.onReturnToHub(),
      "neutral",
      true,
    )
    hubBtn.style.flex = "35 1 0"
    hubBtn.style.width = "auto"

    buttons.append(hubBtn, againBtn)
    this.enableArrowNav(buttons)
    content.append(buttons)

    content.append(
      el(
        "div",
        `font-size: 12px; opacity: 0.7;
        text-align: center; color: #bcebf6; font-family: ${PARAGRAPH_FONT};`,
        `Semilla · ${summary.seed}`,
      ),
    )

    this.open(root, again)
    againBtn.focus()
  }

  public showCardChoice(
    cards: Card[],
    onPick: (card: Card) => void,
    notice?: string,
    getPreview?: (card: Card) => CardPreviewLine[],
  ): void {
    const pick = (index: number) => {
      if (!this.cardChoiceActive || !this.canActivateChoice()) return
      const card = cards[index]
      if (!card) return
      this.hide()
      onPick(card)
    }

    const { root, content } = this.makeWindowFrame()

    const title = this.makeScreenTitle("Elige una carta")

    const row = el(
      "div",
      `display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; width: 100%;`,
    )

    const cardButtons: HTMLElement[] = []

    cards.forEach((card, i) => {
      const btn = this.makeCardButton(
        card,
        i,
        () => pick(i),
        getPreview?.(card),
      )
      cardButtons.push(btn)
      row.append(btn)
    })

    if (notice) {
      content.append(
        el(
          "div",
          `max-width: 640px; padding: 8px 14px; border-radius: 999px;
           border: 1px solid rgba(132, 179, 195, 0.28);
           background: rgba(132, 179, 195, 0.08);
           color: #bae6fd; font-family: ${PARAGRAPH_FONT}; font-size: 13px;
           line-height: 1.4; text-align: center;`,
          `Resultado del evento: ${notice}`,
        ),
      )
    }

    this.enableArrowNav(row)

    content.append(title, row)
    this.open(root, () => {})
    this.cardChoiceActive = true
    this.cardChoiceHandler = pick
    this.choiceGuard.open()
    this.showChoiceLock(cardButtons, content)
    // La animación de entrada limpia el transform al acabar: se vuelve a
    // aplicar el realce a la carta que tenga el foco.
    void revealCards(cardButtons).then(() => {
      const focused = document.activeElement
      if (focused instanceof HTMLElement && cardButtons.includes(focused)) {
        focused.dispatchEvent(new FocusEvent("focus"))
      }
    })
    cardButtons[0]?.focus()
  }

  /**
   * @param focus Botón que recibe el foco al volver de los ajustes. Por
   *   defecto, "Reanudar".
   */
  public showPause(
    onResume: () => void,
    onAbandon: () => void,
    runInfo?: RunInfo,
    focus?: "settings",
  ): void {
    const { root, content } = this.makeWindowFrame()
    const title = this.makeScreenTitle("Pausa")
    content.append(title)

    let statsLine: HTMLElement | undefined
    let buildPanel: HTMLElement | undefined
    let lossWarning: HTMLElement | undefined
    if (runInfo) {
      // Con la build el contenido puede no caber: centrado solo si cabe.
      content.style.justifyContent = "safe center"
      title.style.marginBottom = "8px"

      const zoneLabel = `${runInfo.biomeIndex + 1}. ${runInfo.biomeName}`
      const eco = Math.floor(runInfo.ecoAwareness).toLocaleString("es")
      const banked =
        runInfo.ecoBanked !== undefined
          ? ` (${Math.round(runInfo.ecoBanked).toLocaleString("es")} asegurado)`
          : ""
      statsLine = el(
        "div",
        `max-width: 640px; text-align: center; color: #bae6fd;
         font-family: ${PARAGRAPH_FONT}; font-size: 14px; line-height: 1.4;`,
        `${zoneLabel} · ${runInfo.depth} m · Eco ${eco}${banked}`,
      )
      content.append(statsLine)

      // Inmersión sin fin: al confirmar el abandono se avisa de lo que se pierde.
      if (runInfo.ecoBanked !== undefined) {
        const { lost } = computeEndlessEco(
          runInfo.ecoAwareness,
          runInfo.ecoBanked,
        )
        if (lost > 0) {
          lossWarning = el(
            "div",
            `display: none; max-width: 640px; text-align: center; color: #ffbaba;
             font-family: ${PARAGRAPH_FONT}; font-size: 14px; line-height: 1.4;`,
            `Perderás ${lost.toLocaleString("es")} Eco de esta vuelta. Ciérrala para asegurarlo todo.`,
          )
          content.append(lossWarning)
        }
      }
    }

    const buttons = el(
      "div",
      `width: 100%; max-width: 640px; display: flex; flex-direction: row;
      align-items: stretch; gap: 12px; margin-top: 4px;`,
    )

    const resumeBtn = this.makeGhostAction(
      "Reanudar",
      onResume,
      "primary",
      true,
    )
    resumeBtn.style.flex = "65 1 0"
    resumeBtn.style.width = "auto"

    const abandonBtn = this.makeGhostAction(
      "Abandonar",
      () => showConfirm(),
      "danger",
      true,
    )
    abandonBtn.style.flex = "35 1 0"
    abandonBtn.style.width = "auto"

    const settingsBtn = this.makeGhostAction(
      "Ajustes",
      () =>
        this.showSettings("Volver a la pausa", () =>
          this.showPause(onResume, onAbandon, runInfo, "settings"),
        ),
      "neutral",
      true,
    )
    settingsBtn.style.flex = "35 1 0"
    settingsBtn.style.width = "auto"

    // Confirmación en dos pasos para no perder la inmersión por un clic accidental.
    const secondary = (): HTMLElement[] =>
      [statsLine, buildPanel].filter((n): n is HTMLElement => n !== undefined)
    // Con la confirmación abierta, "volver" en el mando la cancela.
    let cancelConfirm: (() => void) | null = null
    const showConfirm = (): void => {
      title.textContent = "¿Abandonar la inmersión?"
      for (const n of secondary()) n.style.display = "none"
      if (lossWarning) lossWarning.style.display = ""
      const confirmBtn = this.makeGhostAction(
        "Sí, abandonar",
        onAbandon,
        "danger",
        true,
      )
      confirmBtn.style.flex = "35 1 0"
      confirmBtn.style.width = "auto"
      cancelConfirm = () => {
        cancelConfirm = null
        title.textContent = "Pausa"
        for (const n of secondary()) n.style.display = ""
        if (lossWarning) lossWarning.style.display = "none"
        buttons.replaceChildren(abandonBtn, settingsBtn, resumeBtn)
        resumeBtn.focus()
      }
      const cancelBtn = this.makeGhostAction(
        "Seguir buceando",
        cancelConfirm,
        "primary",
        true,
      )
      cancelBtn.style.flex = "65 1 0"
      cancelBtn.style.width = "auto"
      // "Seguir buceando" ocupa el sitio donde estaba "Abandonar": un doble
      // clic accidental cancela en vez de confirmar.
      buttons.replaceChildren(cancelBtn, confirmBtn)
      cancelBtn.focus()
    }

    buttons.append(abandonBtn, settingsBtn, resumeBtn)

    this.enableArrowNav(buttons)

    content.append(buttons)
    if (runInfo) {
      buildPanel = this.makeBuildPanel(runInfo)
      content.append(buildPanel)
    }
    this.open(root, onResume, () =>
      cancelConfirm ? cancelConfirm() : onResume(),
    )
    ;(focus === "settings" ? settingsBtn : resumeBtn).focus()
  }

  /** Pasado el bloqueo y sin un Espacio/Enter "viejo" de por medio. */
  private canActivateChoice(): boolean {
    return this.choiceGuard.canChoose() && !this.suppressActivation
  }

  /**
   * Indica el bloqueo de la elección: las opciones se ven apagadas y una barra
   * se llena hasta que se puede elegir.
   */
  private showChoiceLock(buttons: HTMLElement[], container: HTMLElement): void {
    const lockMs = this.choiceGuard.lockMs
    for (const btn of buttons) btn.classList.add("choice-locked")

    const bar = el("div", "")
    bar.className = "choice-lock-bar"
    bar.style.setProperty("--choice-lock-ms", `${lockMs}ms`)
    bar.setAttribute("aria-hidden", "true")
    container.append(bar)

    setTimeout(() => {
      for (const btn of buttons) btn.classList.remove("choice-locked")
      bar.remove()
    }, lockMs)
  }

  /**
   * Flechas para moverse entre los botones de un grupo: izquierda/derecha en
   * una fila, arriba/abajo en una columna (al llegar al final vuelve al
   * inicio), o las cuatro en una cuadrícula, saltando al botón más cercano en
   * esa dirección según su posición en pantalla.
   */
  private enableArrowNav(
    group: HTMLElement,
    axis: "horizontal" | "vertical" | "grid" = "horizontal",
  ): void {
    if (axis === "grid") {
      group.addEventListener("keydown", (event) => {
        const dir = ARROW_DIRECTIONS[event.key]
        if (!dir) return
        const items = Array.from(
          group.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        )
        const current = document.activeElement
        if (!(current instanceof HTMLButtonElement)) return
        if (!items.includes(current)) return
        const best = pickNeighbor(
          current.getBoundingClientRect(),
          items
            .filter((item) => item !== current)
            .map((item) => ({ item, rect: item.getBoundingClientRect() })),
          dir,
        )
        event.preventDefault()
        best?.focus()
      })
      return
    }

    const [prev, next] =
      axis === "horizontal"
        ? ["ArrowLeft", "ArrowRight"]
        : ["ArrowUp", "ArrowDown"]
    group.addEventListener("keydown", (event) => {
      if (event.key !== prev && event.key !== next) return
      const items = Array.from(
        group.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
      )
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      if (current === -1) return
      const step = event.key === next ? 1 : -1
      items[(current + step + items.length) % items.length]?.focus()
      event.preventDefault()
    })
  }

  /** Panel "Tu tortuga": atributos actuales, cartas y reliquias de la run. */
  private makeBuildPanel(runInfo: RunInfo): HTMLElement {
    const node = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      className: string,
      text?: string,
    ): HTMLElementTagNameMap[K] => {
      const element = document.createElement(tag)
      element.className = className
      if (text !== undefined) element.textContent = text
      return element
    }

    const panel = node("section", "build-panel")
    panel.setAttribute("aria-label", "Tu tortuga")

    const stats = node("div", "build-stats")
    for (const stat of runInfo.stats) {
      const cell = node("div", "build-stat")
      if (stat.warning) cell.classList.add("build-stat-warning")
      cell.append(
        node("div", "build-stat-label", stat.label),
        node("div", "build-stat-value", stat.value),
        node("div", "build-stat-description", stat.description),
      )
      stats.append(cell)
    }

    panel.append(
      node("h2", "build-heading", "Tu tortuga"),
      stats,
      node("h3", "build-subheading", `Cartas (${runInfo.cards.length})`),
    )

    if (runInfo.cards.length === 0) {
      panel.append(
        node(
          "p",
          "build-empty",
          "Aún no has elegido ninguna: limpia la zona para ganar la primera.",
        ),
      )
    } else {
      // La descripción se muestra en un recuadro fijo bajo las fichas, no en un
      // tooltip: así llega también con teclado y en pantallas táctiles.
      const detail = node(
        "p",
        "build-chip-detail",
        "Selecciona una carta para ver qué hace.",
      )
      detail.setAttribute("aria-live", "polite")
      const chips = node("div", "build-chips")
      const select = (chip: HTMLButtonElement, text: string): void => {
        for (const other of chips.querySelectorAll(".build-chip")) {
          other.setAttribute("aria-pressed", "false")
        }
        chip.setAttribute("aria-pressed", "true")
        detail.textContent = text
      }
      for (const card of runInfo.cards) {
        const chip = node("button", "build-chip")
        chip.type = "button"
        chip.setAttribute("aria-pressed", "false")
        chip.style.setProperty("--chip-color", RARITY_COLORS[card.rarity])
        const text = `${card.name} (${RARITY_LABELS[card.rarity]}): ${card.description}`
        chip.append(
          node("span", "build-chip-name", card.name),
          node("span", "build-chip-value", cardValueText(card)),
        )
        for (const type of ["click", "focus", "mouseenter"] as const) {
          chip.addEventListener(type, () => select(chip, text))
        }
        chips.append(chip)
      }
      panel.append(chips, detail)
    }

    if (runInfo.relics.length > 0) {
      const chips = node("div", "build-chips")
      for (const relic of runInfo.relics) {
        const chip = node("div", "build-chip")
        chip.append(node("span", "build-chip-name", relic))
        chips.append(chip)
      }
      panel.append(
        node("h3", "build-subheading", `Reliquias (${runInfo.relics.length})`),
        chips,
      )
    }

    return panel
  }

  private makeWindowFrame(): { root: HTMLElement; content: HTMLElement } {
    const root = el(
      "div",
      `position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%;
      box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden;
      background: linear-gradient(180deg, rgba(9, 38, 54, 0.80), rgba(5, 22, 33, 0.86));`,
    )

    const grid = el(
      "div",
      `position: absolute; inset: 0; pointer-events: none;
      background-image:
        linear-gradient(rgba(245, 238, 221, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245, 238, 221, 0.04) 1px, transparent 1px);
      background-size: 46px 46px;
      -webkit-mask-image: radial-gradient(ellipse at 50% 38%, #000 18%, transparent 74%);
      mask-image: radial-gradient(ellipse at 50% 38%, #000 18%, transparent 74%);`,
    )

    const glow = el(
      "div",
      `position: absolute; top: -180px; left: 50%; width: 780px; height: 460px;
      transform: translateX(-50%); pointer-events: none; filter: blur(20px);`,
    )

    const content = el(
      "div",
      `position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: clamp(14px, 2.4vh, 28px);
      padding: clamp(10px, 2vh, 24px) clamp(18px, 4vw, 56px) clamp(22px, 4vh, 44px);
      text-align: center;`,
    )

    root.append(grid, glow, content)
    return { root, content }
  }

  private makeScreenTitle(text: string, color = "#f5eedd"): HTMLElement {
    return el(
      "div",
      `width: 100%; overflow: visible; font-family: ${TITLE_FONT};
      font-size: clamp(30px, 4.7vw, 60px); font-weight: 900; font-stretch: condensed;
      line-height: 1; text-align: center; margin-bottom: 40px; color: ${color};
      text-shadow: 0 3px 0 rgba(0, 44, 70, 0.6), 0 6px 14px rgba(0, 5, 18, 0.5), 0 0 12px ${color}44;
      max-width: 900px;`,
      text,
    )
  }

  private makeBentoGrid(
    items: Array<{
      label: string
      value: string
      sub?: string
      highlight?: boolean
    }>,
    singleRow = false,
  ): HTMLElement {
    // Una sola línea (menú de inicio): todas las casillas en fila para ocupar
    // menos alto; en pantallas estrechas bajan a dos por fila.
    if (singleRow) {
      const row = el(
        "div",
        `display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px; width: 100%; max-width: 960px;`,
      )
      for (const item of items) {
        row.append(
          this.makeBentoStat(item.label, item.value, item.sub, item.highlight),
        )
      }
      return row
    }

    const wrap = el(
      "div",
      `display: flex; flex-direction: column; align-items: center; gap: 14px;
      width: 100%; max-width: 780px;`,
    )

    const rows: Array<typeof items> = []
    let i = 0
    let target = 2

    while (i < items.length) {
      const remaining = items.length - i
      if (remaining === 1 && rows.length > 0) {
        rows[rows.length - 1].push(items[i])
        break
      }
      if (remaining === 3 && target === 2 && rows.length > 0) {
        rows.push(items.slice(i, i + 3))
        break
      }
      const size = Math.min(target, remaining)
      rows.push(items.slice(i, i + size))
      i += size
      target = target === 2 ? 3 : 2
    }

    for (const row of rows) {
      const rowEl = el(
        "div",
        `display: flex; gap: 14px; justify-content: center; align-items: stretch; width: 100%;`,
      )
      const widthPct =
        row.length === 1 ? "60%" : row.length === 2 ? "40%" : "30%"

      for (const item of row) {
        const stat = this.makeBentoStat(
          item.label,
          item.value,
          item.sub,
          item.highlight,
        )
        stat.style.flex = `0 1 ${widthPct}`
        stat.style.minWidth = "0"
        rowEl.append(stat)
      }
      wrap.append(rowEl)
    }
    return wrap
  }

  private makeBentoStat(
    label: string,
    value: string,
    sub?: string,
    highlight = false,
  ): HTMLElement {
    const card = el(
      "div",
      `display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 12px 14px;
      text-align: left; border-radius: 14px; background: rgba(245, 238, 221, 0.045);
      border: 1px solid rgba(245, 238, 221, 0.09); backdrop-filter: blur(6px);
      transition: border-color 160ms ease, transform 160ms ease;`,
    )

    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-2px)"
    })
    card.addEventListener("mouseleave", () => {
      card.style.borderColor = "rgba(245, 238, 221, 0.09)"
      card.style.transform = "translateY(0)"
    })

    card.append(
      el(
        "div",
        `min-width: 0; font-size: 12px; margin-bottom: 2px; color: rgba(245, 238, 221, 0.8);`,
        label,
      ),
      el(
        "div",
        `font-family: ${TITLE_FONT}; font-size: clamp(17px, 1.7vw, 23px); font-weight: 900; line-height: 1.1; text-align: left; overflow-wrap: anywhere; color: ${highlight ? HUB_ACCENT : "#f5eedd"};`,
        value,
      ),
    )

    if (sub) {
      card.append(
        el("div", `font-size: 12px; color: rgba(245, 238, 221, 0.7);`, sub),
      )
    }
    return card
  }

  private makeGhostAction(
    label: string,
    onClick: () => void,
    variant: ActionVariant = "neutral",
    fullWidth = true,
  ): HTMLButtonElement {
    const palette = {
      primary: {
        color: "rgba(245, 238, 221, 0.92)",
        border: "rgba(132, 179, 195, 0.42)",
        hoverBg: "rgba(245, 238, 221, 0.10)",
        hoverBorder: "rgba(132, 179, 195, 0.83)",
        hoverColor: "#f5eedd",
        focus: HUB_ACCENT,
      },
      upgrade: {
        color: UPGRADE_TEXT,
        border: "rgba(132, 179, 195, 0.45)",
        hoverBg: "rgba(132, 179, 195, 0.16)",
        hoverBorder: "rgba(245, 238, 221, 0.8)",
        hoverColor: "#f5eedd",
        focus: UPGRADE_TEXT,
      },
      danger: {
        color: "rgba(255, 150, 150, 0.9)",
        border: "rgba(255, 120, 120, 0.28)",
        hoverBg: "rgba(255, 90, 90, 0.14)",
        hoverBorder: "rgba(255, 120, 120, 0.6)",
        hoverColor: "#ffbaba",
        focus: "rgba(255, 150, 150, 0.9)",
      },
      neutral: {
        color: "rgba(245, 238, 221, 0.85)",
        border: "rgba(132, 179, 195, 0.3)",
        hoverBg: "rgba(245, 238, 221, 0.08)",
        hoverBorder: "rgba(132, 179, 195, 0.63)",
        hoverColor: "#f5eedd",
        focus: "rgba(245, 238, 221, 0.6)",
      },
    }[variant]

    const btn = el(
      "button",
      `display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      ${fullWidth ? "width: 100%;" : "width: auto;"} min-height: 54px; padding: 12px 22px;
      border-radius: 12px; cursor: pointer; color: ${palette.color};
      font: 700 clamp(15px, 1.9vw, 20px) ${TITLE_FONT}; background: rgba(245, 238, 221, 0.02);
      border: 1.5px solid ${palette.border}; backdrop-filter: blur(6px);
      transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;`,
      label,
    )

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)"
      btn.style.background = palette.hoverBg
      btn.style.borderColor = palette.hoverBorder
      btn.style.color = palette.hoverColor
    })
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)"
      btn.style.background = "rgba(245, 238, 221, 0.02)"
      btn.style.borderColor = palette.border
      btn.style.color = palette.color
    })
    btn.addEventListener("focus", () => {
      btn.style.outline = `2px solid ${palette.focus}`
      btn.style.outlineOffset = "4px"
    })
    btn.addEventListener("blur", () => {
      btn.style.outline = "none"
    })
    btn.addEventListener("click", onClick)

    return btn
  }

  private ensureEventStyles(): void {
    if (document.getElementById("event-option-styles")) return

    const style = document.createElement("style")
    style.id = "event-option-styles"
    style.textContent = `
    .event-option:focus-visible {
      outline: 2px solid #7dd3fc;
      outline-offset: 3px;
    }
    .event-option:focus:not(:focus-visible) {
      outline: none;
    }
    .card-choice:focus-visible {
      outline: 3px solid #f5eedd;
      outline-offset: 5px;
    }
    .card-choice:focus:not(:focus-visible) {
      outline: none;
    }
    /* Bloqueo breve al abrir cartas o eventos (ChoiceGuard). */
    .choice-locked {
      filter: saturate(0.45) brightness(0.75) !important;
      cursor: progress !important;
    }
    .choice-lock-bar {
      width: min(320px, 70%);
      height: 4px;
      flex: none;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(245, 238, 221, 0.12);
    }
    .choice-lock-bar::after {
      content: "";
      display: block;
      height: 100%;
      background: #7dd3fc;
      transform-origin: left center;
      animation: choiceLockFill var(--choice-lock-ms, 1200ms) linear forwards;
    }
    @keyframes choiceLockFill {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
  `
    document.head.appendChild(style)
  }

  private ensureUltraGlowAnimation(): void {
    if (document.getElementById("menu-ultra-glow")) return
    const style = document.createElement("style")
    style.id = "menu-ultra-glow"
    style.textContent = `
    @keyframes ultraGlow {
      0% { border-color: #94a3b8; box-shadow: 0 0 14px rgba(148, 163, 184, 0.7), inset 0 0 12px rgba(148, 163, 184, 0.3); }
      17% { border-color: #38bdf8; box-shadow: 0 0 18px rgba(56, 189, 248, 0.85), inset 0 0 14px rgba(56, 189, 248, 0.4); }
      33% { border-color: #a855f7; box-shadow: 0 0 22px rgba(132, 179, 195, 0.9), inset 0 0 16px rgba(132, 179, 195, 0.45); }
      50% { border-color: #fbbf24; box-shadow: 0 0 26px rgba(251, 191, 36, 1), inset 0 0 18px rgba(251, 191, 36, 0.5); }
      67% { border-color: #ef4444; box-shadow: 0 0 22px rgba(239, 68, 68, 0.9), inset 0 0 16px rgba(239, 68, 68, 0.45); }
      83% { border-color: #0a9396; box-shadow: 0 0 20px rgba(10, 147, 150, 0.9), inset 0 0 14px rgba(10, 147, 150, 0.4); }
      100% { border-color: #94a3b8; box-shadow: 0 0 14px rgba(148, 163, 184, 0.7), inset 0 0 12px rgba(148, 163, 184, 0.3); }
    }
  `
    document.head.appendChild(style)
  }

  private ensureChaosGlitchAnimation(): void {
    if (document.getElementById("menu-chaos-glitch")) return
    const style = document.createElement("style")
    style.id = "menu-chaos-glitch"
    style.textContent = `
    @keyframes chaosGlitch {
      0%, 100% { border-color: #fb923c; box-shadow: 0 0 12px rgba(251, 146, 60, 0.55), inset 0 0 10px rgba(251, 146, 60, 0.2); }
      20% { border-color: #22d3ee; box-shadow: 0 0 18px rgba(34, 211, 238, 0.7), inset 0 0 12px rgba(34, 211, 238, 0.28); }
      40% { border-color: #c084fc; box-shadow: 0 0 24px rgba(132, 179, 195, 0.75), inset 0 0 15px rgba(132, 179, 195, 0.32); }
      60% { border-color: #ef4444; box-shadow: 0 0 18px rgba(239, 68, 68, 0.7), inset 0 0 12px rgba(239, 68, 68, 0.28); }
      80% { border-color: #facc15; box-shadow: 0 0 20px rgba(250, 204, 21, 0.72), inset 0 0 13px rgba(250, 204, 21, 0.3); }
    }
  `
    document.head.appendChild(style)
  }

  private ensureBubbleAnimation(): void {
    if (document.getElementById("menu-bubble-animation")) return
    const style = document.createElement("style")
    style.id = "menu-bubble-animation"
    style.textContent = `
      @keyframes menuBubbleFloat {
        0% { transform: translate3d(0, 0, 0) scale(0.92); opacity: 0; }
        15% { opacity: 0.55; }
        80% { opacity: 0.42; }
        100% { transform: translate3d(18px, -170px, 0) scale(1.12); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }

  private ensureHubAnimation(): void {
    if (document.getElementById("menu-hub-animation")) return
    const style = document.createElement("style")
    style.id = "menu-hub-animation"
    style.textContent = `
      @keyframes hubFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    `
    document.head.appendChild(style)
  }

  private makeHubCta(
    label: string,
    onClick: () => void,
    fullWidth = false,
  ): HTMLButtonElement {
    const btn = el(
      "button",
      `display: inline-flex; align-items: center; justify-content: ${fullWidth ? "center" : "flex-start"};
      gap: 12px; ${fullWidth ? "width: 100%;" : "width: auto;"} padding: 12px 22px;
      border-radius: 12px; cursor: pointer; color: rgba(245, 238, 221, 0.92);
      font: 700 clamp(15px, 1.9vw, 21px) ${TITLE_FONT}; background: #16587b;
      border: 1.5px solid rgba(132, 179, 195, 0.42); backdrop-filter: blur(6px);
      transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;`,
    )

    btn.dataset.hubCta = ""

    const keycap = el(
      "span",
      `font: 700 12px ${PARAGRAPH_FONT}; padding: 3px 8px;
      border-radius: 6px; border: 1px solid rgba(132, 179, 195, 0.42); color: rgba(245, 238, 221, 0.7);`,
      "Enter",
    )
    keycap.setAttribute("aria-hidden", "true")
    // Solo con teclado: en táctil o con mando no hay Enter que pulsar.
    keycap.className = "keyboard-only"

    btn.append(document.createTextNode(label), keycap)

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-2px)"
      btn.style.background = "#1d6a92"
      btn.style.borderColor = "rgba(132, 179, 195, 0.83)"
      btn.style.color = "#f5eedd"
    })
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)"
      btn.style.background = "#16587b"
      btn.style.borderColor = "rgba(132, 179, 195, 0.42)"
      btn.style.color = "rgba(245, 238, 221, 0.92)"
    })
    btn.addEventListener("focus", () => {
      btn.style.outline = `2px solid ${HUB_ACCENT}`
      btn.style.outlineOffset = "5px"
    })
    btn.addEventListener("blur", () => {
      btn.style.outline = "none"
    })
    btn.addEventListener("click", onClick)

    return btn
  }

  private makeGhostTrashButton(
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = el(
      "button",
      `display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px;
      border-radius: 12px; cursor: pointer; font: 13px ${PARAGRAPH_FONT};
      color: rgba(255, 150, 150, 0.9); background: transparent;
      border: 1px solid rgba(255, 120, 120, 0.28);
      transition: background 150ms ease, border-color 150ms ease;`,
    )

    btn.append(icon(ICONS.trash, 15), document.createTextNode(label))

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(255, 90, 90, 0.12)"
      btn.style.borderColor = "rgba(255, 120, 120, 0.6)"
    })
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent"
      btn.style.borderColor = "rgba(255, 120, 120, 0.28)"
    })
    btn.addEventListener("focus", () => {
      btn.style.outline = "2px solid rgba(255, 150, 150, 0.8)"
      btn.style.outlineOffset = "3px"
    })
    btn.addEventListener("blur", () => {
      btn.style.outline = "none"
    })
    btn.addEventListener("click", onClick)

    return btn
  }

  private makeZoneProgress(bestIndex: number): HTMLElement {
    const total = BIOME_ORDER.length
    const reached = bestIndex >= 0 && BIOME_ORDER[bestIndex] ? bestIndex + 1 : 0

    const wrap = el(
      "div",
      `width: 100%; max-width: 960px; display: flex; flex-direction: column; gap: 10px;`,
    )
    const header = el(
      "div",
      `display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
      font-size: 12px; color: rgba(245, 238, 221, 0.72);`,
    )

    header.append(
      el("span", "", "Zonas alcanzadas"),
      el(
        "span",
        `color: ${HUB_ACCENT}; font-weight: bold;`,
        `${reached} / ${total}`,
      ),
    )

    const bar = el("div", `display: flex; gap: 6px;`)
    BIOME_ORDER.forEach((key, i) => {
      const lit = i < reached
      const seg = el(
        "div",
        `flex: 1 1 0; height: 8px; border-radius: 999px; background: ${lit ? HUB_ACCENT : "rgba(245, 238, 221, 0.1)"};`,
      )
      seg.title = `${i + 1}. ${BIOMES[key].name}`
      bar.append(seg)
    })

    wrap.append(header, bar)
    return wrap
  }

  private makeCornerBubbles(): HTMLElement {
    const layer = el(
      "div",
      `position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none;`,
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
        `position: absolute; ${position} width: ${bubble.size}px; height: ${bubble.size}px;
        border-radius: 50%; box-sizing: border-box; opacity: 0.55;
        background: radial-gradient(circle at 30% 25%, rgba(245, 238, 221, 0.95) 0%, rgba(23, 75, 164, 0.28) 18%, rgba(71, 211, 238, 0.12) 48%, rgba(6, 107, 144, 0.05) 72%, transparent 73%);
        border: 1px solid rgba(196, 250, 255, 0.72);
        box-shadow: inset -3px -4px 7px rgba(0, 77, 110, 0.22), inset 2px 2px 5px rgba(245, 238, 221, 0.35), 0 0 12px rgba(91, 236, 255, 0.28);
        animation: menuBubbleFloat ${bubble.duration} ease-in-out ${bubble.delay} infinite;`,
      )
      node.className = "menu-bubble"
      layer.append(node)
    }
    return layer
  }

  /**
   * @param primary Acción de Enter sin un control enfocado.
   * @param back Acción del botón "volver" del mando, si la pantalla la tiene.
   */
  private open(
    container: HTMLElement,
    primary: () => void,
    back?: () => void,
  ): void {
    cancelKeyCapture()
    this.eventActive = false
    this.eventChoiceHandler = null
    this.cardChoiceActive = false
    this.cardChoiceHandler = null
    this.settingsActive = false
    this.escapeAction = null
    this.backAction = back ?? null
    this.overlay.removeAttribute("aria-labelledby")
    this.overlay.removeAttribute("aria-describedby")
    this.overlay.replaceChildren(this.makeCornerBubbles(), container)
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

  private makeCardButton(
    card: Card,
    index: number,
    onClick: () => void,
    preview?: CardPreviewLine[],
  ): HTMLElement {
    const accent = RARITY_COLORS[card.rarity]
    const bg = RARITY_BACKGROUNDS[card.rarity]
    const label = RARITY_LABELS[card.rarity]
    const isUltra = card.rarity === "ultra_legendary"
    const isChaos = card.rarity === "chaos"

    const btn = el(
      "button",
      `position: relative; flex: 0 1 clamp(170px, 26vw, 240px); min-height: clamp(260px, 38vw, 320px);
      padding: 0; display: flex; flex-direction: column; cursor: pointer;
      background: ${isUltra ? "#0f0f14" : bg}; border: 6px solid ${isUltra ? "#94a3b8" : accent};
      border-radius: 16px; overflow: hidden; transition: transform 160ms ease, filter 160ms ease;`,
    )

    if (isUltra) {
      btn.classList.add("card-ultra-legendary")
      btn.style.animation = "ultraGlow 3s infinite ease-in-out"
    } else if (isChaos) {
      btn.classList.add("card-chaos")
      btn.style.animation = "chaosGlitch 2.6s infinite steps(2, end)"
    }

    const previewText =
      preview && preview.length > 0
        ? ` ${preview.map(previewLineText).join(". ")}.`
        : ""
    btn.setAttribute(
      "aria-label",
      `${label}: ${card.name}. ${cardValueText(card)}. ${card.description}${previewText}`,
    )

    btn.classList.add("card-choice")
    btn.style.setProperty("--card-accent", accent)

    // El mismo realce para ratón y teclado: la carta enfocada se levanta.
    const lift = (): void => {
      btn.style.transform = "translateY(-6px) scale(1.02)"
      btn.style.filter = "brightness(1.15)"
      btn.style.boxShadow = `0 14px 32px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(245, 238, 221, 0.12), 0 0 24px ${accent}66`
    }
    const rest = (): void => {
      if (btn.matches(":hover") || document.activeElement === btn) return
      btn.style.transform = "translateY(0) scale(1)"
      btn.style.filter = "brightness(1)"
      btn.style.boxShadow = `0 6px 20px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(245, 238, 221, 0.06)`
    }
    btn.addEventListener("mouseenter", lift)
    btn.addEventListener("mouseleave", rest)
    btn.addEventListener("focus", lift)
    btn.addEventListener("blur", () => queueMicrotask(rest))
    btn.addEventListener("click", onClick)

    const keyBadge = el(
      "div",
      `position: absolute; top: 12px; right: 12px; width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center; font-family: ${TITLE_FONT};
      font-size: 12px; font-weight: 900; color: ${isUltra ? "#f5eedd" : accent};
      background: ${isUltra ? "rgba(0, 0, 0, 0.5)" : "none"}; border: 1.5px solid ${isUltra ? "#f5eedd" : accent};
      border-radius: 6px; z-index: 2;`,
      `${index + 1}`,
    )
    keyBadge.setAttribute("aria-hidden", "true")

    const rarityArea = el(
      "div",
      `padding: 22px 16px 14px; display: flex; flex-direction: column; align-items: center; gap: 10px;`,
    )
    const rarityLabel = el(
      "div",
      `font-family: ${TITLE_FONT}; font-size: 16px; font-weight: 900; text-transform: uppercase; color: ${isUltra ? "#f5eedd" : accent};`,
      label,
    )
    const rarityDivider = el(
      "div",
      `width: 60%; height: 1px;
      background: ${isUltra ? "linear-gradient(90deg, transparent, #f5eedd, transparent)" : `linear-gradient(90deg, transparent, ${accent}, transparent)`};`,
    )
    rarityArea.append(rarityLabel, rarityDivider)

    const body = el(
      "div",
      `flex: 1 1 auto; padding: 0 18px 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 12px;`,
    )
    const name = el(
      "div",
      `font-family: ${TITLE_FONT}; font-size: 21px; font-weight: 900; line-height: 1.1; text-transform: uppercase; color: #f5eedd;`,
      card.name,
    )
    // Cada tramo del valor se pinta según su signo: las penalizaciones van en
    // rojo aunque la carta sea buena en conjunto (maldiciones, caos). Con el
    // modo para daltonismo, además, llevan ▲ o ▼.
    const neutralColor = isUltra ? "#f5eedd" : isChaos ? "#fb923c" : "#e2e8f0"
    const toneColors: Record<CardTone, string> = {
      positive: isUltra ? "#f5eedd" : SEMANTIC.good,
      negative: SEMANTIC.bad,
      neutral: neutralColor,
    }
    const value = el(
      "div",
      // Palabras completas ("RESISTENCIA"...): algo más pequeño que el nombre
      // para que quepan sin partirse en las cartas estrechas.
      `font-family: ${TITLE_FONT}; font-size: clamp(16px, 1.7vw, 20px); font-weight: 900;
      line-height: 1.25; color: ${neutralColor};`,
    )
    const separator = cardValueSeparator(card)
    cardValueParts(card).forEach((part, i) => {
      if (i > 0) value.append(document.createTextNode(separator))
      const span = el("span", `color: ${toneColors[part.tone]};`, part.text)
      if (part.tone !== "neutral") span.classList.add(toneMarkClass(part.tone))
      value.append(span)
    })
    const desc = el(
      "div",
      `font-family: ${PARAGRAPH_FONT}; font-size: 12px; line-height: 1.45; color: rgba(245, 238, 221, 0.75); margin-top: 4px;`,
      card.description,
    )

    body.append(name, value, desc)

    // Vista previa "antes → después" con los valores actuales de la tortuga.
    if (preview) {
      const previewBox = document.createElement("div")
      previewBox.className = "card-preview"
      previewBox.setAttribute("aria-hidden", "true") // va en el aria-label

      for (const line of preview) {
        const row = document.createElement("div")
        row.className = `card-preview-row card-preview-${line.tone}`

        const rowLabel = document.createElement("span")
        rowLabel.className = "card-preview-label"
        rowLabel.textContent = line.label

        const rowValue = document.createElement("span")
        rowValue.className = "card-preview-value"
        if (line.noEffect) {
          rowValue.textContent = `${line.before} (sin cambio)`
        } else {
          const after = document.createElement("span")
          after.className = "card-preview-after"
          after.textContent = line.after
          rowValue.append(`${line.before} → `, after)
        }

        row.append(rowLabel, rowValue)
        previewBox.append(row)
      }

      if (card.random) {
        const note = document.createElement("div")
        note.className = "card-preview-note"
        note.textContent = "El resultado se decide al elegirla"
        previewBox.append(note)
      }

      body.append(previewBox)
    }
    btn.append(keyBadge, rarityArea, body)

    return btn
  }
}
