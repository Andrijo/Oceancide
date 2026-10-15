// src/core/RenderPipeline.ts
// Pipeline de render: tonemapping neutro + bloom dinámico.
//
// El bloom se activa solo cuando el sol se apaga (biomas profundos).
// El strength se controla por frame desde Game según la "darkness" del bioma.
// Cuando el strength es ~0, el composer se salta por completo y se renderiza
// directo con el renderer (más barato).

import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"

// --- Bloom sutil ---
// Solo brilla lo más brillante (threshold alto) y con poca intensidad.
const BLOOM_RADIUS = 0.4
const BLOOM_THRESHOLD = 0.92

// Umbral por debajo del cual el composer se salta (render directo).
// Evita gastar recursos cuando no hay bloom apreciable.
const BLOOM_MIN_ACTIVE = 0.01

// --- Tonemapping ---
// Neutral es más suave que ACES: mantiene los colores vivos y solo
// comprime las altas luces para que no se quemen.
const TONE_MAPPING = THREE.NeutralToneMapping
const TONE_EXPOSURE = 1.05

// Velocidad de interpolación del strength (para transiciones suaves).
const STRENGTH_SMOOTHING = 2.5

export interface RenderPipelineOptions {
  /** Fuerza bloom on/off. Si no se especifica, se autodetecta (off en móvil). */
  enableBloom?: boolean
}

function detectMobile(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export class RenderPipeline {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera

  private composer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null

  private bloomAllowed: boolean

  // Strength objetivo (viene de fuera) y actual (interpolado).
  private targetStrength = 0
  private currentStrength = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    options: RenderPipelineOptions = {},
  ) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    renderer.toneMapping = TONE_MAPPING
    renderer.toneMappingExposure = TONE_EXPOSURE

    // En móvil, el bloom se desactiva por defecto (caro). Se puede forzar con
    // `enableBloom: true`, aunque puede costar fps.
    this.bloomAllowed = options.enableBloom ?? !detectMobile()

    if (this.bloomAllowed) {
      this.setupComposer()
    }
  }

  private setupComposer(): void {
    const size = new THREE.Vector2()
    this.renderer.getSize(size)

    this.composer = new EffectComposer(this.renderer)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
    this.composer.setSize(size.x, size.y)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0, // strength inicial: se actualiza por frame
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    )
    this.composer.addPass(this.bloomPass)

    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)
  }

  /**
   * Fija el strength objetivo del bloom (0..1). El valor real se interpola
   * suavemente para evitar saltos cuando cambia de bioma.
   */
  public setBloomStrength(strength: number): void {
    if (!this.bloomAllowed) return
    this.targetStrength = THREE.MathUtils.clamp(strength, 0, 1)
  }

  /** Avanza la interpolación del strength. Llamar cada frame con el deltaTime. */
  public update(deltaTime: number): void {
    if (!this.bloomAllowed) return

    const k = 1 - Math.exp(-STRENGTH_SMOOTHING * deltaTime)
    this.currentStrength += (this.targetStrength - this.currentStrength) * k

    if (this.bloomPass) {
      this.bloomPass.strength = this.currentStrength
    }
  }

  /** Renderiza un frame. Si el bloom está inactivo, salta el composer. */
  public render(): void {
    const useComposer =
      this.composer !== null && this.currentStrength > BLOOM_MIN_ACTIVE

    if (useComposer) {
      this.composer!.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  /** Ajusta el tamaño del composer y del bloom al redimensionar. */
  public setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height)
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height)
    }
  }

  /** Ajusta la exposición del tonemapping en caliente. */
  public setExposure(exposure: number): void {
    this.renderer.toneMappingExposure = exposure
  }

  public dispose(): void {
    this.composer?.dispose()
    this.composer = null
    this.bloomPass = null
  }
}
