import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { Rng } from "@core/rng"
import type { WorldBounds } from "@core/types"
import { EnemyManager } from "./EnemyManager"

const BOUNDS: WorldBounds = {
  halfSize: 20,
  minY: -10,
  maxY: 10,
}

function createManager(): {
  scene: THREE.Scene
  manager: EnemyManager
} {
  const scene = new THREE.Scene()
  return { scene, manager: new EnemyManager(scene) }
}

describe("EnemyManager", () => {
  it("genera medusas dentro de los bounds y lejos del centro", () => {
    const { scene, manager } = createManager()

    manager.spawn(5, BOUNDS, new Rng(42))

    expect(manager.getCount()).toBe(5)
    expect(scene.children).toHaveLength(5)

    for (const child of scene.children) {
      const position = child.position
      expect(Math.abs(position.x)).toBeLessThanOrEqual(BOUNDS.halfSize)
      expect(Math.abs(position.z)).toBeLessThanOrEqual(BOUNDS.halfSize)
      expect(position.y).toBeGreaterThanOrEqual(BOUNDS.minY)
      expect(position.y).toBeLessThanOrEqual(BOUNDS.maxY)
      expect(Math.hypot(position.x, position.z)).toBeGreaterThanOrEqual(10)
    }
  })

  it("detecta el impacto, activa el cooldown y lo recupera", () => {
    const { scene, manager } = createManager()
    manager.spawn(1, BOUNDS, new Rng(7))

    const jellyfish = scene.children[0] as THREE.Group
    const dome = jellyfish.children[0] as THREE.Mesh
    const material = dome.material as THREE.MeshPhysicalMaterial

    // Primer update con la tortuga lejos para fijar la posición de la medusa.
    manager.update(0, 0, new THREE.Vector3(999, 999, 999), BOUNDS)
    const position = jellyfish.position.clone()

    expect(manager.update(0, 0, position, BOUNDS)).toBe(true)
    expect(manager.getCount()).toBe(1)
    expect(material.opacity).toBeCloseTo(0.08)
    expect(manager.update(0, 0, position, BOUNDS)).toBe(false)

    // Al agotarse el cooldown vuelve a ser peligrosa y recupera su opacidad.
    manager.update(3.1, 3.1, new THREE.Vector3(999, 999, 999), BOUNDS)
    expect(material.opacity).toBeCloseTo(0.6)

    const currentPosition = jellyfish.position.clone()
    expect(manager.update(0, 3.1, currentPosition, BOUNDS)).toBe(true)
  })

  it("limita las posiciones al cambiar de bounds", () => {
    const { scene, manager } = createManager()
    manager.spawn(1, BOUNDS, new Rng(11))

    const jellyfish = scene.children[0] as THREE.Group
    const smallBounds: WorldBounds = { halfSize: 2, minY: -1, maxY: 1 }

    manager.update(0, 1, new THREE.Vector3(999, 999, 999), smallBounds)

    expect(Math.abs(jellyfish.position.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(jellyfish.position.z)).toBeLessThanOrEqual(2)
    expect(jellyfish.position.y).toBeGreaterThanOrEqual(-1)
    expect(jellyfish.position.y).toBeLessThanOrEqual(1)
  })

  it("limpia y reemplaza la generación anterior", () => {
    const { scene, manager } = createManager()

    manager.spawn(3, BOUNDS, new Rng(1))
    manager.spawn(2, BOUNDS, new Rng(2))

    expect(manager.getCount()).toBe(2)
    expect(scene.children).toHaveLength(2)

    manager.clear()

    expect(manager.getCount()).toBe(0)
    expect(scene.children).toHaveLength(0)
  })
})
