// src/BubbleTrail.ts
import * as THREE from "three"

const POOL_SIZE = 120
const EMIT_RATE = 34

const BUBBLE_COLORS = [
  new THREE.Color(0x35f0ff),
  new THREE.Color(0x59a6ff),
  new THREE.Color(0xa45cff),
  new THREE.Color(0xff5fd2),
  new THREE.Color(0xffffff),
]

export class BubbleTrail {
  private mesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()
  private forward = new THREE.Vector3()

  private positions: THREE.Vector3[] = []
  private velocities: THREE.Vector3[] = []

  private age = new Float32Array(POOL_SIZE)
  private life = new Float32Array(POOL_SIZE)
  private size = new Float32Array(POOL_SIZE)
  private phase = new Float32Array(POOL_SIZE)
  private wobble = new Float32Array(POOL_SIZE)

  private cursor = 0
  private emitAccumulator = 0
  private time = 0

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(1, 12, 9)

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.55,
      ior: 1.33,
      thickness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.InstancedMesh(geometry, material, POOL_SIZE)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2

    this.applyInstanceColors()

    scene.add(this.mesh)

    for (let i = 0; i < POOL_SIZE; i++) {
      this.positions.push(new THREE.Vector3())
      this.velocities.push(new THREE.Vector3())
    }

    this.clear()
  }

  public clear(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.age[i] = 1
      this.life[i] = 1
      this.hide(i)
    }

    this.mesh.instanceMatrix.needsUpdate = true
  }

  /** @param intensity 0 = sin boost, 1 = boost máximo. Multiplica la emisión. */
  public update(
    deltaTime: number,
    emitter: THREE.Vector3,
    yaw: number,
    emitting: boolean,
    intensity = 0,
  ): void {
    this.time += deltaTime
    this.forward.set(Math.sin(yaw), 0, Math.cos(yaw))

    if (emitting) {
      const rate = EMIT_RATE * (1 + intensity * 1.5)
      const sizeMul = 1 + intensity * 0.6

      this.emitAccumulator += rate * deltaTime

      while (this.emitAccumulator >= 1) {
        this.emitAccumulator -= 1
        this.spawn(emitter, sizeMul)
      }
    } else {
      this.emitAccumulator = 0
    }

    const drag = Math.exp(-1.8 * deltaTime)

    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.age[i] >= this.life[i]) continue

      this.age[i] += deltaTime

      if (this.age[i] >= this.life[i]) {
        this.hide(i)
        continue
      }

      const position = this.positions[i]
      const velocity = this.velocities[i]

      velocity.x *= drag
      velocity.z *= drag
      velocity.y += 0.65 * deltaTime

      position.addScaledVector(velocity, deltaTime)

      const lifeRatio = this.age[i] / this.life[i]

      position.x +=
        Math.sin(this.time * this.wobble[i] + this.phase[i]) * 0.35 * deltaTime

      position.z +=
        Math.cos(this.time * this.wobble[i] * 0.8 + this.phase[i]) *
        0.3 *
        deltaTime

      const growIn = Math.min(1, lifeRatio * 9)
      const shrinkOut = Math.min(1, (1 - lifeRatio) * 4)
      const scale = this.size[i] * growIn * shrinkOut

      this.dummy.position.copy(position)
      this.dummy.scale.setScalar(scale)
      this.dummy.rotation.set(this.phase[i], this.time * 0.8 + this.phase[i], 0)
      this.dummy.updateMatrix()

      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.mesh.instanceMatrix.needsUpdate = true

    // El emisivo también sube con la intensidad
    const material = this.mesh.material as THREE.MeshPhysicalMaterial
    material.emissiveIntensity = 0.55 + intensity * 0.85
  }

  public dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.mesh.removeFromParent()
  }

  private applyInstanceColors(): void {
    const color = new THREE.Color()

    for (let i = 0; i < POOL_SIZE; i++) {
      color.copy(BUBBLE_COLORS[i % BUBBLE_COLORS.length])
      this.mesh.setColorAt(i, color)
    }

    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true
    }
  }

  private hide(index: number): void {
    this.dummy.position.set(0, -9999, 0)
    this.dummy.scale.setScalar(0)
    this.dummy.updateMatrix()
    this.mesh.setMatrixAt(index, this.dummy.matrix)
  }

  private spawn(emitter: THREE.Vector3, sizeMultiplier = 1): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % POOL_SIZE

    const position = this.positions[i]
    position.copy(emitter)
    position.addScaledVector(this.forward, -1.55)

    position.x += (Math.random() - 0.5) * 0.55
    position.y += (Math.random() - 0.5) * 0.35
    position.z += (Math.random() - 0.5) * 0.55

    const velocity = this.velocities[i]
    velocity.copy(this.forward).multiplyScalar(-(0.8 + Math.random() * 1.4))

    velocity.x += (Math.random() - 0.5) * 0.45
    velocity.z += (Math.random() - 0.5) * 0.45
    velocity.y = 0.85 + Math.random() * 1.1

    this.age[i] = 0
    this.life[i] = 1.15 + Math.random() * 1.1
    this.size[i] = (0.05 + Math.random() * 0.13) * sizeMultiplier
    this.phase[i] = Math.random() * Math.PI * 2
    this.wobble[i] = 0.5 + Math.random() * 1.2
  }
}
