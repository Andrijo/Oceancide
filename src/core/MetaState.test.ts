import { afterEach, describe, expect, it, vi } from "vitest"
import {
  COMPLETION_BONUS,
  META_VERSION,
  SaveManager,
  applyRunToMeta,
  computeEco,
  createDefaultMeta,
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

  it("descarta datos de una versión anterior", () => {
    const storage = new MemoryStorage()
    storage.setItem(
      "oceancide.meta",
      JSON.stringify({ version: META_VERSION - 1, ecoPoints: 999 }),
    )
    vi.stubGlobal("localStorage", storage)

    expect(new SaveManager().load()).toEqual(createDefaultMeta())
  })

  it("descarta datos corruptos", () => {
    const storage = new MemoryStorage()
    storage.setItem("oceancide.meta", "{no es json")
    vi.stubGlobal("localStorage", storage)

    expect(new SaveManager().load()).toEqual(createDefaultMeta())
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
