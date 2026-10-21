import * as THREE from "three"
import type { InputState, TurtleStats, WorldBounds } from "@core/types"

const BASE_SHELL_COLOR = 0x0a4d20
const BASE_SKIN_COLOR = 0x61b112
const BASE_PLATE_COLOR = 0x0f6329
const BASE_RIM_COLOR = 0xf0c053

const GLOW_WHITE = new THREE.Color(0xffffff)

/** Reacción de dolor: flash magenta y retroceso breve, sin tapar el control. */
const HURT_COLOR = new THREE.Color(0xff3b7a)
const HURT_DURATION = 0.42
const HURT_FLASH_INTENSITY = 2.2

/** Tope duro de resistencia a la toxicidad (nunca inmunidad total). */
const TOXICITY_RESISTANCE_CAP = 0.9

/** Curva de respuesta del stick: más resolución cerca del centro, lineal en el teclado. */
function inputCurve(v: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), 1.6)
}

/** Fases de bioluminiscencia: de apagada (t = 0) a blanco puro (t = 1). */
type GlowKeyframe = {
  t: number
  colorMult: number
  whiten: number
  emissive: number
  light: number
  distance: number
}

const GLOW_PHASES: GlowKeyframe[] = [
  {
    t: 0.0,
    colorMult: 1.0,
    whiten: 0.0,
    emissive: 0.0,
    light: 0,
    distance: 12,
  },
  {
    t: 0.2,
    colorMult: 1.5,
    whiten: 0.0,
    emissive: 0.4,
    light: 6,
    distance: 14,
  },
  {
    t: 0.4,
    colorMult: 2.5,
    whiten: 0.05,
    emissive: 1.0,
    light: 15,
    distance: 20,
  },
  {
    t: 0.6,
    colorMult: 4.0,
    whiten: 0.3,
    emissive: 2.0,
    light: 26,
    distance: 30,
  },
  {
    t: 0.8,
    colorMult: 5.5,
    whiten: 0.7,
    emissive: 3.2,
    light: 38,
    distance: 40,
  },
  {
    t: 1.0,
    colorMult: 7.0,
    whiten: 1.0,
    emissive: 4.5,
    light: 52,
    distance: 50,
  },
]

/** Muestrea la tabla de fases con interpolación smoothstep. */
function sampleGlow(t: number): Omit<GlowKeyframe, "t"> {
  t = Math.max(0, Math.min(1, t))

  for (let i = 0; i < GLOW_PHASES.length - 1; i++) {
    const a = GLOW_PHASES[i]
    const b = GLOW_PHASES[i + 1]
    if (t >= a.t && t <= b.t) {
      const local = (t - a.t) / (b.t - a.t)
      const eased = local * local * (3 - 2 * local)
      return {
        colorMult: a.colorMult + (b.colorMult - a.colorMult) * eased,
        whiten: a.whiten + (b.whiten - a.whiten) * eased,
        emissive: a.emissive + (b.emissive - a.emissive) * eased,
        light: a.light + (b.light - a.light) * eased,
        distance: a.distance + (b.distance - a.distance) * eased,
      }
    }
  }

  // t === 1: devolver el último
  const last = GLOW_PHASES[GLOW_PHASES.length - 1]
  return {
    colorMult: last.colorMult,
    whiten: last.whiten,
    emissive: last.emissive,
    light: last.light,
    distance: last.distance,
  }
}

export class Turtle {
  public mesh: THREE.Group
  public stats: TurtleStats

  private model: THREE.Group
  private body: THREE.Group

  private leftFrontFlipper: THREE.Mesh
  private rightFrontFlipper: THREE.Mesh
  private leftBackFlipper: THREE.Mesh
  private rightBackFlipper: THREE.Mesh
  private tail: THREE.Mesh

  // Materiales (para el glow de bioluminiscencia)
  private shellMaterial: THREE.MeshStandardMaterial
  private skinMaterial: THREE.MeshStandardMaterial
  private plateMaterial: THREE.MeshStandardMaterial
  private rimMaterial: THREE.MeshStandardMaterial

  // Luz de bioluminiscencia
  private glowLight: THREE.PointLight
  private glowLevel = 0
  private glowTarget = 0

  private baseColors: {
    shell: THREE.Color
    skin: THREE.Color
    plate: THREE.Color
    rim: THREE.Color
  }

  private speed = 0
  private time = 0
  private readonly turnSpeed = 3

  private slowTimer = 0
  private slowMultiplier = 1
  private hurtTimer = 0

  /* Spinning */
  private isSpinning = false
  private spinProgress = 0
  private spinDirection = 1
  private readonly spinDuration = 0.8

  private completedRoll = 0

  // Backflip
  private isBackflipping = false
  private backflipProgress = 0
  private readonly backflipDuration = 0.7
  private backflipStartYaw = 0
  private completedPitch = 0

  // Boost de giro (Q/E)
  private spinBoost = 0
  private spinBoostMultiplier = 1.6
  private readonly spinBoostDecay = 4

  // Boost normal (I): energía finita
  private boostEnergy = 100
  private readonly boostMaxEnergy = 100
  private readonly boostDrainRate = 25
  private readonly boostRegenRate = 12
  private readonly boostMinToStart = 15
  private boostActiveThisFrame = false

  private baseStats: TurtleStats

  constructor() {
    const { model, body, flippers, tail, materials } = this.createTurtleModel()

    this.model = model
    this.body = body

    this.leftFrontFlipper = flippers.leftFront
    this.rightFrontFlipper = flippers.rightFront
    this.leftBackFlipper = flippers.leftBack
    this.rightBackFlipper = flippers.rightBack
    this.tail = tail

    this.shellMaterial = materials.shell
    this.skinMaterial = materials.skin
    this.plateMaterial = materials.plate
    this.rimMaterial = materials.rim

    this.mesh = new THREE.Group()
    this.mesh.add(this.model)

    // Guardar los colores base para interpolar hacia blanco
    this.baseColors = {
      shell: this.shellMaterial.color.clone(),
      skin: this.skinMaterial.color.clone(),
      plate: this.plateMaterial.color.clone(),
      rim: this.rimMaterial.color.clone(),
    }

    // La luz empieza blanca y apagada
    this.glowLight = new THREE.PointLight(0xffffff, 0, 12, 2)
    this.glowLight.position.set(0, 0, 0)
    this.mesh.add(this.glowLight)

    this.stats = {
      speed: 9,
      collectionRadius: 3,
      toxicityResistance: 0.1,
      filterCapacity: 5,
    }
    this.baseStats = { ...this.stats }
  }

  public trigger360Spin(direction: "left" | "right" = "left"): void {
    if (this.isSpinning) return

    this.isSpinning = true
    this.spinProgress = 0
    this.spinDirection = direction === "left" ? 1 : -1
    this.spinBoost = this.spinBoostMultiplier
  }

  public triggerBackflip(): void {
    if (this.isBackflipping || this.isSpinning) return

    this.isBackflipping = true
    this.backflipProgress = 0
    this.backflipStartYaw = this.mesh.rotation.y
  }

  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position)
    this.mesh.rotation.set(0, 0, 0)
    this.model.rotation.set(0, 0, 0)

    this.speed = 0
    this.isSpinning = false
    this.spinProgress = 0
    this.completedRoll = 0
    this.spinBoost = 0
    this.boostEnergy = this.boostMaxEnergy
    this.boostActiveThisFrame = false
    this.isBackflipping = false
    this.backflipProgress = 0
    this.completedPitch = 0

    this.slowTimer = 0
    this.slowMultiplier = 1
    this.hurtTimer = 0
  }

  /**
   * Aplica una ralentización temporal. Si ya había una más fuerte activa, se
   * conserva la más fuerte y solo se extiende el tiempo.
   */
  public applySlow(duration: number, multiplier: number): void {
    if (duration <= 0) return
    this.slowTimer = Math.max(this.slowTimer, duration)
    this.slowMultiplier = Math.min(
      this.slowMultiplier,
      THREE.MathUtils.clamp(multiplier, 0, 1),
    )
  }

  /** Dispara el retroceso y el flash de dolor. Reinicia la animación si ya estaba activa. */
  public playHurt(): void {
    this.hurtTimer = HURT_DURATION
  }

  public addSpinBoostMultiplier(delta: number): void {
    this.spinBoostMultiplier += delta
  }

  public getSpinBoostMultiplier(): number {
    return this.spinBoostMultiplier
  }

  /** 0 = apagado, 1 = bioluminiscencia máxima. */
  public setGlow(level: number): void {
    this.glowTarget = THREE.MathUtils.clamp(level, 0, 1)
  }

  public getGlow(): number {
    return this.glowLevel
  }

  /** Nivel objetivo (no el nivel animado) para previsualizar/encadenar efectos. */
  public getGlowTarget(): number {
    return this.glowTarget
  }

  /** Suma glow al objetivo y devuelve el incremento real tras el clamp 0..1. */
  public addGlow(amount: number): number {
    const before = this.glowTarget
    this.glowTarget = THREE.MathUtils.clamp(before + amount, 0, 1)
    return this.glowTarget - before
  }

  /** Suma resistencia con rendimientos decrecientes: cada punto adicional vale menos. */
  public addToxicityResistance(amount: number): void {
    if (amount <= 0) return
    const current = this.stats.toxicityResistance
    this.stats.toxicityResistance = Math.min(
      TOXICITY_RESISTANCE_CAP,
      1 - (1 - current) * (1 - amount),
    )
  }

  /** Reduce la resistencia (maldiciones), sin bajar de 0. */
  public reduceToxicityResistance(amount: number): void {
    this.stats.toxicityResistance = Math.max(
      0,
      this.stats.toxicityResistance - amount,
    )
  }

  public update(
    deltaTime: number,
    input: InputState,
    bounds: WorldBounds,
  ): void {
    this.time += deltaTime

    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - deltaTime)
      if (this.slowTimer === 0) this.slowMultiplier = 1
    }

    // Decaimiento del boost de giro
    if (this.spinBoost > 0) {
      this.spinBoost *= Math.exp(-this.spinBoostDecay * deltaTime)
      if (this.spinBoost < 0.01) this.spinBoost = 0
    }

    // --- Gestión de la energía del boost normal ---
    const wantsBoost = input.boost
    const canBoost = this.boostEnergy >= this.boostMinToStart
    const isBoosting = wantsBoost && canBoost
    this.boostActiveThisFrame = isBoosting

    if (isBoosting) {
      this.boostEnergy = Math.max(
        0,
        this.boostEnergy - this.boostDrainRate * deltaTime,
      )
    } else {
      this.boostEnergy = Math.min(
        this.boostMaxEnergy,
        this.boostEnergy + this.boostRegenRate * deltaTime,
      )
    }

    const inputBoost = isBoosting ? 2 : 1
    const totalBoost = inputBoost * (1 + this.spinBoost)
    const maxSpeed = this.stats.speed * totalBoost * this.slowMultiplier

    // Ejes analógicos si el stick está activo; si no, booleanos del teclado.
    const throttle =
      input.moveY !== 0
        ? inputCurve(input.moveY)
        : input.forward
          ? 1
          : input.backward
            ? -1
            : 0
    const steer =
      input.moveX !== 0
        ? -inputCurve(input.moveX)
        : (input.left ? 1 : 0) - (input.right ? 1 : 0)

    let targetSpeed = 0
    if (throttle > 0) {
      targetSpeed = throttle * maxSpeed
    } else if (throttle < 0) {
      targetSpeed = throttle * maxSpeed * 0.5
    }

    // El impulso garantiza velocidad máxima hacia adelante.
    if (isBoosting && throttle >= 0) {
      targetSpeed = Math.max(targetSpeed, maxSpeed)
    }

    if (this.isSpinning && targetSpeed === 0) {
      targetSpeed = maxSpeed * 0.6
    }

    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-4 * deltaTime))

    // Giro normal vs Backflip
    let extraPitch = 0

    if (this.isBackflipping) {
      this.backflipProgress += deltaTime / this.backflipDuration
      const t = Math.min(1, this.backflipProgress)
      // smoothstep para acelerar y desacelerar la voltereta
      const eased = t * t * (3 - 2 * t)

      // Gira la dirección 180° (yaw) suavemente durante el salto
      this.mesh.rotation.y = this.backflipStartYaw + Math.PI * eased

      if (this.backflipProgress >= 1) {
        this.isBackflipping = false
        this.backflipProgress = 1
        this.mesh.rotation.y = this.backflipStartYaw + Math.PI
        this.completedPitch -= Math.PI * 2 // Conserva la rotación visual
      } else {
        // Rotación de 360° en el eje X (pitch). Negativo para voltereta hacia atrás.
        extraPitch = -eased * Math.PI * 2
      }
    } else {
      // Giro normal
      this.mesh.rotation.y += steer * this.turnSpeed * deltaTime
    }

    let extraRollAngle = 0

    if (this.isSpinning) {
      this.spinProgress += deltaTime / this.spinDuration

      if (this.spinProgress >= 1) {
        this.spinProgress = 1
        this.isSpinning = false

        this.completedRoll += Math.PI * 2 * this.spinDirection
        if (Math.abs(this.completedRoll) > Math.PI * 20) {
          this.completedRoll = this.completedRoll % (Math.PI * 2)
        }
      }

      const t = this.spinProgress
      const easedProgress = t * t * (3 - 2 * t)
      extraRollAngle = easedProgress * Math.PI * 2 * this.spinDirection
    }

    const yaw = this.mesh.rotation.y
    this.mesh.position.x += Math.sin(yaw) * this.speed * deltaTime
    this.mesh.position.z += Math.cos(yaw) * this.speed * deltaTime

    const vertical =
      input.vertical !== 0
        ? input.vertical
        : (input.up ? 1 : 0) - (input.down ? 1 : 0)
    this.mesh.position.y += vertical * this.stats.speed * 0.7 * deltaTime

    const position = this.mesh.position
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

    this.updateGlow(deltaTime)
    this.updateHurt(deltaTime)
    // Pasamos extraPitch a la animación
    this.animateSwimming(deltaTime, steer, vertical, extraRollAngle, extraPitch)
  }

  public getSpeed(): number {
    return this.speed
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone()
  }

  public getCollectionRadius(): number {
    return this.stats.collectionRadius
  }

  public getSpinBoost(): number {
    return this.spinBoost
  }

  public isSpinBoosting(): boolean {
    return this.spinBoost > 0.05
  }

  public isSpinInProgress(): boolean {
    return this.isSpinning
  }

  public isBoosting(): boolean {
    return this.boostActiveThisFrame
  }

  public getBoostEnergy(): number {
    return this.boostEnergy / this.boostMaxEnergy
  }

  public resetStats(): void {
    this.stats = { ...this.baseStats }

    this.glowTarget = 0
    this.glowLevel = 0
    this.glowLight.intensity = 0

    this.isBackflipping = false
    this.backflipProgress = 0
    this.completedPitch = 0

    this.shellMaterial.color.copy(this.baseColors.shell)
    this.skinMaterial.color.copy(this.baseColors.skin)
    this.plateMaterial.color.copy(this.baseColors.plate)
    this.rimMaterial.color.copy(this.baseColors.rim)

    this.shellMaterial.emissive.setHex(0x000000)
    this.skinMaterial.emissive.setHex(0x000000)
    this.plateMaterial.emissive.setHex(0x000000)
    this.rimMaterial.emissive.setHex(0x000000)

    this.shellMaterial.emissiveIntensity = 0
    this.skinMaterial.emissiveIntensity = 0
    this.plateMaterial.emissiveIntensity = 0
    this.rimMaterial.emissiveIntensity = 0
  }

  private createTurtleModel(): {
    model: THREE.Group
    body: THREE.Group
    flippers: {
      leftFront: THREE.Mesh
      rightFront: THREE.Mesh
      leftBack: THREE.Mesh
      rightBack: THREE.Mesh
    }
    tail: THREE.Mesh
    materials: {
      shell: THREE.MeshStandardMaterial
      skin: THREE.MeshStandardMaterial
      plate: THREE.MeshStandardMaterial
      rim: THREE.MeshStandardMaterial
    }
  } {
    const model = new THREE.Group()
    const body = new THREE.Group()
    model.add(body)

    const shellMaterial = new THREE.MeshStandardMaterial({
      color: BASE_SHELL_COLOR,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    })

    const shellRimMaterial = new THREE.MeshStandardMaterial({
      color: BASE_RIM_COLOR,
      roughness: 0.75,
      flatShading: true,
    })

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: BASE_SKIN_COLOR,
      roughness: 0.7,
      flatShading: true,
    })

    const shell = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      shellMaterial,
    )
    shell.scale.set(1, 0.55, 1.5)
    body.add(shell)

    const plateMaterial = new THREE.MeshStandardMaterial({
      color: BASE_PLATE_COLOR,
      roughness: 0.65,
      metalness: 0.08,
      flatShading: true,
    })

    const platePositions: Array<[number, number, number, number]> = [
      [0, 0.52, 0.55, 0],
      [0, 0.58, 0, 0],
      [0, 0.52, -0.55, 0],
      [-0.42, 0.42, 0.28, 0.5],
      [0.42, 0.42, 0.28, -0.5],
      [-0.42, 0.42, -0.28, -0.5],
      [0.42, 0.42, -0.28, 0.5],
    ]

    for (const [x, y, z, rotation] of platePositions) {
      const plate = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.26, 0),
        plateMaterial,
      )
      plate.position.set(x, y, z)
      plate.rotation.y = rotation
      plate.scale.set(1.1, 0.45, 1.25)
      body.add(plate)
    }

    const shellRim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.02, 0.82, 0.22, 10),
      shellRimMaterial,
    )
    shellRim.position.y = -0.16
    shellRim.scale.set(1, 1, 1.45)
    body.add(shellRim)

    const head = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.36, 0),
      skinMaterial,
    )
    head.position.set(0, 0.18, 1.22)
    head.scale.set(0.9, 0.85, 1.1)
    body.add(head)

    const eyeGeometry = new THREE.SphereGeometry(0.09, 8, 6)
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.25,
    })

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
      eye.position.set(side * 0.18, 0.28, 1.38)
      body.add(eye)
    }

    const frontFlipperGeometry = new THREE.BoxGeometry(0.85, 0.12, 0.42)

    const leftFrontFlipper = new THREE.Mesh(frontFlipperGeometry, skinMaterial)
    leftFrontFlipper.position.set(-0.85, 0, 0.5)
    leftFrontFlipper.rotation.z = 0.3
    body.add(leftFrontFlipper)

    const rightFrontFlipper = new THREE.Mesh(frontFlipperGeometry, skinMaterial)
    rightFrontFlipper.position.set(0.85, 0, 0.5)
    rightFrontFlipper.rotation.z = -0.3
    body.add(rightFrontFlipper)

    const backFlipperGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.3)

    const leftBackFlipper = new THREE.Mesh(backFlipperGeometry, skinMaterial)
    leftBackFlipper.position.set(-0.6, -0.15, -0.8)
    body.add(leftBackFlipper)

    const rightBackFlipper = new THREE.Mesh(backFlipperGeometry, skinMaterial)
    rightBackFlipper.position.set(0.6, -0.15, -0.8)
    body.add(rightBackFlipper)

    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.6, 6),
      skinMaterial,
    )
    tail.position.set(0, 0, -1.42)
    tail.rotation.x = -Math.PI / 2
    body.add(tail)

    return {
      model,
      body,
      flippers: {
        leftFront: leftFrontFlipper,
        rightFront: rightFrontFlipper,
        leftBack: leftBackFlipper,
        rightBack: rightBackFlipper,
      },
      tail,
      materials: {
        shell: shellMaterial,
        skin: skinMaterial,
        plate: plateMaterial,
        rim: shellRimMaterial,
      },
    }
  }

  private animateSwimming(
    deltaTime: number,
    steer: number,
    vertical: number,
    extraRollAngle: number,
    extraPitch: number = 0,
  ): void {
    const speedRatio = THREE.MathUtils.clamp(
      Math.abs(this.speed) / this.stats.speed,
      0,
      2,
    )

    const swimFrequency = 2.2 + speedRatio * 2.4
    const swimAmplitude = 0.22 + speedRatio * 0.24
    const paddle = Math.sin(this.time * swimFrequency)
    const hurt = this.hurtTimer > 0 ? this.hurtTimer / HURT_DURATION : 0

    this.leftFrontFlipper.rotation.x = paddle * swimAmplitude
    this.rightFrontFlipper.rotation.x = -paddle * swimAmplitude
    this.leftBackFlipper.rotation.x = -paddle * swimAmplitude * 0.45
    this.rightBackFlipper.rotation.x = paddle * swimAmplitude * 0.45
    this.tail.rotation.y = paddle * 0.18

    // Cabeceo vertical + voltereta + conservación de rotación
    const pitchTarget =
      -vertical * 0.38 +
      Math.sin(this.time * 2.6) * 0.035 +
      this.completedPitch +
      extraPitch +
      hurt * 0.12

    this.model.rotation.x +=
      (pitchTarget - this.model.rotation.x) * (1 - Math.exp(-6 * deltaTime))

    const bankTarget = -steer * 0.28
    const baseRoll = Math.sin(this.time * 4.5) * 0.07
    const targetRoll =
      bankTarget + baseRoll + this.completedRoll + extraRollAngle + hurt * 0.1

    this.model.rotation.z +=
      (targetRoll - this.model.rotation.z) * (1 - Math.exp(-7 * deltaTime))

    // --- Flotación + squash & stretch del body ---
    this.body.position.y = Math.sin(this.time * 1.8) * 0.06 - hurt * 0.08
    this.body.position.z = -hurt * 0.18
    this.body.rotation.x = Math.sin(this.time * 1.4) * 0.03 + hurt * 0.2
    this.body.rotation.z = hurt * 0.12

    const boostVisual = Math.min(1, this.spinBoost / this.spinBoostMultiplier)
    const hurtScale = 1 - hurt * 0.06
    const targetScaleX = (1 - boostVisual * 0.05) * hurtScale
    const targetScaleY = (1 - boostVisual * 0.08) * hurtScale
    const targetScaleZ = (1 + boostVisual * 0.15) * (1 + hurt * 0.04)

    const scaleSmoothing = 1 - Math.exp(-8 * deltaTime)
    this.body.scale.x += (targetScaleX - this.body.scale.x) * scaleSmoothing
    this.body.scale.y += (targetScaleY - this.body.scale.y) * scaleSmoothing
    this.body.scale.z += (targetScaleZ - this.body.scale.z) * scaleSmoothing
  }

  /** Flash magenta y luz de impacto; se aplica después del glow para no pisarlo. */
  private updateHurt(deltaTime: number): void {
    if (this.hurtTimer <= 0) return

    this.hurtTimer = Math.max(0, this.hurtTimer - deltaTime)
    const strength = this.hurtTimer / HURT_DURATION
    if (strength <= 0) return

    const flash = Math.sin(strength * Math.PI * 0.5)

    for (const material of [
      this.shellMaterial,
      this.skinMaterial,
      this.plateMaterial,
      this.rimMaterial,
    ]) {
      material.emissive.lerp(HURT_COLOR, flash * 0.9)
      material.emissiveIntensity = Math.max(
        material.emissiveIntensity,
        flash * HURT_FLASH_INTENSITY,
      )
    }

    this.glowLight.color.lerp(HURT_COLOR, flash * 0.9)
    this.glowLight.intensity = Math.max(this.glowLight.intensity, flash * 8)
  }

  /** Bioluminiscencia en 5 fases: color propio → saturación → blanqueo → blanco puro. */
  private updateGlow(deltaTime: number): void {
    this.glowLevel +=
      (this.glowTarget - this.glowLevel) * (1 - Math.exp(-4 * deltaTime))

    // Apagado total: restaurar todo
    if (this.glowLevel < 0.005 && this.glowTarget === 0) {
      this.shellMaterial.color.copy(this.baseColors.shell)
      this.skinMaterial.color.copy(this.baseColors.skin)
      this.plateMaterial.color.copy(this.baseColors.plate)
      this.rimMaterial.color.copy(this.baseColors.rim)

      this.shellMaterial.emissive.setHex(0x000000)
      this.skinMaterial.emissive.setHex(0x000000)
      this.plateMaterial.emissive.setHex(0x000000)
      this.rimMaterial.emissive.setHex(0x000000)

      this.shellMaterial.emissiveIntensity = 0
      this.skinMaterial.emissiveIntensity = 0
      this.plateMaterial.emissiveIntensity = 0
      this.rimMaterial.emissiveIntensity = 0

      this.glowLight.intensity = 0
      return
    }

    const intensity = this.glowLevel
    const phase = sampleGlow(intensity)

    // Pulso biológico: fuerte en fases bajas, imperceptible al máximo
    const pulseAmount = 0.15 * (1 - intensity * 0.7)
    const pulse = 1 - pulseAmount + pulseAmount * Math.sin(this.time * 2.5)

    // Helper que aplica las 5 fases a un material
    const applyGlow = (
      material: THREE.MeshStandardMaterial,
      base: THREE.Color,
      emissiveWeight: number,
    ) => {
      // 1. Color base multiplicado (satura + ilumina)
      const c = base.clone().multiplyScalar(phase.colorMult)
      c.r = Math.min(1, c.r)
      c.g = Math.min(1, c.g)
      c.b = Math.min(1, c.b)

      // 2. Mezcla hacia blanco (fases 4 y 5)
      c.lerp(GLOW_WHITE, phase.whiten)
      material.color.copy(c)

      // 3. Emisivo: parte con el tono propio, vira a blanco en fases tardías
      const emissiveColor = base.clone().lerp(GLOW_WHITE, phase.whiten)
      material.emissive.copy(emissiveColor)

      // 4. Intensidad del emisivo con el peso por material
      material.emissiveIntensity = phase.emissive * emissiveWeight * pulse
    }

    applyGlow(this.shellMaterial, this.baseColors.shell, 0.8)
    applyGlow(this.skinMaterial, this.baseColors.skin, 1.0)
    applyGlow(this.plateMaterial, this.baseColors.plate, 1.1)
    applyGlow(this.rimMaterial, this.baseColors.rim, 1.3)

    // --- Luz puntual ---
    // En fases bajas mantiene un tono cian bioluminiscente; a partir de
    // la fase 4, vira a blanco puro.
    const lightColor = new THREE.Color(0x7cf7d4).lerp(GLOW_WHITE, phase.whiten)
    this.glowLight.color.copy(lightColor)
    this.glowLight.intensity = phase.light * pulse
    this.glowLight.distance = phase.distance
  }
}
