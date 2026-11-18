import { describe, expect, it } from "vitest"
import { BIOMES, BIOME_ORDER, type BiomeKey } from "@core/types"
import {
  BIOME_MODIFIERS,
  BIOME_OBJECTIVES,
  LAYER_COUNT,
  ROUTE_LAYERS,
  START_NODE,
  defaultNode,
  describeNode,
  generateRouteOptions,
  layerOf,
  leakProgress,
  modifiedToxicityRate,
  nodeTitle,
  objectiveBonus,
  shopItems,
  type RouteNode,
} from "@world/BiomeRoute"

const ALL_BIOMES = Object.keys(BIOMES) as BiomeKey[]

describe("capas de la ruta", () => {
  it("los 10 biomas aparecen en alguna capa, sin repetirse", () => {
    const listed = ROUTE_LAYERS.flat()
    expect(new Set(listed).size).toBe(listed.length)
    expect([...listed].sort()).toEqual([...ALL_BIOMES].sort())
  })

  it("hay una capa por bioma de la ruta por defecto, que es su primera opción", () => {
    expect(LAYER_COUNT).toBe(BIOME_ORDER.length)
    ROUTE_LAYERS.forEach((layer, i) => {
      expect(layer[0]).toBe(BIOME_ORDER[i])
    })
  })

  it("cada capa es más honda que la anterior", () => {
    for (let i = 1; i < ROUTE_LAYERS.length; i++) {
      const shallowest = Math.min(
        ...ROUTE_LAYERS[i].map((key) => BIOMES[key].depth),
      )
      const deepestBefore = Math.max(
        ...ROUTE_LAYERS[i - 1].map((key) => BIOMES[key].depth),
      )
      expect(shallowest).toBeGreaterThan(deepestBefore)
    }
  })

  it("layerOf da la vuelta en la inmersión sin fin", () => {
    expect(layerOf(0)).toBe(0)
    expect(layerOf(5)).toBe(5)
    expect(layerOf(6)).toBe(0)
    expect(layerOf(13)).toBe(1)
  })

  it("defaultNode sigue la ruta clásica sin modificadores", () => {
    expect(defaultNode(0)).toEqual(START_NODE)
    expect(defaultNode(2).biome).toBe(BIOME_ORDER[2])
    expect(defaultNode(8).modifier).toBe("none")
  })
})

describe("generateRouteOptions", () => {
  it("ofrece los dos biomas de la capa cuando hay dos", () => {
    for (let index = 1; index <= 4; index++) {
      const [a, b] = generateRouteOptions(123, index)
      expect([a.biome, b.biome].sort()).toEqual([...ROUTE_LAYERS[index]].sort())
    }
  })

  it("las dos opciones siempre se diferencian en algo", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let index = 1; index < 12; index++) {
        const [a, b] = generateRouteOptions(seed, index)
        expect(a).not.toEqual(b)
      }
    }
  })

  it("es determinista con la semilla", () => {
    expect(generateRouteOptions(7, 3)).toEqual(generateRouteOptions(7, 3))
  })

  it("semillas distintas dan rutas o modificadores distintos", () => {
    const signature = (seed: number): string =>
      [1, 2, 3, 4, 5]
        .map((i) =>
          generateRouteOptions(seed, i)
            .map((n) => `${n.biome}/${n.modifier}/${n.objective}/${n.perk}`)
            .join("|"),
        )
        .join(";")
    const signatures = new Set(
      Array.from({ length: 20 }, (_, i) => signature(i)),
    )
    expect(signatures.size).toBeGreaterThan(15)
  })

  it("con muchas semillas salen todos los modificadores, objetivos y recompensas", () => {
    const modifiers = new Set<string>()
    const objectives = new Set<string>()
    const perks = new Set<string>()
    for (let seed = 0; seed < 100; seed++) {
      for (const node of generateRouteOptions(seed, 2)) {
        modifiers.add(node.modifier)
        objectives.add(node.objective)
        perks.add(node.perk)
      }
    }
    expect([...modifiers].sort()).toEqual(Object.keys(BIOME_MODIFIERS).sort())
    expect([...objectives].sort()).toEqual(Object.keys(BIOME_OBJECTIVES).sort())
    expect([...perks].sort()).toEqual(["event", "none", "shop"])
  })

  it("no ofrece evento garantizado si ya hay evento tras ese bioma", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const node of generateRouteOptions(seed, 1, true)) {
        expect(node.perk).not.toBe("event")
      }
    }
  })

  it("la capa 0 (vuelta de la inmersión sin fin) siempre es de limpieza", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const node of generateRouteOptions(seed, 6)) {
        expect(node.biome).toBe("epipelagic_upper")
        expect(node.objective).toBe("clean")
      }
    }
  })
})

describe("modificadores y objetivos", () => {
  it("modifiedToxicityRate aplica la marea roja también arriba", () => {
    expect(modifiedToxicityRate(0.5, BIOME_MODIFIERS.none)).toBe(0.5)
    expect(modifiedToxicityRate(0, BIOME_MODIFIERS.red_tide)).toBeGreaterThan(0)
    expect(modifiedToxicityRate(0.5, BIOME_MODIFIERS.red_tide)).toBeCloseTo(
      0.83,
    )
  })

  it("todo modificador con riesgo da más Eco", () => {
    for (const modifier of Object.values(BIOME_MODIFIERS)) {
      if (modifier.id === "none") expect(modifier.ecoMultiplier).toBe(1)
      else expect(modifier.ecoMultiplier).toBeGreaterThan(1)
    }
  })

  it("leakProgress cuenta las fugas cerradas", () => {
    expect(leakProgress(4, 4)).toBe(0)
    expect(leakProgress(4, 1)).toBe(75)
    expect(leakProgress(4, 0)).toBe(100)
    expect(leakProgress(0, 0)).toBe(100)
    expect(leakProgress(2, 5)).toBe(0)
  })

  it("objectiveBonus premia las fugas y el contrarreloj a tiempo", () => {
    expect(objectiveBonus("clean", 3, 10)).toBe(0)
    expect(objectiveBonus("leaks", 2, 0)).toBe(300)
    expect(objectiveBonus("time_trial", 1, 5)).toBe(300)
    expect(objectiveBonus("time_trial", 1, 0)).toBe(0)
  })
})

describe("tienda", () => {
  it("los precios suben con la profundidad", () => {
    const shallow = shopItems(1)
    const deep = shopItems(4)
    shallow.forEach((item, i) => {
      expect(deep[i].id).toBe(item.id)
      expect(deep[i].cost).toBeGreaterThan(item.cost)
    })
  })
})

describe("textos", () => {
  it("describeNode nombra objetivo, modificador y recompensa", () => {
    const node: RouteNode = {
      biome: "hadopelagic",
      modifier: "blackout",
      objective: "leaks",
      perk: "shop",
    }
    const text = describeNode(node)
    expect(text).toContain("Cierra las fugas")
    expect(text).toContain("Apagón")
    expect(text).toContain("Tienda al terminar")
    expect(nodeTitle(node)).toBe("Hadopelágico · 8000 m")
  })
})
