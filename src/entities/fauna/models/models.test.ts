import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { Rng } from "@core/rng"
import { animateLook, type CreatureLook } from "../look"
import { buildModel, MODEL_KINDS } from "./index"
import { Jellyfish } from "../../Enemy"
import { leviathan, netKraken, scrapShark } from "./bosses"
import { fin, ModelKit } from "./kit"

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) out.push(object as THREE.Mesh)
  })
  return out
}

function animated(look: CreatureLook): THREE.Object3D[] {
  return [
    ...look.tail,
    ...look.fins,
    ...look.wings,
    ...look.tentacles,
    ...look.legs,
    ...look.claws,
  ]
}

describe("modelos de la fauna", () => {
  it("cada especie tiene modelo propio dentro del presupuesto de la tortuga", () => {
    for (const kind of MODEL_KINDS) {
      const look = buildModel(kind, new Rng(1))
      const list = meshes(look.root)
      // La tortuga son 17 mallas: la fauna no debe pasar de ahí por mucho.
      expect(list.length, kind).toBeGreaterThanOrEqual(5)
      expect(list.length, kind).toBeLessThanOrEqual(20)
      // Estilo de la tortuga: cuerpo facetado y ojos lisos y brillantes.
      expect(look.bodyMaterial.flatShading, kind).toBe(true)
      expect(look.accentMaterial.flatShading, kind).toBe(true)
      look.dispose()
    }
  })

  it("todas se animan: algo se mueve respecto a la pose de reposo", () => {
    for (const kind of MODEL_KINDS) {
      const look = buildModel(kind, new Rng(2))
      const parts = animated(look)
      expect(parts.length, kind).toBeGreaterThan(0)
      for (let i = 0; i < 20; i++) {
        animateLook(look, {
          deltaTime: 1 / 30,
          time: i / 30,
          phase: 0.3,
          effort: 1,
          turn: 0.5,
        })
      }
      const moved = parts.some((part) => {
        const base = part.userData.base as THREE.Euler
        return (
          Math.abs(part.rotation.x - base.x) +
            Math.abs(part.rotation.y - base.y) +
            Math.abs(part.rotation.z - base.z) >
          0.01
        )
      })
      expect(moved, kind).toBe(true)
      // Se ladea hacia dentro de la curva (la anémona no se mueve).
      if (look.rig.bank > 0) expect(look.root.rotation.z, kind).toBeLessThan(0)
      look.dispose()
    }
  })

  it("cazadores con mandíbula y señuelo", () => {
    for (const kind of ["barracuda", "anglerfish", "lanternfish"] as const) {
      expect(buildModel(kind, new Rng(1)).jaw, kind).not.toBeNull()
    }
    for (const kind of ["anglerfish", "lanternfish"] as const) {
      const look = buildModel(kind, new Rng(1))
      expect(look.lure, kind).not.toBeNull()
      expect(look.lureMaterial?.emissiveIntensity, kind).toBeGreaterThan(1)
    }
    expect(buildModel("pufferfish", new Rng(1)).spikes).not.toBeNull()
  })

  it("la tortuga atrapada usa el modelo de la tortuga y lleva red", () => {
    const look = buildModel("nettedTurtle", new Rng(1))
    expect(look.legs).toHaveLength(4)
    expect(look.net).not.toBeNull()
    expect(look.rig.gait).toBe("paddle")
  })

  it("dispose libera todas las geometrías", () => {
    const look = buildModel("manta", new Rng(1))
    const geometries = new Set(meshes(look.root).map((m) => m.geometry))
    let disposed = 0
    for (const g of geometries) g.addEventListener("dispose", () => disposed++)
    look.dispose()
    expect(disposed).toBe(geometries.size)
  })
})

describe("ModelKit", () => {
  it("las piezas en espejo conservan las caras hacia fuera", () => {
    const kit = new ModelKit()
    const parent = new THREE.Group()
    const material = kit.material(0xffffff)
    kit.part(
      parent,
      fin(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        0.1,
      ),
      material,
      {
        scale: [-1, 1, 1],
      },
    )
    kit.build()
    const geometry = (parent.children[0] as THREE.Mesh).geometry
    const pos = geometry.getAttribute("position")
    const normals = geometry.getAttribute("normal")
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      // Normal según el orden de los vértices frente a la normal guardada.
      const face = b.sub(a).cross(c.sub(a))
      if (face.lengthSq() < 1e-10) continue
      n.fromBufferAttribute(normals, i)
      expect(face.dot(n)).toBeGreaterThan(0)
    }
  })

  it("funde las piezas estáticas: una malla por padre y material", () => {
    const kit = new ModelKit()
    const parent = new THREE.Group()
    const material = kit.material(0xffffff)
    const cone = new THREE.ConeGeometry(0.1, 0.3, 4)
    for (let i = 0; i < 12; i++)
      kit.part(parent, cone, material, { at: [i, 0, 0] })
    kit.build()
    expect(parent.children).toHaveLength(1)
  })
})

describe("megajefes y medusa", () => {
  it("kraken y tiburón: modelo animado con fugas y centros de daño", () => {
    for (const build of [netKraken, scrapShark]) {
      const model = build(new Rng(1), 5)
      expect(model.leaks).toHaveLength(5)
      expect(model.cores.length).toBeGreaterThan(0)
      expect(model.look.bodyMaterial.flatShading).toBe(true)
      expect(animated(model.look).length).toBeGreaterThan(0)
      // Uno solo en pantalla: puede ser más rico, pero con tope.
      expect(meshes(model.look.root).length).toBeLessThanOrEqual(40)
      model.look.dispose()
    }
  })

  it("leviatán: cabeza con mandíbula y una fuga por cada pocos segmentos", () => {
    const serpent = leviathan(16, 7)
    expect(serpent.segments).toHaveLength(16)
    expect(serpent.radii[0]).toBeGreaterThan(serpent.radii[15])
    expect(serpent.leaks).toHaveLength(7)
    expect(new Set(serpent.leaks.map((l) => l.parent)).size).toBe(7)
    expect(serpent.jaw.parent).toBe(serpent.segments[0])
  })

  it("la medusa sigue siendo barata (es la fauna más común)", () => {
    const jelly = new Jellyfish(new THREE.Vector3(), new Rng(1))
    expect(meshes(jelly.mesh).length).toBeLessThanOrEqual(12)
    jelly.dispose()
  })
})
