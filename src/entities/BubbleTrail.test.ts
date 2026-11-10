import { describe, expect, it } from "vitest"
import * as THREE from "three"
import {
  BubbleTrail,
  bubbleEmissive,
  bubblePalette,
} from "@entities/BubbleTrail"
import { BIOMES, BIOME_ORDER } from "@core/types"

function luminance(color: THREE.Color): number {
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  return hsl.l
}

function colorsOf(key: (typeof BIOME_ORDER)[number]) {
  const biome = BIOMES[key]
  return {
    water: new THREE.Color().setRGB(...biome.waterColor),
    accent: new THREE.Color().setHex(biome.accentColor),
  }
}

describe("bubblePalette", () => {
  it("incluye el acento del bioma tal cual", () => {
    const { water, accent } = colorsOf("deepSea")

    expect(bubblePalette(water, accent)[0].getHex()).toBe(accent.getHex())
  })

  it("cambia de un bioma a otro", () => {
    const surface = colorsOf("epipelagic_upper")
    const deep = colorsOf("deepSea")

    const a = bubblePalette(surface.water, surface.accent).map((c) =>
      c.getHex(),
    )
    const b = bubblePalette(deep.water, deep.accent).map((c) => c.getHex())

    expect(a).not.toEqual(b)
  })

  it("en todos los biomas las burbujas son más claras que el agua", () => {
    for (const key of BIOME_ORDER) {
      const { water, accent } = colorsOf(key)

      for (const color of bubblePalette(water, accent)) {
        expect(luminance(color), key).toBeGreaterThan(luminance(water))
      }
    }
  })

  it("no modifica los colores de entrada", () => {
    const { water, accent } = colorsOf("abyssopelagic")
    const before = [water.getHex(), accent.getHex()]

    bubblePalette(water, accent)
    bubbleEmissive(water, accent)

    expect([water.getHex(), accent.getHex()]).toEqual(before)
  })
})

describe("BubbleTrail.setBiomeColors", () => {
  it("tiñe las instancias y el emisivo con los colores del bioma", () => {
    const scene = new THREE.Scene()
    const trail = new BubbleTrail(scene)
    const mesh = scene.children[0] as THREE.InstancedMesh
    const material = mesh.material as THREE.MeshStandardMaterial
    const { water, accent } = colorsOf("deepSea")

    trail.setBiomeColors(water, accent)

    const palette = bubblePalette(water, accent)
    const color = new THREE.Color()
    for (let i = 0; i < palette.length * 2; i++) {
      mesh.getColorAt(i, color)
      expect(color.getHex()).toBe(palette[i % palette.length].getHex())
    }
    expect(material.emissive.getHex()).toBe(
      bubbleEmissive(water, accent).getHex(),
    )

    trail.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
