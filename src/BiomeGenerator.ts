// src/BiomeGenerator.ts

import * as THREE from "three"
import {
  BIOMES,
  type BiomeConfig,
  type BiomeKey,
  type WorldBounds,
} from "./types"
import { Debris } from "./Debris"
import type { Rng } from "./rng"

const WHITE = new THREE.Color(1, 1, 1)
const CLEAN_FOG_FACTOR = 0.55 // niebla con la zona 100 % limpia (1 = sin cambio)
const CLEAN_BRIGHTEN = 0.15 // cuánto se aclara el agua al limpiarla (0..1)
const VISUAL_SMOOTHING = 2 // rapidez con la que el agua cambia de aspecto

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

  // Contaminación activa: suma de lo que aportan los desechos aún en el agua
  private pollutionTotal = 0
  private pollutionRemaining = 0

  // Aspecto del agua (se aclara a medida que se limpia la zona)
  private baseColor = new THREE.Color()
  private waterColor = new THREE.Color() // usado como fondo y como color de niebla
  private visualRatio = 1

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.currentBiome = BIOMES.epipelagic_upper
    this.debrisGroup = new THREE.Group()
    scene.add(this.debrisGroup)
  }

  public generateBiome(biomeKey: BiomeKey, rng: Rng): void {
    this.currentBiome = BIOMES[biomeKey]
    this.debrisGroup.clear()
    this.debrisList = []

    this.baseColor.setRGB(...this.currentBiome.waterColor)
    this.scene.background = this.waterColor
    this.scene.fog = new THREE.FogExp2(
      this.baseColor,
      this.currentBiome.fogDensity,
    )
    this.visualRatio = 1
    this.applyVisuals()

    const bounds = this.getBounds()
    this.initialDebrisCount = Math.floor(
      DEBRIS_BASE_COUNT * this.currentBiome.debrisDensity,
    )
    for (let i = 0; i < this.initialDebrisCount; i++) {
      const position = new THREE.Vector3(
        rng.range(-HALF_SIZE, HALF_SIZE),
        rng.range(bounds.minY, bounds.maxY),
        rng.range(-HALF_SIZE, HALF_SIZE),
      )
      const debris = new Debris(
        position,
        Debris.pickDefinition(biomeKey, rng),
        rng,
      )
      this.debrisGroup.add(debris.mesh)
      this.debrisList.push(debris)
    }

    this.pollutionTotal = this.debrisList.reduce(
      (sum, d) => sum + d.pollution,
      0,
    )
    this.pollutionRemaining = this.pollutionTotal

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
      color: new THREE.Color(...this.currentBiome.floorColor),
      roughness: 0.9,
      flatShading: true,
    })

    this.floor = new THREE.Mesh(geometry, material)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -this.currentBiome.depth
    this.scene.add(this.floor)
  }

  /** Límites del bioma actual. Restringen la posición de la tortuga. */
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
        this.pollutionRemaining = Math.max(
          0,
          this.pollutionRemaining - debris.pollution,
        )
      }
    }
    if (this.debrisList.length === 0) this.pollutionRemaining = 0

    return collected
  }

  /** Contaminación restante de la zona: 1 = sin limpiar, 0 = totalmente limpia. */
  public getPollutionRatio(): number {
    return this.pollutionTotal > 0
      ? this.pollutionRemaining / this.pollutionTotal
      : 0
  }

  /** Aclara el agua de forma suave según la contaminación restante. */
  public updateVisuals(deltaTime: number): void {
    const target = this.getPollutionRatio()
    this.visualRatio +=
      (target - this.visualRatio) *
      (1 - Math.exp(-VISUAL_SMOOTHING * deltaTime))
    this.applyVisuals()
  }

  private applyVisuals(): void {
    const fog = this.scene.fog as THREE.FogExp2
    const r = this.visualRatio

    this.waterColor.copy(this.baseColor).lerp(WHITE, (1 - r) * CLEAN_BRIGHTEN)
    fog.color.copy(this.waterColor)
    fog.density =
      this.currentBiome.fogDensity *
      (CLEAN_FOG_FACTOR + (1 - CLEAN_FOG_FACTOR) * r)
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
