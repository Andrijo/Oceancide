// src/Turtle.ts
import * as THREE from "three"
import type { InputState, TurtleStats, WorldBounds } from "./types"

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

  private speed = 0
  private time = 0
  private readonly turnSpeed = 3

  private isSpinning = false
  private spinProgress = 0
  private spinDirection = 1
  private readonly spinDuration = 0.8

  private completedRoll = 0

  // Boost de giro (Q/E)
  private spinBoost = 0
  private readonly spinBoostMultiplier = 1.6
  private readonly spinBoostDecay = 4

  constructor() {
    const { model, body, flippers, tail } = this.createTurtleModel()

    this.model = model
    this.body = body

    this.leftFrontFlipper = flippers.leftFront
    this.rightFrontFlipper = flippers.rightFront
    this.leftBackFlipper = flippers.leftBack
    this.rightBackFlipper = flippers.rightBack
    this.tail = tail

    this.mesh = new THREE.Group()
    this.mesh.add(this.model)

    this.stats = {
      speed: 9,
      collectionRadius: 3,
      toxicityResistance: 0.2,
      filterCapacity: 5,
    }
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
  } {
    const model = new THREE.Group()
    const body = new THREE.Group()
    model.add(body)

    const shellMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a4d20,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    })

    const shellRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0c053,
      roughness: 0.75,
      flatShading: true,
    })

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0x61b112,
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
      color: 0x0f6329,
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
    }
  }

  public trigger360Spin(direction: "left" | "right" = "left"): void {
    if (this.isSpinning) return

    this.isSpinning = true
    this.spinProgress = 0
    this.spinDirection = direction === "left" ? 1 : -1

    // Impulso inmediato: multiplicador temporal de velocidad
    this.spinBoost = this.spinBoostMultiplier
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
  }

  public update(
    deltaTime: number,
    input: InputState,
    bounds: WorldBounds,
  ): void {
    this.time += deltaTime

    // Decaimiento exponencial del boost de giro
    if (this.spinBoost > 0) {
      this.spinBoost *= Math.exp(-this.spinBoostDecay * deltaTime)
      if (this.spinBoost < 0.01) this.spinBoost = 0
    }

    // Boost normal (I) × boost de giro (Q/E)
    const inputBoost = input.boost ? 2 : 1
    const totalBoost = inputBoost * (1 + this.spinBoost)

    const maxSpeed = this.stats.speed * totalBoost

    let targetSpeed = 0

    if (input.forward || (input.boost && !input.backward)) {
      targetSpeed = maxSpeed
    } else if (input.backward) {
      targetSpeed = -maxSpeed * 0.5
    }

    // Durante el giro, forzamos avance hacia adelante para que se sienta
    // como un "dash" incluso si el jugador suelta W
    if (this.isSpinning && targetSpeed === 0) {
      targetSpeed = maxSpeed * 0.6
    }

    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-4 * deltaTime))

    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0)
    this.mesh.rotation.y += turn * this.turnSpeed * deltaTime

    let extraRollAngle = 0

    if (this.isSpinning) {
      this.spinProgress += deltaTime / this.spinDuration

      if (this.spinProgress >= 1) {
        this.spinProgress = 1
        this.isSpinning = false

        this.completedRoll += Math.PI * 2 * this.spinDirection

        // Normalizar solo cuando supera muchas vueltas (evita el salto visual)
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

    const vertical = (input.up ? 1 : 0) - (input.down ? 1 : 0)
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

    this.animateSwimming(deltaTime, turn, vertical, extraRollAngle)
  }

  private animateSwimming(
    deltaTime: number,
    turn: number,
    vertical: number,
    extraRollAngle: number,
  ): void {
    const speedRatio = THREE.MathUtils.clamp(
      Math.abs(this.speed) / this.stats.speed,
      0,
      2,
    )

    const swimFrequency = 2.2 + speedRatio * 2.4
    const swimAmplitude = 0.22 + speedRatio * 0.24

    const paddle = Math.sin(this.time * swimFrequency)

    // Aleteo delantero alternado
    this.leftFrontFlipper.rotation.x = paddle * swimAmplitude
    this.rightFrontFlipper.rotation.x = -paddle * swimAmplitude

    // Aletas traseras más sutiles
    this.leftBackFlipper.rotation.x = -paddle * swimAmplitude * 0.45
    this.rightBackFlipper.rotation.x = paddle * swimAmplitude * 0.45

    // Cola
    this.tail.rotation.y = paddle * 0.18

    // Cabeceo vertical
    const pitchTarget = -vertical * 0.38 + Math.sin(this.time * 2.6) * 0.035

    this.model.rotation.x +=
      (pitchTarget - this.model.rotation.x) * (1 - Math.exp(-6 * deltaTime))

    // Inclinación al girar + balanceo + giros completados
    const bankTarget = -turn * 0.28
    const baseRoll = Math.sin(this.time * 4.5) * 0.07

    const targetRoll =
      bankTarget + baseRoll + this.completedRoll + extraRollAngle

    this.model.rotation.z +=
      (targetRoll - this.model.rotation.z) * (1 - Math.exp(-7 * deltaTime))

    // Uso del body: flotación + squash & stretch

    // Flotación sutil constante (respiración)
    this.body.position.y = Math.sin(this.time * 1.8) * 0.06
    this.body.rotation.x = Math.sin(this.time * 1.4) * 0.03

    // Squash & stretch durante el boost de giro.
    // boostVisual va de 0 (sin boost) a 1 (boost máximo).
    const boostVisual = Math.min(1, this.spinBoost / this.spinBoostMultiplier)

    // Estirar en Z (dirección de avance) y comprimir en X/Y
    const targetScaleX = 1 - boostVisual * 0.05
    const targetScaleY = 1 - boostVisual * 0.08
    const targetScaleZ = 1 + boostVisual * 0.15

    const scaleSmoothing = 1 - Math.exp(-8 * deltaTime)

    this.body.scale.x += (targetScaleX - this.body.scale.x) * scaleSmoothing
    this.body.scale.y += (targetScaleY - this.body.scale.y) * scaleSmoothing
    this.body.scale.z += (targetScaleZ - this.body.scale.z) * scaleSmoothing
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

  /** Multiplicador de velocidad actual por el boost de giro (1 = sin boost). */
  public getSpinBoost(): number {
    return this.spinBoost
  }

  /** True si el boost de giro está activo de forma apreciable. */
  public isSpinBoosting(): boolean {
    return this.spinBoost > 0.05
  }

  /** True si la tortuga está en medio de un giro de 360°. */
  public isSpinInProgress(): boolean {
    return this.isSpinning
  }
}
