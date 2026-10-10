// src/Game.ts
// Clase principal del juego:
// Incia la escena, la cámara, la tortuga, el generador de biomas y la UI.

import * as THREE from "three"
import { Turtle } from "./Turtle"
import { BiomeGenerator } from "./BiomeGenerator"
import { UIManager } from "./UIManager"
import { TouchControls } from "./TouchControls"
import { DevMenu } from "./DevMenu"
import { BubbleTrail } from "./BubbleTrail"
import { BiomeTransition } from "./BiomeTransition"
import { StructureManager } from "./StructureManager"
import { STRUCTURES, type StructureKey } from "./StructureConfig"
import { ScreenManager } from "./ScreenManager"
import {
  SaveManager,
  applyRunToMeta,
  computeEco,
  type MetaState,
} from "./MetaState"
import { Rng, deriveSeed, randomSeed } from "./rng"
import {
  BIOME_ORDER,
  type GameState,
  type InputState,
  type RunOutcome,
  type RunSummary,
} from "./types"

const MAX_DELTA = 0.1 // Restringe el deltaTime para que no se rompa la física si hay un lagazo o se cambia de pestaña.
const TOXICITY_SCALE = 6 // toxicityRate 0.1 => ~0.6 de toxicidad por segundo.
const CLEAN_THRESHOLD = 0.3 // Tasa de contaminación por debajo de la cual la toxicidad empieza a bajar sola.
const ZONE_COMPLETION_RATIO = 0.8 // % de desechos que hay que recoger para pasar de zona
const CAMERA_OFFSET = new THREE.Vector3(0, 5, -12) // Posición de la cámara respecto a la tortuga.
const UP = new THREE.Vector3(0, 1, 0)
const BUILD_DISTANCE = 4 // las estructuras se colocan delante de la tortuga

type Screen = "hub" | "run" | "summary"

/** Permite reproducir una run con ?seed=123 en la URL. */
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
  private timer: THREE.Timer
  private ambientLight!: THREE.AmbientLight
  private directionalLight!: THREE.DirectionalLight
  private pointLights: THREE.PointLight[] = []

  private biomeIndex = 0
  private collectedInZone = 0
  private godMode = false
  private devMenu?: DevMenu
  private bubbles: BubbleTrail
  private structures: StructureManager
  private lookBack = false // C mantenida: cámara mirando hacia atrás
  private lookBackApplied = false // valor de lookBack con el que está colocada la cámara
  private transition: BiomeTransition

  private saveManager = new SaveManager()
  private meta: MetaState
  private screens: ScreenManager
  private screen: Screen = "hub"
  private runSeed = randomSeed()
  private runTime = 0

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

    this.turtle = new Turtle()
    this.scene.add(this.turtle.mesh)
    this.bubbles = new BubbleTrail(this.scene)
    this.structures = new StructureManager(this.scene)

    this.biomeGenerator = new BiomeGenerator(this.scene)
    this.uiManager = new UIManager()
    this.transition = new BiomeTransition()

    this.meta = this.saveManager.load()
    this.screens = new ScreenManager({
      onStartRun: () => this.startRun(),
      onReturnToHub: () => this.showHub(),
      onResetProgress: () => {
        this.meta = this.saveManager.reset()
        this.showHub()
      },
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
      turnAroundLeft: false,
      turnAroundRight: false,
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
    }

    new TouchControls(this.input, {
      onBuild: () => this.tryBuild("filter"),
      onLookBack: (active) => {
        this.lookBack = active
      },
    })

    this.timer = new THREE.Timer()
    this.timer.connect(document) // ignora el tiempo con la pestaña oculta

    this.setupLighting()
    this.setupEventListeners()
    this.showHub()

    /* Menú de desarrollador: solo con `vite dev` o con ?dev en la URL
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
      */
    this.animate()
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    this.scene.add(this.ambientLight)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    this.directionalLight.position.set(50, 100, 50)
    this.scene.add(this.directionalLight)

    for (let i = 0; i < 5; i++) {
      const light = new THREE.PointLight(0x00ffff, 0.5, 50)
      this.scene.add(light)
      this.pointLights.push(light)
    }
  }

  private setupEventListeners(): void {
    window.addEventListener("keydown", (e) => this.handleKeyDown(e))
    window.addEventListener("keyup", (e) => this.handleKeyUp(e))
    window.addEventListener("resize", () => this.handleResize())
  }

  private setKey(code: string, pressed: boolean): void {
    switch (code) {
      case "KeyQ":
        this.input.turnAroundLeft = pressed
        break
      case "KeyW":
      case "ArrowUp":
        this.input.forward = pressed
        break
      case "KeyE":
        this.input.turnAroundRight = pressed
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
    if (e.code === "KeyR") {
      if (!e.repeat && this.screen === "run") this.endRun("abandoned")
      return
    }
    if (e.code === "KeyB") {
      if (!e.repeat) this.tryBuild("filter")
      return
    }
    // C (mantener): ver hacia atrás
    if (e.code === "KeyC") {
      this.lookBack = true
      return
    }
    // Q / E: giro de 360° (solo al pulsar, no se repite al mantener la tecla)
    if (e.code === "KeyQ" || e.code === "KeyE") {
      if (
        !e.repeat &&
        this.screen === "run" &&
        !this.transition.blocksGameplay
      ) {
        this.turtle.trigger360Spin(e.code === "KeyQ" ? "left" : "right")
      }
      return
    }
    this.setKey(e.code, true)
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === "KeyC") this.lookBack = false
    this.setKey(e.code, false)
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  /** Genera un bioma y coloca a la tortuga, las luces y la cámara. */
  private loadBiome(index: number): void {
    this.biomeIndex = index
    this.collectedInZone = 0
    this.state.zoneProgress = 0

    // Cada bioma de una run usa su propia semilla derivada de la semilla de la run
    const rng = new Rng(deriveSeed(this.runSeed, index))
    this.biomeGenerator.generateBiome(BIOME_ORDER[index], rng)

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.reset(new THREE.Vector3(0, (bounds.minY + bounds.maxY) / 2, 0))

    for (const light of this.pointLights) {
      light.color.setHex(this.biomeGenerator.getBiome().accentColor)
      light.position.set(
        (Math.random() - 0.5) * bounds.halfSize * 2,
        bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        (Math.random() - 0.5) * bounds.halfSize * 2,
      )
    }

    this.bubbles.clear()
    this.structures.clear()
    this.lookBackApplied = this.lookBack
    this.snapCamera()
    this.devMenu?.refresh()
  }

  /* Salta directamente a un bioma (herramienta de desarrollo).
  private goToBiome(index: number): void {
    window.clearTimeout(this.restartTimeout)
    this.state.isRunning = true
    this.state.toxicity = 0
    this.loadBiome(index)
    this.uiManager.showMessage(`Zona: ${this.biomeGenerator.getBiomeName()}`)
  }
  */

  private getCameraTarget(): THREE.Vector3 {
    return CAMERA_OFFSET.clone()
      .applyAxisAngle(
        UP,
        this.turtle.mesh.rotation.y + (this.lookBack ? Math.PI : 0),
      )
      .add(this.turtle.getPosition())
  }

  private snapCamera(): void {
    this.camera.position.copy(this.getCameraTarget())
    this.camera.lookAt(this.turtle.getPosition())
  }

  /** Construye una estructura delante de la tortuga, pagando con Conciencia Ecológica. */
  private tryBuild(key: StructureKey): void {
    if (this.screen !== "run" || this.transition.blocksGameplay) return

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
    this.structures.build(key, position)
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

  private clearInput(): void {
    this.lookBack = false
    this.input.forward = false
    this.input.backward = false
    this.input.left = false
    this.input.right = false
    this.input.up = false
    this.input.down = false
    this.input.boost = false
  }

  /** Refugio: escena de fondo con la cámara orbitando y menú encima. */
  private showHub(): void {
    this.transition.cancel()
    this.screen = "hub"
    this.state.isRunning = false
    this.clearInput()
    this.runSeed = randomSeed()
    this.loadBiome(0)
    this.screens.showHub(this.meta)
  }

  private startRun(): void {
    this.transition.cancel()
    this.runSeed = seedFromUrl() ?? randomSeed()
    this.runTime = 0

    this.state.debrisCollected = 0
    this.state.ecoAwareness = 0
    this.state.toxicity = 0
    this.state.isRunning = true
    this.screen = "run"
    this.clearInput()

    this.screens.hide()
    this.loadBiome(0)
    this.uiManager.showMessage(this.biomeGenerator.getBiomeName())
  }

  /** Cierra la run, guarda el progreso y enseña el resumen. */
  private endRun(outcome: RunOutcome): void {
    if (this.screen !== "run") return

    this.transition.cancel()
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
    }

    applyRunToMeta(this.meta, summary)
    this.saveManager.save(this.meta)
    this.screens.showSummary(summary, this.meta)
  }

  private orbitCamera(time: number): void {
    const center = this.turtle.getPosition()
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
    if (next >= BIOME_ORDER.length) {
      this.endRun("completed")
      return
    }

    this.transition.play(() => {
      this.state.toxicity *= 0.5
      this.loadBiome(next)
      this.uiManager.showMessage(this.biomeGenerator.getBiomeName())
    })
  }

  private update(deltaTime: number, time: number): void {
    if (!this.state.isRunning) return
    if (this.transition.blocksGameplay) return
    this.runTime += deltaTime

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.update(deltaTime, this.input, bounds)

    // Cambiar entre ver delante/atrás recoloca la cámara al instante (sin animación)
    if (this.lookBack !== this.lookBackApplied) {
      this.lookBackApplied = this.lookBack
      this.snapCamera()
    }

    // Cámara suave, independiente de los FPS
    const smoothing = 1 - Math.exp(-6 * deltaTime)
    this.camera.position.lerp(this.getCameraTarget(), smoothing)
    this.camera.lookAt(this.turtle.getPosition())

    // Recolección
    const collected = this.biomeGenerator.updateDebris(
      this.turtle.getPosition(),
      this.turtle.getCollectionRadius(),
      time,
      deltaTime,
    )

    const required = Math.max(
      1,
      this.biomeGenerator.getInitialDebrisCount() * ZONE_COMPLETION_RATIO,
    )
    for (const debris of collected) {
      this.state.debrisCollected++
      this.state.ecoAwareness += debris.ecoValue
      this.collectedInZone++
    }
    // Los filtros absorben desechos por su cuenta (cuentan para la zona y dan Conciencia Ecológica)
    const credit = this.structures.update(deltaTime, time, this.biomeGenerator)
    this.state.debrisCollected += credit.count
    this.state.ecoAwareness += credit.eco
    this.collectedInZone += credit.count

    this.state.zoneProgress = Math.min(
      100,
      (this.collectedInZone / required) * 100,
    )

    // Toxicidad según la contaminación que queda en la zona:
    // sube mientras quede mucha y baja sola cuando está casi limpia.
    this.biomeGenerator.updateVisuals(deltaTime)
    const pollution = this.biomeGenerator.getPollutionRatio()
    const drift = (pollution - CLEAN_THRESHOLD) / (1 - CLEAN_THRESHOLD) // 1 sucia .. <0 casi limpia
    const base = this.biomeGenerator.getBiome().toxicityRate * TOXICITY_SCALE
    const rate =
      drift > 0
        ? base * drift * (1 - this.turtle.stats.toxicityResistance)
        : base * drift // la recuperación no depende de la resistencia
    if (!this.godMode) {
      this.state.toxicity = Math.max(0, this.state.toxicity + rate * deltaTime)
    }

    if (!this.godMode && this.state.toxicity >= 100) {
      this.endRun("died")
    } else if (this.state.zoneProgress >= 100) {
      this.advanceBiome()
    }

    this.uiManager.updateUI(this.state)
    this.updateBuildHud()
  }

  private animate(timestamp: number = 0): void {
    requestAnimationFrame((t) => this.animate(t))

    this.timer.update(timestamp)
    const deltaTime = Math.min(this.timer.getDelta(), MAX_DELTA)
    const time = this.timer.getElapsed()

    this.update(deltaTime, time)
    if (this.screen !== "run") this.orbitCamera(time)
    this.transition.update(deltaTime)

    // Estela de burbujas mientras se usa el impulso y la tortuga avanza de verdad
    const boosting =
      this.state.isRunning &&
      !this.transition.blocksGameplay &&
      this.input.boost &&
      this.turtle.getSpeed() > 1
    this.bubbles.update(
      deltaTime,
      this.turtle.getPosition(),
      this.turtle.mesh.rotation.y,
      boosting,
    )

    this.pointLights.forEach((light, i) => {
      light.intensity = 0.3 + Math.sin(time + i) * 0.2
    })

    this.renderer.render(this.scene, this.camera)
  }
}
