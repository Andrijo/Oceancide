import * as THREE from "three"
import { Turtle } from "@entities/Turtle"
import { BiomeGenerator } from "@world/BiomeGenerator"
import { SUN_DIRECTION } from "@world/WaterEffects"
import { UIManager } from "@ui/UIManager"
import { DevMenu } from "@ui/DevMenu"
import { TouchControls } from "@ui/TouchControls"
import { CardManager } from "@cards/CardManager"
import { createRunState, type RunState } from "@cards/Card"
import { Debris } from "@entities/Debris"
import { BubbleTrail } from "@entities/BubbleTrail"
import { BiomeTransition } from "@world/BiomeTransition"
import { StructureManager } from "@world/StructureManager"
import { STRUCTURES, type StructureKey } from "@world/StructureConfig"
import { ScreenManager } from "@ui/ScreenManager"
import { setAnimationsPaused } from "@ui/animations"
import { RenderPipeline } from "@core/RenderPipeline"
import {
  SaveManager,
  applyRunToMeta,
  computeEco,
  type MetaState,
} from "@core/MetaState"
import { Rng, deriveSeed, randomSeed } from "@core/rng"
import {
  BIOME_ORDER,
  type GameState,
  type InputState,
  type RunOutcome,
  type RunSummary,
} from "@core/types"
import { UpgradeManager } from "@/tycoon/UpgradeManager"
import { ACT_EVENTS } from "@/events/EventPool"

const MAX_DELTA = 0.1

const TOXICITY_SCALE = 3
const TOXICITY_REDUCTION_BASE = 0.4
const TOXICITY_REDUCTION_PER_POLLUTION = 1.0
const FILTER_TOXICITY_REDUCTION =
  TOXICITY_REDUCTION_BASE + 0.5 * TOXICITY_REDUCTION_PER_POLLUTION
const TOXICITY_CARRYOVER = 0.5
const TOXICITY_FLOOR_SCALE = 30

const ZONE_COMPLETION_RATIO = 0.6
const CAMERA_OFFSET = new THREE.Vector3(0, 5, -12)
const UP = new THREE.Vector3(0, 1, 0)
const BUILD_DISTANCE = 4
const DEEP_POINT_LIGHT_BOOST = 25
const BLOOM_MAX_STRENGTH = 0.5

const BIOME_TIME_BASE = 120
const BIOME_TIME_DECAY = 2
const BIOME_TIME_MIN = 80
const BIOME_TIME_PRESSURE = 4
/** Los eventos pueden recortar el siguiente bioma por debajo del mínimo normal. */
const MIN_BIOME_TIME_AFTER_EVENT = 30

const REVIVE_TOXICITY_BASE = 50
const REVIVE_TOXICITY_STEP = 10
const REVIVE_TOXICITY_MAX = 90

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
  private uiManager: UIManager
  private state: GameState
  private input: InputState
  private renderPipeline!: RenderPipeline
  private timer: THREE.Timer
  private ambientLight!: THREE.AmbientLight
  private directionalLight!: THREE.DirectionalLight
  private pointLights: THREE.PointLight[] = []
  private pointLightBoost = 1

  private cardManager = new CardManager()
  private upgradeManager = new UpgradeManager() // <-- NUEVO
  private runState: RunState = createRunState()
  private biomeIndex = 0
  private collectedInZone = 0
  private godMode = false
  private bubbles: BubbleTrail
  private structures: StructureManager
  private lookBack = false
  private lookBackApplied = false
  private paused = false
  private transition: BiomeTransition
  private pendingAdvance = false

  private endlessMode = false
  private loop = 0

  private biomeTimeRemaining = 0
  private biomeTimeLimit = 0
  private pendingTimeDelta = 0
  private pendingToxicityFloor: number | null = null
  private revivesUsed = 0
  private toxicityScaleMult = 1 // <-- NUEVO

  private saveManager = new SaveManager()
  private meta: MetaState
  private screens: ScreenManager
  private devMenu?: DevMenu
  private screen: Screen = "hub"
  private runSeed = randomSeed()
  private runTime = 0

  private readonly tmpCameraTarget = new THREE.Vector3()
  private readonly tmpProjected = new THREE.Vector3()

  constructor() {
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document
      .getElementById("game-container")!
      .appendChild(this.renderer.domElement)

    this.renderPipeline = new RenderPipeline(
      this.renderer,
      this.scene,
      this.camera,
    )

    this.turtle = new Turtle()
    this.scene.add(this.turtle.mesh)
    this.bubbles = new BubbleTrail(this.scene)
    this.structures = new StructureManager(this.scene)

    this.biomeGenerator = new BiomeGenerator(this.scene)
    this.uiManager = new UIManager()
    this.uiManager.createPauseButton(() => this.togglePause())
    this.transition = new BiomeTransition()

    this.meta = this.saveManager.load()

    // <-- NUEVO CALLBACK: onSaveMeta
    this.screens = new ScreenManager({
      onStartRun: () => this.startRun(false),
      onStartEndless: () => this.startRun(true),
      onReturnToHub: () => this.showHub(),
      onResetProgress: () => {
        this.meta = this.saveManager.reset()
        this.showHub()
      },
      onSaveMeta: () => this.saveManager.save(this.meta),
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

    new TouchControls(this.input, {
      onBuild: () => this.tryBuild("filter"),
      onLookBack: (active) => {
        this.lookBack = active
      },
      onDash: (direction) => this.tryDash(direction),
    })

    this.timer = new THREE.Timer()
    this.timer.connect(document)

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
      })
    }

    this.animate()
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.1)
    this.scene.add(this.ambientLight)

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
    this.clearInput()

    const rng = new Rng(deriveSeed(this.runSeed, this.biomeIndex + 2000))
    const event = rng.pick(ACT_EVENTS)

    this.screens.showEvent(event, (opt) => {
      opt.apply({
        turtle: this.turtle,
        state: this.state,
        run: this.runState,
        rng: rng,
      })

      if (opt.nextBiomeTimeDelta) {
        this.pendingTimeDelta += opt.nextBiomeTimeDelta
      }
      if (opt.nextBiomeToxicityFloor !== undefined) {
        this.pendingToxicityFloor = opt.nextBiomeToxicityFloor
      }

      // Los eventos pueden llevar la toxicidad a 100. Resolvemos la muerte o
      // el revive antes de abrir la elección de carta.
      const lethal = this.state.toxicity >= 100
      if (lethal && !this.tryKill()) return

      if (!lethal) this.uiManager.showMessage(opt.label, 1500)
      this.openCardChoice()
    })
  }

  private setupEventListeners(): void {
    window.addEventListener("keydown", (e) => this.handleKeyDown(e))
    window.addEventListener("keyup", (e) => this.handleKeyUp(e))
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

  private setKey(code: string, pressed: boolean): void {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.input.forward = pressed
        break
      case "KeyS":
      case "ArrowDown":
        this.input.backward = pressed
        break
      case "KeyA":
      case "ArrowLeft":
        this.input.left = pressed
        break
      case "KeyD":
      case "ArrowRight":
        this.input.right = pressed
        break
      case "KeyU":
        this.input.up = pressed
        break
      case "KeyJ":
        this.input.down = pressed
        break
      case "KeyI":
        this.input.boost = pressed
        break
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Durante un evento o una elección de carta, el overlay controla la
    // interacción (botones, Tab y teclas numéricas). No dejamos que el juego
    // procese movimiento, pausa, dash, construcción ni el backflip.
    if (this.screens.isEventActive() || this.screens.isCardChoiceActive()) {
      return
    }

    if (e.code === "Escape") {
      if (!e.repeat) this.togglePause()
      return
    }

    if (e.code === "Enter") {
      if (
        e.repeat ||
        e.defaultPrevented ||
        this.paused ||
        this.screen !== "run"
      ) {
        return
      }

      // Si hay un control enfocado, Enter debe activarlo a él.
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest(
          "button, a[href], [role='button'], input, select, textarea",
        )
      ) {
        return
      }

      this.setPaused(true)
      e.preventDefault()
      return
    }

    if (e.code === "Space") {
      if (
        !e.repeat &&
        this.screen === "run" &&
        !this.transition.blocksGameplay
      ) {
        this.turtle.triggerBackflip()
        e.preventDefault()
      }
      return
    }

    if (this.paused) return

    if (e.code === "KeyR") {
      if (!e.repeat && this.screen === "run") this.endRun("abandoned")
      return
    }

    if (e.code === "KeyB") {
      if (!e.repeat) this.tryBuild("filter")
      return
    }

    if (e.code === "KeyC") {
      this.lookBack = true
      return
    }

    if (e.code === "KeyQ" || e.code === "KeyE") {
      if (!e.repeat) {
        this.tryDash(e.code === "KeyQ" ? "left" : "right")
      }
      return
    }

    this.setKey(e.code, true)
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (this.screens.isEventActive() || this.screens.isCardChoiceActive()) {
      return
    }
    if (e.code === "KeyC") this.lookBack = false
    this.setKey(e.code, false)
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderPipeline.setSize(window.innerWidth, window.innerHeight)
  }

  private loadBiome(index: number): void {
    this.biomeIndex = index
    this.collectedInZone = 0
    this.state.zoneProgress = 0

    this.loop = Math.floor(index / BIOME_ORDER.length)
    const biomeKey = BIOME_ORDER[index % BIOME_ORDER.length]

    const baseTimeLimit = Math.max(
      BIOME_TIME_MIN,
      BIOME_TIME_BASE - (index % BIOME_ORDER.length) * BIOME_TIME_DECAY,
    )
    this.biomeTimeLimit = Math.max(
      MIN_BIOME_TIME_AFTER_EVENT,
      baseTimeLimit + this.pendingTimeDelta,
    )
    this.biomeTimeRemaining = this.biomeTimeLimit
    this.pendingTimeDelta = 0

    const rng = new Rng(deriveSeed(this.runSeed, index))
    this.biomeGenerator.generateBiome(biomeKey, rng, this.loop)
    this.applyBiomeLighting()

    const biomeToxicityFloor =
      this.biomeGenerator.getBiome().toxicityRate * TOXICITY_FLOOR_SCALE
    const toxicityFloor = this.pendingToxicityFloor ?? biomeToxicityFloor

    this.state.toxicity = Math.max(
      this.state.toxicity * TOXICITY_CARRYOVER,
      toxicityFloor,
    )
    this.pendingToxicityFloor = null

    const sun = this.biomeGenerator.getSun()
    this.renderPipeline.setBloomStrength(sun.darkness * BLOOM_MAX_STRENGTH)

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.reset(new THREE.Vector3(0, (bounds.minY + bounds.maxY) / 2, 0))

    for (const light of this.pointLights) {
      light.color.setHex(this.biomeGenerator.getBiome().accentColor)
      light.position.set(
        rng.range(-bounds.halfSize, bounds.halfSize),
        rng.range(bounds.minY, bounds.maxY),
        rng.range(-bounds.halfSize, bounds.halfSize),
      )
    }

    this.bubbles.clear()
    this.structures.clear()
    this.lookBackApplied = this.lookBack
    this.snapCamera()
    this.devMenu?.refresh()
  }

  private applyBiomeLighting(): void {
    const sun = this.biomeGenerator.getSun()
    this.directionalLight.intensity = sun.intensity
    this.directionalLight.color.setHex(sun.color)
    this.pointLightBoost = 1 + sun.darkness * DEEP_POINT_LIGHT_BOOST
  }

  private getCameraTarget(): THREE.Vector3 {
    return this.tmpCameraTarget
      .copy(CAMERA_OFFSET)
      .applyAxisAngle(
        UP,
        this.turtle.mesh.rotation.y + (this.lookBack ? Math.PI : 0),
      )
      .add(this.turtle.mesh.position)
  }

  private snapCamera(): void {
    this.camera.position.copy(this.getCameraTarget())
    this.camera.lookAt(this.turtle.mesh.position)
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

    this.turtle.trigger360Spin(direction)
    navigator.vibrate?.(15)

    if (!this.turtle.isSpinBoosting()) {
      this.uiManager.showMessage("¡DASH!", 700)
    }
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

    const config = STRUCTURES[key]
    if (this.structures.getActiveCount() >= this.turtle.stats.filterCapacity) {
      this.uiManager.showMessage("Máximo de filtros activos", 1200)
      return
    }
    if (this.state.ecoAwareness < config.cost) {
      this.uiManager.showMessage(
        `Necesitas ${config.cost} de Conciencia Ecológica`,
        1200,
      )
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
    const available = this.state.ecoAwareness >= config.cost && active < max
    this.uiManager.updateBuildHud(
      `${config.name} (B) · cuesta ${config.cost} · activos ${active}/${max}`,
      available,
    )
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
      this.clearInput()
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
          cardsCount: this.runState.cards.length,
        },
      )
    } else {
      this.paused = false
      this.screens.hide()
    }

    setAnimationsPaused(paused)
  }

  private clearInput(): void {
    this.lookBack = false
    this.input.forward = false
    this.input.backward = false
    this.input.left = false
    this.input.right = false
    this.input.up = false
    this.input.down = false
    this.input.boost = false
    this.input.moveX = 0
    this.input.moveY = 0
    this.input.vertical = 0
  }

  private showHub(): void {
    this.transition.cancel()
    this.pendingAdvance = false
    this.paused = false
    this.endlessMode = false
    this.screen = "hub"
    this.state.isRunning = false
    this.clearInput()
    this.runSeed = randomSeed()
    this.pendingTimeDelta = 0
    this.pendingToxicityFloor = null
    this.loadBiome(0)
    this.screens.showHub(this.meta)
  }

  private startRun(endless = false): void {
    this.endlessMode = endless
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
    this.clearInput()

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
    this.clearInput()

    const { base, bonus } = computeEco(this.state.ecoAwareness, outcome)
    const summary: RunSummary = {
      outcome,
      biomeIndex: this.biomeIndex,
      biomeName: this.biomeGenerator.getBiomeName(),
      debrisCollected: this.state.debrisCollected,
      ecoBase: base,
      ecoBonus: bonus,
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

  private orbitCamera(time: number): void {
    const center = this.turtle.mesh.position
    const angle = time * 0.15
    this.camera.position.set(
      center.x + Math.sin(angle) * 14,
      center.y + 4,
      center.z + Math.cos(angle) * 14,
    )
    this.camera.lookAt(center)
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

    const started = this.transition.play(() => {
      this.loadBiome(next)
      this.uiManager.showMessage(this.biomeBanner())
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
    const timePressure =
      this.biomeTimeRemaining <= 0 ? 1 + BIOME_TIME_PRESSURE : 1
    this.uiManager.updateBiomeTimer(
      this.biomeTimeRemaining,
      this.biomeTimeLimit,
    )

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.update(deltaTime, this.input, bounds)

    if (this.lookBack !== this.lookBackApplied) {
      this.lookBackApplied = this.lookBack
      this.snapCamera()
    }

    const smoothing = 1 - Math.exp(-6 * deltaTime)
    this.camera.position.lerp(this.getCameraTarget(), smoothing)
    this.camera.lookAt(this.turtle.mesh.position)

    // --- Recolección ---
    const collected = this.biomeGenerator.updateDebris(
      this.turtle.mesh.position,
      this.turtle.getCollectionRadius(),
      time,
      deltaTime,
      this.input.boost,
    )

    const required = Math.max(
      1,
      this.biomeGenerator.getInitialDebrisCount() * ZONE_COMPLETION_RATIO,
    )

    // --- Toxicidad Pasiva (aplicando el multiplicador de la mejora "Sistema Inmune") ---
    this.biomeGenerator.updateVisuals(deltaTime)
    const pollution = this.biomeGenerator.getPollutionRatio()
    const base =
      this.biomeGenerator.getBiome().toxicityRate *
      TOXICITY_SCALE *
      this.toxicityScaleMult
    const passiveRate =
      base *
      pollution *
      (1 - this.turtle.stats.toxicityResistance) *
      timePressure

    if (!this.godMode) {
      this.state.toxicity = Math.max(
        0,
        this.state.toxicity + passiveRate * deltaTime,
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
        const reduction =
          TOXICITY_REDUCTION_BASE +
          debris.pollution * TOXICITY_REDUCTION_PER_POLLUTION
        this.state.toxicity = Math.max(0, this.state.toxicity - reduction)
      }

      if (eco > 0) this.showFloatingEco(debris, eco)
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
      this.state.toxicity = Math.max(
        0,
        this.state.toxicity - FILTER_TOXICITY_REDUCTION * credit.count,
      )
    }

    for (const absorption of credit.absorptions) {
      const value = Math.round(absorption.eco * this.runState.ecoMultiplier)
      this.showFloatingEcoAt(absorption.position, value)
    }

    if (this.state.toxicity >= 100 && !this.tryKill()) return

    this.state.zoneProgress = Math.min(
      100,
      (this.collectedInZone / required) * 100,
    )

    this.uiManager.updateUI(this.state, deltaTime)
    this.updateBuildHud()

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

  private openCardChoice(): void {
    if (this.screens.isCardChoiceActive()) return
    if (this.screens.isEventActive()) return
    if (this.screen !== "run") return
    if (this.transition.isActive()) return
    this.clearInput()

    const rng = new Rng(deriveSeed(this.runSeed, this.biomeIndex + 1000))
    const choices = this.cardManager.rollChoices(3, rng)

    this.screens.showCardChoice(choices, (card) => {
      this.cardManager.pick(card, {
        turtle: this.turtle,
        state: this.state,
        run: this.runState,
      })

      if (card.id === "bioluminescence") {
        const next = Math.min(1, this.turtle.getGlow() + 0.5)
        this.turtle.setGlow(next)
      }

      this.uiManager.showMessage(`+ ${card.name}`, 1500)
      this.advanceBiome()
    })
  }

  private tryKill(): boolean {
    if (this.godMode) return true

    if (this.runState.reviveCharges > 0) {
      this.runState.reviveCharges--
      const reviveToxicity = Math.min(
        REVIVE_TOXICITY_MAX,
        REVIVE_TOXICITY_BASE + this.revivesUsed * REVIVE_TOXICITY_STEP,
      )
      this.revivesUsed++
      this.state.toxicity = reviveToxicity
      this.biomeTimeRemaining = Math.max(this.biomeTimeRemaining, 20)
      this.uiManager.showMessage("¡Revives!", 1800)
      return true
    }

    this.endRun("died")
    return false
  }

  private animate(timestamp: number = 0): void {
    requestAnimationFrame((t) => this.animate(t))

    this.timer.update(timestamp)
    const deltaTime = Math.min(this.timer.getDelta(), MAX_DELTA)
    const time = this.timer.getElapsed()

    this.update(deltaTime, time)

    if (this.screen !== "run") {
      this.orbitCamera(time)
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
      light.intensity = (0.3 + Math.sin(time + i) * 0.2) * this.pointLightBoost
    })

    this.biomeGenerator.updateWater(simDelta, this.camera.position)
    this.renderPipeline.update(simDelta)
    this.renderPipeline.render()
  }
}
