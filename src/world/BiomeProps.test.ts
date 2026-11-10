import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { Rng } from "@core/rng"
import type { BiomeKey } from "@core/types"
import { BiomeProps } from "./BiomeProps"

const ALL_BIOMES: BiomeKey[] = [
  "epipelagic_upper",
  "pelagic_mid",
  "subphotic",
  "mesopelagic_upper",
  "mesopelagic_deep",
  "bathypelagic_upper",
  "bathypelagic_deep",
  "abyssopelagic",
  "hadopelagic",
  "deepSea",
]

function generate(biome: BiomeKey): {
  props: BiomeProps
  group: THREE.Group
} {
  const scene = new THREE.Scene()
  const props = new BiomeProps(scene)

  props.generate(biome, new Rng(12345), () => 0)

  return { props, group: scene.children[0] as THREE.Group }
}

describe("BiomeProps", () => {
  it("genera props para todos los biomas y los anima sin errores", () => {
    for (const biome of ALL_BIOMES) {
      const { props, group } = generate(biome)

      expect(group.children.length).toBeGreaterThan(0)
      expect(() => props.update(0.016)).not.toThrow()

      for (const anchor of props.getLightAnchors()) {
        expect(Number.isFinite(anchor.position.x)).toBe(true)
        expect(Number.isFinite(anchor.position.y)).toBe(true)
        expect(Number.isFinite(anchor.position.z)).toBe(true)
      }

      props.clear()
      expect(props.getLightAnchors()).toHaveLength(0)
    }
  })

  it("no reutiliza arrecifes, coral ni conchas en el mar profundo", () => {
    const { props } = generate("deepSea")
    const kinds = props.getKinds()

    expect(kinds.has("vent")).toBe(true)
    expect(kinds.has("tubeWorm")).toBe(true)
    expect(kinds.has("spire")).toBe(true)
    expect(kinds.has("nodule")).toBe(true)
    expect(kinds.has("reef")).toBe(false)
    expect(kinds.has("coral")).toBe(false)
    expect(kinds.has("shell")).toBe(false)
  })

  it("genera anclas de luz en el mar profundo", () => {
    const { props } = generate("deepSea")

    expect(props.getLightAnchors().length).toBeGreaterThan(0)
  })

  it("fusiona los props en pocas mallas (draw calls)", () => {
    for (const biome of ALL_BIOMES) {
      const { props } = generate(biome)

      // Antes: una malla por rama/tubo/roca (varios cientos por bioma).
      expect(props.getDrawableCount()).toBeLessThan(40)
    }
  })

  it("la composición no depende del fusionado: misma semilla, mismos vértices", () => {
    const a = generate("deepSea").group
    const b = generate("deepSea").group

    const signature = (group: THREE.Group): number[] =>
      group.children.map((child) =>
        child instanceof THREE.Mesh
          ? (child.geometry as THREE.BufferGeometry).attributes.position.count
          : -1,
      )

    expect(signature(a)).toEqual(signature(b))
    expect(signature(a).length).toBeGreaterThan(0)
  })
})
