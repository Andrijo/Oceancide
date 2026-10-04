// src/Turtle.ts

import * as THREE from "three"
import type { InputState, TurtleStats, WorldBounds } from "./types"

export class Turtle {
  /** Grupo exterior: solo posición y rumbo (yaw). */
  public mesh: THREE.Group
  public stats: TurtleStats

  /** Grupo interior: modelo visual con balanceo y cabeceo. */
  private model: THREE.Group
  private speed = 0
  private time = 0
  private readonly turnSpeed = 3 // rad/s

  constructor() {
    this.model = this.createTurtleModel()
    this.mesh = new THREE.Group()
    this.mesh.add(this.model)

    this.stats = {
      speed: 9, // unidades/s
      collectionRadius: 3,
      toxicityResistance: 0.1,
      filterCapacity: 5,
    }
  }

  private createTurtleModel(): THREE.Group {
    const group = new THREE.Group()

    // Caparazón (low-poly)
    const shell = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.8,
        flatShading: true,
      }),
    )
    shell.scale.set(1, 0.5, 1.5)
    group.add(shell)

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0x9acd32,
      roughness: 0.7,
    })

    // Cabeza
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      skinMaterial,
    )
    head.position.set(0, 0.2, 1.2)
    group.add(head)

    // Patas delanteras
    const flipperGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.4)
    const leftFlipper = new THREE.Mesh(flipperGeometry, skinMaterial)
    leftFlipper.position.set(-0.8, 0, 0.5)
    leftFlipper.rotation.z = 0.3
    group.add(leftFlipper)

    const rightFlipper = new THREE.Mesh(flipperGeometry, skinMaterial)
    rightFlipper.position.set(0.8, 0, 0.5)
    rightFlipper.rotation.z = -0.3
    group.add(rightFlipper)

    // Patas traseras
    const backFlipperGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.3)
    const leftBack = new THREE.Mesh(backFlipperGeometry, skinMaterial)
    leftBack.position.set(-0.6, -0.2, -0.8)
    group.add(leftBack)

    const rightBack = new THREE.Mesh(backFlipperGeometry, skinMaterial)
    rightBack.position.set(0.6, -0.2, -0.8)
    group.add(rightBack)

    // Cola
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x9acd32, roughness: 0.8 }),
    )
    tail.position.set(0, 0, -1.5)
    tail.rotation.x = -Math.PI / 2 // la punta apunta hacia atrás
    group.add(tail)

    // Ojos
    const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8)
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.2,
    })
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    leftEye.position.set(-0.2, 0.3, 1.4)
    group.add(leftEye)

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    rightEye.position.set(0.2, 0.3, 1.4)
    group.add(rightEye)

    return group
  }

  public reset(position: THREE.Vector3): void {
    this.mesh.position.copy(position)
    this.mesh.rotation.set(0, 0, 0)
    this.speed = 0
  }

  public update(
    deltaTime: number,
    input: InputState,
    bounds: WorldBounds,
  ): void {
    this.time += deltaTime

    // Avance con aceleración suave
    const maxSpeed = this.stats.speed * (input.boost ? 2 : 1)
    let target = 0
    if (input.forward) target = maxSpeed
    else if (input.backward) target = -maxSpeed * 0.5
    this.speed += (target - this.speed) * (1 - Math.exp(-4 * deltaTime))

    // Giro (izquierda = +Y, mirando hacia +Z)
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0)
    this.mesh.rotation.y += turn * this.turnSpeed * deltaTime

    // Movimiento horizontal en la dirección del rumbo
    const yaw = this.mesh.rotation.y
    this.mesh.position.x += Math.sin(yaw) * this.speed * deltaTime
    this.mesh.position.z += Math.cos(yaw) * this.speed * deltaTime

    // Movimiento vertical
    const vertical = (input.up ? 1 : 0) - (input.down ? 1 : 0)
    this.mesh.position.y += vertical * this.stats.speed * 0.7 * deltaTime

    // Límites del mundo
    const p = this.mesh.position
    p.x = THREE.MathUtils.clamp(p.x, -bounds.halfSize, bounds.halfSize)
    p.z = THREE.MathUtils.clamp(p.z, -bounds.halfSize, bounds.halfSize)
    p.y = THREE.MathUtils.clamp(p.y, bounds.minY, bounds.maxY)

    // Animación de nado (solo en el modelo, no afecta al rumbo)
    const pitchTarget = -vertical * 0.4
    this.model.rotation.x +=
      (pitchTarget + Math.sin(this.time * 3) * 0.05 - this.model.rotation.x) *
      (1 - Math.exp(-6 * deltaTime))
    this.model.rotation.z = Math.sin(this.time * 5) * 0.1
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone()
  }

  public getCollectionRadius(): number {
    return this.stats.collectionRadius
  }
}
