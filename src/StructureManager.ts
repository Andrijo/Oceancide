// src/StructureManager.ts

import * as THREE from "three"
import type { BiomeGenerator } from "./BiomeGenerator"
import type { Debris } from "./Debris"
import { Structure } from "./Structure"
import { STRUCTURES, type StructureKey } from "./StructureConfig"

/** Lo que las estructuras han ganado en este frame. */
export interface StructureCredit {
  eco: number
  count: number
}

export class StructureManager {
  private scene: THREE.Scene
  private structures: Structure[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public getActiveCount(): number {
    return this.structures.length
  }

  public build(key: StructureKey, position: THREE.Vector3): Structure {
    const structure = new Structure(STRUCTURES[key], position)
    this.scene.add(structure.group)
    this.structures.push(structure)
    return structure
  }

  public clear(): void {
    for (const s of this.structures) {
      this.scene.remove(s.group)
      s.dispose()
    }
    this.structures = []
  }

  public update(
    deltaTime: number,
    time: number,
    biome: BiomeGenerator,
  ): StructureCredit {
    const credit: StructureCredit = { eco: 0, count: 0 }

    for (let i = this.structures.length - 1; i >= 0; i--) {
      const s = this.structures[i]
      s.update(time, deltaTime)

      // Cobrar los desechos que han llegado al filtro
      for (let j = s.inFlight.length - 1; j >= 0; j--) {
        const debris = s.inFlight[j]
        if (debris.removed) {
          s.inFlight.splice(j, 1) // lo recogió la tortuga por el camino
        } else if (debris.pullArrived) {
          biome.removeDebris(debris)
          s.inFlight.splice(j, 1)
          credit.eco += Math.round(debris.ecoValue * s.config.yield)
          credit.count += 1
        }
      }

      // Reservar el siguiente desecho
      if (s.remaining > 0) {
        s.timer += deltaTime
        if (s.timer >= s.config.interval) {
          const target = this.findTarget(s, biome.getDebrisList())
          if (target) {
            target.pull(s.position)
            s.inFlight.push(target)
            s.remaining -= 1
            s.timer = 0
          } else {
            s.timer = s.config.interval // espera a que haya algo en alcance
          }
        }
      }

      if (s.isExhausted()) {
        this.scene.remove(s.group)
        s.dispose()
        this.structures.splice(i, 1)
      }
    }

    return credit
  }

  /** Desecho libre más cercano dentro del alcance de la estructura. */
  private findTarget(s: Structure, debrisList: Debris[]): Debris | null {
    let best: Debris | null = null
    let bestDist = s.config.radius
    for (const debris of debrisList) {
      if (debris.claimed || debris.removed) continue
      const dist = debris.mesh.position.distanceTo(s.position)
      if (dist < bestDist) {
        best = debris
        bestDist = dist
      }
    }
    return best
  }
}
