// src/world/StructureManager.ts

import * as THREE from "three"
import type { BiomeGenerator } from "./BiomeGenerator"
import type { Debris } from "@entities/Debris"
import type { Relic } from "@/relics/RelicPool"
import { Structure } from "./Structure"
import { STRUCTURES, type StructureKey } from "./StructureConfig"

export interface StructureAbsorption {
  position: THREE.Vector3
  eco: number
  /** Desecho absorbido (para el códice y las fugas cerradas). */
  debris: Debris
  /** Reliquia que escondía el desecho absorbido, si llevaba una. */
  relic: Relic | null
}

export interface StructureCredit {
  eco: number
  count: number
  absorptions: StructureAbsorption[]
  /** Esferas que se han agotado en este frame. */
  exhausted: number
}

/** Reglas de las cartas que cambian cómo trabajan las esferas. */
export interface StructureRules {
  /** Desechos que atrae cada esfera a la vez. */
  pull: number
  /** Multiplicador del Eco de las fugas. */
  leakEco: number
}

const DEFAULT_RULES: StructureRules = { pull: 1, leakEco: 1 }

export class StructureManager {
  private scene: THREE.Scene
  private structures: Structure[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  public getActiveCount(): number {
    return this.structures.length
  }

  /** Posición de cada esfera activa (el pulpo va a por ellas). */
  public getPositions(): THREE.Vector3[] {
    return this.structures.map((s) => s.position)
  }

  public build(
    key: StructureKey,
    position: THREE.Vector3,
    phase: number,
    capacity?: number,
  ): Structure {
    const structure = new Structure(STRUCTURES[key], position, phase, capacity)
    this.scene.add(structure.group)
    this.structures.push(structure)
    return structure
  }

  public clear(): void {
    for (const s of this.structures) {
      for (const debris of s.inFlight) {
        debris.release()
      }
      s.inFlight.length = 0

      this.scene.remove(s.group)
      s.dispose()
    }
    this.structures = []
  }

  public update(
    deltaTime: number,
    time: number,
    biome: BiomeGenerator,
    rules: StructureRules = DEFAULT_RULES,
  ): StructureCredit {
    const credit: StructureCredit = {
      eco: 0,
      count: 0,
      absorptions: [],
      exhausted: 0,
    }

    for (let i = this.structures.length - 1; i >= 0; i--) {
      const s = this.structures[i]
      s.update(time, deltaTime)

      for (let j = s.inFlight.length - 1; j >= 0; j--) {
        const debris = s.inFlight[j]
        // Retirado, o soltado por otro (un pulpo se lo ha robado).
        if (debris.removed || !debris.claimed) {
          s.inFlight.splice(j, 1)
        } else if (debris.pullArrived) {
          biome.removeDebris(debris)
          s.inFlight.splice(j, 1)

          const leak = debris.hazard === "lixivia" ? rules.leakEco : 1
          const eco = Math.round(debris.ecoValue * s.config.yield * leak)
          credit.eco += eco
          credit.count += 1

          s.triggerAbsorb()
          credit.absorptions.push({
            position: s.position.clone(),
            eco,
            debris,
            relic: debris.relic,
          })
        }
      }

      if (s.remaining > 0) {
        s.timer += deltaTime
        if (s.timer >= s.config.interval) {
          let pulled = 0
          while (pulled < rules.pull && s.remaining > 0) {
            const target = this.findTarget(s, biome.getDebrisList())
            if (!target) break
            target.pull(s.position)
            s.inFlight.push(target)
            s.remaining -= 1
            pulled++
          }
          s.timer = pulled > 0 ? 0 : s.config.interval
        }
      }

      if (s.isExhausted()) {
        credit.exhausted += 1
        this.scene.remove(s.group)
        s.dispose()
        this.structures.splice(i, 1)
      }
    }

    return credit
  }

  private findTarget(s: Structure, debrisList: Debris[]): Debris | null {
    let best: Debris | null = null
    let bestScore = -Infinity
    const radiusSq = s.config.radius * s.config.radius
    for (const debris of debrisList) {
      if (debris.claimed || debris.removed || debris.grabCooldown > 0) continue
      const distSq = debris.mesh.position.distanceToSquared(s.position)
      if (distSq > radiusSq) continue
      // La raíz solo se calcula para los candidatos dentro del radio.
      const dist = Math.sqrt(distSq)
      // Prioriza lo más contaminante; a igual contaminación, lo más cercano.
      const score = debris.pollution * s.config.radius - dist
      if (score > bestScore) {
        best = debris
        bestScore = score
      }
    }
    return best
  }
}
