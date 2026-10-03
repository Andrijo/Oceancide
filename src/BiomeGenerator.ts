// src/BiomeGenerator.ts

import * as THREE from "three"
import {
  BIOMES,
  type BiomeConfig,
  type BiomeKey,
  type WorldBounds,
} from "./types"
import { Debris } from "./Debris"

const HALF_SIZE = 40 // los desechos aparecen en un área de 80x80
const DEBRIS_BASE_COUNT = 200
const FLOOR_AMPLITUDE = 5
const BAND_ABOVE_FLOOR = 6 // margen mínimo sobre el relieve
const BAND_HEIGHT = 20 // altura de la columna de agua jugable

export class BiomeGenerator {
  private scene: THREE.Scene
  private currentBiome: BiomeConfig
  private debrisList: Debris[] = []
  private debrisGroup: THREE.Group
  private floor?: THREE.Mesh
  private initialDebrisCount = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.currentBiome = BIOMES.coralReef
    this.debrisGroup = new THREE.Group()
    scene.add(this.debrisGroup)
  }

  public generateBiome(biomeKey: BiomeKey): void {
    this.currentBiome = BIOMES[biomeKey]

    // Los meshes comparten geometría/material, así que no hay que hacer dispose
    this.debrisGroup.clear()
    this.debrisList = []

    const color = new THREE.Color(...this.currentBiome.waterColor)
    this.scene.background = color
    this.scene.fog = new THREE.FogExp2(color, this.currentBiome.fogDensity)

    const bounds = this.getBounds()
    this.initialDebrisCount = Math.floor(
      DEBRIS_BASE_COUNT * this.currentBiome.debrisDensity,
    )
    for (let i = 0; i < this.initialDebrisCount; i++) {
      const position = new THREE.Vector3(
        (Math.random() * 2 - 1) * HALF_SIZE,
        bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        (Math.random() * 2 - 1) * HALF_SIZE,
      )
      const debris = new Debris(position)
      this.debrisGroup.add(debris.mesh)
      this.debrisList.push(debris)
    }

    this.generateTerrain()
  }

  private generateTerrain(): void {
    if (this.floor) {
      this.scene.remove(this.floor)
      this.floor.geometry.dispose()
      ;(this.floor.material as THREE.Material).dispose()
    }

    const geometry = new THREE.PlaneGeometry(200, 200, 50, 50)
    const positions = geometry.attributes.position.array as Float32Array
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]
      positions[i + 2] = Math.sin(x * 0.1) * Math.cos(y * 0.1) * FLOOR_AMPLITUDE
    }
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.1, 0.3, 0.2),
      roughness: 0.9,
      flatShading: true,
    })

    this.floor = new THREE.Mesh(geometry, material)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -this.currentBiome.depth
    this.scene.add(this.floor)
  }

  /** Límites jugables del bioma actual (la tortuga no puede salir de aquí). */
  public getBounds(): WorldBounds {
    const floorY = -this.currentBiome.depth
    return {
      halfSize: HALF_SIZE + 5,
      minY: floorY + BAND_ABOVE_FLOOR,
      maxY: floorY + BAND_ABOVE_FLOOR + BAND_HEIGHT,
    }
  }

  public updateDebris(
    turtlePosition: THREE.Vector3,
    collectionRadius: number,
    time: number,
    deltaTime: number,
  ): Debris[] {
    const collected: Debris[] = []

    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const debris = this.debrisList[i]
      debris.animate(time, deltaTime)

      if (debris.mesh.position.distanceTo(turtlePosition) < collectionRadius) {
        collected.push(debris)
        this.debrisGroup.remove(debris.mesh)
        this.debrisList.splice(i, 1)
      }
    }

    return collected
  }

  public getDebrisList(): Debris[] {
    return this.debrisList
  }

  public getInitialDebrisCount(): number {
    return this.initialDebrisCount
  }

  public getBiome(): BiomeConfig {
    return this.currentBiome
  }

  public getBiomeName(): string {
    return this.currentBiome.name
  }
}
