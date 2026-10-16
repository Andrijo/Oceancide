// src/BiomeGenerator.ts
import * as THREE from "three"
import {
  BIOMES,
  type BiomeConfig,
  type BiomeKey,
  type WorldBounds,
} from "@core/types"
import { BiomeProps } from "./BiomeProps"
import { WaterEffects, getSoftDot } from "./WaterEffects"
import { Debris } from "@entities/Debris"
import type { Rng } from "@core/rng"

const WHITE = new THREE.Color(1, 1, 1)
const CLEAN_FOG_FACTOR = 0.55
const CLEAN_BRIGHTEN = 0.15
const VISUAL_SMOOTHING = 2

const HALF_SIZE = 60
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

// Luz solar por bioma: se apaga con la profundidad (desde el bioma 5 solo luz ambiental y bioluminiscencia).

const MAX_SUN_INTENSITY = 1.3

const SUN: Record<BiomeKey, { intensity: number; color: number }> = {
  epipelagic_upper: { intensity: 1.3, color: 0xe8fbff },
  pelagic_mid: { intensity: 0.9, color: 0xbfe8ff },
  subphotic: { intensity: 0.45, color: 0x9cc8ff },
  mesopelagic_upper: { intensity: 0.15, color: 0x8888ff },
  mesopelagic_deep: { intensity: 0, color: 0x000000 },
  bathypelagic_upper: { intensity: 0, color: 0x000000 },
  bathypelagic_deep: { intensity: 0, color: 0x000000 },
  abyssopelagic: { intensity: 0, color: 0x000000 },
  hadopelagic: { intensity: 0, color: 0x000000 },
  deepSea: { intensity: 0, color: 0x000000 },
}

/** Intensidad de las cáusticas sobre el suelo (solo donde llega la luz). */
const CAUSTICS: Partial<Record<BiomeKey, number>> = {
  epipelagic_upper: 0.9,
  pelagic_mid: 0.55,
  subphotic: 0.2,
}

// Ruido de valor (relieve del suelo)

function hash(x: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Devuelve un valor en [-1, 1], continuo y determinista. */
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)

  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)

  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

export class BiomeGenerator {
  private scene: THREE.Scene
  private currentBiome: BiomeConfig
  private currentAmbience: BiomeAmbience
  private currentBiomeKey: BiomeKey = "epipelagic_upper"
  private props: BiomeProps
  private water: WaterEffects

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
  private lastAppliedRatio = -1 // para evitar recalcular niebla/fog cada frame

  private particlePositions: Float32Array = new Float32Array(0)
  private particleVelocities: Float32Array = new Float32Array(0)

  // Caché de bounds: se invalida al cambiar de bioma
  private cachedBounds: WorldBounds | null = null

  // Cáusticas: uniforms compartidos con el shader del suelo
  private causticUniforms = {
    uTime: { value: 0 },
    uStrength: { value: 0 },
  }
  private causticBase = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.currentBiome = BIOMES.epipelagic_upper
    this.currentAmbience = BIOME_AMBIENCE.epipelagic_upper
    this.props = new BiomeProps(scene)
    this.water = new WaterEffects(scene)

    this.debrisGroup = new THREE.Group()
    scene.add(this.debrisGroup)

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1)
    this.hemisphereLight = new THREE.HemisphereLight(0xbfe9ff, 0x0b1a22, 0.7)

    scene.add(this.ambientLight)
    scene.add(this.hemisphereLight)
  }

  public generateBiome(biomeKey: BiomeKey, rng: Rng, loop = 0): void {
    // Liberar recursos del bioma anterior antes de reemplazarlos
    this.disposeDebris()
    this.disposeFloor()
    this.disposeParticles()

    const base = BIOMES[biomeKey]
    this.currentBiome = {
      ...base,
      toxicityRate: base.toxicityRate * (1 + 1.0 * loop),
      fogDensity: base.fogDensity * (1 + 0.2 * loop),
      debrisDensity: base.debrisDensity * (1 + 0.3 * loop),
    }
    this.currentAmbience = BIOME_AMBIENCE[biomeKey]
    this.currentBiomeKey = biomeKey
    this.causticBase = CAUSTICS[biomeKey] ?? 0

    this.baseColor.setRGB(...this.currentBiome.waterColor)

    // El fondo se asigna como copia para no compartir referencia mutable
    this.waterColor.copy(this.baseColor)
    this.scene.background = this.waterColor.clone()

    this.scene.fog = new THREE.FogExp2(
      this.baseColor.clone(),
      this.currentBiome.fogDensity,
    )

    this.visualRatio = 1
    this.lastAppliedRatio = -1 // forzar primer applyVisuals
    this.applyVisuals()
    this.applyLighting()

    // Invalidar caché de bounds al cambiar de bioma
    this.cachedBounds = null

    const bounds = this.getBounds()

    this.water.setBiome({
      sunNorm: SUN[biomeKey].intensity / MAX_SUN_INTENSITY,
      snowColor: this.currentAmbience.particleColor,
      snowOpacity: this.currentAmbience.particleOpacity,
      topY: bounds.maxY + 25,
    })

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

  public getFloorHeight(x: number, z: number): number {
    return -this.currentBiome.depth + this.floorOffset(x, z)
  }

  // Bounds con caché

  public getBounds(): WorldBounds {
    if (this.cachedBounds) return this.cachedBounds

    const floorY = -this.currentBiome.depth
    const { floorAmplitude, floorDetail } = this.currentAmbience

    // Altura máxima que puede alcanzar el relieve (las dos ondas coincidiendo)
    const maxRise = floorAmplitude * (1 + 0.25 * floorDetail)
    const bandStart = Math.max(BAND_ABOVE_FLOOR, maxRise + FLOOR_CLEARANCE)

    this.cachedBounds = {
      halfSize: HALF_SIZE + 5,
      minY: floorY + bandStart,
      maxY: floorY + bandStart + BAND_HEIGHT,
    }

    return this.cachedBounds
  }

  // Debris

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

      if (debris.removed) {
        this.debrisList.splice(i, 1)
        continue
      }

      if (debris.mesh.position.distanceTo(turtlePosition) < collectionRadius) {
        collected.push(debris)
        this.removeDebrisInternal(debris, i)
      }
    }

    if (this.debrisList.length === 0) {
      this.pollutionRemaining = 0
    }

    return collected
  }

  /** Elimina un debris del bioma sin dispose (materiales compartidos); solo lo quita y actualiza la contaminación. */
  public removeDebris(debris: Debris): void {
    if (debris.removed) return

    const index = this.debrisList.indexOf(debris)
    if (index < 0) {
      // El debris ya no pertenece a este bioma; solo marcamos
      debris.removed = true
      return
    }

    this.removeDebrisInternal(debris, index)
  }

  public getPollutionRatio(): number {
    return this.pollutionTotal > 0
      ? this.pollutionRemaining / this.pollutionTotal
      : 0
  }

  // Visuals

  public updateVisuals(deltaTime: number): void {
    const target = this.getPollutionRatio()

    this.visualRatio +=
      (target - this.visualRatio) *
      (1 - Math.exp(-VISUAL_SMOOTHING * deltaTime))

    // Solo recalcular niebla/fog si el ratio cambió de forma apreciable
    if (Math.abs(this.visualRatio - this.lastAppliedRatio) > 0.001) {
      this.applyVisuals()
      this.lastAppliedRatio = this.visualRatio
    }

    // Cáusticas: avanzan con el tiempo y se marcan más cuanto más limpia está el agua
    this.causticUniforms.uTime.value += deltaTime
    this.causticUniforms.uStrength.value =
      this.causticBase * (0.4 + 0.6 * (1 - this.visualRatio))

    this.updateParticles(deltaTime)
  }

  /** Efectos del volumen de agua; llamar cada frame. Con deltaTime = 0 la animación se congela. */
  public updateWater(deltaTime: number, cameraPosition: THREE.Vector3): void {
    this.water.update(deltaTime, cameraPosition, 1 - this.visualRatio)
  }

  // Accesores

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

  /** Sol del bioma actual; `darkness` (0..1) es cuánta luz solar falta. */
  public getSun(): { intensity: number; color: number; darkness: number } {
    const sun = SUN[this.currentBiomeKey]
    return {
      intensity: sun.intensity,
      color: sun.color,
      darkness: 1 - sun.intensity / MAX_SUN_INTENSITY,
    }
  }

  /** Libera todos los recursos del bioma actual. Llamar al destruir el juego. */
  public dispose(): void {
    this.disposeDebris()
    this.disposeFloor()
    this.disposeParticles()
    this.props.clear()
    this.water.dispose()
  }

  // Dispose de recursos

  private disposeDebris(): void {
    for (const debris of this.debrisList) {
      debris.dispose()
    }
    this.debrisGroup.clear()
    this.debrisList = []
  }

  private disposeFloor(): void {
    if (!this.floor) return

    this.scene.remove(this.floor)
    this.floor.geometry.dispose()
    ;(this.floor.material as THREE.Material).dispose()
    this.floor = undefined
  }

  private disposeParticles(): void {
    if (!this.particles) return

    this.scene.remove(this.particles)
    this.particles.geometry.dispose()
    ;(this.particles.material as THREE.Material).dispose()
    this.particles = undefined
  }

  // Luces

  private applyLighting(): void {
    if (!this.ambientLight || !this.hemisphereLight) return

    this.ambientLight.intensity = this.currentAmbience.ambientLight
    this.ambientLight.color.set(this.currentAmbience.lightColor)

    this.hemisphereLight.intensity = this.currentAmbience.ambientLight * 0.65
    this.hemisphereLight.color.set(this.currentAmbience.lightColor)
    // El "suelo" de la hemisférica toma el tono del agua en vez de un azul fijo
    this.hemisphereLight.groundColor.copy(this.baseColor).multiplyScalar(0.25)
  }

  // Terreno

  /** Desplazamiento vertical del relieve respecto a la profundidad base (fuente única para malla y getFloorHeight). */
  private floorOffset(x: number, z: number): number {
    const {
      floorAmplitude: amp,
      floorFrequency: f,
      floorDetail: detail,
    } = this.currentAmbience

    const base =
      valueNoise(x * f * 0.32, z * f * 0.32) * 0.65 +
      valueNoise(x * f * 0.7 + 31, z * f * 0.7 - 17) * 0.35

    const fine = valueNoise(x * f * 1.1 - 7, z * f * 1.1 + 53)

    return amp * base + amp * 0.25 * detail * fine
  }

  private generateTerrain(): void {
    this.disposeFloor()

    const geometry = new THREE.PlaneGeometry(220, 220, 80, 80)
    const positions = geometry.attributes.position.array as Float32Array

    const { floorAmplitude, floorDetail } = this.currentAmbience
    const maxRise = floorAmplitude * (1 + 0.25 * floorDetail)

    const baseColor = new THREE.Color(...this.currentBiome.floorColor)
    const tint = new THREE.Color()
    const colors = new Float32Array(positions.length)

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      // La malla se rota -π/2 en X: el eje Y local del plano es -Z en el mundo
      const z = -positions[i + 1]
      const h = this.floorOffset(x, z)

      positions[i + 2] = h

      // Valles más oscuros, crestas más claras
      const t = THREE.MathUtils.clamp((h / maxRise) * 0.5 + 0.5, 0, 1)
      tint.copy(baseColor).multiplyScalar(0.65 + 0.55 * t)
      colors[i] = tint.r
      colors[i + 1] = tint.g
      colors[i + 2] = tint.b
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // el color real viene de los vértices
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
    })

    this.applyCaustics(material)

    this.floor = new THREE.Mesh(geometry, material)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.y = -this.currentBiome.depth

    this.scene.add(this.floor)
  }

  /** Inyecta cáusticas animadas (luz ondulante) en el material del suelo. */
  private applyCaustics(material: THREE.MeshStandardMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.causticUniforms.uTime
      shader.uniforms.uStrength = this.causticUniforms.uStrength

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vWPos;
          uniform float uTime;
          uniform float uStrength;

          float caustic(vec2 uv, float time) {
            const float TAU = 6.28318530718;
            vec2 p = mod(uv * TAU, TAU) - 250.0;
            vec2 i = p;
            float c = 1.0;
            const float inten = 0.005;
            for (int n = 0; n < 5; n++) {
              float t = time * (1.0 - (3.5 / float(n + 1)));
              i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
              c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
            }
            c /= 5.0;
            c = 1.17 - pow(c, 1.4);
            return pow(abs(c), 8.0);
          }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.65, 0.95, 1.0)
            * caustic(vWPos.xz * 0.04, uTime * 0.6) * uStrength;`,
        )
    }
  }

  // Particulas

  private generateParticles(rng: Rng): void {
    this.disposeParticles()

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
      map: getSoftDot(), // sprite circular suave (los puntos por defecto son cuadrados)
      size: this.currentAmbience.particleSize * 3.5, // con el sprite suave hay que subirlo
      transparent: true,
      opacity: this.currentAmbience.particleOpacity,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.particles = new THREE.Points(geometry, material)
    this.particles.frustumCulled = false

    this.scene.add(this.particles)
  }

  private removeDebrisInternal(debris: Debris, index: number): void {
    debris.removed = true

    this.debrisGroup.remove(debris.mesh)
    this.debrisList.splice(index, 1)

    this.pollutionRemaining = Math.max(
      0,
      this.pollutionRemaining - debris.pollution,
    )

    if (this.debrisList.length === 0) {
      this.pollutionRemaining = 0
    }
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

    // Actualizar el fondo sin compartir referencia con waterColor
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.waterColor)
    } else {
      this.scene.background = this.waterColor.clone()
    }

    // La cúpula, la viñeta y la niebla comparten el mismo color de agua
    this.water.setWaterColor(this.waterColor)

    fog.density =
      this.currentBiome.fogDensity *
      (CLEAN_FOG_FACTOR + (1 - CLEAN_FOG_FACTOR) * ratio)
  }
}
