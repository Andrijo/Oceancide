import { describe, expect, it } from "vitest"
import * as THREE from "three"
import type { InputState, WorldBounds } from "@core/types"
import { Turtle } from "./Turtle"

const BOUNDS: WorldBounds = {
  halfSize: 65,
  minY: -12,
  maxY: 8,
}

const FORWARD: InputState = {
  forward: true,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  boost: false,
  moveX: 0,
  moveY: 0,
  vertical: 0,
}

const IDLE: InputState = {
  ...FORWARD,
  forward: false,
}

function createTurtle(): Turtle {
  const turtle = new Turtle()
  turtle.reset(new THREE.Vector3(0, 0, 0))
  return turtle
}

describe("Turtle.applySlow", () => {
  it("reduce la velocidad máxima durante la ralentización", () => {
    const normal = createTurtle()
    const slowed = createTurtle()

    slowed.applySlow(2, 0.5)
    normal.update(0.1, FORWARD, BOUNDS)
    slowed.update(0.1, FORWARD, BOUNDS)

    expect(slowed.getSpeed()).toBeLessThan(normal.getSpeed() * 0.6)
  })

  it("recupera la velocidad al terminar el efecto", () => {
    const turtle = createTurtle()

    turtle.applySlow(0.2, 0.5)
    turtle.update(0.1, FORWARD, BOUNDS)
    const slowedSpeed = turtle.getSpeed()

    turtle.update(0.11, IDLE, BOUNDS)
    turtle.update(0.5, FORWARD, BOUNDS)

    expect(turtle.getSpeed()).toBeGreaterThan(slowedSpeed * 2)
  })

  it("se limpia al hacer reset", () => {
    const normal = createTurtle()
    const reset = createTurtle()

    reset.applySlow(2, 0.5)
    reset.reset(new THREE.Vector3(0, 0, 0))

    normal.update(0.1, FORWARD, BOUNDS)
    reset.update(0.1, FORWARD, BOUNDS)

    expect(reset.getSpeed()).toBeCloseTo(normal.getSpeed())
  })
})

describe("Turtle.playHurt", () => {
  it("produce un retroceso y un flash que se apagan solos", () => {
    const turtle = createTurtle()
    const model = turtle.mesh.children[0] as THREE.Group
    const body = model.children[0] as THREE.Group
    const shellMaterial = (body.children[0] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial

    turtle.playHurt()
    turtle.update(0.016, IDLE, BOUNDS)

    expect(body.position.z).toBeLessThan(0)
    expect(body.rotation.x).toBeGreaterThan(0.1)
    expect(shellMaterial.emissiveIntensity).toBeGreaterThan(0)

    turtle.update(0.5, IDLE, BOUNDS)

    expect(body.position.z).toBeCloseTo(0)
    expect(body.rotation.z).toBeCloseTo(0)
    expect(shellMaterial.emissiveIntensity).toBe(0)
  })
})
