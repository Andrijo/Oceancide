// src/BubbleTrail.ts

import * as THREE from "three"

const POOL_SIZE = 80 // burbujas máximas a la vez
const EMIT_RATE = 30 // burbujas por segundo mientras se emite

/**
 * Estela de burbujas con un solo InstancedMesh (1 draw call).
 * Las burbujas viven en el mundo (no siguen a la tortuga), suben y se encogen al morir.
 */
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

  private cursor = 0
  private emitAccumulator = 0
  private time = 0

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(1, 6, 5)
    const material = new THREE.MeshBasicMaterial({
      color: 0xcfefff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })

    this.mesh = new THREE.InstancedMesh(geometry, material, POOL_SIZE)
    // Las instancias están lejos del origen: sin esto el culling las ocultaría
    this.mesh.frustumCulled = false
    scene.add(this.mesh)

    for (let i = 0; i < POOL_SIZE; i++) {
      this.positions.push(new THREE.Vector3())
      this.velocities.push(new THREE.Vector3())
    }
    this.clear()
  }

  /** Elimina todas las burbujas (p. ej. al teletransportar a la tortuga). */
  public clear(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.age[i] = 1
      this.life[i] = 1 // age >= life => muerta
      this.hide(i)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  private hide(i: number): void {
    this.dummy.position.set(0, 0, 0)
    this.dummy.scale.setScalar(0)
    this.dummy.updateMatrix()
    this.mesh.setMatrixAt(i, this.dummy.matrix)
  }

  private spawn(emitter: THREE.Vector3): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % POOL_SIZE

    // Salen de detrás de la tortuga, con algo de dispersión
    const p = this.positions[i]
    p.copy(emitter).addScaledVector(this.forward, -1.7)
    p.x += (Math.random() - 0.5) * 0.8
    p.y += (Math.random() - 0.5) * 0.5
    p.z += (Math.random() - 0.5) * 0.8

    // Un poco hacia atrás (arrastre del impulso) y subiendo
    const v = this.velocities[i]
    v.copy(this.forward).multiplyScalar(-(1 + Math.random() * 1.5))
    v.x += (Math.random() - 0.5) * 0.6
    v.z += (Math.random() - 0.5) * 0.6
    v.y = 1 + Math.random() * 1.2

    this.age[i] = 0
    this.life[i] = 1 + Math.random()
    this.size[i] = 0.08 + Math.random() * 0.14
    this.phase[i] = Math.random() * Math.PI * 2
  }

  /**
   * @param deltaTime segundos del frame
   * @param emitter posición de la tortuga
   * @param yaw rumbo de la tortuga (rotation.y)
   * @param emitting true mientras debe salir la estela
   */
  public update(
    deltaTime: number,
    emitter: THREE.Vector3,
    yaw: number,
    emitting: boolean,
  ): void {
    this.time += deltaTime
    this.forward.set(Math.sin(yaw), 0, Math.cos(yaw))

    if (emitting) {
      this.emitAccumulator += EMIT_RATE * deltaTime
      while (this.emitAccumulator >= 1) {
        this.emitAccumulator -= 1
        this.spawn(emitter)
      }
    } else {
      this.emitAccumulator = 0
    }

    const drag = Math.exp(-2 * deltaTime)
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.age[i] >= this.life[i]) continue

      this.age[i] += deltaTime
      if (this.age[i] >= this.life[i]) {
        this.hide(i) // acaba de morir
        continue
      }

      const p = this.positions[i]
      const v = this.velocities[i]
      v.x *= drag
      v.z *= drag
      v.y += 0.5 * deltaTime // flotabilidad
      p.addScaledVector(v, deltaTime)
      p.x += Math.sin(this.time * 6 + this.phase[i]) * 0.4 * deltaTime // vaivén

      // Aparece creciendo y se encoge al final de su vida
      const t = this.age[i] / this.life[i]
      const scale = this.size[i] * Math.min(1, t * 8) * Math.min(1, (1 - t) * 5)

      this.dummy.position.copy(p)
      this.dummy.scale.setScalar(scale)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.mesh.instanceMatrix.needsUpdate = true
  }
}
