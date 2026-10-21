import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { CameraRig } from "@core/CameraRig"

function makeRig(): CameraRig {
  return new CameraRig(new THREE.PerspectiveCamera(75, 1, 0.1, 1000))
}

function direction(rig: CameraRig): THREE.Vector3 {
  return rig.camera.getWorldDirection(new THREE.Vector3())
}

describe("CameraRig.snap", () => {
  it("coloca la cámara detrás de la tortuga", () => {
    const rig = makeRig()
    const position = new THREE.Vector3(10, 2, 3)

    rig.snap(position, 0)

    expect(rig.camera.position).toEqual(new THREE.Vector3(10, 7, -9))
  })

  it("rota el offset con el yaw de la tortuga", () => {
    const rig = makeRig()

    rig.snap(new THREE.Vector3(0, 0, 0), Math.PI / 2)

    expect(rig.camera.position.x).toBeCloseTo(-12)
    expect(rig.camera.position.y).toBeCloseTo(5)
    expect(rig.camera.position.z).toBeCloseTo(0)
  })

  it("mira siempre hacia la tortuga", () => {
    const rig = makeRig()
    const position = new THREE.Vector3(0, 0, 0)

    rig.snap(position, 0)

    const forward = direction(rig)
    expect(forward.x).toBeCloseTo(0)
    expect(forward.y).toBeCloseTo(-5 / Math.sqrt(169))
    expect(forward.z).toBeCloseTo(12 / Math.sqrt(169))
  })

  it("aplica el look-back al hacer snap", () => {
    const rig = makeRig()
    rig.setLookBack(true)

    rig.snap(new THREE.Vector3(0, 0, 0), 0)

    expect(rig.camera.position.x).toBeCloseTo(0)
    expect(rig.camera.position.y).toBe(5)
    expect(rig.camera.position.z).toBe(12)
  })
})

describe("CameraRig.update", () => {
  it("sigue la posición con suavizado", () => {
    const rig = makeRig()
    rig.snap(new THREE.Vector3(0, 0, 0), 0)
    const before = rig.camera.position.clone()

    rig.update(0.016, new THREE.Vector3(0, 0, 100), 0)

    expect(rig.camera.position.z).toBeGreaterThan(before.z)
    expect(rig.camera.position.z).toBeLessThan(88)
  })

  it("cambia de vista al instante al activar el look-back", () => {
    const rig = makeRig()
    rig.snap(new THREE.Vector3(0, 0, 0), 0)
    rig.setLookBack(true)

    rig.update(0.016, new THREE.Vector3(0, 0, 0), 0)

    expect(rig.camera.position.x).toBeCloseTo(0)
    expect(rig.camera.position.y).toBe(5)
    expect(rig.camera.position.z).toBe(12)
  })

  it("vuelve a la vista normal al desactivar el look-back", () => {
    const rig = makeRig()
    rig.setLookBack(true)
    rig.snap(new THREE.Vector3(0, 0, 0), 0)
    rig.setLookBack(false)

    rig.update(0.016, new THREE.Vector3(0, 0, 0), 0)

    expect(rig.camera.position.x).toBeCloseTo(0)
    expect(rig.camera.position.y).toBe(5)
    expect(rig.camera.position.z).toBe(-12)
  })
})

describe("CameraRig.orbit", () => {
  it("orbita a radio fijo alrededor del centro", () => {
    const rig = makeRig()
    const center = new THREE.Vector3(1, 2, 3)

    rig.orbit(0, center)

    expect(rig.camera.position).toEqual(new THREE.Vector3(1, 6, 17))
  })

  it("avanza con el tiempo", () => {
    const rig = makeRig()
    const center = new THREE.Vector3(0, 0, 0)

    rig.orbit(Math.PI / (2 * 0.15), center)

    expect(rig.camera.position.x).toBeCloseTo(14)
    expect(rig.camera.position.z).toBeCloseTo(0)
  })
})

describe("CameraRig.resize", () => {
  it("actualiza el aspect y la matriz de proyección", () => {
    const rig = makeRig()
    const before = rig.camera.projectionMatrix.clone()

    rig.resize(2)

    expect(rig.camera.aspect).toBe(2)
    expect(rig.camera.projectionMatrix.equals(before)).toBe(false)
  })
})
