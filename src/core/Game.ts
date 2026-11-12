import * as THREE from "three"
import { Turtle } from "@entities/Turtle"
import { BiomeGenerator } from "@world/BiomeGenerator"
import { EnemyManager } from "@world/EnemyManager"
import { SUN_DIRECTION } from "@world/WaterEffects"
import { UIManager } from "@ui/UIManager"
import { EdgeIndicators } from "@ui/EdgeIndicators"
import { BoundaryWalls } from "@world/BoundaryWalls"
import { DevMenu } from "@ui/DevMenu"
import { PerfOverlay } from "@ui/PerfOverlay"
import {
  AdaptiveQuality,
  QUALITY_LABELS,
  QUALITY_PRESETS,
  effectivePixelRatio,
  isTouchDevice,
  lowerPreset,
  qualityChoiceFromUrl,
  rememberAutoPreset,
  resolveQuality,
  wantsAntialias,
  type QualityChoice,
  type QualitySettings,
} from "@core/quality"
import {
  SettingsManager,
  sanitizeSettings,
  type Settings,
} from "@core/settings"
import { TouchControls } from "@ui/TouchControls"
import { setColorVisionMode } from "@ui/colorVision"
import { CardManager } from "@cards/CardManager"
import { createRunState, type RunState } from "@cards/Card"
import { buildStatLines, previewCard, readBuild } from "@cards/BuildStats"
import { Debris } from "@entities/Debris"
import { BubbleTrail } from "@entities/BubbleTrail"
import { BiomeTransition } from "@world/BiomeTransition"
import { StructureManager } from "@world/StructureManager"
import { STRUCTURES, type StructureKey } from "@world/StructureConfig"
import { ScreenManager } from "@ui/ScreenManager"
import {
  prefersReducedMotion,
  setAnimationsPaused,
  setReduceMotionChoice,
} from "@ui/animations"
import { RenderPipeline } from "@core/RenderPipeline"
import {
  SaveManager,
  applyRunToMeta,
  computeEco,
  computeEndlessEco,
  type MetaState,
} from "@core/MetaState"
import { Rng, deriveSeed, randomSeed } from "@core/rng"
import { InputController } from "@core/InputController"
import { GamepadController, type PadStyle } from "@core/gamepad"
import {
  buildControlLabel,
  controlsHintText,
  type ControlBindings,
  type ControlDevice,
  type InputDevice,
} from "@ui/controlLabels"
import { buildHudView } from "@ui/buildHud"
import {
  HELD_CONTROLS,
  hintActions,
  isHeldControlActive,
  touchLabelActions,
  type HintAction,
} from "@core/controlsHint"
import {
  TIP_TIME_LOW_RATIO,
  TOUCH_TIP_CONTROL,
  TOUCH_TIP_IDS,
  TipQueue,
  tipText,
  type TipId,
} from "@core/tips"
import { CameraRig } from "@core/CameraRig"
import {
  BIOME_ORDER,
  type GameState,
  type InputState,
  type RunOutcome,
  type RunSummary,
} from "@core/types"
import {
  applyToxicityDelta,
  computeBiomeToxicityFloor,
  computeDebrisCleanup,
  computeEntryToxicity,
  computeFilterCleanup,
  computePassiveToxicityRate,
} from "@core/systems/toxicity"
import {
  computeBiomeTimeLimit,
  computeReviveToxicity,
  computeReviveTimeRemaining,
  computeTimePressure,
  computeZoneProgress,
} from "@core/systems/progression"
import { UpgradeManager } from "@/tycoon/UpgradeManager"
import { ACT_EVENTS } from "@/events/EventPool"
import { RELICS, pickRelic, type Relic } from "@/relics/RelicPool"
import {
  applyEventEffects,
  previewEventEffects,
  type EventContext,
} from "@/events/EventEffects"

const MAX_DELTA = 0.1
// Colores temporales para teñir la estela de burbujas (sin allocations).
const bubbleWater = new THREE.Color()
const bubbleAccent = new THREE.Color()
// Sal de la semilla de las reliquias (0 = bioma, 1000 = cartas, 2000 = eventos).
const RELIC_SEED_SALT = 3000

const BUILD_DISTANCE = 4
const DEEP_POINT_LIGHT_BOOST = 25
const BLOOM_MAX_STRENGTH = 0.5

// Avisos de proximidad: se comprueban cada cierto tiempo, no en cada frame.
const TIP_CHECK_INTERVAL = 0.3
const TIP_DEBRIS_NEAR_DISTANCE = 14
const TIP_LEAK_SEEN_DISTANCE = 22

type Screen = "hub" | "run" | "summary"

function seedFromUrl(): number | null {
  const raw = new URLSearchParams(location.search).get("seed")
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n >>> 0 : null
}

export class Game {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private turtle: Turtle
  private biomeGenerator: BiomeGenerator
  private enemyManager: EnemyManager
  private uiManager: UIManager
  private state: GameState
  private input: InputState
  private inputController: InputController
  private gamepad: GamepadController
  /** Último dispositivo usado: decide qué teclas o botones muestra la ayuda. */
  private controlDevice: ControlDevice = {
    device: "keyboard",
    padStyle: "xbox",
  }
  private cameraRig: CameraRig
  private renderPipeline!: RenderPipeline
  private timer: THREE.Timer
  private directionalLight!: THREE.DirectionalLight
  private pointLights: THREE.PointLight[] = []
  private pointLightBoost = 1

  private cardManager = new CardManager()
  private upgradeManager = new UpgradeManager()
  private runState: RunState = createRunState()
  private biomeIndex = 0
  private collectedInZone = 0
  private godMode = false
  private bubbles: BubbleTrail
  private structures: StructureManager
  private paused = false
  private transition: BiomeTransition
  private pendingAdvance = false

  private endlessMode = false
  /** Eco asegurado en la inmersión sin fin: el que había al cerrar la última vuelta. */
  private endlessBankedEco = 0
  private loop = 0

  private biomeTimeRemaining = 0
  private biomeTimeLimit = 0
  private pendingTimeDelta = 0
  private pendingToxicityFloor: number | null = null
  private revivesUsed = 0
  private toxicityScaleMult = 1

  private saveManager = new SaveManager()
  private meta: MetaState
  private screens: ScreenManager
  private touchControls: TouchControls
  private tips: TipQueue
  private tipCheckTimer = 0
  private devMenu?: DevMenu
  private perfOverlay?: PerfOverlay

  private settingsManager = new SettingsManager()
  private settings: Settings = this.settingsManager.load()
  private qualityChoice: QualityChoice =
    qualityChoiceFromUrl() ?? this.settings.quality
  private quality: QualitySettings = resolveQuality(this.qualityChoice)
  private adaptiveQuality = new AdaptiveQuality()
  private screen: Screen = "hub"
  private runSeed = randomSeed()
  private runTime = 0

  private readonly tmpProjected = new THREE.Vector3()
  private edgeIndicators!: EdgeIndicators
  private boundaryWalls!: BoundaryWalls

  constructor() {
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )
    this.cameraRig = new CameraRig(this.camera)

    // El antialias no se puede cambiar después de crear el contexto: se decide
    // con el preset inicial. Con pixel ratio ≥ 2 el MSAA no se nota y es caro.
    const pixelRatio = effectivePixelRatio(
      this.quality,
      window.devicePixelRatio,
    )
    this.renderer = new THREE.WebGLRenderer({
      antialias: wantsAntialias(pixelRatio),
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(pixelRatio)
    document
      .getElementById("game-container")!
      .appendChild(this.renderer.domElement)

    this.renderPipeline = new RenderPipeline(
      this.renderer,
      this.scene,
      this.camera,
      { bloom: this.quality.bloom },
    )

    this.turtle = new Turtle()
    this.scene.add(this.turtle.mesh)
    this.bubbles = new BubbleTrail(this.scene)
    this.structures = new StructureManager(this.scene)

    this.biomeGenerator = new BiomeGenerator(this.scene)
    this.biomeGenerator.setQuality(this.quality)
    this.enemyManager = new EnemyManager(this.scene)
    this.uiManager = new UIManager()
    this.edgeIndicators = new EdgeIndicators(
      document.getElementById("game-container")!,
    )
    this.boundaryWalls = new BoundaryWalls(this.scene)
    this.uiManager.createPauseButton(() => this.togglePause())
    this.transition = new BiomeTransition()

    this.meta = this.saveManager.load()

    this.screens = new ScreenManager({
      onStartRun: () => this.startRun(false),
      onStartEndless: () => this.startRun(true),
      onReturnToHub: () => this.showHub(),
      onResetProgress: () => {
        this.meta = this.saveManager.reset()
        this.refreshControlsHint()
        this.showHub()
      },
      onSaveMeta: () => this.saveManager.save(this.meta),
      getHelpState: () => ({
        controls: { ...this.controlDevice },
        tipsEnabled: this.settings.tipsEnabled,
        seenTips: this.meta.seenTips.length,
      }),
      onSetTipsEnabled: (enabled) => {
        this.updateSettings({ tipsEnabled: enabled })
      },
      onResetTips: () => {
        this.meta.seenTips = []
        this.saveManager.save(this.meta)
      },
      // La calidad en uso (puede venir de ?quality=), no solo la guardada.
      getSettings: () => ({ ...this.settings, quality: this.qualityChoice }),
      onUpdateSettings: (patch) => this.updateSettings(patch),
      capturePadButton: (onButton) => this.gamepad.captureButton(onButton),
    })

    this.tips = new TipQueue({
      isSeen: (id) => this.meta.seenTips.includes(id),
      isEnabled: () => this.settings.tipsEnabled,
      onShow: (id) => this.showTip(id),
      onHide: () => this.uiManager.hideTip(),
    })

    this.state = {
      debrisCollected: 0,
      ecoAwareness: 0,
      toxicity: 0,
      zoneProgress: 0,
      isRunning: true,
    }

    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
      moveX: 0,
      moveY: 0,
      vertical: 0,
    }

    this.inputController = new InputController(
      this.input,
      {
        // En los ajustes, las flechas, Espacio y Esc son de la pantalla
        // (sliders, casillas, volver), no del juego.
        isOverlayActive: () =>
          this.screens.isEventActive() ||
          this.screens.isCardChoiceActive() ||
          this.screens.isSettingsActive(),
        isPaused: () => this.paused,
        isPlaying: () => this.screen === "run",
        blocksGameplay: () => this.transition.blocksGameplay,
        togglePause: () => this.togglePause(),
        setPaused: (paused) => this.setPaused(paused),
        backflip: () => this.turtle.triggerBackflip(),
        requestAbandon: () => this.setPaused(true),
        build: () => this.tryBuild("filter"),
        dash: (direction) => this.tryDash(direction),
        setLookBack: (active) => {
          this.cameraRig.setLookBack(active)
        },
      },
      () => this.settings.keyBindings,
    )

    this.gamepad = new GamepadController(
      this.input,
      {
        // Con una pantalla abierta (menús, pausa, cartas, eventos), el mando
        // navega; en la inmersión, juega; en una transición, no hace nada.
        getMode: () => {
          if (this.screens.isOpen()) return "menu"
          if (
            this.screen === "run" &&
            !this.paused &&
            !this.transition.blocksGameplay
          ) {
            return "gameplay"
          }
          return "none"
        },
        onActivity: (style) => this.setControlDevice("gamepad", style),
        togglePause: () => this.togglePause(),
        dash: (direction) => this.tryDash(direction),
        backflip: () => this.turtle.triggerBackflip(),
        build: () => this.tryBuild("filter"),
        setLookBack: (active) => {
          this.cameraRig.setLookBack(active)
        },
        navigate: (direction) => this.screens.navigateFocus(direction),
        activate: () => this.screens.activateFocus(),
        back: () => this.screens.goBack(),
        scroll: (pixels) => this.screens.scrollBy(pixels),
      },
      undefined,
      () => this.settings.padBindings,
    )

    this.touchControls = new TouchControls(this.input, {
      onBuild: () => this.tryBuild("filter"),
      onLookBack: (active) => {
        this.cameraRig.setLookBack(active)
        // En táctil es un botón con etiqueta: usarlo la retira.
        if (active) this.markControlUsed("lookBack")
      },
      onDash: (direction) => this.tryDash(direction),
    })

    this.timer = new THREE.Timer()
    this.timer.connect(document)

    this.applySettings()
    this.setupLighting()
    this.setupEventListeners()
    this.showHub()

    if (
      import.meta.env.DEV ||
      new URLSearchParams(location.search).has("dev")
    ) {
      this.devMenu = new DevMenu({
        getBiomeIndex: () => this.biomeIndex,
        goToBiome: (i) => this.goToBiome(i),
        isGodMode: () => this.godMode,
        setGodMode: (v) => {
          this.godMode = v
        },
        clearToxicity: () => {
          this.state.toxicity = 0
        },
        completeZone: () => {
          this.collectedInZone = Number.MAX_SAFE_INTEGER
        },
        restartRun: () => this.restartRun(),
        getQualityChoice: () => this.qualityChoice,
        getQualityPreset: () => this.quality.preset,
        setQualityChoice: (choice) => this.setQualityChoice(choice),
      })

      if (new URLSearchParams(location.search).has("perf")) {
        this.perfOverlay = new PerfOverlay(this.renderer, this.scene)
        const overlay = this.perfOverlay
        // Lectura programática de las métricas (scripts de medición).
        ;(window as unknown as { __perf?: () => unknown }).__perf = () =>
          overlay.getSnapshot()
      }
    }

    this.animate()
  }

  private setupLighting(): void {
    // Presupuesto de luces FIJO: 1 direccional + 5 puntuales aquí, 1 puntual
    // en la tortuga y ambiente + hemisferio en BiomeGenerator. El número de
    // luces forma parte de la clave de los programas de three.js: si cambia,
    // se recompilan los shaders de toda la escena. Nunca añadir ni quitar
    // luces en caliente; apagarlas con intensity = 0.
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    this.directionalLight.position.copy(SUN_DIRECTION).multiplyScalar(100)
    this.scene.add(this.directionalLight)

    for (let i = 0; i < 5; i++) {
      const light = new THREE.PointLight(0x00ffff, 0.5, 50)
      this.scene.add(light)
      this.pointLights.push(light)
    }
  }

  private openActEvent(): void {
    if (this.screen !== "run") return
    this.inputController.clear()

    const rng = new Rng(deriveSeed(this.runSeed, this.biomeIndex + 2000))
    const event = rng.pick(ACT_EVENTS)
    const ctx: EventContext = {
      turtle: this.turtle,
      state: this.state,
      run: this.runState,
      rng,
    }

    this.screens.showEvent(
      event,
      (opt) => {
        const result = applyEventEffects(opt.effects, ctx)

        if (result.nextBiomeTimeDelta) {
          this.pendingTimeDelta += result.nextBiomeTimeDelta
        }
        if (result.nextBiomeToxicityFloor !== undefined) {
          this.pendingToxicityFloor = result.nextBiomeToxicityFloor
        }

        this.uiManager.announce(`Evento: ${result.summary}`)

        // Los eventos pueden llevar la toxicidad a 100. Resolvemos la muerte o
        // el revive antes de abrir la elección de carta.
        const lethal = this.state.toxicity >= 100
        if (lethal && !this.tryKill()) return

        this.openCardChoice(result.summary)
      },
      (opt) => previewEventEffects(opt.effects, ctx),
    )
  }

  private setupEventListeners(): void {
    // Antes del primer toque o tecla: en un móvil no hay teclas que enseñar
    // (el hub y el HUD ocultan las teclas con data-input, ver styles.css).
    const initial: InputDevice = isTouchDevice() ? "touch" : "keyboard"
    this.controlDevice = { ...this.controlDevice, device: initial }
    document.documentElement.dataset.input = initial
    this.refreshControlsHint()

    window.addEventListener("keydown", (e) =>
      this.inputController.handleKeyDown(e),
    )
    window.addEventListener("keyup", (e) => this.inputController.handleKeyUp(e))
    // En captura: cuenta aunque otra escucha detenga la tecla (reasignación).
    window.addEventListener(
      "keydown",
      () => this.setControlDevice("keyboard"),
      true,
    )
    window.addEventListener(
      "pointerdown",
      (e) =>
        this.setControlDevice(e.pointerType === "touch" ? "touch" : "keyboard"),
      true,
    )
    window.addEventListener("resize", () => this.handleResize())

    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        !this.transition.isActive() &&
        !this.screens.isCardChoiceActive() &&
        !this.screens.isEventActive()
      ) {
        this.setPaused(true)
      }
    })
  }

  /** Elige la calidad gráfica ("auto" o un preset fijo) y la guarda entre sesiones. */
  public setQualityChoice(choice: QualityChoice): void {
    this.updateSettings({ quality: choice })
  }

  /**
   * Cambia los ajustes indicados, los guarda y aplica en caliente solo lo que
   * ha cambiado (sin recargar).
   */
  private updateSettings(patch: Partial<Settings>): void {
    const previous = this.settings
    const next = sanitizeSettings({ ...previous, ...patch }, previous)
    this.settings = next
    this.settingsManager.save(next)

    // La calidad se compara con la que está en uso, no con la guardada: con
    // ?quality= pueden no coincidir.
    if (patch.quality !== undefined && next.quality !== this.qualityChoice) {
      this.qualityChoice = next.quality
      this.applyQuality(resolveQuality(next.quality))
    }
    if (!next.tipsEnabled && previous.tipsEnabled) this.tips.clear()

    this.applySettings()
  }

  /** Aplica los ajustes que no dependen de la calidad gráfica. Idempotente. */
  private applySettings(): void {
    const s = this.settings
    this.cameraRig.setFov(s.fov)
    setReduceMotionChoice(s.reduceMotion)
    setColorVisionMode(s.colorVision)
    this.touchControls.setAppearance(s.touchScale, s.touchOpacity)
    this.refreshControlsHint()
  }

  /**
   * Cambia el dispositivo con el que se juega (teclado y ratón, táctil o
   * mando) para que la ayuda muestre sus teclas, botones o glifos.
   */
  private setControlDevice(device: InputDevice, padStyle?: PadStyle): void {
    const current = this.controlDevice
    const style = padStyle ?? current.padStyle
    if (current.device === device && current.padStyle === style) return

    this.controlDevice = { device, padStyle: style }
    document.documentElement.dataset.input = device
    this.refreshControlsHint()
  }

  private controlBindings(): ControlBindings {
    return { keys: this.settings.keyBindings, pad: this.settings.padBindings }
  }

  /**
   * Pista de controles inferior: teclas asignadas o botones del mando de las
   * acciones que toca enseñar (en modo automático, las básicas sin usar).
   */
  private refreshControlsHint(): void {
    // En táctil el mismo ajuste decide las etiquetas bajo los botones.
    this.touchControls.setLabels(
      touchLabelActions(this.settings.controlsHint, this.meta.learnedControls),
    )

    const hint = document.getElementById("controls-hint")
    if (!hint) return
    const text = controlsHintText(
      this.controlDevice,
      this.controlBindings(),
      hintActions(this.settings.controlsHint, this.meta.learnedControls),
    )
    hint.textContent = text
    // En táctil no hay teclas que nombrar: los botones están en pantalla.
    hint.classList.toggle(
      "hidden",
      text === "" || this.controlDevice.device === "touch",
    )
  }

  /**
   * Da un control por aprendido: la pista automática y las etiquetas táctiles
   * dejan de nombrarlo.
   */
  private markControlUsed(control: HintAction): void {
    if (this.meta.learnedControls.includes(control)) return
    this.meta.learnedControls.push(control)
    this.saveManager.save(this.meta)
    this.refreshControlsHint()
  }

  /** Detecta el uso de los controles de mantener (mover, profundidad, impulso). */
  private trackHeldControls(): void {
    for (const control of HELD_CONTROLS) {
      if (isHeldControlActive(this.input, control)) {
        this.markControlUsed(control)
      }
    }
  }

  /**
   * Aplica un preset en caliente: resolución y bloom al momento; partículas y
   * nieve al momento; la densidad de props, al cargar el siguiente bioma.
   */
  private applyQuality(settings: QualitySettings): void {
    this.quality = settings
    this.renderPipeline.setBloomMode(settings.bloom)
    this.biomeGenerator.setQuality(settings)
    this.adaptiveQuality.reset()
    this.handleResize()
    this.devMenu?.refresh()
  }

  /** Modo automático: si el frame medio se mantiene alto, baja un preset. */
  private updateAdaptiveQuality(frameSeconds: number): void {
    if (this.qualityChoice !== "auto") return

    const measurable =
      this.screen === "run" &&
      !this.paused &&
      !this.transition.isActive() &&
      !document.hidden
    if (!measurable) {
      this.adaptiveQuality.reset()
      return
    }

    if (!this.adaptiveQuality.sample(frameSeconds)) return

    const lower = lowerPreset(this.quality.preset)
    if (!lower) return

    rememberAutoPreset(lower)
    this.applyQuality(QUALITY_PRESETS[lower])
    this.uiManager.showMessage(
      `Calidad gráfica ajustada: ${QUALITY_LABELS[lower]}`,
      1800,
    )
  }

  private handleResize(): void {
    this.cameraRig.resize(window.innerWidth / window.innerHeight)
    this.renderer.setPixelRatio(
      effectivePixelRatio(this.quality, window.devicePixelRatio),
    )
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderPipeline.setSize(window.innerWidth, window.innerHeight)
  }

  private loadBiome(index: number): void {
    this.biomeIndex = index
    this.collectedInZone = 0
    this.state.zoneProgress = 0

    this.loop = Math.floor(index / BIOME_ORDER.length)
    const biomeKey = BIOME_ORDER[index % BIOME_ORDER.length]

    this.biomeTimeLimit = computeBiomeTimeLimit(
      index,
      BIOME_ORDER.length,
      this.pendingTimeDelta,
    )
    this.biomeTimeRemaining = this.biomeTimeLimit
    this.pendingTimeDelta = 0

    const rng = new Rng(deriveSeed(this.runSeed, index))
    this.biomeGenerator.generateBiome(biomeKey, rng, this.loop)
    this.hideRelic(index)
    this.boundaryWalls.setBounds(
      this.biomeGenerator.getBounds(),
      this.biomeGenerator.getBiome().waterColor,
    )
    this.edgeIndicators.clear()
    // La carga del bioma no debe contar como bajo rendimiento.
    this.adaptiveQuality.reset()

    const bounds = this.biomeGenerator.getBounds()
    // En modo sin fin `index` sigue creciendo; el módulo mantiene la fauna
    // base entre 2 y 7 medusas por vuelta. El pacto caótico puede añadir más,
    // con un tope para no castigar el rendimiento.
    const enemyCount = Math.min(
      12,
      2 + (index % BIOME_ORDER.length) + this.runState.enemyCountBonus,
    )
    this.enemyManager.spawn(enemyCount, bounds, rng)
    this.applyBiomeLighting()

    const toxicityFloor =
      this.pendingToxicityFloor ??
      computeBiomeToxicityFloor(this.biomeGenerator.getBiome().toxicityRate)

    this.state.toxicity = computeEntryToxicity(
      this.state.toxicity,
      toxicityFloor,
    )
    this.pendingToxicityFloor = null

    const sun = this.biomeGenerator.getSun()
    this.renderPipeline.setBloomStrength(sun.darkness * BLOOM_MAX_STRENGTH)

    this.turtle.reset(new THREE.Vector3(0, (bounds.minY + bounds.maxY) / 2, 0))

    const lightAnchors = this.biomeGenerator.getLightAnchors()

    for (let i = 0; i < this.pointLights.length; i++) {
      const light = this.pointLights[i]
      const anchor = lightAnchors[i]

      // Las luces de bioluminiscencia nacen del propio prop (fuente hidrotermal,
      // esponja de vidrio, pluma de mar). Si no hay anclas, se usa un punto
      // aleatorio como acento ambiental.
      if (anchor) {
        light.color.setHex(anchor.color)
        light.position.copy(anchor.position)
        light.userData.baseIntensity = anchor.intensity
        continue
      }

      light.color.setHex(this.biomeGenerator.getBiome().accentColor)
      light.userData.baseIntensity = 1
      light.position.set(
        rng.range(-bounds.halfSize, bounds.halfSize),
        rng.range(bounds.minY, bounds.maxY),
        rng.range(-bounds.halfSize, bounds.halfSize),
      )
    }

    this.bubbles.clear()
    this.applyBubbleColors()
    this.structures.clear()
    this.cameraRig.snap(this.turtle.mesh.position, this.turtle.mesh.rotation.y)
    this.devMenu?.refresh()
  }

  private applyBiomeLighting(): void {
    const sun = this.biomeGenerator.getSun()
    this.directionalLight.intensity = sun.intensity
    this.directionalLight.color.setHex(sun.color)
    this.pointLightBoost = 1 + sun.darkness * DEEP_POINT_LIGHT_BOOST
  }

  private computeStructurePhase(): number {
    const count = this.structures.getActiveCount()
    const salt = 10000 + this.biomeIndex * 100 + count
    const hash = deriveSeed(this.runSeed, salt)
    return (hash / 0xffffffff) * Math.PI * 2
  }

  private tryDash(direction: "left" | "right"): void {
    if (
      this.screen !== "run" ||
      this.transition.blocksGameplay ||
      this.screens.isCardChoiceActive() ||
      this.screens.isEventActive()
    ) {
      return
    }

    // Sin mensaje central: el giro de la tortuga ya lo indica y, al
    // encadenar, el HUD "DASH ×N" muestra el multiplicador.
    this.turtle.trigger360Spin(direction)
    if (this.settings.vibration) navigator.vibrate?.(15)
    this.markControlUsed("dash")
  }

  private tryBuild(key: StructureKey): void {
    if (
      this.screen !== "run" ||
      this.transition.blocksGameplay ||
      this.screens.isCardChoiceActive() ||
      this.screens.isEventActive()
    ) {
      return
    }

    // Intentarlo ya cuenta: aunque falte eco, el jugador conoce la tecla.
    this.markControlUsed("build")

    const config = STRUCTURES[key]
    if (this.structures.getActiveCount() >= this.turtle.stats.filterCapacity) {
      this.uiManager.showMessage("Máximo de filtros activos", 1200)
      return
    }
    if (this.state.ecoAwareness < config.cost) {
      this.uiManager.showMessage(`Necesitas ${config.cost} de Eco`, 1200)
      return
    }

    const bounds = this.biomeGenerator.getBounds()
    const yaw = this.turtle.mesh.rotation.y
    const position = this.turtle.getPosition()
    position.x += Math.sin(yaw) * BUILD_DISTANCE
    position.z += Math.cos(yaw) * BUILD_DISTANCE
    position.x = THREE.MathUtils.clamp(
      position.x,
      -bounds.halfSize,
      bounds.halfSize,
    )
    position.z = THREE.MathUtils.clamp(
      position.z,
      -bounds.halfSize,
      bounds.halfSize,
    )
    position.y = THREE.MathUtils.clamp(position.y, bounds.minY, bounds.maxY)

    this.state.ecoAwareness -= config.cost
    const phase = this.computeStructurePhase()
    this.structures.build(key, position, phase)
  }

  private updateBuildHud(): void {
    const config = STRUCTURES.filter
    const active = this.structures.getActiveCount()
    const max = this.turtle.stats.filterCapacity
    this.uiManager.updateBuildHud(
      buildHudView({
        name: config.name,
        control: buildControlLabel(this.controlDevice, this.controlBindings()),
        cost: config.cost,
        eco: this.state.ecoAwareness,
        active,
        max,
      }),
    )
  }

  /** Pinta un aviso contextual y lo da por visto para que no se repita. */
  private showTip(id: TipId): void {
    this.meta.seenTips.push(id)
    this.saveManager.save(this.meta)
    const biome = this.biomeGenerator.getBiome()
    this.uiManager.showTip(
      tipText(id, {
        buildControl: buildControlLabel(
          this.controlDevice,
          this.controlBindings(),
        ),
        filterCost: STRUCTURES.filter.cost,
      }),
      { water: biome.waterColor, accent: biome.accentColor },
    )
  }

  /** Dispara los avisos que dependen del estado de la partida y avanza la cola. */
  private updateTips(deltaTime: number): void {
    if (this.controlDevice.device === "touch") this.triggerTouchTips()

    if (
      this.biomeTimeLimit > 0 &&
      this.biomeTimeRemaining / this.biomeTimeLimit <= TIP_TIME_LOW_RATIO
    ) {
      this.tips.trigger("time_low")
    }

    if (
      this.state.ecoAwareness >= STRUCTURES.filter.cost &&
      this.structures.getActiveCount() < this.turtle.stats.filterCapacity
    ) {
      this.tips.trigger("filter_affordable")
    }

    this.tipCheckTimer -= deltaTime
    if (this.tipCheckTimer <= 0) {
      this.tipCheckTimer = TIP_CHECK_INTERVAL
      this.checkProximityTips()
    }

    this.tips.update(deltaTime)
  }

  /**
   * Avisos de los controles táctiles, en orden. El que enseña un control que
   * el jugador ya ha descubierto solo se da por visto sin mostrarlo (también
   * si estaba esperando en la cola: la cola lo descarta al llegarle el turno).
   */
  private triggerTouchTips(): void {
    for (const id of TOUCH_TIP_IDS) {
      if (this.meta.seenTips.includes(id)) continue
      if (this.touchControls.hasUsed(TOUCH_TIP_CONTROL[id])) {
        this.meta.seenTips.push(id)
        this.saveManager.save(this.meta)
      } else {
        this.tips.trigger(id)
      }
    }
  }

  /** Primer desecho cerca y primera fuga a la vista (en pantalla y a tiro). */
  private checkProximityTips(): void {
    let wantsDebris = this.tips.wants("debris_near")
    let wantsLeak = this.tips.wants("leak_seen")
    if (!wantsDebris && !wantsLeak) return

    const origin = this.turtle.mesh.position
    const nearSq = TIP_DEBRIS_NEAR_DISTANCE * TIP_DEBRIS_NEAR_DISTANCE
    const leakSq = TIP_LEAK_SEEN_DISTANCE * TIP_LEAK_SEEN_DISTANCE

    for (const debris of this.biomeGenerator.getDebrisList()) {
      if (debris.removed || debris.claimed) continue

      const leak = debris.hazard === "lixivia"
      const distanceSq = debris.mesh.position.distanceToSquared(origin)
      const debrisHit = wantsDebris && distanceSq <= nearSq
      const leakHit = wantsLeak && leak && distanceSq <= leakSq
      if (!debrisHit && !leakHit) continue
      if (!this.projectToScreen(debris.mesh.position)) continue

      if (debrisHit) {
        this.tips.trigger("debris_near")
        wantsDebris = false
      }
      if (leakHit) {
        this.tips.trigger("leak_seen")
        wantsLeak = false
      }
      if (!wantsDebris && !wantsLeak) return
    }
  }

  private togglePause(): void {
    this.setPaused(!this.paused)
  }

  private setPaused(paused: boolean): void {
    if (this.screens.isEventActive()) return
    if (paused === this.paused) return

    if (paused) {
      if (
        this.screen !== "run" ||
        this.transition.isActive() ||
        this.screens.isCardChoiceActive()
      ) {
        return
      }
      this.paused = true
      this.inputController.clear()
      this.screens.showPause(
        () => this.setPaused(false),
        () => {
          this.setPaused(false)
          this.endRun("abandoned")
        },
        {
          biomeIndex: this.biomeIndex,
          biomeName: this.biomeGenerator.getBiomeName(),
          depth: this.biomeGenerator.getBiome().depth,
          ecoAwareness: this.state.ecoAwareness,
          ecoBanked: this.endlessMode ? this.endlessBankedEco : undefined,
          stats: buildStatLines(
            readBuild({
              turtle: this.turtle,
              run: this.runState,
              state: this.state,
            }),
          ),
          cards: this.runState.cards,
          relics: this.runState.relics.map(
            (id) => RELICS.find((relic) => relic.id === id)?.name ?? id,
          ),
        },
      )
    } else {
      this.paused = false
      this.screens.hide()
    }

    setAnimationsPaused(paused)
  }

  private showHub(): void {
    this.transition.cancel()
    this.pendingAdvance = false
    this.paused = false
    this.endlessMode = false
    this.screen = "hub"
    this.state.isRunning = false
    this.inputController.clear()
    this.runSeed = randomSeed()
    this.pendingTimeDelta = 0
    this.pendingToxicityFloor = null
    this.tips.clear()
    this.loadBiome(0)
    // El hub reutiliza el bioma 0 como fondo, pero no debe quedarse con fauna
    // hostil congelada detrás del menú.
    this.enemyManager.clear()
    this.screens.showHub(this.meta)
  }

  private startRun(endless = false): void {
    this.endlessMode = endless
    this.endlessBankedEco = 0
    this.transition.cancel()
    this.pendingAdvance = false
    this.paused = false
    this.runSeed = seedFromUrl() ?? randomSeed()
    this.runTime = 0

    this.state.debrisCollected = 0
    this.state.ecoAwareness = 0
    this.state.toxicity = 0
    this.state.isRunning = true
    this.screen = "run"
    this.inputController.clear()

    this.turtle.resetStats()
    this.runState = createRunState()
    this.cardManager.resetPity()
    this.pendingTimeDelta = 0
    this.pendingToxicityFloor = null
    this.revivesUsed = 0
    const bonuses = this.upgradeManager.applyAll(this.meta, this.turtle.stats)
    this.runState.ecoMultiplier *= bonuses.ecoMult
    this.toxicityScaleMult = bonuses.toxScaleMult

    this.uiManager.resetRunHud()
    this.tips.clear()
    this.tipCheckTimer = 0

    this.screens.hide()
    this.loadBiome(0)
    this.uiManager.showMessage(this.biomeBanner())
  }

  private endRun(outcome: RunOutcome): void {
    if (this.screen !== "run") return

    this.transition.cancel()
    this.pendingAdvance = false
    this.screen = "summary"
    this.state.isRunning = false
    this.inputController.clear()
    this.enemyManager.clear()
    this.tips.clear()

    const { base, bonus, lost } = this.endlessMode
      ? computeEndlessEco(this.state.ecoAwareness, this.endlessBankedEco)
      : { ...computeEco(this.state.ecoAwareness, outcome), lost: 0 }
    const summary: RunSummary = {
      outcome,
      biomeIndex: this.biomeIndex,
      biomeName: this.biomeGenerator.getBiomeName(),
      debrisCollected: this.state.debrisCollected,
      ecoBase: base,
      ecoBonus: bonus,
      ecoLost: lost,
      durationSeconds: this.runTime,
      seed: this.runSeed,
      cardsPicked: this.runState.cards.map((c) => c.id),
      endless: this.endlessMode,
      loopsCompleted: Math.floor(this.biomeIndex / BIOME_ORDER.length),
    }

    applyRunToMeta(this.meta, summary)
    this.saveManager.save(this.meta)
    this.screens.showSummary(summary, this.meta)
  }

  private advanceBiome(): void {
    const next = this.biomeIndex + 1
    if (!this.endlessMode && next >= BIOME_ORDER.length) {
      this.endRun("completed")
      return
    }

    if (this.transition.isActive()) {
      this.pendingAdvance = true
      return
    }

    // Cerrar una vuelta de la inmersión sin fin asegura todo el Eco acumulado.
    const closesLoop = this.endlessMode && next % BIOME_ORDER.length === 0
    if (closesLoop) this.endlessBankedEco = this.state.ecoAwareness

    const started = this.transition.play(async () => {
      this.loadBiome(next)
      // La transición ya rotula el bioma y su profundidad: no hace falta
      // repetirlo con un mensaje al retirarse.
      const banked = Math.round(this.endlessBankedEco).toLocaleString("es")
      this.transition.setLabel(
        closesLoop
          ? `Vuelta completada · ${banked} Eco asegurado\n${this.biomeBanner()}`
          : this.biomeBanner(),
      )
      // Compila los shaders del bioma nuevo con la pantalla aún en negro,
      // para que el tirón no se vea al retirarse la transición.
      try {
        await this.renderer.compileAsync(this.scene, this.camera)
      } catch (error) {
        console.warn("[Game] No se pudo precompilar el bioma", error)
      }
    })

    if (!started) {
      this.pendingAdvance = true
    }
  }

  private biomeBanner(): string {
    const depth = this.biomeGenerator.getBiome().depth
    return `${this.biomeGenerator.getBiomeName()} · ${depth} m`
  }

  private goToBiome(index: number): void {
    if (index < 0 || index >= BIOME_ORDER.length) return

    this.transition.cancel()
    this.pendingAdvance = false
    this.paused = false

    if (this.screen !== "run") {
      this.screen = "run"
      this.state.isRunning = true
      this.screens.hide()
    }

    this.loadBiome(index)
    this.devMenu?.refresh()
  }

  private restartRun(): void {
    this.startRun(this.endlessMode)
    this.devMenu?.refresh()
  }

  private projectToScreen(
    worldPosition: THREE.Vector3,
  ): { x: number; y: number } | null {
    const pos = this.tmpProjected.copy(worldPosition).project(this.camera)

    if (pos.z > 1) return null

    const halfW = window.innerWidth / 2
    const halfH = window.innerHeight / 2
    const screenX = pos.x * halfW + halfW
    const screenY = -pos.y * halfH + halfH

    const margin = 40
    if (
      screenX < -margin ||
      screenX > window.innerWidth + margin ||
      screenY < -margin ||
      screenY > window.innerHeight + margin
    ) {
      return null
    }

    return { x: screenX, y: screenY }
  }

  private showFloatingEco(debris: Debris, value: number): void {
    const screen = this.projectToScreen(debris.mesh.position)
    if (!screen) return
    this.uiManager.showFloatingEco(value, screen.x, screen.y)
  }

  private showFloatingEcoAt(position: THREE.Vector3, value: number): void {
    const screen = this.projectToScreen(position)
    if (!screen) return
    this.uiManager.showFloatingEco(value, screen.x, screen.y)
  }

  private update(deltaTime: number, time: number): void {
    if (!this.state.isRunning) return
    if (this.transition.blocksGameplay) return
    if (this.paused) return
    if (this.screens.isCardChoiceActive()) return
    if (this.screens.isEventActive()) return

    this.runTime += deltaTime

    // --- Timer por bioma ---
    this.biomeTimeRemaining -= deltaTime
    if (this.biomeTimeRemaining < 0) this.biomeTimeRemaining = 0
    const timePressure = computeTimePressure(this.biomeTimeRemaining)
    this.uiManager.updateBiomeTimer(
      this.biomeTimeRemaining,
      this.biomeTimeLimit,
    )

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.update(deltaTime, this.input, bounds)
    this.trackHeldControls()

    const hitByEnemy = this.enemyManager.update(
      deltaTime,
      time,
      this.turtle.mesh.position,
      bounds,
    )
    if (hitByEnemy && !this.godMode) {
      this.state.toxicity = Math.min(100, this.state.toxicity + 15)
      this.turtle.applySlow(2, 0.5)
      this.turtle.playHurt()
      this.uiManager.showMessage("¡MEDUSA!", 1000)
      this.tips.trigger("jellyfish_hit")
      if (this.state.toxicity >= 100 && !this.tryKill()) return
    }

    this.cameraRig.update(
      deltaTime,
      this.turtle.mesh.position,
      this.turtle.mesh.rotation.y,
    )

    // --- Ayudas de orientación ---
    this.boundaryWalls.update(this.turtle.mesh.position)
    const debrisList = this.biomeGenerator.getDebrisList()
    this.camera.updateMatrixWorld()
    this.edgeIndicators.update(
      debrisList,
      this.turtle.mesh.position,
      this.camera,
      this.biomeTimeLimit > 0
        ? this.biomeTimeRemaining / this.biomeTimeLimit
        : 1,
    )
    this.uiManager.updateLeaks(
      debrisList.reduce((n, d) => n + (d.hazard === "lixivia" ? 1 : 0), 0),
    )

    // --- Recolección ---
    const collected = this.biomeGenerator.updateDebris(
      this.turtle.mesh.position,
      this.turtle.getCollectionRadius(),
      time,
      deltaTime,
      this.input.boost,
    )

    // --- Toxicidad Pasiva (aplicando el multiplicador de la mejora "Sistema Inmune") ---
    this.biomeGenerator.updateVisuals(deltaTime)
    const pollution = this.biomeGenerator.getPollutionRatio()
    const passiveRate = computePassiveToxicityRate({
      toxicityRate: this.biomeGenerator.getBiome().toxicityRate,
      pollution,
      toxicityResistance: this.turtle.stats.toxicityResistance,
      toxicityScaleMult:
        this.toxicityScaleMult * this.runState.toxicityMultiplier,
      timePressure,
    })

    if (!this.godMode) {
      this.state.toxicity = applyToxicityDelta(
        this.state.toxicity,
        passiveRate * deltaTime,
      )
    }

    // --- Recolección manual ---
    for (const debris of collected) {
      this.state.debrisCollected++
      const eco = debris.shattered
        ? 0
        : Math.round(debris.ecoValue * this.runState.ecoMultiplier)
      this.state.ecoAwareness += eco

      if (!debris.isFragment) this.collectedInZone++

      if (!this.godMode) {
        this.state.toxicity = applyToxicityDelta(
          this.state.toxicity,
          -computeDebrisCleanup(debris.pollution),
        )
      }

      if (eco > 0) this.showFloatingEco(debris, eco)
      if (debris.shattered) this.tips.trigger("fragile_broken")
      if (debris.relic) this.claimRelic(debris.relic)
    }

    // --- Simbiosis ---
    const filterCount = this.structures.getActiveCount()
    if (filterCount > 0 && this.runState.filterEcoPerSecond > 0) {
      this.state.ecoAwareness +=
        filterCount * this.runState.filterEcoPerSecond * deltaTime
    }

    // --- Filtros ---
    const credit = this.structures.update(deltaTime, time, this.biomeGenerator)
    this.state.debrisCollected += credit.count
    this.collectedInZone += credit.count

    const filterEco = Math.round(credit.eco * this.runState.ecoMultiplier)
    this.state.ecoAwareness += filterEco

    if (!this.godMode && credit.count > 0) {
      this.state.toxicity = applyToxicityDelta(
        this.state.toxicity,
        -computeFilterCleanup(credit.count),
      )
    }

    for (const absorption of credit.absorptions) {
      const value = Math.round(absorption.eco * this.runState.ecoMultiplier)
      this.showFloatingEcoAt(absorption.position, value)
      if (absorption.relic) this.claimRelic(absorption.relic)
    }

    if (this.state.toxicity >= 100 && !this.tryKill()) return

    this.state.zoneProgress = computeZoneProgress(
      this.collectedInZone,
      this.biomeGenerator.getInitialDebrisCount(),
    )

    this.uiManager.updateUI(this.state, deltaTime)
    this.uiManager.updateRevives(this.runState.reviveCharges)
    this.updateBuildHud()
    this.updateTips(deltaTime)

    if (this.state.zoneProgress >= 100) {
      if (
        !this.endlessMode &&
        (this.biomeIndex === 1 || this.biomeIndex === 3)
      ) {
        this.openActEvent()
        return
      }
      if (this.endlessMode || this.biomeIndex + 1 < BIOME_ORDER.length) {
        this.openCardChoice()
      } else {
        this.endRun("completed")
      }
      return
    }

    this.uiManager.updateSpinBoostHud(
      this.turtle.getSpinBoost() / this.turtle.getSpinBoostMultiplier(),
      this.turtle.isSpinBoosting(),
    )

    this.uiManager.updateBoostEnergy(
      this.turtle.getBoostEnergy(),
      this.turtle.isBoosting(),
    )
  }

  /** La estela de burbujas toma los colores del agua y del acento del bioma. */
  private applyBubbleColors(): void {
    const biome = this.biomeGenerator.getBiome()
    this.bubbles.setBiomeColors(
      bubbleWater.setRGB(...biome.waterColor),
      bubbleAccent.setHex(biome.accentColor),
    )
  }

  /**
   * Una vez elegida la primera carta, cada bioma esconde una reliquia dentro
   * de uno de sus desechos. Usa su propia semilla para no alterar el resto de
   * la generación del bioma.
   */
  private hideRelic(index: number): void {
    if (this.screen !== "run") return
    if (this.runState.cards.length === 0) return

    const rng = new Rng(deriveSeed(this.runSeed, index + RELIC_SEED_SALT))
    const relic = pickRelic(rng, this.runState.relics)
    this.biomeGenerator.hideRelic(relic, rng)
  }

  /** Entrega la recompensa de una reliquia recogida (a mano o con un filtro). */
  private claimRelic(relic: Relic): void {
    const result = applyEventEffects(relic.effects, {
      turtle: this.turtle,
      state: this.state,
      run: this.runState,
      rng: new Rng(deriveSeed(this.runSeed, this.biomeIndex + RELIC_SEED_SALT)),
    })

    if (result.nextBiomeTimeDelta) {
      this.pendingTimeDelta += result.nextBiomeTimeDelta
    }

    this.runState.relics.push(relic.id)
    this.uiManager.announce(
      `Reliquia encontrada: ${relic.name}. ${relic.description} ${result.summary}`,
    )
    const biome = this.biomeGenerator.getBiome()
    this.uiManager.showRelicToast(
      relic.name,
      relic.description,
      result.summary,
      { water: biome.waterColor, accent: biome.accentColor },
    )
  }

  private openCardChoice(notice?: string): void {
    if (this.screens.isCardChoiceActive()) return
    if (this.screens.isEventActive()) return
    if (this.screen !== "run") return
    if (this.transition.isActive()) return
    this.inputController.clear()

    const rng = new Rng(deriveSeed(this.runSeed, this.biomeIndex + 1000))
    const choices = this.cardManager.rollChoices(3, rng)
    const build = readBuild({
      turtle: this.turtle,
      run: this.runState,
      state: this.state,
    })

    this.screens.showCardChoice(
      choices,
      (card) => {
        const outcome = this.cardManager.pick(card, {
          turtle: this.turtle,
          state: this.state,
          run: this.runState,
          rng,
        })

        this.uiManager.showMessage(
          outcome ? `${card.name}: ${outcome}` : `+ ${card.name}`,
          outcome ? 2400 : 1500,
        )

        // Las cartas de caos pueden subir la toxicidad al máximo al instante.
        if (this.state.toxicity >= 100 && !this.tryKill()) return

        this.advanceBiome()
      },
      notice,
      (card) => previewCard(card, build),
    )
  }

  private tryKill(): boolean {
    if (this.godMode) return true

    if (this.runState.reviveCharges > 0) {
      this.runState.reviveCharges--
      this.state.toxicity = computeReviveToxicity(this.revivesUsed)
      this.revivesUsed++
      this.biomeTimeRemaining = computeReviveTimeRemaining(
        this.biomeTimeRemaining,
      )
      this.uiManager.showMessage("¡Revives!", 1800)
      return true
    }

    this.endRun("died")
    return false
  }

  private animate(timestamp: number = 0): void {
    requestAnimationFrame((t) => this.animate(t))

    this.timer.update(timestamp)
    const rawDelta = this.timer.getDelta()
    const deltaTime = Math.min(rawDelta, MAX_DELTA)
    const time = this.timer.getElapsed()

    this.updateAdaptiveQuality(rawDelta)

    this.gamepad.update(deltaTime)
    this.update(deltaTime, time)

    if (this.screen !== "run") {
      // Con movimiento reducido, la cámara del menú se queda quieta.
      this.cameraRig.orbit(
        prefersReducedMotion() ? 0 : time,
        this.turtle.mesh.position,
      )
      if (!this.paused) this.biomeGenerator.updateVisuals(deltaTime)
    }

    if (!this.paused) {
      this.transition.update(deltaTime)
    }

    if (
      this.pendingAdvance &&
      !this.transition.isActive() &&
      !this.paused &&
      this.screen === "run"
    ) {
      this.pendingAdvance = false
      this.advanceBiome()
    }

    const simDelta = this.paused ? 0 : deltaTime

    const spinIntensity = this.turtle.isSpinBoosting()
      ? Math.min(
          1,
          this.turtle.getSpinBoost() / this.turtle.getSpinBoostMultiplier(),
        )
      : 0

    const boosting =
      this.state.isRunning &&
      !this.transition.blocksGameplay &&
      (this.turtle.isBoosting() || this.turtle.isSpinBoosting()) &&
      this.turtle.getSpeed() > 1

    this.bubbles.update(
      simDelta,
      this.turtle.mesh.position,
      this.turtle.mesh.rotation.y,
      boosting,
      spinIntensity,
    )

    this.pointLights.forEach((light, i) => {
      const baseIntensity =
        (light.userData.baseIntensity as number | undefined) ?? 1

      light.intensity =
        (0.3 + Math.sin(time + i) * 0.2) * this.pointLightBoost * baseIntensity
    })

    this.biomeGenerator.updateWater(simDelta, this.camera.position)
    this.renderPipeline.update(simDelta)
    this.biomeGenerator.syncDebrisRender()
    this.perfOverlay?.beginFrame()
    this.renderPipeline.render()
    this.perfOverlay?.endFrame(performance.now())
  }
}
