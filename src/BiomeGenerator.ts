// src/BiomeGenerator.ts
import * as THREE from "three"
import {
  BIOMES,
  type BiomeConfig,
  type BiomeKey,
  type WorldBounds,
} from "./types"
import { BiomeProps } from "./BiomeProps"
import { Debris } from "./Debris"
import type { Rng } from "./rng"

const WHITE = new THREE.Color(1, 1, 1)
const CLEAN_FOG_FACTOR = 0.55
const CLEAN_BRIGHTEN = 0.15
const VISUAL_SMOOTHING = 2

const HALF_SIZE = 40
const DEBRIS_BASE_COUNT = 200
const BAND_ABOVE_FLOOR = 6
const BAND_HEIGHT = 20
const FLOOR_CLEARANCE = 2 // margen sobre la cima más alta del relieve

type BiomeAmbience = {
  floorAmplitude: number
  floorFrequency: number
  floorDetail: number
  particleColor: number
  particleCount: number
  particleSize: number
  particleOpacity: number
  ambientLight: number
  lightColor: number
}

const BIOME_AMBIENCE: Record<BiomeKey, BiomeAmbience> = {
  epipelagic_upper: {
    floorAmplitude: 3,
    floorFrequency: 0.08,
    floorDetail: 0.4,
    particleColor: 0xeafcff,
    particleCount: 500,
    particleSize: 0.06,
    particleOpacity: 0.38,
    ambientLight: 0.95,
    lightColor: 0xdff6ff,
  },

  pelagic_mid: {
    floorAmplitude: 4,
    floorFrequency: 0.09,
    floorDetail: 0.5,
    particleColor: 0xd8f4ff,
    particleCount: 650,
    particleSize: 0.055,
    particleOpacity: 0.32,
    ambientLight: 0.95,
    lightColor: 0xcfe9ff,
  },

  subphotic: {
    floorAmplitude: 5,
    floorFrequency: 0.1,
    floorDetail: 0.6,
    particleColor: 0xc4ecf7,
    particleCount: 800,
    particleSize: 0.05,
    particleOpacity: 0.28,
    ambientLight: 0.75,
    lightColor: 0xa9c8d8,
  },

  mesopelagic_upper: {
    floorAmplitude: 6,
    floorFrequency: 0.11,
    floorDetail: 0.7,
    particleColor: 0xa9dbe8,
    particleCount: 900,
    particleSize: 0.045,
    particleOpacity: 0.25,
    ambientLight: 0.6,
    lightColor: 0x9db8c8,
  },

  mesopelagic_deep: {
    floorAmplitude: 7,
    floorFrequency: 0.12,
    floorDetail: 0.8,
    particleColor: 0x93c6d6,
    particleCount: 1000,
    particleSize: 0.04,
    particleOpacity: 0.22,
    ambientLight: 0.48,
    lightColor: 0x8ba4b4,
  },

  bathypelagic_upper: {
    floorAmplitude: 8,
    floorFrequency: 0.13,
    floorDetail: 0.9,
    particleColor: 0x8fb9c9,
    particleCount: 1100,
    particleSize: 0.038,
    particleOpacity: 0.2,
    ambientLight: 0.36,
    lightColor: 0x7a8f9c,
  },

  bathypelagic_deep: {
    floorAmplitude: 9,
    floorFrequency: 0.14,
    floorDetail: 1,
    particleColor: 0x86aebd,
    particleCount: 1200,
    particleSize: 0.036,
    particleOpacity: 0.18,
    ambientLight: 0.28,
    lightColor: 0x6d808c,
  },

  abyssopelagic: {
    floorAmplitude: 10,
    floorFrequency: 0.15,
    floorDetail: 1.1,
    particleColor: 0x9fc4cf,
    particleCount: 1300,
    particleSize: 0.034,
    particleOpacity: 0.17,
    ambientLight: 0.2,
    lightColor: 0x5f7280,
  },

  hadopelagic: {
    floorAmplitude: 12,
    floorFrequency: 0.17,
    floorDetail: 1.25,
    particleColor: 0xb8d8de,
    particleCount: 1400,
    particleSize: 0.032,
    particleOpacity: 0.16,
    ambientLight: 0.14,
    lightColor: 0x51626e,
  },

  deepSea: {
    floorAmplitude: 14,
    floorFrequency: 0.18,
    floorDetail: 1.4,
    particleColor: 0xd6f0f4,
    particleCount: 1500,
    particleSize: 0.03,
    particleOpacity: 0.15,
    ambientLight: 0.1,
    lightColor: 0x4a5a66,
  },
}

export class BiomeGenerator {
  private scene: THREE.Scene
  private currentBiome: BiomeConfig
  private currentAmbience: BiomeAmbience
  private props: BiomeProps

  private debrisList: Debris[] = []
  private debrisGroup: THREE.Group

  private floor?: THREE.Mesh
  private particles?: THREE.Points
  private ambientLight?: THREE.AmbientLight
  private hemisphereLight?: THREE.HemisphereLight

  private initialDebrisCount = 0

  private pollutionTotal = 0
  private pollutionRemaining = 0

  private baseColor = new THREE.Color()
  private waterColor = new THREE.Color()
  private visualRatio = 1

  private particlePositions: Float32Array = new Float32Array(0)
  private particleVelocities: Float32Array = new Float32Array(0)

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.currentBiome = BIOMES.epipelagic_upper
    this.currentAmbience = BIOME_AMBIENCE.epipelagic_upper
    this.props = new BiomeProps(scene)

    this.debrisGroup = new THREE.Group()
    scene.add(this.debrisGroup)

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1)
    this.hemisphereLight = new THREE.HemisphereLight(0xbfe9ff, 0x0b1a22, 0.7)

    scene.add(this.ambientLight)
    scene.add(this.hemisphereLight)
  }

  public generateBiome(biomeKey: BiomeKey, rng: Rng): void {
    this.currentBiome = BIOMES[biomeKey]
    this.currentAmbience = BIOME_AMBIENCE[biomeKey]

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
    this.applyLighting()

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
      (sum, debris) => sum + debris.pollution,
      0,
    )

    this.pollutionRemaining = this.pollutionTotal

    this.generateTerrain()

    this.props.generate(biomeKey, rng, (x: number, z: number) =>
      this.getFloorHeight(x, z),
    )

    this.generateParticles(rng)
  }

  private applyLighting(): void {
    if (!this.ambientLight || !this.hemisphereLight) return

    this.ambientLight.intensity = this.currentAmbience.ambientLight
    this.ambientLight.color.set(this.currentAmbience.lightColor)

    this.hemisphereLight.intensity = this.currentAmbience.ambientLight * 0.65

    this.hemisphereLight.color.set(this.currentAmbience.lightColor)
  }

  private generateTerrain(): void {
    if (this.floor) {
      this.scene.remove(this.floor)
      this.floor.geometry.dispose()
      ;(this.floor.material as THREE.Material).dispose()
    }

    const { floorAmplitude, floorFrequency, floorDetail } = this.currentAmbience

    const geometry = new THREE.PlaneGeometry(220, 220, 64, 64)
    const positions = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 1]

      positions[i + 2] = this.calculateFloorDisplacement(
        x,
        z,
        floorAmplitude,
        floorFrequency,
        floorDetail,
      )
    }

    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...this.currentBiome.floorColor),
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
    })

    this.floor = new THREE.Mesh(geometry, material)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -this.currentBiome.depth

    this.scene.add(this.floor)
  }

  private calculateFloorDisplacement(
    x: number,
    z: number,
    amplitude: number,
    frequency: number,
    detail: number,
  ): number {
    const mainWave =
      Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude

    const secondaryWave =
      Math.sin(x * frequency * 3.1) *
      Math.cos(z * frequency * 2.7) *
      amplitude *
      0.25 *
      detail

    return mainWave + secondaryWave
  }

  public getFloorHeight(x: number, z: number): number {
    const { floorAmplitude, floorFrequency, floorDetail } = this.currentAmbience

    const mainWave =
      Math.sin(x * floorFrequency) *
      Math.cos(z * floorFrequency) *
      floorAmplitude

    const detail =
      Math.sin(x * floorFrequency * 3.1) *
      Math.cos(z * floorFrequency * 2.7) *
      floorAmplitude *
      0.25 *
      floorDetail

    return -this.currentBiome.depth + mainWave + detail
  }

  private generateParticles(rng: Rng): void {
    if (this.particles) {
      this.scene.remove(this.particles)
      this.particles.geometry.dispose()
      ;(this.particles.material as THREE.Material).dispose()
    }

    const count = this.currentAmbience.particleCount
    const bounds = this.getBounds()

    this.particlePositions = new Float32Array(count * 3)
    this.particleVelocities = new Float32Array(count * 2)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const i2 = i * 2

      this.particlePositions[i3] = rng.range(-HALF_SIZE, HALF_SIZE)
      this.particlePositions[i3 + 1] = rng.range(bounds.minY, bounds.maxY)
      this.particlePositions[i3 + 2] = rng.range(-HALF_SIZE, HALF_SIZE)

      this.particleVelocities[i2] = rng.range(-0.08, 0.08)
      this.particleVelocities[i2 + 1] = rng.range(-0.16, -0.04)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3),
    )

    const material = new THREE.PointsMaterial({
      color: this.currentAmbience.particleColor,
      size: this.currentAmbience.particleSize,
      transparent: true,
      opacity: this.currentAmbience.particleOpacity,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, material)
    this.particles.frustumCulled = false

    this.scene.add(this.particles)
  }

  public getBounds(): WorldBounds {
    const floorY = -this.currentBiome.depth
    const { floorAmplitude, floorDetail } = this.currentAmbience

    // Altura máxima que puede alcanzar el relieve (las dos ondas coincidiendo)
    const maxRise = floorAmplitude * (1 + 0.25 * floorDetail)
    const bandStart = Math.max(BAND_ABOVE_FLOOR, maxRise + FLOOR_CLEARANCE)

    return {
      halfSize: HALF_SIZE + 5,
      minY: floorY + bandStart,
      maxY: floorY + bandStart + BAND_HEIGHT,
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
        debris.removed = true

        this.debrisGroup.remove(debris.mesh)
        this.debrisList.splice(i, 1)

        this.pollutionRemaining = Math.max(
          0,
          this.pollutionRemaining - debris.pollution,
        )
      }
    }

    if (this.debrisList.length === 0) {
      this.pollutionRemaining = 0
    }

    return collected
  }

  public removeDebris(debris: Debris): void {
    if (debris.removed) return

    debris.removed = true
    this.debrisGroup.remove(debris.mesh)

    const index = this.debrisList.indexOf(debris)

    if (index >= 0) {
      this.debrisList.splice(index, 1)
    }

    this.pollutionRemaining = Math.max(
      0,
      this.pollutionRemaining - debris.pollution,
    )

    if (this.debrisList.length === 0) {
      this.pollutionRemaining = 0
    }
  }

  public getPollutionRatio(): number {
    return this.pollutionTotal > 0
      ? this.pollutionRemaining / this.pollutionTotal
      : 0
  }

  public updateVisuals(deltaTime: number): void {
    const target = this.getPollutionRatio()

    this.visualRatio +=
      (target - this.visualRatio) *
      (1 - Math.exp(-VISUAL_SMOOTHING * deltaTime))

    this.applyVisuals()
    this.updateParticles(deltaTime)
  }

  private updateParticles(deltaTime: number): void {
    if (!this.particles) return

    const bounds = this.getBounds()
    const positions = this.particles.geometry.attributes.position
      .array as Float32Array

    const cleanliness = 1 - this.visualRatio

    for (let i = 0; i < positions.length / 3; i++) {
      const i3 = i * 3
      const i2 = i * 2

      positions[i3] += this.particleVelocities[i2] * deltaTime
      positions[i3 + 1] +=
        this.particleVelocities[i2 + 1] * deltaTime * (0.5 + cleanliness * 0.5)
      positions[i3 + 2] += this.particleVelocities[i2] * deltaTime * 0.6

      if (positions[i3 + 1] < bounds.minY) {
        positions[i3 + 1] = bounds.maxY
      }

      if (positions[i3] < -HALF_SIZE) positions[i3] = HALF_SIZE
      if (positions[i3] > HALF_SIZE) positions[i3] = -HALF_SIZE

      if (positions[i3 + 2] < -HALF_SIZE) positions[i3 + 2] = HALF_SIZE
      if (positions[i3 + 2] > HALF_SIZE) positions[i3 + 2] = -HALF_SIZE
    }

    this.particles.geometry.attributes.position.needsUpdate = true

    const material = this.particles.material as THREE.PointsMaterial

    material.opacity =
      this.currentAmbience.particleOpacity * (0.35 + this.visualRatio * 0.65)
  }

  private applyVisuals(): void {
    const fog = this.scene.fog as THREE.FogExp2
    const ratio = this.visualRatio

    this.waterColor
      .copy(this.baseColor)
      .lerp(WHITE, (1 - ratio) * CLEAN_BRIGHTEN)

    fog.color.copy(this.waterColor)

    fog.density =
      this.currentBiome.fogDensity *
      (CLEAN_FOG_FACTOR + (1 - CLEAN_FOG_FACTOR) * ratio)
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
