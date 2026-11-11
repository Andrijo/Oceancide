import { afterEach, describe, expect, it, vi } from "vitest"
import {
  COMPLETION_BONUS,
  META_VERSION,
  SaveManager,
  migrateMeta,
  sanitizeMeta,
  applyRunToMeta,
  computeEco,
  computeEndlessEco,
  createDefaultMeta,
  ENDLESS_UNBANKED_KEEP,
} from "@core/MetaState"
import type { RunSummary } from "@core/types"

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  public get length(): number {
    return this.data.size
  }

  public clear(): void {
    this.data.clear()
  }

  public getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  public key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  public removeItem(key: string): void {
    this.data.delete(key)
  }

  public setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    outcome: "died",
    biomeIndex: 0,
    biomeName: "Epipelágico Superior",
    debrisCollected: 0,
    ecoBase: 0,
    ecoBonus: 0,
    ecoLost: 0,
    durationSeconds: 0,
    seed: 1,
    cardsPicked: [],
    endless: false,
    loopsCompleted: 0,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("createDefaultMeta", () => {
  it("crea un progreso vacío con la versión actual", () => {
    expect(createDefaultMeta()).toEqual({
      version: META_VERSION,
      ecoPoints: 0,
      lifetimeEco: 0,
      bestBiomeIndex: -1,
      runsPlayed: 0,
      runsCompleted: 0,
      totalDebris: 0,
      upgrades: {},
      seenTips: [],
      tipsEnabled: true,
    })
  })
})

describe("computeEco", () => {
  it("redondea el eco base", () => {
    expect(computeEco(100.4, "died")).toEqual({ base: 100, bonus: 0 })
    expect(computeEco(100.5, "died")).toEqual({ base: 101, bonus: 0 })
  })

  it("solo da bono al completar la run", () => {
    const { base, bonus } = computeEco(100, "completed")

    expect(base).toBe(100)
    expect(bonus).toBe(100 * COMPLETION_BONUS)
    expect(computeEco(100, "abandoned").bonus).toBe(0)
  })
})

describe("computeEndlessEco", () => {
  it("conserva todo lo asegurado y solo una parte de la vuelta en curso", () => {
    expect(computeEndlessEco(1000, 600)).toEqual({
      base: 600 + 400 * ENDLESS_UNBANKED_KEEP,
      bonus: 0,
      lost: 400 * (1 - ENDLESS_UNBANKED_KEEP),
    })
  })

  it("sin vuelta cerrada, todo está en riesgo", () => {
    const { base, lost } = computeEndlessEco(300, 0)
    expect(base + lost).toBe(300)
    expect(base).toBe(Math.round(300 * ENDLESS_UNBANKED_KEEP))
  })

  it("justo al cerrar una vuelta no se pierde nada", () => {
    expect(computeEndlessEco(800, 800)).toEqual({
      base: 800,
      bonus: 0,
      lost: 0,
    })
  })

  it("si un evento baja el Eco por debajo de lo asegurado, no inventa pérdidas", () => {
    expect(computeEndlessEco(500, 800)).toEqual({
      base: 500,
      bonus: 0,
      lost: 0,
    })
  })
})

describe("applyRunToMeta", () => {
  it("acumula eco, desechos y runs", () => {
    const meta = createDefaultMeta()

    applyRunToMeta(
      meta,
      makeSummary({
        outcome: "completed",
        ecoBase: 100,
        ecoBonus: 25,
        debrisCollected: 10,
        biomeIndex: 3,
      }),
    )

    expect(meta.ecoPoints).toBe(125)
    expect(meta.lifetimeEco).toBe(125)
    expect(meta.totalDebris).toBe(10)
    expect(meta.runsPlayed).toBe(1)
    expect(meta.runsCompleted).toBe(1)
    expect(meta.bestBiomeIndex).toBe(3)
  })

  it("no empeora el mejor bioma ni cuenta runs abandonadas como completadas", () => {
    const meta = createDefaultMeta()

    applyRunToMeta(
      meta,
      makeSummary({
        outcome: "completed",
        ecoBase: 100,
        ecoBonus: 25,
        biomeIndex: 4,
      }),
    )
    applyRunToMeta(
      meta,
      makeSummary({
        outcome: "abandoned",
        ecoBase: 50,
        biomeIndex: 1,
      }),
    )

    expect(meta.ecoPoints).toBe(175)
    expect(meta.runsPlayed).toBe(2)
    expect(meta.runsCompleted).toBe(1)
    expect(meta.bestBiomeIndex).toBe(4)
  })
})

describe("SaveManager", () => {
  it("devuelve el progreso por defecto sin datos guardados", () => {
    vi.stubGlobal("localStorage", new MemoryStorage())

    expect(new SaveManager().load()).toEqual(createDefaultMeta())
  })

  it("guarda y recupera el progreso", () => {
    vi.stubGlobal("localStorage", new MemoryStorage())
    const manager = new SaveManager()
    const meta = {
      ...createDefaultMeta(),
      ecoPoints: 1234,
      upgrades: { speed: 2 },
    }

    manager.save(meta)

    expect(manager.load()).toEqual(meta)
  })

  it("un guardado de versión futura o sin migración deja copia de seguridad", () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify({ version: META_VERSION + 1, ecoPoints: 999 })
    storage.setItem("oceancide.meta", raw)
    vi.stubGlobal("localStorage", storage)

    expect(new SaveManager().load()).toEqual(createDefaultMeta())
    expect(storage.getItem("oceancide.meta.backup")).toBe(raw)
  })

  it("un guardado corrupto deja copia de seguridad", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const storage = new MemoryStorage()
    storage.setItem("oceancide.meta", "{no es json")
    vi.stubGlobal("localStorage", storage)

    expect(new SaveManager().load()).toEqual(createDefaultMeta())
    expect(storage.getItem("oceancide.meta.backup")).toBe("{no es json")
    expect(warn).toHaveBeenCalled()
  })

  it("un guardado válido no crea copia de seguridad", () => {
    const storage = new MemoryStorage()
    vi.stubGlobal("localStorage", storage)
    const manager = new SaveManager()

    manager.save({ ...createDefaultMeta(), ecoPoints: 10 })
    manager.load()

    expect(storage.getItem("oceancide.meta.backup")).toBeNull()
  })

  it("reset() borra el progreso guardado", () => {
    const storage = new MemoryStorage()
    vi.stubGlobal("localStorage", storage)
    const manager = new SaveManager()

    manager.save({ ...createDefaultMeta(), ecoPoints: 50 })
    manager.reset()

    expect(storage.getItem("oceancide.meta")).toBeNull()
  })

  it("no rompe la partida si localStorage falla al guardar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const storage = new MemoryStorage()
    storage.setItem = () => {
      throw new Error("quota exceeded")
    }
    vi.stubGlobal("localStorage", storage)

    expect(() =>
      new SaveManager().save({ ...createDefaultMeta(), ecoPoints: 1 }),
    ).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe("migrateMeta", () => {
  it("migra un guardado v1 a v2 sin perder datos", () => {
    const v1 = {
      version: 1,
      ecoPoints: 120,
      lifetimeEco: 300,
      bestBiomeIndex: 2,
      runsPlayed: 7,
      runsCompleted: 1,
      totalDebris: 55,
      upgrades: { speed: 2 },
    }

    const migrated = migrateMeta(
      v1,
      { 1: (old) => ({ ...old, achievements: [] }) },
      2,
    )

    expect(migrated).toMatchObject({ ...v1, version: META_VERSION })
  })

  it("encadena varias migraciones en orden", () => {
    const order: number[] = []
    const migrated = migrateMeta(
      { version: 1, ecoPoints: 5 },
      {
        1: (old) => {
          order.push(1)
          return old
        },
        2: (old) => {
          order.push(2)
          return old
        },
      },
      3,
    )

    expect(order).toEqual([1, 2])
    expect(migrated?.ecoPoints).toBe(5)
  })

  it("devuelve null si falta una migración o la versión es inválida", () => {
    expect(migrateMeta({ version: 1 }, {}, 2)).toBeNull()
    expect(migrateMeta({ version: 99 })).toBeNull()
    expect(migrateMeta({ version: "1" })).toBeNull()
    expect(migrateMeta(null)).toBeNull()
    expect(migrateMeta([])).toBeNull()
  })
})

describe("sanitizeMeta", () => {
  it("sustituye valores no válidos por los de por defecto", () => {
    const meta = sanitizeMeta({
      ecoPoints: Number.NaN,
      lifetimeEco: "mucho",
      runsPlayed: -5,
      bestBiomeIndex: -10,
      totalDebris: Infinity,
    })

    expect(meta).toEqual(createDefaultMeta())
  })

  it("limita los niveles de mejora a maxLevel y descarta ids desconocidos", () => {
    const meta = sanitizeMeta({
      upgrades: { speed: 999, fantasma: 3, other: "x" },
    })

    expect(meta.upgrades.speed).toBe(5)
    expect(meta.upgrades).not.toHaveProperty("fantasma")
    expect(meta.upgrades).not.toHaveProperty("other")
  })

  it("conserva los avisos vistos válidos, sin duplicados", () => {
    const meta = sanitizeMeta({
      seenTips: ["leak_seen", "inventado", 4, "leak_seen", "time_low"],
      tipsEnabled: false,
    })

    expect(meta.seenTips).toEqual(["leak_seen", "time_low"])
    expect(meta.tipsEnabled).toBe(false)
  })

  it("un guardado sin avisos los deja activados y sin ver", () => {
    const meta = sanitizeMeta({ seenTips: "todos", tipsEnabled: "no" })

    expect(meta.seenTips).toEqual([])
    expect(meta.tipsEnabled).toBe(true)
  })
})
