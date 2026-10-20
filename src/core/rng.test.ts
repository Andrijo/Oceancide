import { describe, expect, it, vi } from "vitest"
import { Rng, deriveSeed, randomSeed } from "@core/rng"

describe("Rng", () => {
  it("genera la misma secuencia para la misma semilla", () => {
    const a = new Rng(12345)
    const b = new Rng(12345)

    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it("genera secuencias distintas con semillas distintas", () => {
    const a = new Rng(1)
    const b = new Rng(2)

    expect(a.next()).not.toBe(b.next())
  })

  it("next() siempre cae en [0, 1)", () => {
    const rng = new Rng(99)

    for (let i = 0; i < 1000; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it("range() respeta los límites", () => {
    const rng = new Rng(7)

    for (let i = 0; i < 1000; i++) {
      const value = rng.range(-5, 10)
      expect(value).toBeGreaterThanOrEqual(-5)
      expect(value).toBeLessThanOrEqual(10)
    }
  })

  it("range() intercambia min y max si vienen al revés", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const rng = new Rng(7)

    const value = rng.range(10, 5)

    expect(value).toBeGreaterThanOrEqual(5)
    expect(value).toBeLessThanOrEqual(10)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it("int() devuelve enteros en [0, maxExclusive)", () => {
    const rng = new Rng(3)

    for (let i = 0; i < 1000; i++) {
      const value = rng.int(5)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(5)
    }
  })

  it("pick() devuelve un elemento de la lista", () => {
    const rng = new Rng(11)
    const items = ["a", "b", "c"] as const

    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items))
    }
  })

  it("pickWeighted() ignora pesos negativos", () => {
    const rng = new Rng(5)
    const items = ["a", "b"]

    for (let i = 0; i < 100; i++) {
      const picked = rng.pickWeighted(items, (item) => (item === "a" ? -10 : 1))
      expect(picked).toBe("b")
    }
  })

  it("pickWeighted() cae a pick uniforme si todos los pesos son 0", () => {
    const rng = new Rng(5)

    expect(rng.pickWeighted(["a", "b"], () => 0)).toMatch(/^[ab]$/)
  })

  it("pickWeighted() falla con una lista vacía", () => {
    const rng = new Rng(5)

    expect(() => rng.pickWeighted([], () => 1)).toThrow("lista vacía")
  })
})

describe("deriveSeed", () => {
  it("es determinista", () => {
    expect(deriveSeed(123, 7)).toBe(deriveSeed(123, 7))
  })

  it("cambia con la semilla o el salt", () => {
    expect(deriveSeed(123, 7)).not.toBe(deriveSeed(124, 7))
    expect(deriveSeed(123, 7)).not.toBe(deriveSeed(123, 8))
  })

  it("siempre devuelve un uint32", () => {
    for (let salt = -10; salt <= 10; salt++) {
      const seed = deriveSeed(0xffffffff, salt)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(0xffffffff)
      expect(Number.isInteger(seed)).toBe(true)
    }
  })
})

describe("randomSeed", () => {
  it("devuelve un uint32", () => {
    const seed = randomSeed()

    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(0xffffffff)
    expect(Number.isInteger(seed)).toBe(true)
  })
})
