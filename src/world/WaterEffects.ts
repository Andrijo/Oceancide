// src/world/WaterEffects.ts
// Efectos del volumen de agua (lo que hay ENTRE la cámara y el fondo):
//  - Cúpula con gradiente (más clara arriba, más oscura abajo, brillo del sol).
//  - Niebla con absorción por canal (el rojo se pierde antes que el azul).
//  - Rayos de luz que bajan desde la superficie (solo donde llega el sol).
//  - Nieve marina pegada a la cámara (da parallax y sensación de medio).
//  - Viñeta tintada con el color del agua.

import * as THREE from "three"

/** Dirección hacia el sol. Game la usa también para colocar la luz direccional. */
export const SUN_DIRECTION = new THREE.Vector3(0.28, 0.93, 0.19).normalize()

const SNOW_COUNT = 700
const SNOW_FIELD = 36 // lado del cubo de nieve marina centrado en la cámara
const SHAFT_COUNT = 16
const SHAFT_RANGE = 40 // semilado del área donde viven los rayos
const SHAFT_LENGTH = 90
const SHAFT_OPACITY = 0.08
const LIGHT = new THREE.Color(0.75, 0.95, 1)

// Niebla con absorción por canal

let absorptionInstalled = false

/** Sustituye el chunk de niebla de three para atenuar cada canal a distinta velocidad. */
export function installAbsorptionFog(): void {
  if (absorptionInstalled) return
  absorptionInstalled = true

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogDist = fogDensity * fogDensity * vFogDepth * vFogDepth;
    vec3 fogAmount = clamp(1.0 - exp(-fogDist * vec3(1.55, 1.0, 0.8)), 0.0, 1.0);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogAmount);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif
#endif`
}

// Sprite circular suave (compartido)

let softDot: THREE.CanvasTexture | null = null

export function getSoftDot(): THREE.CanvasTexture {
  if (softDot) return softDot

  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 64

  const ctx = canvas.getContext("2d")!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, "rgba(255,255,255,1)")
  gradient.addColorStop(0.4, "rgba(255,255,255,0.35)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  softDot = new THREE.CanvasTexture(canvas)
  return softDot
}

/** Rayo: degradado horizontal suave, que se desvanece hacia abajo. */
function createShaftTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 256

  const ctx = canvas.getContext("2d")!

  const horizontal = ctx.createLinearGradient(0, 0, 64, 0)
  horizontal.addColorStop(0, "rgba(255,255,255,0)")
  horizontal.addColorStop(0.5, "rgba(255,255,255,1)")
  horizontal.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = horizontal
  ctx.fillRect(0, 0, 64, 256)

  ctx.globalCompositeOperation = "destination-in"
  const vertical = ctx.createLinearGradient(0, 0, 0, 256)
  vertical.addColorStop(0, "rgba(255,255,255,1)")
  vertical.addColorStop(0.35, "rgba(255,255,255,0.55)")
  vertical.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = vertical
  ctx.fillRect(0, 0, 64, 256)

  return new THREE.CanvasTexture(canvas)
}

/** Envuelve `value` en un intervalo de ancho 2*half centrado en `center`. */
function wrap(value: number, center: number, half: number): number {
  const size = half * 2
  const rel = ((((value - center + half) % size) + size) % size) - half
  return center + rel
}

export interface WaterBiomeParams {
  /** 0 = sin sol, 1 = sol máximo (epipelágico). */
  sunNorm: number
  snowColor: number
  snowOpacity: number
  /** Altura desde la que "cuelgan" los rayos. */
  topY: number
}

type ShaftData = { x: number; z: number; phase: number; width: number }

export class WaterEffects {
  private dome: THREE.Mesh
  private domeMaterial: THREE.ShaderMaterial

  private snow: THREE.Points
  private snowPositions: Float32Array

  private shafts: THREE.InstancedMesh
  private shaftTexture: THREE.CanvasTexture
  private shaftData: ShaftData[] = []
  private shaftQuatA = new THREE.Quaternion()
  private shaftQuatB = new THREE.Quaternion()

  private vignette: HTMLDivElement

  private horizon = new THREE.Color()
  private sunNorm = 0
  private topY = 0
  private clean = 0
  private time = 0

  private tmpMatrix = new THREE.Matrix4()
  private tmpPos = new THREE.Vector3()
  private tmpScale = new THREE.Vector3()
  private tmpColor = new THREE.Color()

  constructor(scene: THREE.Scene) {
    installAbsorptionFog()

    // --- Cúpula con gradiente ---
    this.domeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: new THREE.Color() },
        uZenith: { value: new THREE.Color() },
        uNadir: { value: new THREE.Color() },
        uSunDir: { value: SUN_DIRECTION.clone() },
        uSunColor: { value: LIGHT.clone() },
        uSun: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uNadir;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSun;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 col = uHorizon;
          col = mix(col, uZenith, smoothstep(0.0, 0.9, d.y));
          col = mix(col, uNadir, smoothstep(0.0, 0.8, -d.y));
          float s = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(s, 6.0) * 0.30 + pow(s, 40.0) * 0.45) * uSun;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(500, 24, 16),
      this.domeMaterial,
    )
    this.dome.frustumCulled = false
    this.dome.renderOrder = -1000
    scene.add(this.dome)

    // --- Nieve marina cercana ---
    this.snowPositions = new Float32Array(SNOW_COUNT * 3)
    for (let i = 0; i < this.snowPositions.length; i++) {
      this.snowPositions[i] = (Math.random() - 0.5) * SNOW_FIELD
    }

    const snowGeometry = new THREE.BufferGeometry()
    snowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.snowPositions, 3),
    )

    this.snow = new THREE.Points(
      snowGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        map: getSoftDot(),
        size: 0.2,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    )
    this.snow.frustumCulled = false
    scene.add(this.snow)

    // --- Rayos de luz (InstancedMesh: 2 planos cruzados por rayo) ---
    this.shaftTexture = createShaftTexture()

    const shaftGeometry = new THREE.PlaneGeometry(1, SHAFT_LENGTH)
    shaftGeometry.translate(0, -SHAFT_LENGTH / 2, 0) // el origen queda arriba

    const shaftMaterial = new THREE.MeshBasicMaterial({
      map: this.shaftTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })

    this.shafts = new THREE.InstancedMesh(
      shaftGeometry,
      shaftMaterial,
      SHAFT_COUNT * 2,
    )
    this.shafts.frustumCulled = false
    this.shafts.visible = false
    this.shafts.renderOrder = 1

    for (let i = 0; i < SHAFT_COUNT; i++) {
      this.shaftData.push({
        x: (Math.random() - 0.5) * SHAFT_RANGE * 2,
        z: (Math.random() - 0.5) * SHAFT_RANGE * 2,
        phase: Math.random() * Math.PI * 2,
        width: 5 + Math.random() * 8,
      })
    }

    // Eje largo del rayo (-Y local) alineado con la luz, que viaja alejándose del sol
    const lightDir = SUN_DIRECTION.clone().negate()
    this.shaftQuatA.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lightDir)
    this.shaftQuatB
      .copy(this.shaftQuatA)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI / 2,
        ),
      )

    scene.add(this.shafts)

    // --- Viñeta (DOM) ---
    // Se inserta primero en el contenedor: queda sobre el canvas pero bajo el HUD.
    this.vignette = document.createElement("div")
    this.vignette.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
    `
    const container = document.getElementById("game-container")!
    container.insertBefore(this.vignette, container.firstChild)
  }

  /** Configura los efectos para un bioma nuevo. */
  public setBiome(params: WaterBiomeParams): void {
    this.sunNorm = THREE.MathUtils.clamp(params.sunNorm, 0, 1)
    this.topY = params.topY

    const snow = this.snow.material as THREE.PointsMaterial
    snow.color.set(params.snowColor)
    snow.opacity = THREE.MathUtils.clamp(
      params.snowOpacity * 1.6 + 0.12,
      0,
      0.7,
    )

    this.domeMaterial.uniforms.uSun.value = this.sunNorm
    this.refreshColors()
  }

  /** Color del agua (el mismo que la niebla). Cambia al limpiar el bioma. */
  public setWaterColor(color: THREE.Color): void {
    this.horizon.copy(color)
    this.refreshColors()
  }

  /** @param cleanliness 0 = contaminado, 1 = limpio; los rayos se marcan más con agua limpia. */
  public update(
    deltaTime: number,
    cameraPosition: THREE.Vector3,
    cleanliness: number,
  ): void {
    this.time += deltaTime
    this.clean = cleanliness

    this.dome.position.copy(cameraPosition)
    this.updateSnow(deltaTime, cameraPosition)
    this.updateShafts(cameraPosition)
  }

  public dispose(): void {
    this.dome.removeFromParent()
    this.dome.geometry.dispose()
    this.domeMaterial.dispose()

    this.snow.removeFromParent()
    this.snow.geometry.dispose()
    ;(this.snow.material as THREE.Material).dispose()

    this.shafts.removeFromParent()
    this.shafts.geometry.dispose()
    ;(this.shafts.material as THREE.Material).dispose()
    this.shaftTexture.dispose()

    this.vignette.remove()
  }

  private refreshColors(): void {
    const lit = this.horizon.clone().lerp(LIGHT, 0.5).multiplyScalar(1.1)
    const dim = this.horizon.clone().multiplyScalar(0.8)
    const zenith = dim.lerp(lit, this.sunNorm)
    const nadir = this.horizon.clone().multiplyScalar(0.5)

    this.domeMaterial.uniforms.uHorizon.value.copy(this.horizon)
    this.domeMaterial.uniforms.uZenith.value.copy(zenith)
    this.domeMaterial.uniforms.uNadir.value.copy(nadir)

    const edge = this.horizon.clone().multiplyScalar(0.18).getStyle()
    const rgba = edge.replace("rgb(", "rgba(").replace(")", ", 0.62)")
    this.vignette.style.background = `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 48%, ${rgba} 100%)`
  }

  private updateSnow(deltaTime: number, camera: THREE.Vector3): void {
    const pos = this.snowPositions
    const half = SNOW_FIELD / 2
    const t = this.time

    for (let i = 0; i < SNOW_COUNT; i++) {
      const k = i * 3

      pos[k] += Math.sin(t * 0.3 + i) * 0.18 * deltaTime
      pos[k + 1] -= (0.12 + (i % 7) * 0.02) * deltaTime
      pos[k + 2] += Math.cos(t * 0.25 + i * 1.3) * 0.18 * deltaTime

      pos[k] = wrap(pos[k], camera.x, half)
      pos[k + 1] = wrap(pos[k + 1], camera.y, half)
      pos[k + 2] = wrap(pos[k + 2], camera.z, half)
    }

    this.snow.geometry.attributes.position.needsUpdate = true
  }

  private updateShafts(camera: THREE.Vector3): void {
    const strength = SHAFT_OPACITY * this.sunNorm * (0.5 + 0.5 * this.clean)

    if (strength < 0.004) {
      this.shafts.visible = false
      return
    }

    this.shafts.visible = true
    ;(this.shafts.material as THREE.MeshBasicMaterial).opacity = strength

    for (let k = 0; k < SHAFT_COUNT; k++) {
      const s = this.shaftData[k]

      const x = wrap(s.x, camera.x, SHAFT_RANGE)
      const z = wrap(s.z, camera.z, SHAFT_RANGE)

      const dist = Math.hypot(x - camera.x, z - camera.z)
      const fade =
        1 - THREE.MathUtils.smoothstep(dist, SHAFT_RANGE * 0.5, SHAFT_RANGE)
      const pulse = 0.65 + 0.35 * Math.sin(this.time * 0.5 + s.phase)
      const sway = 1 + 0.15 * Math.sin(this.time * 0.3 + s.phase * 1.7)

      this.tmpPos.set(x, this.topY, z)
      this.tmpScale.set(s.width * sway, 1, 1)
      const v = fade * pulse
      this.tmpColor.setRGB(v, v, v)

      for (let side = 0; side < 2; side++) {
        const index = k * 2 + side
        this.tmpMatrix.compose(
          this.tmpPos,
          side === 0 ? this.shaftQuatA : this.shaftQuatB,
          this.tmpScale,
        )
        this.shafts.setMatrixAt(index, this.tmpMatrix)
        this.shafts.setColorAt(index, this.tmpColor)
      }
    }

    this.shafts.instanceMatrix.needsUpdate = true
    if (this.shafts.instanceColor) this.shafts.instanceColor.needsUpdate = true
  }
}
