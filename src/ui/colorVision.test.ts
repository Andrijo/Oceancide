import { afterEach, describe, expect, it, vi } from "vitest"
import {
  COLOR_ASSIST_CLASS,
  SEMANTIC,
  setColorVisionMode,
  tint,
} from "@ui/colorVision"

function stubDocument() {
  const classes = new Set<string>()
  const root = {
    dataset: {} as Record<string, string>,
    classList: {
      toggle: (name: string, force: boolean) => {
        if (force) classes.add(name)
        else classes.delete(name)
      },
    },
  }
  vi.stubGlobal("document", { documentElement: root })
  return { root, classes }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("setColorVisionMode", () => {
  it("con un modo activo, cambia la paleta y activa las pistas sin color", () => {
    const { root, classes } = stubDocument()

    setColorVisionMode("deuteranopia")

    expect(root.dataset.colorVision).toBe("deuteranopia")
    expect(classes.has(COLOR_ASSIST_CLASS)).toBe(true)
  })

  it("al desactivarlo vuelve a la paleta normal y quita las pistas", () => {
    const { root, classes } = stubDocument()

    setColorVisionMode("tritanopia")
    setColorVisionMode("off")

    expect(root.dataset.colorVision).toBe("off")
    expect(classes.has(COLOR_ASSIST_CLASS)).toBe(false)
  })
})

describe("colores semánticos", () => {
  it("son variables CSS, para que el modo los cambie sin redibujar", () => {
    for (const value of Object.values(SEMANTIC)) {
      expect(value).toMatch(/^var\(--c-[a-z]+\)$/)
    }
  })

  it("tint mezcla el color con transparencia", () => {
    expect(tint(SEMANTIC.bad, 35)).toBe(
      "color-mix(in srgb, var(--c-bad) 35%, transparent)",
    )
  })
})
