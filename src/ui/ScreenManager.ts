import {
  BIOME_ORDER,
  BIOMES,
  type RunOutcome,
  type RunSummary,
} from "@core/types"
import {
  computeEndlessEco,
  isEndlessUnlocked,
  type MetaState,
} from "@core/MetaState"
import type { Card } from "@cards/Card"
import {
  cardTags,
  cardValueParts,
  cardValueSeparator,
  cardValueText,
  tagLabel,
} from "@cards/CardEffects"
import { CARD_POOL } from "@cards/CardPool"
import {
  CODEX_SECTION_LABELS,
  CODEX_SECTIONS,
  sectionProgress,
  totalCodexProgress,
  type CodexSection,
} from "@/meta/codex"
import { CODEX_SECTION_HINTS, codexSectionContent } from "@ui/codexView"
import { ACHIEVEMENTS, achievementById, rewardText } from "@/meta/achievements"
import { dailyKey } from "@/meta/daily"
import {
  previewLineText,
  type BuildStatLine,
  type CardPreviewLine,
} from "@cards/BuildStats"
import { revealCards } from "@ui/animations"
import { ChoiceGuard, isRepeatedActivation } from "@ui/choiceGuard"
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
  focusables,
  moveFocus,
  pickNeighbor,
  scrollFocused,
  trapTabTarget,
  type Direction,
} from "@ui/focusNav"
import { createDefaultSettings, type Settings } from "@core/settings"
import { LOCALE } from "@core/locale"
import { endlessBiomes, type RecordKind } from "@core/records"
import { describeDeathCause } from "@core/systems/deathCause"
import { visibleSegments } from "@core/systems/runTimeline"
import { RECORD_LABELS, seedShareUrl, summaryCardChips } from "@ui/runSummary"
import { buildNextGoals, type NextGoalsView } from "@ui/nextGoals"
import {
  buttonClass,
  el,
  icon,
  makeButton,
  setUnavailable,
  type ButtonVariant,
} from "@ui/dom"
import { createConfirmDialog, type ConfirmOptions } from "@ui/ConfirmDialog"
import { RARITY_LABELS, rarityClass } from "@ui/rarity"
import { upgradeView } from "@ui/upgradeView"
import { UPGRADES } from "@/tycoon/Upgrades"
import { UpgradeManager, affordableUpgrades } from "@/tycoon/UpgradeManager"
import { type GameEvent, type EventOption } from "@/events/EventPool"
import type { EventPreview } from "@/events/EventEffects"

/** Clase que añade ▲ o ▼ con el modo para daltonismo (ver styles.css). */
function toneMarkClass(tone: "positive" | "negative"): string {
  return tone === "positive" ? "tone-mark-good" : "tone-mark-bad"
}

export interface ScreenCallbacks {
  onStartRun(): void
  /** Empieza el desafío diario (semilla del día). */
  onStartDaily(): void
  onStartEndless(): void
  /** Empieza una run con la semilla indicada (botón "Repetir semilla"). */
  onReplaySeed(seed: number, endless: boolean): void
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

/** Acciones extra de la elección de carta: volver a tirar y saltar. */
export interface CardChoiceOptions {
  reroll?: {
    /** Eco que cuesta volver a tirar. */
    cost: number
    /** Si hay Eco suficiente (si no, el botón explica por qué no). */
    affordable: boolean
    onReroll(): void
  }
  onSkip?: () => void
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

const HUD_IDS = [
  "ui-overlay",
  "toxicity-skull",
  "biome-timer",
  "zone-objective",
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

/** Color del título del resumen (ver .screen-title--* en styles.css). */
const OUTCOME_TITLE_CLASS: Record<RunOutcome, string> = {
  died: "screen-title--died",
  completed: "screen-title--completed",
  abandoned: "",
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

const ICONS = {
  trash: [
    "M3 6h18",
    "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
    "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  lock: [
    "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
    "M7 11V7a5 5 0 0 1 10 0v4",
  ],
}

/** Burbujas decorativas del fondo de las pantallas. */
const MENU_BUBBLES: ReadonlyArray<{
  size: number
  left?: string
  right?: string
  bottom: string
  delay: string
  duration: string
}> = [
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
  private cardChoiceActive = false
  private cardChoiceHandler: ((index: number) => void) | null = null
  private eventActive = false
  private eventChoiceHandler: ((index: number) => void) | null = null
  /** Bloqueo breve al abrir cartas o eventos contra elecciones accidentales. */
  private choiceGuard = new ChoiceGuard()
  /** Última pestaña vista del códice (se reabre en ella). */
  private codexSection: CodexSection = "debris"
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
  /** Diálogo de confirmación abierto sobre la pantalla, si lo hay. */
  private confirmLayer: HTMLElement | null = null

  constructor(callbacks: ScreenCallbacks) {
    this.callbacks = callbacks

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

    this.overlay = el("div", "screen-overlay")
    this.overlay.hidden = true
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

    // Con cualquier pantalla abierta, Tab no sale de ella (ni del diálogo de
    // confirmación, si hay uno). En la ventana y no en el overlay: si el foco
    // se había quedado fuera (en el body o el canvas), también lo devuelve.
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Tab" || !this.isOpen()) return
        const scope = this.confirmLayer ?? this.overlay
        const active = document.activeElement
        const target = trapTabTarget(
          focusables(scope),
          active instanceof HTMLElement && scope.contains(active)
            ? active
            : null,
          event.shiftKey,
        )
        if (!target) return
        event.preventDefault()
        target.focus()
      },
      true,
    )

    // Esc vuelve atrás en las subpantallas que lo permiten (ajustes) y cierra
    // el diálogo de confirmación. En captura y sin propagar: si no, el juego
    // lo recibiría después como "alternar pausa" y reanudaría la inmersión.
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
    this.overlay.hidden = true
    this.overlay.replaceChildren()
    this.confirmLayer = null
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
    return !this.overlay.hidden
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
    focus?:
      "upgrades" | "help" | "settings" | "daily" | "codex" | "achievements",
  ): void {
    const bestIndex = meta.bestBiomeIndex
    const bestKey = BIOME_ORDER[bestIndex]
    const bestBiome = bestKey
      ? `${bestIndex + 1}. ${BIOMES[bestKey].name}`
      : "—"

    const start = () => this.callbacks.onStartRun()

    const resetBtn = this.makeGhostTrashButton("Eliminar progreso", () =>
      this.confirm(
        {
          title: "¿Eliminar todo el progreso?",
          message:
            "Se borrarán el Eco, las mejoras, las zonas alcanzadas y las estadísticas. No se puede deshacer.",
          confirmLabel: "Sí, eliminar",
          cancelLabel: "Cancelar",
        },
        () => this.callbacks.onResetProgress(),
        resetBtn,
      ),
    )

    const enter = <T extends HTMLElement>(node: T, delayMs: number): T => {
      node.classList.add("hub-enter")
      node.style.setProperty("--hub-delay", `${delayMs}ms`)
      return node
    }

    const { root, content } = this.makeWindowFrame()

    const topBar = el("div", "hub-topbar")
    topBar.append(resetBtn)

    const title = el("h1", "hub-title")
    title.setAttribute("aria-label", "Oceancide")
    title.append(
      el("span", "hub-title-ocean", "OCEAN"),
      el("span", "hub-title-cide", "CIDE"),
    )

    const stats = this.makeBentoGrid(
      [
        {
          label: "Eco",
          value: meta.ecoPoints.toLocaleString(LOCALE),
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
          value: meta.totalDebris.toLocaleString(LOCALE),
        },
      ],
      true,
    )

    // Fila de botones de acción. "Empezar" va primero (orden de lectura y de
    // tabulación): es el modo principal.
    const actionsRow = el("div", "action-row")

    const primary = this.makePrimaryCta("Empezar", start)
    primary.classList.add("is-main")

    // Hasta completar el modo normal, la inmersión sin fin solo se anuncia.
    const secondary = isEndlessUnlocked(meta)
      ? makeButton("Inmersión sin fin", () => this.callbacks.onStartEndless())
      : this.makeLockedAction(
          "Inmersión sin fin",
          "Completa una inmersión para desbloquearla",
        )
    secondary.classList.add("is-side")

    actionsRow.append(primary, secondary)

    // Fila secundaria (debajo de la principal): mejoras, ayuda y ajustes.
    const secondaryRow = el("div", "action-row action-row--spaced")

    const upgradesBtn = makeButton(
      "Mejoras",
      () => this.showUpgrades(meta, () => this.showHub(meta, "upgrades")),
      "upgrade",
    )
    this.markAffordable(upgradesBtn, affordableUpgrades(meta).length)

    const helpBtn = makeButton("Cómo jugar", () =>
      this.showHowToPlay("Volver al inicio", () => this.showHub(meta, "help")),
    )

    const settingsBtn = makeButton("Configuración", () =>
      this.showSettings("Volver al inicio", () =>
        this.showHub(meta, "settings"),
      ),
    )

    secondaryRow.append(upgradesBtn, helpBtn, settingsBtn)

    // Tercera fila: metas a largo plazo (desafío diario, códice y logros).
    const metaRow = el("div", "action-row action-row--spaced")
    const today = dailyKey(new Date())
    const daily = meta.daily?.date === today ? meta.daily : null
    const dailyBtn = makeButton(
      daily
        ? `Desafío diario · récord ${daily.bestEco.toLocaleString(LOCALE)} Eco`
        : "Desafío diario",
      () => this.callbacks.onStartDaily(),
    )
    dailyBtn.title =
      "La misma semilla para todos durante el día de hoy. Supera tu récord."
    const codex = totalCodexProgress(meta)
    const codexBtn = makeButton(`Códice ${codex.found}/${codex.total}`, () =>
      this.showCodex(meta, () => this.showHub(meta, "codex")),
    )
    const achievementsBtn = makeButton(
      `Logros ${meta.achievements.length}/${ACHIEVEMENTS.length}`,
      () =>
        this.showAchievements(meta, () => this.showHub(meta, "achievements")),
    )
    metaRow.append(dailyBtn, codexBtn, achievementsBtn)

    content.append(
      enter(title, 0),
      enter(stats, 180),
      enter(this.makeZoneProgress(bestIndex), 280),
      enter(actionsRow, 380),
      enter(secondaryRow, 440),
      enter(metaRow, 500),
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
      daily: dailyBtn,
      codex: codexBtn,
      achievements: achievementsBtn,
    }
    const focusTarget = focus ? focusTargets[focus] : primary
    focusTarget.focus()
  }

  public showEvent(
    event: GameEvent,
    onChoose: (opt: EventOption) => void,
    getPreview?: (opt: EventOption) => EventPreview,
    getLock?: (opt: EventOption) => string | null,
  ): void {
    const { root, content } = this.makeWindowFrame()

    const title = this.makeScreenTitle(event.title)
    title.id = "event-dialog-title"

    const desc = el("p", "event-desc", event.description)
    desc.id = "event-dialog-desc"

    const optionsCol = el("div", "event-options")

    const optionButtons: HTMLButtonElement[] = []

    const choose = (index: number): void => {
      if (!this.eventActive || !this.canActivateChoice()) return
      const opt = event.options[index]
      if (!opt || getLock?.(opt)) return
      this.hide()
      onChoose(opt)
    }

    event.options.forEach((opt, index) => {
      const btn = el("button", "event-option")
      btn.type = "button"
      btn.setAttribute("aria-keyshortcuts", String(index + 1))

      const header = el("div", "event-option-header")
      // Las teclas 1-3 no existen en táctil.
      const keyHint = el("span", "key-hint keyboard-only", String(index + 1))
      keyHint.setAttribute("aria-hidden", "true")

      header.append(keyHint, el("span", "event-option-title", opt.label))
      btn.append(header, el("span", "event-option-desc", opt.description))

      // Bloqueada: sigue siendo enfocable para que se lea el requisito.
      const lock = getLock?.(opt) ?? null
      if (lock) {
        btn.classList.add("is-locked")
        btn.setAttribute("aria-disabled", "true")
        btn.append(el("span", "event-lock", `🔒 ${lock}`))
      }

      const preview = getPreview?.(opt)
      if (preview && preview.lines.length > 0) {
        const previewBox = el("span", "event-preview")

        for (const line of preview.lines) {
          const chip = el(
            "span",
            `event-chip event-chip--${line.tone}`,
            `${line.label}: ${line.value}`,
          )
          if (line.noEffect) chip.classList.add("is-noeffect")
          if (line.tone !== "neutral" && !line.noEffect) {
            chip.classList.add(toneMarkClass(line.tone))
          }
          previewBox.append(chip)
        }

        if (preview.warning) {
          previewBox.append(el("span", "event-warning", preview.warning))
        }

        btn.append(previewBox)
      }

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
    const firstOpen = event.options.findIndex((opt) => !getLock?.(opt))
    optionButtons[Math.max(0, firstOpen)]?.focus()
  }

  /** Líneas del resumen sobre logros, códice y desafío diario. */
  private summaryMetaLines(summary: RunSummary, meta: MetaState): string[] {
    const lines: string[] = []
    for (const id of summary.newAchievements ?? []) {
      const achievement = achievementById(id)
      if (!achievement) continue
      const reward = rewardText(achievement)
      lines.push(`¡Logro: ${achievement.name}!${reward ? ` ${reward}.` : ""}`)
    }
    const found = summary.newDiscoveries ?? 0
    if (found > 0) {
      lines.push(
        found === 1
          ? "1 entrada nueva en el códice"
          : `${found} entradas nuevas en el códice`,
      )
    }
    if (summary.daily && meta.daily?.date === summary.daily) {
      lines.push(
        `Desafío diario · récord de hoy: ${meta.daily.bestEco.toLocaleString(LOCALE)} Eco (${meta.daily.attempts} ${meta.daily.attempts === 1 ? "intento" : "intentos"})`,
      )
    }
    return lines
  }

  /**
   * Códice: una pestaña por sección (desechos, fauna, reliquias y biomas). Lo
   * descubierto muestra su dato real; lo demás, oculto. Se abre en la última
   * pestaña vista.
   */
  public showCodex(meta: MetaState, onClose: () => void): void {
    const { root, content } = this.makeWindowFrame()
    // Contenido largo: si se centrara, el título y las pestañas quedarían
    // por encima del área con scroll.
    content.classList.add("screen-content--top")
    const title = this.makeScreenTitle("Códice")
    const subtitle = el("p", "upgrade-subtitle")
    subtitle.id = "codex-subtitle"

    const tabs = el("div", "codex-tabs")
    tabs.setAttribute("role", "tablist")
    tabs.setAttribute("aria-label", "Secciones del códice")
    const panel = el("div", "codex-list")
    panel.id = "codex-panel"
    panel.setAttribute("role", "tabpanel")
    panel.setAttribute("aria-describedby", subtitle.id)

    const tabButtons = new Map<CodexSection, HTMLButtonElement>()
    const select = (section: CodexSection): void => {
      this.codexSection = section
      const { found, total } = sectionProgress(meta, section)
      subtitle.textContent = `${found} de ${total} registrados. ${CODEX_SECTION_HINTS[section]}`
      for (const [id, button] of tabButtons) {
        button.setAttribute("aria-selected", String(id === section))
        button.tabIndex = id === section ? 0 : -1
      }
      panel.setAttribute("aria-labelledby", tabButtons.get(section)!.id)
      panel.replaceChildren(...codexSectionContent(section, meta))
    }
    for (const section of CODEX_SECTIONS) {
      const { found, total } = sectionProgress(meta, section)
      const button = makeButton(
        `${CODEX_SECTION_LABELS[section]} ${found}/${total}`,
        () => select(section),
      )
      button.classList.add("btn--compact", "codex-tab")
      button.id = `codex-tab-${section}`
      button.setAttribute("role", "tab")
      button.setAttribute("aria-controls", panel.id)
      tabButtons.set(section, button)
      tabs.append(button)
    }
    select(this.codexSection)

    const backBtn = makeButton("Volver al inicio", onClose)
    backBtn.classList.add("btn--narrow")
    content.append(title, tabs, subtitle, panel, backBtn)
    this.open(root, onClose, onClose)
    tabButtons.get(this.codexSection)?.focus()
  }

  /** Logros conseguidos y pendientes, con lo que desbloquea cada uno. */
  public showAchievements(meta: MetaState, onClose: () => void): void {
    const { root, content } = this.makeWindowFrame()
    content.classList.add("screen-content--top")
    const title = this.makeScreenTitle("Logros")
    const subtitle = el(
      "p",
      "upgrade-subtitle",
      `${meta.achievements.length} de ${ACHIEVEMENTS.length} conseguidos.`,
    )
    const grid = el("div", "upgrade-grid")
    for (const achievement of ACHIEVEMENTS) {
      const done = meta.achievements.includes(achievement.id)
      const card = el("article", done ? "upgrade-card is-max" : "upgrade-card")
      const header = el("div", "upgrade-header")
      header.append(
        el("h2", "upgrade-name", achievement.name),
        el("span", "upgrade-level", done ? "Conseguido" : "Pendiente"),
      )
      card.append(header, el("p", "upgrade-desc", achievement.description))
      const reward = rewardText(achievement)
      if (reward) card.append(el("p", "upgrade-status", reward))
      grid.append(card)
    }

    const backBtn = makeButton("Volver al inicio", onClose)
    backBtn.classList.add("btn--narrow")
    content.append(title, subtitle, grid, backBtn)
    this.open(root, onClose, onClose)
    backBtn.focus()
  }

  /**
   * Mejoras permanentes. Al comprar se actualizan las tarjetas en su sitio
   * (nivel, coste y qué se puede comprar con el Eco que queda), sin volver a
   * montar la pantalla: el foco sigue en el botón pulsado.
   */
  public showUpgrades(
    meta: MetaState,
    onClose: () => void,
    backLabel = "Volver al inicio",
  ): void {
    const { root, content } = this.makeWindowFrame()
    const manager = new UpgradeManager()

    const title = this.makeScreenTitle("Mejoras permanentes")
    // Se anuncia al cambiar: confirma la compra a quien usa lector.
    const subtitle = el("p", "upgrade-subtitle")
    subtitle.setAttribute("aria-live", "polite")

    const grid = el("div", "upgrade-grid")

    const cards = UPGRADES.map((upgrade) => {
      const card = el("div", "upgrade-card")
      const header = el("div", "upgrade-header")
      const name = el("h2", "upgrade-name", upgrade.name)
      name.id = `upgrade-${upgrade.id}-name`
      const level = el("span", "upgrade-level")
      header.append(name, level)

      const status = el("p", "upgrade-status")
      status.id = `upgrade-${upgrade.id}-status`

      const btn = makeButton("", () => {
        if (!manager.buy(meta, upgrade.id)) return
        this.callbacks.onSaveMeta() // Guardar en localStorage
        refresh()
      })
      // El nombre de la mejora y lo que falta, para que "Comprar · 120 Eco"
      // no suene igual en todas las tarjetas.
      btn.setAttribute("aria-describedby", `${name.id} ${status.id}`)

      card.append(
        header,
        el("p", "upgrade-desc", upgrade.description),
        btn,
        status,
      )
      grid.append(card)
      return { upgrade, card, level, btn, status }
    })

    const refresh = (): void => {
      subtitle.textContent = `Eco disponible: ${meta.ecoPoints.toLocaleString(LOCALE)}`
      for (const { upgrade, card, level, btn, status } of cards) {
        const view = upgradeView(meta, upgrade)
        const variant: ButtonVariant = view.isMax
          ? "upgrade"
          : view.canBuy
            ? "primary"
            : "neutral"
        card.classList.toggle("is-max", view.isMax)
        level.replaceChildren(
          el("span", "sr-only", "Nivel "),
          `${view.level} / ${view.maxLevel}`,
        )
        btn.className = buttonClass(variant)
        btn.textContent = view.buttonLabel
        setUnavailable(btn, !view.canBuy)
        status.textContent = view.status
      }
    }
    refresh()

    const backBtn = makeButton(backLabel, onClose)
    backBtn.classList.add("btn--narrow")

    this.enableArrowNav(grid, "grid")

    content.append(title, subtitle, grid, backBtn)
    this.open(root, onClose, onClose)

    // Foco: la primera mejora comprable; si no queda ninguna, volver.
    const firstBuyable = cards.find(
      ({ btn }) => btn.getAttribute("aria-disabled") !== "true",
    )
    ;(firstBuyable?.btn ?? backBtn).focus()
  }

  /**
   * Pantalla "Cómo jugar": controles, fichas de desechos y peligros, y el
   * interruptor de los avisos. `onBack` vuelve a la pantalla que la abrió.
   */
  public showHowToPlay(backLabel: string, onBack: () => void): void {
    const help = this.callbacks.getHelpState()
    const { root, content } = this.makeWindowFrame()
    content.classList.add("screen-content--top")

    const title = this.makeScreenTitle("Cómo jugar", "screen-title--tight")

    const reopen = (): void => this.showHowToPlay(backLabel, onBack)

    const tipsRow = el("div", "action-row action-row--wrap action-row--wide")

    const tipsToggle = makeButton(
      help.tipsEnabled
        ? "Avisos durante la inmersión: activados"
        : "Avisos durante la inmersión: desactivados",
      () => {
        this.callbacks.onSetTipsEnabled(!help.tipsEnabled)
        reopen()
      },
      help.tipsEnabled ? "upgrade" : "neutral",
    )
    tipsToggle.setAttribute("role", "switch")
    tipsToggle.setAttribute("aria-checked", String(help.tipsEnabled))

    const tipsReset = makeButton("Volver a mostrar los avisos", () => {
      this.callbacks.onResetTips()
      reopen()
    })
    setUnavailable(tipsReset, help.seenTips === 0)

    tipsRow.append(tipsToggle, tipsReset)

    const backBtn = makeButton(backLabel, onBack, "primary")
    backBtn.classList.add("btn--narrow")

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
    content.classList.add("screen-content--top")

    const title = this.makeScreenTitle("Configuración", "screen-title--tight")
    title.id = "settings-dialog-title"

    const { controls } = this.callbacks.getHelpState()
    const body = createSettingsBody(this.callbacks.getSettings(), {
      device: controls.device,
      padStyle: controls.padStyle,
      capturePadButton: (onButton) => this.callbacks.capturePadButton(onButton),
      onChange: (patch) => this.callbacks.onUpdateSettings(patch),
    })

    const buttons = el("div", "action-row action-row--wrap action-row--top")

    const resetBtn = makeButton("Restablecer configuración", () => {
      this.callbacks.onUpdateSettings(createDefaultSettings())
      this.showSettings(backLabel, onBack, "reset")
    })

    const backBtn = makeButton(backLabel, onBack, "primary")

    // La acción principal va primero (a la izquierda), como en el resto.
    buttons.append(backBtn, resetBtn)
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

  /**
   * @param newRecords Récords que ha batido esta run.
   * @param focus Botón que recibe el foco al volver de una subpantalla
   *   (mejoras o detalles), para no perder la posición con teclado.
   */
  public showSummary(
    summary: RunSummary,
    meta: MetaState,
    newRecords: readonly RecordKind[] = [],
    focus?: "upgrades" | "details",
  ): void {
    const again = () => this.callbacks.onStartRun()
    const { root, content } = this.makeWindowFrame()
    const isRecord = (kind: RecordKind) => newRecords.includes(kind)

    const title = summary.endless
      ? this.makeScreenTitle("Fin de la inmersión", "screen-title--completed")
      : this.makeScreenTitle(
          OUTCOME_TITLES[summary.outcome],
          OUTCOME_TITLE_CLASS[summary.outcome],
        )
    // Sin el hueco habitual bajo el título: el resumen debe caber sin scroll.
    title.classList.add("screen-title--tight")
    content.append(title)

    if (summary.outcome === "died" && summary.deathCause) {
      content.append(this.makeDeathCause(summary.deathCause))
    }

    const zoneLabel = summary.endless
      ? `Bioma ${summary.biomeIndex + 1} (vuelta ${summary.loopsCompleted + 1})`
      : `${summary.biomeIndex + 1}. ${summary.biomeName}`

    // Solo lo esencial; récords, recorrido y cartas van en "Detalles".
    const totalEarned = summary.ecoBase + summary.ecoBonus
    const bentoItems: BentoItem[] = [
      summary.endless
        ? {
            label: "Biomas sobrevividos",
            value: String(endlessBiomes(summary)),
            record: isRecord("endless"),
          }
        : {
            label: "Zona alcanzada",
            value: zoneLabel,
            record: isRecord("biome"),
          },
      {
        label: "Desechos recolectados",
        value: summary.debrisCollected.toLocaleString(LOCALE),
        record: isRecord("debris"),
      },
      {
        label: "Tiempo de inmersión",
        value: formatTime(summary.durationSeconds),
        record: isRecord("fastest"),
      },
      {
        label: "Eco de esta inmersión",
        value: `+${totalEarned.toLocaleString(LOCALE)}`,
        sub:
          summary.ecoBonus > 0
            ? `Incluye +${summary.ecoBonus} de bono`
            : summary.ecoLost > 0
              ? `${summary.ecoLost.toLocaleString(LOCALE)} perdido por no cerrar la vuelta`
              : undefined,
        highlight: true,
        record: isRecord("eco"),
      },
    ]

    content.append(this.makeBentoGrid(bentoItems, true))

    if (newRecords.length > 0) {
      // Las insignias de las casillas son visuales; esto lo dice en texto.
      const names = newRecords.map((kind) => RECORD_LABELS[kind]).join(", ")
      content.append(
        el(
          "p",
          "summary-records",
          newRecords.length === 1
            ? `¡Nuevo récord! ${names}`
            : `¡${newRecords.length} nuevos récords! ${names}`,
        ),
      )
    }

    for (const line of this.summaryMetaLines(summary, meta)) {
      content.append(el("p", "summary-records", line))
    }

    const buttons = el("div", "action-row action-row--top")

    const againBtn = this.makePrimaryCta(
      summary.endless ? "Otra inmersión sin fin" : "Nueva inmersión",
      again,
    )
    againBtn.classList.add("is-main")

    const hubBtn = makeButton("Volver al inicio", () =>
      this.callbacks.onReturnToHub(),
    )
    hubBtn.classList.add("is-side")

    buttons.append(againBtn, hubBtn)

    const detailsBtn = makeButton("Detalles", () =>
      this.showRunDetails(summary, meta, newRecords),
    )
    detailsBtn.classList.add("btn--compact")

    // Objetivos pendientes, botones y semilla van en un mismo grupo de flechas
    // (en cuadrícula), para llegar también al botón de mejoras del panel.
    const actionArea = el("div", "summary-actions")
    const goals = this.makeNextGoals(buildNextGoals(summary, meta), () =>
      this.showUpgrades(
        meta,
        () => this.showSummary(summary, meta, newRecords, "upgrades"),
        "Volver al resumen",
      ),
    )
    if (goals) actionArea.append(goals.panel)
    actionArea.append(buttons, this.makeSeedRow(summary, detailsBtn))
    this.enableArrowNav(actionArea, "grid")
    content.append(actionArea)

    this.open(root, again)
    const upgradesBtn = goals?.upgradesButton
    const focusTarget =
      focus === "details"
        ? detailsBtn
        : focus === "upgrades" && upgradesBtn
          ? upgradesBtn
          : againBtn
    focusTarget.focus()
  }

  /** Línea "Causa" bajo el título del resumen de una derrota. */
  private makeDeathCause(
    cause: NonNullable<RunSummary["deathCause"]>,
  ): HTMLElement {
    const text = describeDeathCause(cause)
    const line = el("p", "summary-cause", "Causa: ")
    line.append(el("strong", "", text.title), ` · ${text.detail}`)
    return line
  }

  /**
   * Subpantalla del resumen: récords, recorrido por biomas, cartas elegidas y
   * Eco acumulado. Vuelve al resumen con el botón o con Escape.
   */
  private showRunDetails(
    summary: RunSummary,
    meta: MetaState,
    newRecords: readonly RecordKind[],
  ): void {
    const back = () => this.showSummary(summary, meta, newRecords, "details")
    const { root, content } = this.makeWindowFrame()
    content.append(
      this.makeScreenTitle("Detalles de la inmersión", "screen-title--tight"),
    )

    const { records } = meta
    const isRecord = (kind: RecordKind) => newRecords.includes(kind)
    const recordItems: BentoItem[] = [
      {
        label: RECORD_LABELS.biome,
        value: BIOME_ORDER[meta.bestBiomeIndex]
          ? `${meta.bestBiomeIndex + 1}. ${BIOMES[BIOME_ORDER[meta.bestBiomeIndex]].name}`
          : "—",
        record: isRecord("biome"),
      },
      {
        label: RECORD_LABELS.debris,
        value: records.bestDebris.toLocaleString(LOCALE),
        record: isRecord("debris"),
      },
      {
        label: RECORD_LABELS.eco,
        value: records.bestEco.toLocaleString(LOCALE),
        record: isRecord("eco"),
      },
      {
        label: RECORD_LABELS.fastest,
        value:
          records.fastestCompletion > 0
            ? formatTime(records.fastestCompletion)
            : "—",
        record: isRecord("fastest"),
      },
    ]
    if (records.bestEndlessBiomes > 0) {
      recordItems.push({
        label: RECORD_LABELS.endless,
        value: String(records.bestEndlessBiomes),
        record: isRecord("endless"),
      })
    }

    content.append(
      el("h2", "details-heading", "Récords"),
      this.makeBentoGrid(recordItems, true),
      el(
        "p",
        "details-eco",
        `Eco acumulado: ${meta.ecoPoints.toLocaleString(LOCALE)}`,
      ),
    )

    const segments = summary.timeline ?? []
    if (segments.length > 0) {
      content.append(
        el("h2", "details-heading", "Recorrido"),
        this.makeRunTimeline(summary),
      )
    }

    const chips = summaryCardChips(summary.cardsPicked, CARD_POOL)
    if (chips.length > 0) {
      const list = el("ul", "summary-cards")
      list.setAttribute("aria-label", "Cartas elegidas")
      for (const { card, count } of chips) {
        const item = el("li", `summary-card ${rarityClass(card.rarity)}`)
        item.title = `${RARITY_LABELS[card.rarity]}: ${card.description}`
        item.append(el("span", "", card.name))
        if (count > 1) {
          item.append(el("span", "summary-card-count", `×${count}`))
        }
        // El color y el icono no llegan al lector de pantalla.
        item.append(el("span", "sr-only", ` (${RARITY_LABELS[card.rarity]})`))
        list.append(item)
      }
      content.append(
        el(
          "h2",
          "details-heading",
          `Cartas elegidas (${summary.cardsPicked.length})`,
        ),
        list,
      )
    }

    const backBtn = makeButton("Volver al resumen", back, "primary")
    const row = el("div", "action-row action-row--top")
    row.append(backBtn)
    content.append(row)

    this.open(root, back, back)
    backBtn.focus()
  }

  /** Biomas recorridos con su tiempo, desechos y Eco. */
  private makeRunTimeline(summary: RunSummary): HTMLElement {
    const section = el("section", "summary-timeline")
    section.setAttribute("aria-label", "Recorrido")

    const { hidden, shown } = visibleSegments(summary.timeline ?? [], 8)
    if (hidden > 0) {
      section.append(
        el(
          "p",
          "summary-timeline-hidden",
          hidden === 1
            ? "1 bioma anterior no se muestra"
            : `${hidden} biomas anteriores no se muestran`,
        ),
      )
    }

    const list = el("ol", "summary-timeline-list")
    for (const segment of shown) {
      const loop = Math.floor(segment.biomeIndex / BIOME_ORDER.length)
      const name = summary.endless
        ? `${segment.biomeName} · vuelta ${loop + 1}`
        : `${segment.biomeIndex + 1}. ${segment.biomeName}`
      const stats = [
        formatTime(segment.seconds),
        `${segment.debris.toLocaleString(LOCALE)} desechos`,
        `+${segment.eco.toLocaleString(LOCALE)} Eco`,
      ].join(" · ")

      const item = el("li", "summary-timeline-item")
      item.append(
        el("span", "summary-timeline-name", name),
        el("span", "summary-timeline-stats", stats),
      )
      list.append(item)
    }
    section.append(list)
    return section
  }

  /**
   * Semilla de la run con los botones para compartirla y repetirla, más
   * `extra` (el botón de detalles) en la misma fila.
   */
  private makeSeedRow(summary: RunSummary, extra: HTMLElement): HTMLElement {
    const row = el("div", "summary-seed")
    row.append(el("span", "summary-seed-value", `Semilla · ${summary.seed}`))

    const status = el("span", "sr-only")
    status.setAttribute("aria-live", "polite")

    const link = seedShareUrl(location.href, summary.seed)
    const linkText = el("code", "summary-seed-link", link)
    linkText.hidden = true

    const copyLabel = "Copiar enlace"
    let resetTimer = 0
    const copyBtn = makeButton(copyLabel, () => {
      const done = (text: string) => {
        copyBtn.textContent = text
        status.textContent = text
        window.clearTimeout(resetTimer)
        resetTimer = window.setTimeout(() => {
          copyBtn.textContent = copyLabel
        }, 2000)
      }
      // Sin portapapeles (HTTP sin TLS, permisos denegados) se deja el enlace
      // a la vista para copiarlo a mano.
      const fallback = () => {
        linkText.hidden = false
        done("Cópialo abajo")
      }
      if (!navigator.clipboard) {
        fallback()
        return
      }
      navigator.clipboard
        .writeText(link)
        .then(() => done("¡Enlace copiado!"), fallback)
    })
    copyBtn.classList.add("btn--compact")

    const replayBtn = makeButton("Repetir semilla", () =>
      this.callbacks.onReplaySeed(summary.seed, summary.endless),
    )
    replayBtn.classList.add("btn--compact")

    row.append(copyBtn, replayBtn, extra, status, linkText)
    return row
  }

  /**
   * Panel "Siguiente objetivo" del resumen: lo que faltó de la zona, la mejora
   * a tiro y el siguiente bioma. Si hay mejoras comprables, ofrece ir a ellas.
   */
  private makeNextGoals(
    view: NextGoalsView,
    onUpgrades: () => void,
  ): { panel: HTMLElement; upgradesButton: HTMLButtonElement | null } | null {
    if (view.goals.length === 0) return null

    const panel = el("section", "goals-panel")

    const heading = el(
      "h2",
      "goals-heading",
      view.goals.length === 1 ? "Siguiente objetivo" : "Próximos objetivos",
    )
    heading.id = "next-goals-title"
    panel.setAttribute("aria-labelledby", heading.id)

    const list = el("ul", "goals-list")
    for (const goal of view.goals) {
      const item = el("li", "goals-item")
      item.append(el("span", "", goal.text))

      if (goal.progress !== undefined) {
        // El texto ya dice cuánto falta: la barra es solo un refuerzo visual.
        const track = el("div", "goals-track")
        track.setAttribute("aria-hidden", "true")
        const percent = Math.round(
          Math.max(0, Math.min(1, goal.progress)) * 100,
        )
        const fill = el("div", "goals-fill")
        fill.style.setProperty("--progress", `${percent}%`)
        track.append(fill)
        item.append(track)
      }
      list.append(item)
    }
    panel.append(heading, list)

    let upgradesButton: HTMLButtonElement | null = null
    if (view.affordableCount > 0) {
      upgradesButton = makeButton("Ir a Mejoras", onUpgrades, "upgrade")
      upgradesButton.classList.add("btn--compact")
      this.markAffordable(upgradesButton, view.affordableCount)
      panel.append(upgradesButton)
    }

    return { panel, upgradesButton }
  }

  /**
   * Contador de mejoras comprables en un botón de "Mejoras" (en el hub y en el
   * resumen). Sin nada comprable no añade nada.
   */
  private markAffordable(button: HTMLButtonElement, count: number): void {
    if (count <= 0) return

    const label = button.textContent?.trim() ?? ""
    const badge = el("span", "count-badge", String(count))
    badge.setAttribute("aria-hidden", "true")
    button.append(badge)
    button.setAttribute(
      "aria-label",
      `${label}, ${count === 1 ? "1 disponible" : `${count} disponibles`}`,
    )
  }

  public showCardChoice(
    cards: Card[],
    onPick: (card: Card) => void,
    notice?: string,
    getPreview?: (card: Card) => CardPreviewLine[],
    options: CardChoiceOptions = {},
  ): void {
    const pick = (index: number) => {
      if (!this.cardChoiceActive || !this.canActivateChoice()) return
      const card = cards[index]
      if (!card) return
      this.hide()
      onPick(card)
    }

    // Volver a tirar y saltar pasan por el mismo bloqueo que las cartas, para
    // que una pulsación pendiente no los active sin querer.
    const extra = (action: () => void) => () => {
      if (!this.cardChoiceActive || !this.canActivateChoice()) return
      this.hide()
      action()
    }

    const { root, content } = this.makeWindowFrame()

    const title = this.makeScreenTitle("Elige una carta")

    const row = el("div", "card-row")

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
      content.append(el("p", "event-notice", `Resultado del evento: ${notice}`))
    }

    this.enableArrowNav(row)

    content.append(title, row)

    const extraButtons: HTMLButtonElement[] = []
    if (options.reroll || options.onSkip) {
      const actions = el("div", "card-choice-actions")
      const { reroll, onSkip } = options
      if (reroll) {
        const btn = makeButton(
          `Volver a tirar · ${reroll.cost} Eco`,
          extra(reroll.onReroll),
        )
        btn.classList.add("btn--compact")
        if (!reroll.affordable) {
          setUnavailable(btn, true)
          btn.setAttribute(
            "aria-label",
            `Volver a tirar: necesitas ${reroll.cost} de Eco`,
          )
          btn.title = `Necesitas ${reroll.cost} de Eco`
        }
        extraButtons.push(btn)
      }
      if (onSkip) {
        const btn = makeButton("Saltar", extra(onSkip))
        btn.classList.add("btn--compact")
        btn.title = "Seguir sin elegir ninguna carta"
        extraButtons.push(btn)
      }
      actions.append(...extraButtons)
      this.enableArrowNav(actions)
      content.append(actions)
    }

    this.open(root, () => {})
    this.cardChoiceActive = true
    this.cardChoiceHandler = pick
    this.choiceGuard.open()
    this.showChoiceLock([...cardButtons, ...extraButtons], content)
    // El realce de la carta enfocada es CSS (:focus-visible): al acabar la
    // animación de entrada, que limpia el transform, vuelve a aplicarse solo.
    void revealCards(cardButtons)
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

    // Inmersión sin fin: al confirmar el abandono se avisa de lo que se pierde.
    let lossWarning: string | undefined
    if (runInfo) {
      // Con la build el contenido puede no caber: centrado solo si cabe.
      content.classList.add("screen-content--safe")
      title.classList.add("screen-title--compact")

      const zoneLabel = `${runInfo.biomeIndex + 1}. ${runInfo.biomeName}`
      const eco = Math.floor(runInfo.ecoAwareness).toLocaleString(LOCALE)
      const banked =
        runInfo.ecoBanked !== undefined
          ? ` (${Math.round(runInfo.ecoBanked).toLocaleString(LOCALE)} asegurado)`
          : ""
      content.append(
        el(
          "p",
          "pause-stats",
          `${zoneLabel} · ${runInfo.depth.toLocaleString(LOCALE)} m · Eco ${eco}${banked}`,
        ),
      )

      if (runInfo.ecoBanked !== undefined) {
        const { lost } = computeEndlessEco(
          runInfo.ecoAwareness,
          runInfo.ecoBanked,
        )
        if (lost > 0) {
          lossWarning = `Perderás ${lost.toLocaleString(LOCALE)} Eco de esta vuelta. Ciérrala para asegurarlo todo.`
        }
      }
    }

    const buttons = el("div", "action-row action-row--top")

    const resumeBtn = this.makePrimaryCta("Reanudar", onResume)
    resumeBtn.classList.add("is-main")

    // Confirmación para no perder la inmersión por un clic accidental.
    const abandonBtn = makeButton(
      "Abandonar",
      () =>
        this.confirm(
          {
            title: "¿Abandonar la inmersión?",
            warning: lossWarning,
            confirmLabel: "Sí, abandonar",
            cancelLabel: "Seguir buceando",
          },
          onAbandon,
          abandonBtn,
        ),
      "danger",
    )
    abandonBtn.classList.add("is-side")

    const settingsBtn = makeButton("Configuración", () =>
      this.showSettings("Volver a la pausa", () =>
        this.showPause(onResume, onAbandon, runInfo, "settings"),
      ),
    )
    settingsBtn.classList.add("is-side")

    // La acción principal va primero (a la izquierda), como en el hub y el
    // resumen; "Abandonar", la destructiva, en el otro extremo.
    buttons.append(resumeBtn, settingsBtn, abandonBtn)

    this.enableArrowNav(buttons)

    content.append(buttons)
    if (runInfo) content.append(this.makeBuildPanel(runInfo))
    this.open(root, onResume, onResume)
    ;(focus === "settings" ? settingsBtn : resumeBtn).focus()
  }

  /**
   * Pide confirmación con un diálogo propio sobre la pantalla abierta. La
   * pantalla de debajo queda inerte (ni ratón, ni Tab, ni lector de pantalla);
   * Esc, "volver" en el mando o tocar fuera cancelan y devuelven el foco a
   * `opener` (el botón que lo abrió; Safari no lo enfoca al hacer clic).
   */
  private confirm(
    options: ConfirmOptions,
    onConfirm: () => void,
    opener: HTMLElement,
  ): void {
    if (this.confirmLayer) return

    const screen = this.overlay.querySelector<HTMLElement>(".screen-frame")
    const saved = {
      primary: this.primaryAction,
      back: this.backAction,
      escape: this.escapeAction,
    }

    const close = (): void => {
      if (!this.confirmLayer) return
      this.confirmLayer.remove()
      this.confirmLayer = null
      if (screen) screen.inert = false
      this.primaryAction = saved.primary
      this.backAction = saved.back
      this.escapeAction = saved.escape
    }
    const cancel = (): void => {
      close()
      opener.focus()
    }

    const { layer, cancelButton } = createConfirmDialog(
      options,
      () => {
        close()
        onConfirm()
      },
      cancel,
    )

    if (screen) screen.inert = true
    this.overlay.append(layer)
    this.confirmLayer = layer
    this.primaryAction = cancel
    this.backAction = cancel
    this.escapeAction = cancel
    cancelButton.focus()
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

    const bar = el("div", "choice-lock-bar")
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
    const panel = el("section", "build-panel")
    panel.setAttribute("aria-label", "Tu tortuga")

    const stats = el("div", "build-stats")
    for (const stat of runInfo.stats) {
      const cell = el("div", "build-stat")
      if (stat.warning) cell.classList.add("build-stat-warning")
      cell.append(
        el("div", "build-stat-label", stat.label),
        el("div", "build-stat-value", stat.value),
        el("div", "build-stat-description", stat.description),
      )
      stats.append(cell)
    }

    panel.append(
      el("h2", "build-heading", "Tu tortuga"),
      stats,
      el("h3", "build-subheading", `Cartas (${runInfo.cards.length})`),
    )

    if (runInfo.cards.length === 0) {
      panel.append(
        el(
          "p",
          "build-empty",
          "Aún no has elegido ninguna: limpia la zona para ganar la primera.",
        ),
      )
    } else {
      // La descripción se muestra en un recuadro fijo bajo las fichas, no en un
      // tooltip: así llega también con teclado y en pantallas táctiles.
      const detail = el(
        "p",
        "build-chip-detail",
        "Selecciona una carta para ver qué hace.",
      )
      detail.setAttribute("aria-live", "polite")
      const chips = el("div", "build-chips")
      const select = (chip: HTMLButtonElement, text: string): void => {
        for (const other of chips.querySelectorAll(".build-chip")) {
          other.setAttribute("aria-pressed", "false")
        }
        chip.setAttribute("aria-pressed", "true")
        detail.textContent = text
      }
      for (const card of runInfo.cards) {
        const chip = el("button", `build-chip ${rarityClass(card.rarity)}`)
        chip.type = "button"
        chip.setAttribute("aria-pressed", "false")
        const text = `${card.name} (${RARITY_LABELS[card.rarity]}): ${card.description}`
        chip.append(
          el("span", "build-chip-name", card.name),
          el("span", "build-chip-value", cardValueText(card)),
        )
        // Pasar el ratón por encima también la describe (no es un estilo: es
        // la misma selección que el clic y el foco).
        for (const type of ["click", "focus", "pointerenter"] as const) {
          chip.addEventListener(type, () => select(chip, text))
        }
        chips.append(chip)
      }
      panel.append(chips, detail)
    }

    if (runInfo.relics.length > 0) {
      const chips = el("div", "build-chips")
      for (const relic of runInfo.relics) {
        const chip = el("div", "build-chip")
        chip.append(el("span", "build-chip-name", relic))
        chips.append(chip)
      }
      panel.append(
        el("h3", "build-subheading", `Reliquias (${runInfo.relics.length})`),
        chips,
      )
    }

    return panel
  }

  private makeWindowFrame(): { root: HTMLElement; content: HTMLElement } {
    const root = el("div", "screen-frame")
    const content = el("div", "screen-content")
    root.append(content)
    return { root, content }
  }

  /** Título de pantalla (h1). `modifier`: clase de color o margen. */
  private makeScreenTitle(text: string, modifier = ""): HTMLElement {
    return el("h1", `screen-title ${modifier}`.trim(), text)
  }

  private makeBentoGrid(items: BentoItem[], singleRow = false): HTMLElement {
    // Una sola línea (menú de inicio): todas las casillas en fila para ocupar
    // menos alto; en pantallas estrechas bajan a dos por fila.
    if (singleRow) {
      const row = el("div", "bento-row")
      for (const item of items) row.append(this.makeBentoStat(item))
      return row
    }

    const wrap = el("div", "bento-wrap")

    const rows: BentoItem[][] = []
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
      const line = el("div", "bento-line")
      const basis = row.length === 1 ? "60%" : row.length === 2 ? "40%" : "30%"

      for (const item of row) {
        const stat = this.makeBentoStat(item)
        stat.style.setProperty("--bento-basis", basis)
        line.append(stat)
      }
      wrap.append(line)
    }
    return wrap
  }

  private makeBentoStat(item: BentoItem): HTMLElement {
    const card = el("div", "bento-stat")
    card.append(
      el("div", "bento-label", item.label),
      el(
        "div",
        item.highlight ? "bento-value bento-value--accent" : "bento-value",
        item.value,
      ),
    )
    if (item.sub) card.append(el("div", "bento-sub", item.sub))
    if (item.record) {
      const badge = el("span", "record-badge", "¡Nuevo récord!")
      badge.setAttribute("aria-hidden", "true") // lo dice .summary-records
      card.append(badge)
    }
    return card
  }

  /**
   * Acción principal de una pantalla (la que lanza Enter): botón relleno con
   * la tecla al lado. Mismo aspecto en el hub, la pausa y el resumen.
   */
  private makePrimaryCta(
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = makeButton(label, onClick, "primary")

    // Solo con teclado: en táctil o con mando no hay Enter que pulsar.
    const keycap = el("span", "keycap keyboard-only", "Enter")
    keycap.setAttribute("aria-hidden", "true")
    btn.append(keycap)

    return btn
  }

  /**
   * Modo aún no disponible: no es un botón (no recibe foco ni se pulsa), solo
   * dice qué hace falta para desbloquearlo.
   */
  private makeLockedAction(label: string, requirement: string): HTMLElement {
    const box = el("div", "locked-action")
    box.dataset.locked = ""

    const text = el("div", "locked-action-text")
    text.append(
      el("span", "locked-action-label", label),
      el("span", "locked-action-req", requirement),
    )
    box.append(icon(ICONS.lock, 18), text)
    return box
  }

  private makeGhostTrashButton(
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = el("button", "btn-trash")
    btn.type = "button"
    btn.append(icon(ICONS.trash, 15), document.createTextNode(label))
    btn.addEventListener("click", onClick)
    return btn
  }

  private makeZoneProgress(bestIndex: number): HTMLElement {
    const total = BIOME_ORDER.length
    const reached = bestIndex >= 0 && BIOME_ORDER[bestIndex] ? bestIndex + 1 : 0

    const wrap = el("div", "zone-progress")
    const header = el("div", "zone-progress-header")
    header.append(
      el("span", "", "Zonas alcanzadas"),
      el("span", "zone-progress-count", `${reached} / ${total}`),
    )

    // El contador ya lo dice: la barra es solo visual.
    const bar = el("div", "zone-progress-bar")
    bar.setAttribute("aria-hidden", "true")
    BIOME_ORDER.forEach((key, i) => {
      const seg = el(
        "div",
        i < reached ? "zone-progress-seg is-lit" : "zone-progress-seg",
      )
      seg.title = `${i + 1}. ${BIOMES[key].name}`
      bar.append(seg)
    })

    wrap.append(header, bar)
    return wrap
  }

  private makeCornerBubbles(): HTMLElement {
    const layer = el("div", "menu-bubbles")
    layer.setAttribute("aria-hidden", "true")

    for (const bubble of MENU_BUBBLES) {
      const node = el("div", "menu-bubble")
      node.style.setProperty("--size", `${bubble.size}px`)
      node.style.setProperty("--delay", bubble.delay)
      node.style.setProperty("--duration", bubble.duration)
      if (bubble.left) node.style.left = bubble.left
      if (bubble.right) node.style.right = bubble.right
      node.style.bottom = bubble.bottom
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
    this.confirmLayer = null
    this.overlay.removeAttribute("aria-describedby")
    this.overlay.replaceChildren(this.makeCornerBubbles(), container)

    // El diálogo se nombra con el título de la pantalla.
    const heading = container.querySelector("h1")
    if (heading) {
      if (!heading.id) heading.id = "screen-title"
      this.overlay.setAttribute("aria-labelledby", heading.id)
    } else {
      this.overlay.removeAttribute("aria-labelledby")
    }

    this.overlay.hidden = false
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
    const label = RARITY_LABELS[card.rarity]

    const btn = el("button", `card-choice ${rarityClass(card.rarity)}`)
    btn.type = "button"
    if (card.rarity === "ultra_legendary") {
      btn.classList.add("card-ultra-legendary")
    } else if (card.rarity === "chaos") {
      btn.classList.add("card-chaos")
    }

    const previewText =
      preview && preview.length > 0
        ? ` ${preview.map(previewLineText).join(". ")}.`
        : ""
    const tagText =
      cardTags(card).length > 0
        ? ` Etiquetas: ${cardTags(card).map(tagLabel).join(", ")}.`
        : ""
    btn.setAttribute(
      "aria-label",
      `${label}: ${card.name}. ${cardValueText(card)}. ${card.description}${tagText}${previewText}`,
    )
    btn.addEventListener("click", onClick)

    const keyBadge = el("span", "card-key", `${index + 1}`)
    keyBadge.setAttribute("aria-hidden", "true")

    // La rareza se lee en el texto, no solo en el color.
    const rarityArea = el("span", "card-rarity")
    const rarityLabel = el("span", "card-rarity-label", label)
    rarityArea.append(rarityLabel, el("span", "card-divider"))

    const body = el("span", "card-body")
    const name = el("span", "card-name", card.name)

    // Cada tramo del valor se pinta según su signo (ver .card-value). Con el
    // modo para daltonismo, además, llevan ▲ o ▼.
    const value = el("span", "card-value")
    const separator = cardValueSeparator(card)
    cardValueParts(card).forEach((part, i) => {
      if (i > 0) value.append(document.createTextNode(separator))
      const span = el("span", `card-tone-${part.tone}`, part.text)
      if (part.tone !== "neutral") span.classList.add(toneMarkClass(part.tone))
      value.append(span)
    })
    const desc = el("span", "card-desc", card.description)

    body.append(name, value, desc)

    // Arquetipos, para ver de un vistazo qué cartas se combinan.
    const tags = cardTags(card)
    if (tags.length > 0) {
      body.append(el("span", "card-tags", tags.map(tagLabel).join(" ")))
    }

    // Vista previa "antes → después" con los valores actuales de la tortuga.
    // Las cartas que solo cambian reglas no tienen atributos que prever.
    if (preview && (preview.length > 0 || card.random)) {
      const previewBox = el("span", "card-preview")
      previewBox.setAttribute("aria-hidden", "true") // va en el aria-label

      for (const line of preview) {
        const row = el("span", `card-preview-row card-preview-${line.tone}`)
        const rowLabel = el("span", "card-preview-label", line.label)
        const rowValue = el("span", "card-preview-value")
        if (line.noEffect) {
          rowValue.textContent = `${line.before} (sin cambio)`
        } else {
          rowValue.append(
            `${line.before} → `,
            el("span", "card-preview-after", line.after),
          )
        }

        row.append(rowLabel, rowValue)
        previewBox.append(row)
      }

      if (card.random) {
        previewBox.append(
          el("span", "card-preview-note", "El resultado se decide al elegirla"),
        )
      }

      body.append(previewBox)
    }
    btn.append(keyBadge, rarityArea, body)

    return btn
  }
}

interface BentoItem {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  /** Marca de "¡Nuevo récord!" en la casilla. */
  record?: boolean
}
