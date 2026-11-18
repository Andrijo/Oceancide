import * as THREE from "three"
import type { Rng } from "@core/rng"
import type { Creature, CreatureContext, CreatureEffects } from "./Creature"
import { edgeAvoidance, turnToward } from "./steering"

const FISH_COUNT = 18
const SWIM_SPEED = 2.4
const EDGE_MARGIN = 9

/** Distancia al centro del banco a la que la tortuga lo atraviesa. */
export const SCHOOL_TRIGGER_RADIUS = 3.2
/** Radio y velocidad con los que esparce los desechos al dispersarse. */
export const SCHOOL_SCATTER_RADIUS = 9
const SCATTER_SPEED = 7
/** Segundos que tarda en reagruparse (y en poder volver a dispersarse). */
export const SCHOOL_REGROUP_TIME = 7
const SCATTER_SPREAD = 9

interface Fish {
  radius: number
  speed: number
  angle: number
  height: number
  tilt: number
  scale: number
}

const dummy = new THREE.Object3D()

/**
 * Banco de peces. Gira en remolino alrededor de un centro que vaga por el
 * bioma. No hace daño, pero si la tortuga lo atraviesa los peces salen
 * disparados y arrastran los desechos de alrededor, que acaban más
 * repartidos. Tarda unos segundos en reagruparse.
 */
export class FishSchool implements Creature {
  public readonly kind = "fishSchool"
  public readonly mesh = new THREE.Group()

  private readonly fishMesh: THREE.InstancedMesh
  private readonly geometry: THREE.ConeGeometry
  private readonly material: THREE.MeshStandardMaterial
  private readonly fish: Fish[] = []
  private readonly phase: number
  private heading: number
  /** 0..1: lo dispersos que están los peces (1 recién atravesado). */
  private spread = 0
  private regroup = 0

  constructor(position: THREE.Vector3, rng: Rng) {
    this.phase = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)

    this.mesh.name = "fishSchool"
    this.mesh.userData.kind = "fishSchool"
    this.mesh.position.copy(position)

    this.geometry = new THREE.ConeGeometry(0.12, 0.45, 5)
    // El cono apunta a +Y; se tumba para que el pez nade hacia +Z.
    this.geometry.rotateX(Math.PI / 2)
    this.material = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff,
      roughness: 0.25,
      metalness: 0.6,
      emissive: 0x2a6f9a,
      emissiveIntensity: 0.35,
    })
    this.fishMesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      FISH_COUNT,
    )
    this.fishMesh.frustumCulled = false
    this.mesh.add(this.fishMesh)

    for (let i = 0; i < FISH_COUNT; i++) {
      this.fish.push({
        radius: rng.range(0.9, 2.6),
        speed: rng.range(1.1, 1.8),
        angle: rng.range(0, Math.PI * 2),
        height: rng.range(-0.9, 0.9),
        tilt: rng.range(-0.4, 0.4),
        scale: rng.range(0.8, 1.25),
      })
    }
    this.layoutFish(0)
  }

  /** `true` mientras los peces están dispersos y no pueden volver a hacerlo. */
  public get scattered(): boolean {
    return this.regroup > 0
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime, time, bounds, target } = ctx
    const position = this.mesh.position

    this.heading += Math.sin(time * 0.25 + this.phase) * 0.6 * deltaTime
    const away = edgeAvoidance(position, bounds, EDGE_MARGIN)
    if (away !== null) {
      this.heading = turnToward(this.heading, away, 1.4 * deltaTime)
    }
    position.x += Math.sin(this.heading) * SWIM_SPEED * deltaTime
    position.z += Math.cos(this.heading) * SWIM_SPEED * deltaTime
    position.y += Math.sin(time * 0.4 + this.phase) * 0.4 * deltaTime

    if (this.regroup > 0) {
      this.regroup = Math.max(0, this.regroup - deltaTime)
    }
    // Se dispersan de golpe y se reagrupan con suavidad.
    this.spread = Math.min(this.spread, this.regroup / SCHOOL_REGROUP_TIME)

    this.layoutFish(deltaTime)

    if (
      this.regroup === 0 &&
      position.distanceTo(target.position) < SCHOOL_TRIGGER_RADIUS
    ) {
      this.regroup = SCHOOL_REGROUP_TIME
      this.spread = 1
      return {
        scatter: {
          center: position.clone(),
          radius: SCHOOL_SCATTER_RADIUS,
          speed: SCATTER_SPEED,
        },
        notice: "school_scatter",
      }
    }
    return null
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    this.fishMesh.dispose()
    this.geometry.dispose()
    this.material.dispose()
  }

  private layoutFish(deltaTime: number): void {
    // Curva de salida: rápida al principio y frenando, como un estallido.
    const burst = 1 - (1 - this.spread) ** 3
    for (let i = 0; i < this.fish.length; i++) {
      const fish = this.fish[i]
      fish.angle += fish.speed * deltaTime * (1 - burst * 0.7)
      const radius = fish.radius + burst * SCATTER_SPREAD
      const x = Math.cos(fish.angle) * radius
      const z = Math.sin(fish.angle) * radius
      const y = fish.height * (1 + burst * 2)
      dummy.position.set(x, y, z)
      // Tangente del giro (nadan en el sentido de su ángulo).
      dummy.rotation.set(
        fish.tilt,
        Math.atan2(-Math.sin(fish.angle), Math.cos(fish.angle)),
        0,
      )
      dummy.scale.setScalar(fish.scale)
      dummy.updateMatrix()
      this.fishMesh.setMatrixAt(i, dummy.matrix)
    }
    this.fishMesh.instanceMatrix.needsUpdate = true
  }
}
