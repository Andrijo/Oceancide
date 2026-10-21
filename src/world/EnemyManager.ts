import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { WorldBounds } from "@core/types"
import { Jellyfish } from "@entities/Enemy"

const HIT_DISTANCE = 1.8
const SPAWN_MARGIN = 6
const SPAWN_ATTEMPTS = 12
const CENTER_CLEARANCE = 10

/**
 * Gestiona la fauna hostil del bioma. Por ahora solo medusas.
 *
 * `spawn` limpia la generación anterior para que el cambio de bioma no deje
 * enemigos huérfanos en la escena.
 */
export class EnemyManager {
  private readonly enemies: Jellyfish[] = []
  private readonly scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      enemy.dispose()
    }
    this.enemies.length = 0
  }

  public spawn(count: number, bounds: WorldBounds, rng: Rng): void {
    this.clear()

    const safeCount = Math.max(0, Math.floor(count))
    const marginXZ = Math.min(SPAWN_MARGIN, Math.max(0, bounds.halfSize - 1))
    const marginY = Math.min(1, Math.max(0, (bounds.maxY - bounds.minY) * 0.1))

    for (let i = 0; i < safeCount; i++) {
      const position = this.findSpawnPosition(bounds, rng, marginXZ, marginY)
      const enemy = new Jellyfish(position, rng)
      this.enemies.push(enemy)
      this.scene.add(enemy.mesh)
    }
  }

  /**
   * Actualiza todas las medusas y devuelve `true` si alguna tocó a la tortuga
   * en este frame.
   */
  public update(
    deltaTime: number,
    time: number,
    turtlePos: THREE.Vector3,
    bounds: WorldBounds,
  ): boolean {
    let hit = false
    const hitDistanceSq = HIT_DISTANCE * HIT_DISTANCE

    for (const enemy of this.enemies) {
      enemy.update(time, deltaTime)

      const position = enemy.mesh.position
      position.x = THREE.MathUtils.clamp(
        position.x,
        -bounds.halfSize,
        bounds.halfSize,
      )
      position.y = THREE.MathUtils.clamp(position.y, bounds.minY, bounds.maxY)
      position.z = THREE.MathUtils.clamp(
        position.z,
        -bounds.halfSize,
        bounds.halfSize,
      )

      if (
        !enemy.coolingDown &&
        position.distanceToSquared(turtlePos) < hitDistanceSq
      ) {
        enemy.hit()
        hit = true
      }
    }

    return hit
  }

  public getCount(): number {
    return this.enemies.length
  }

  private findSpawnPosition(
    bounds: WorldBounds,
    rng: Rng,
    marginXZ: number,
    marginY: number,
  ): THREE.Vector3 {
    const minX = -bounds.halfSize + marginXZ
    const maxX = bounds.halfSize - marginXZ
    const minY = bounds.minY + marginY
    const maxY = bounds.maxY - marginY
    const centerY = (bounds.minY + bounds.maxY) / 2

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const x = rng.range(minX, maxX)
      const z = rng.range(minX, maxX)

      if (Math.hypot(x, z) >= CENTER_CLEARANCE) {
        return new THREE.Vector3(x, rng.range(minY, maxY), z)
      }
    }

    // Fallback: una esquina lejos del centro, siempre dentro de los bounds.
    return new THREE.Vector3(maxX, centerY, maxX)
  }
}
