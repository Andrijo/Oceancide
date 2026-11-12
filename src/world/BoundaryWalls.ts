// src/world/BoundaryWalls.ts
import * as THREE from "three"
import type { WorldBounds } from "@core/types"
import { wallOpacity } from "@ui/offscreenIndicators"

const GRID_CELLS = 8
const WHITE = new THREE.Color(1, 1, 1)

function createGridTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = "rgba(180, 235, 255, 0.9)"
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

interface Wall {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  /** Distancia del jugador a este muro (>= 0 dentro del bioma). */
  distance: (p: THREE.Vector3, b: WorldBounds) => number
}

/**
 * Mallas translúcidas en los límites del bioma que aparecen al acercarse.
 * Avisan antes de que la tortuga se quede pegada contra una pared invisible.
 */
export class BoundaryWalls {
  private readonly group = new THREE.Group()
  private readonly walls: Wall[] = []
  private readonly texture = createGridTexture()
  private readonly geometry = new THREE.PlaneGeometry(1, 1)
  private bounds: WorldBounds | null = null
  private readonly tint = new THREE.Color()

  private readonly scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.group.visible = false
    this.group.renderOrder = 10
    const defs: {
      rot: [number, number, number]
      distance: Wall["distance"]
    }[] = [
      { rot: [0, Math.PI / 2, 0], distance: (p, b) => b.halfSize - p.x }, // +x
      { rot: [0, -Math.PI / 2, 0], distance: (p, b) => p.x + b.halfSize }, // -x
      { rot: [0, Math.PI, 0], distance: (p, b) => b.halfSize - p.z }, // +z
      { rot: [0, 0, 0], distance: (p, b) => p.z + b.halfSize }, // -z
      { rot: [Math.PI / 2, 0, 0], distance: (p, b) => b.maxY - p.y }, // techo
      { rot: [-Math.PI / 2, 0, 0], distance: (p, b) => p.y - b.minY }, // fondo
    ]
    for (const def of defs) {
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        color: 0x9be7ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      })
      const mesh = new THREE.Mesh(this.geometry, material)
      mesh.rotation.set(...def.rot)
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.walls.push({ mesh, material, distance: def.distance })
    }
    scene.add(this.group)
  }

  public setBounds(
    bounds: WorldBounds,
    water: readonly [number, number, number],
  ): void {
    this.bounds = bounds
    // Tinte cercano al agua del bioma para que la malla se funda con la niebla.
    this.tint.setRGB(water[0], water[1], water[2]).lerp(WHITE, 0.3)
    for (const wall of this.walls) wall.material.color.copy(this.tint)
    const side = bounds.halfSize * 2
    const height = bounds.maxY - bounds.minY
    const midY = (bounds.minY + bounds.maxY) / 2
    const [px, nx, pz, nz, top, bottom] = this.walls
    px.mesh.position.set(bounds.halfSize, midY, 0)
    nx.mesh.position.set(-bounds.halfSize, midY, 0)
    pz.mesh.position.set(0, midY, bounds.halfSize)
    nz.mesh.position.set(0, midY, -bounds.halfSize)
    top.mesh.position.set(0, bounds.maxY, 0)
    bottom.mesh.position.set(0, bounds.minY, 0)
    for (const wall of [px, nx, pz, nz]) wall.mesh.scale.set(side, height, 1)
    for (const wall of [top, bottom]) wall.mesh.scale.set(side, side, 1)
    // Repetición de la rejilla acorde al tamaño del muro.
    this.texture.repeat.set(GRID_CELLS * 2, GRID_CELLS)
  }

  public update(playerPosition: THREE.Vector3): void {
    if (!this.bounds) return
    let any = false
    for (const wall of this.walls) {
      const opacity = wallOpacity(wall.distance(playerPosition, this.bounds))
      wall.material.opacity = opacity
      wall.mesh.visible = opacity > 0.001
      if (wall.mesh.visible) any = true
    }
    this.group.visible = any
  }

  public dispose(): void {
    this.scene.remove(this.group)
    this.geometry.dispose()
    this.texture.dispose()
    for (const wall of this.walls) wall.material.dispose()
  }
}
