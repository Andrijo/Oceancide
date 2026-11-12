import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { BIOMES } from "@core/types"
import {
  AA_NORMAL_TEXT,
  compositeOver,
  contrastRatio,
  linearToSrgb,
  parseColor,
  type Rgba,
} from "@ui/contrast"
import { CREAM } from "@ui/palette"

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

/** Valor de una variable CSS en cada bloque que la define (paletas incluidas). */
function cssVarValues(name: string): string[] {
  const pattern = new RegExp(`${name}:\\s*([^;]+);`, "g")
  return [...css.matchAll(pattern)].map((m) => m[1].trim())
}

function cssVar(name: string): Rgba {
  const [value] = cssVarValues(name)
  if (!value) throw new Error(`Falta ${name} en styles.css`)
  return parseColor(value)
}

/** Agua y suelo de cada bioma, como se ven en pantalla (Three usa lineal). */
const BACKGROUNDS = Object.entries(BIOMES).flatMap(([key, biome]) =>
  (["waterColor", "floorColor"] as const).map((part) => {
    const [r, g, b] = biome[part].map(linearToSrgb)
    return { label: `${key}.${part}`, color: { r, g, b, a: 1 } }
  }),
)

/** Colores de texto que salen sobre el panel del HUD, en todas las paletas. */
const PANEL_TEXTS = [
  { label: "crema", color: parseColor(CREAM) },
  ...["--c-bad", "--c-warn", "--c-leak"].flatMap((name) =>
    cssVarValues(name).map((value, i) => ({
      label: `${name}[${i}]`,
      color: parseColor(value),
    })),
  ),
]

describe("contrastRatio", () => {
  it("da 21 entre blanco y negro y 1 entre un color y sí mismo", () => {
    const white = parseColor("#fff")
    const black = parseColor("rgb(0, 0, 0)")
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5)
    expect(contrastRatio(white, white)).toBe(1)
  })

  it("compone el alfa sobre el fondo", () => {
    const half = compositeOver(
      parseColor("rgba(0, 0, 0, 0.5)"),
      parseColor("#ffffff"),
    )
    expect(half.r).toBeCloseTo(127.5)
  })

  it("rechaza colores que no entiende", () => {
    expect(() => parseColor("var(--c-bad)")).toThrow()
  })
})

describe("contraste del HUD", () => {
  it("lee las paletas de styles.css", () => {
    // Crema + tres colores × tres paletas (normal, rojo-verde, tritanopía).
    expect(PANEL_TEXTS.length).toBe(1 + 3 * 3)
    expect(BACKGROUNDS.length).toBe(Object.keys(BIOMES).length * 2)
  })

  it("el texto del panel cumple AA sobre cualquier bioma", () => {
    const panel = cssVar("--hud-panel")
    const failures: string[] = []

    for (const bg of BACKGROUNDS) {
      const surface = compositeOver(panel, bg.color)
      for (const text of PANEL_TEXTS) {
        const ratio = contrastRatio(text.color, surface)
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(`${text.label} sobre ${bg.label}: ${ratio.toFixed(2)}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it("el texto crema cumple AA en el panel azul, incluso sobre blanco", () => {
    const panel = cssVar("--hud-panel-accent")
    const cream = parseColor(CREAM)
    const backgrounds = [
      ...BACKGROUNDS.map((bg) => bg.color),
      parseColor("#ffffff"),
    ]

    for (const bg of backgrounds) {
      expect(
        contrastRatio(cream, compositeOver(panel, bg)),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    }
  })

  it("el texto crema cumple AA en el panel oscuro aunque el fondo sea blanco", () => {
    const surface = compositeOver(cssVar("--hud-panel"), parseColor("#fff"))
    expect(contrastRatio(parseColor(CREAM), surface)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    )
  })
})
