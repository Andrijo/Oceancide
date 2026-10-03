// src/Game.ts

import * as THREE from "three"
import { Turtle } from "./Turtle"
import { BiomeGenerator } from "./BiomeGenerator"
import { UIManager } from "./UIManager"
import { TouchControls } from "./TouchControls"
import { BIOME_ORDER, type GameState, type InputState } from "./types"

const MAX_DELTA = 0.1 // evita saltos enormes si la pestaña pierde el foco
const TOXICITY_SCALE = 6 // toxicityRate 0.1 => ~0.6 de toxicidad por segundo
const ZONE_COMPLETION_RATIO = 0.8 // % de desechos que hay que recoger para pasar de zona
const CAMERA_OFFSET = new THREE.Vector3(0, 5, -12) // detrás de la tortuga
const UP = new THREE.Vector3(0, 1, 0)

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
  private restartTimeout?: number

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

    this.biomeGenerator = new BiomeGenerator(this.scene)
    this.uiManager = new UIManager()

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
    }

    new TouchControls(this.input)

    this.timer = new THREE.Timer()
    this.timer.connect(document) // ignora el tiempo con la pestaña oculta

    this.setupLighting()
    this.setupEventListeners()
    this.loadBiome(0)

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
    if (e.code === "KeyR") {
      if (!e.repeat) this.restartRun()
      return
    }
    this.setKey(e.code, true)
  }

  private handleKeyUp(e: KeyboardEvent): void {
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

    this.biomeGenerator.generateBiome(BIOME_ORDER[index])

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.reset(new THREE.Vector3(0, (bounds.minY + bounds.maxY) / 2, 0))

    for (const light of this.pointLights) {
      light.position.set(
        (Math.random() - 0.5) * bounds.halfSize * 2,
        bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        (Math.random() - 0.5) * bounds.halfSize * 2,
      )
    }

    this.snapCamera()
  }

  private getCameraTarget(): THREE.Vector3 {
    return CAMERA_OFFSET.clone()
      .applyAxisAngle(UP, this.turtle.mesh.rotation.y)
      .add(this.turtle.getPosition())
  }

  private snapCamera(): void {
    this.camera.position.copy(this.getCameraTarget())
    this.camera.lookAt(this.turtle.getPosition())
  }

  private restartRun(): void {
    window.clearTimeout(this.restartTimeout)

    this.state.debrisCollected = 0
    this.state.ecoAwareness = 0
    this.state.toxicity = 0
    this.state.isRunning = true

    this.loadBiome(0)
    this.uiManager.showMessage("¡Nueva Run Iniciada!")
  }

  private gameOver(): void {
    this.state.isRunning = false
    this.uiManager.showMessage(
      "!Game Over! Has alcanzado el límite de toxicidad",
      3000,
    )
    this.restartTimeout = window.setTimeout(() => this.restartRun(), 3000)
  }

  private advanceBiome(): void {
    const next = this.biomeIndex + 1
    if (next >= BIOME_ORDER.length) {
      this.uiManager.showMessage("¡Has limpiado el océano!", 3000)
      this.state.isRunning = false
      this.restartTimeout = window.setTimeout(() => this.restartRun(), 3000)
      return
    }

    this.state.toxicity *= 0.5
    this.loadBiome(next)
    this.uiManager.showMessage(`Zona: ${this.biomeGenerator.getBiomeName()}`)
  }

  private update(deltaTime: number, time: number): void {
    if (!this.state.isRunning) return

    const bounds = this.biomeGenerator.getBounds()
    this.turtle.update(deltaTime, this.input, bounds)

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
      // Retirar desechos tóxicos limpia el agua (más cuanto más tóxicos)
      this.state.toxicity = Math.max(
        0,
        this.state.toxicity - debris.toxicity * 0.5,
      )
      this.collectedInZone++
    }
    this.state.zoneProgress = Math.min(
      100,
      (this.collectedInZone / required) * 100,
    )

    // Toxicidad pasiva según bioma y resistencia de la tortuga
    const biome = this.biomeGenerator.getBiome()
    this.state.toxicity +=
      biome.toxicityRate *
      TOXICITY_SCALE *
      (1 - this.turtle.stats.toxicityResistance) *
      deltaTime

    if (this.state.toxicity >= 100) {
      this.gameOver()
    } else if (this.state.zoneProgress >= 100) {
      this.advanceBiome()
    }

    this.uiManager.updateUI(this.state)
  }

  private animate(timestamp: number = 0): void {
    requestAnimationFrame((t) => this.animate(t))

    this.timer.update(timestamp)
    const deltaTime = Math.min(this.timer.getDelta(), MAX_DELTA)
    const time = this.timer.getElapsed()

    this.update(deltaTime, time)

    this.pointLights.forEach((light, i) => {
      light.intensity = 0.3 + Math.sin(time + i) * 0.2
    })

    this.renderer.render(this.scene, this.camera)
  }
}
