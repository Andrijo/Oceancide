// src/core/CameraRig.ts
// Cámara en tercera persona: seguimiento suave, look-back y órbita del hub.

import * as THREE from "three"

const CAMERA_OFFSET = new THREE.Vector3(0, 5, -12)
const UP = new THREE.Vector3(0, 1, 0)

const ORBIT_RADIUS = 14
const ORBIT_HEIGHT = 4
const ORBIT_SPEED = 0.15
const FOLLOW_SMOOTHING = 6

export class CameraRig {
  public readonly camera: THREE.PerspectiveCamera
  private readonly target = new THREE.Vector3()
  private lookBack = false
  private appliedLookBack = false

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  public setLookBack(active: boolean): void {
    this.lookBack = active
  }

  /** Coloca la cámara de golpe (al cargar un bioma o cambiar de vista). */
  public snap(position: THREE.Vector3, yaw: number): void {
    this.appliedLookBack = this.lookBack
    this.camera.position.copy(this.computeTarget(position, yaw))
    this.camera.lookAt(position)
  }

  /** Sigue a la tortuga con suavizado y aplica el look-back al instante. */
  public update(deltaTime: number, position: THREE.Vector3, yaw: number): void {
    if (this.lookBack !== this.appliedLookBack) {
      this.appliedLookBack = this.lookBack
      this.camera.position.copy(this.computeTarget(position, yaw))
    } else {
      const smoothing = 1 - Math.exp(-FOLLOW_SMOOTHING * deltaTime)
      this.camera.position.lerp(this.computeTarget(position, yaw), smoothing)
    }

    this.camera.lookAt(position)
  }

  /** Órbita lenta alrededor de la tortuga para el hub y el resumen. */
  public orbit(time: number, center: THREE.Vector3): void {
    const angle = time * ORBIT_SPEED

    this.camera.position.set(
      center.x + Math.sin(angle) * ORBIT_RADIUS,
      center.y + ORBIT_HEIGHT,
      center.z + Math.cos(angle) * ORBIT_RADIUS,
    )
    this.camera.lookAt(center)
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  private computeTarget(position: THREE.Vector3, yaw: number): THREE.Vector3 {
    return this.target
      .copy(CAMERA_OFFSET)
      .applyAxisAngle(UP, yaw + (this.lookBack ? Math.PI : 0))
      .add(position)
  }
}
