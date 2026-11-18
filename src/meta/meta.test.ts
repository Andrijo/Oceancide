import { describe, expect, it } from "vitest"
import { BIOME_DEBRIS, MICROFRAGMENT } from "@entities/debrisCatalog"
import { CARD_POOL } from "@cards/CardPool"
import { CardManager } from "@cards/CardManager"
import { Rng } from "@core/rng"
import {
  applyRunToMeta,
  createDefaultMeta,
  migrateMeta,
  META_VERSION,
} from "@core/MetaState"
import type { RunSummary } from "@core/types"
import {
  CODEX_ENTRIES,
  DEBRIS_FACTS,
  codexProgress,
  discoverDebris,
  isCodexId,
} from "@/meta/codex"
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  lockedCards,
  rewardText,
  type AchievementContext,
} from "@/meta/achievements"
import {
  applyDailyResult,
  dailyKey,
  dailySeed,
  sanitizeDailyRecord,
} from "@/meta/daily"

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    outcome: "completed",
    biomeIndex: 5,
    biomeName: "Mar Profundo",
    zoneProgress: 100,
    debrisCollected: 100,
    ecoBase: 500,
    ecoBonus: 125,
    ecoLost: 0,
    durationSeconds: 600,
    seed: 1,
    cardsPicked: [],
    endless: false,
    loopsCompleted: 0,
    ...overrides,
  }
}

describe("códice", () => {
  const catalogIds = new Set(
    Object.values(BIOME_DEBRIS)
      .flat()
      .map((debris) => debris.id),
  )

  it("tiene una entrada por cada tipo de desecho del catálogo, sin duplicados", () => {
    const ids = CODEX_ENTRIES.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(ids)).toEqual(catalogIds)
  })

  it("cada entrada tiene un dato real", () => {
    for (const entry of CODEX_ENTRIES) {
      expect(entry.fact.length, entry.id).toBeGreaterThan(30)
    }
    // Y no sobran datos de desechos que no existen.
    for (const id of Object.keys(DEBRIS_FACTS)) {
      expect(catalogIds.has(id), id).toBe(true)
    }
  })

  it("los microfragmentos no cuentan", () => {
    expect(isCodexId(MICROFRAGMENT.id)).toBe(false)
    expect(isCodexId("plastic_bottle")).toBe(true)
    expect(isCodexId("inventado")).toBe(false)
    expect(isCodexId(3)).toBe(false)
  })

  it("discoverDebris solo apunta la primera vez", () => {
    const discovered: string[] = []
    expect(discoverDebris(discovered, "plastic_bottle")).toBe(true)
    expect(discoverDebris(discovered, "plastic_bottle")).toBe(false)
    expect(discoverDebris(discovered, MICROFRAGMENT.id)).toBe(false)
    expect(codexProgress(discovered)).toEqual({
      found: 1,
      total: CODEX_ENTRIES.length,
    })
  })
})

describe("logros", () => {
  const meta = (
    overrides: Partial<AchievementContext["meta"]> = {},
  ): AchievementContext["meta"] => ({
    runsPlayed: 0,
    runsCompleted: 0,
    totalDebris: 0,
    lifetimeEco: 0,
    leaksClosed: 0,
    discoveredDebris: [],
    ...overrides,
  })

  it("ids únicos y las cartas que desbloquean existen", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    const cardIds = new Set(CARD_POOL.map((card) => card.id))
    for (const achievement of ACHIEVEMENTS) {
      for (const id of achievement.unlocksCards ?? []) {
        expect(cardIds.has(id), id).toBe(true)
      }
    }
  })

  it("al empezar no hay ninguno y se bloquean sus cartas", () => {
    expect(evaluateAchievements({ meta: meta() }, [])).toEqual([])
    expect(lockedCards([])).toContain("ocean_heart")
    expect(lockedCards(["first_clear"])).not.toContain("ocean_heart")
  })

  it("se consiguen con el progreso guardado", () => {
    const unlocked = evaluateAchievements(
      {
        meta: meta({
          runsPlayed: 3,
          runsCompleted: 1,
          totalDebris: 1500,
          lifetimeEco: 25000,
          leaksClosed: 60,
          discoveredDebris: CODEX_ENTRIES.map((e) => e.id),
        }),
      },
      [],
    )
    expect(unlocked).toEqual(
      expect.arrayContaining([
        "first_dive",
        "first_clear",
        "debris_1000",
        "eco_20000",
        "leaks_50",
        "codex_half",
        "codex_full",
      ]),
    )
  })

  it("los de la run miran el resumen", () => {
    const base = meta({ runsPlayed: 1, runsCompleted: 1 })
    const commons = CARD_POOL.filter((c) => c.rarity === "common")
      .slice(0, 4)
      .map((c) => c.id)
    const ids = evaluateAchievements(
      {
        meta: base,
        summary: summary({
          revivesUsed: 0,
          cardsPicked: commons,
          daily: "2026-11-17",
        }),
      },
      ["first_dive", "first_clear"],
    )
    expect(ids.sort()).toEqual(["commons_only", "daily_clear", "no_revive"])

    expect(
      evaluateAchievements(
        { meta: base, summary: summary({ revivesUsed: 1 }) },
        [],
      ),
    ).not.toContain("no_revive")
    expect(
      evaluateAchievements(
        {
          meta: base,
          summary: summary({
            outcome: "died",
            endless: true,
            loopsCompleted: 1,
          }),
        },
        [],
      ),
    ).toContain("endless_loop")
  })

  it("no repite los que ya tienes", () => {
    expect(
      evaluateAchievements({ meta: meta({ runsPlayed: 1 }) }, ["first_dive"]),
    ).toEqual([])
  })

  it("rewardText nombra las cartas", () => {
    const firstClear = ACHIEVEMENTS.find((a) => a.id === "first_clear")!
    expect(rewardText(firstClear)).toBe("Desbloquea: Corazón del Océano")
    const firstDive = ACHIEVEMENTS.find((a) => a.id === "first_dive")!
    expect(rewardText(firstDive)).toBeNull()
  })

  it("CardManager no ofrece las cartas bloqueadas", () => {
    const manager = new CardManager()
    const locked = lockedCards([])
    manager.setLockedCards(locked)
    for (let seed = 0; seed < 300; seed++) {
      for (const card of manager.rollChoices(3, new Rng(seed))) {
        expect(locked).not.toContain(card.id)
      }
    }
  })
})

describe("desafío diario", () => {
  it("la clave es la fecha local y la semilla es estable", () => {
    const key = dailyKey(new Date(2026, 10, 7))
    expect(key).toBe("2026-11-07")
    expect(dailySeed(key)).toBe(dailySeed("2026-11-07"))
    expect(dailySeed(key)).not.toBe(dailySeed("2026-11-08"))
    expect(Number.isInteger(dailySeed(key))).toBe(true)
    expect(dailySeed(key)).toBeGreaterThanOrEqual(0)
  })

  it("guarda el mejor resultado del día y empieza de cero otro día", () => {
    const first = applyDailyResult(
      null,
      "2026-11-17",
      summary({ outcome: "died", ecoBase: 300, ecoBonus: 0, biomeIndex: 2 }),
    )
    expect(first.improved).toBe(true)
    expect(first.record).toEqual({
      date: "2026-11-17",
      attempts: 1,
      bestEco: 300,
      bestBiome: 2,
      completed: false,
    })

    const worse = applyDailyResult(
      first.record,
      "2026-11-17",
      summary({ outcome: "died", ecoBase: 100, ecoBonus: 0, biomeIndex: 1 }),
    )
    expect(worse.improved).toBe(false)
    expect(worse.record.bestEco).toBe(300)
    expect(worse.record.attempts).toBe(2)

    const nextDay = applyDailyResult(worse.record, "2026-11-18", summary())
    expect(nextDay.record.attempts).toBe(1)
    expect(nextDay.record.completed).toBe(true)
  })

  it("sanitizeDailyRecord descarta lo que no vale", () => {
    expect(sanitizeDailyRecord(null)).toBeNull()
    expect(sanitizeDailyRecord({ date: "ayer" })).toBeNull()
    expect(
      sanitizeDailyRecord({ date: "2026-11-17", bestEco: -5, attempts: "x" }),
    ).toEqual({
      date: "2026-11-17",
      attempts: 0,
      bestEco: 0,
      bestBiome: -1,
      completed: false,
    })
  })
})

describe("MetaState con la meta-progresión", () => {
  it("un guardado antiguo carga con los valores por defecto", () => {
    const migrated = migrateMeta({ version: META_VERSION, ecoPoints: 10 })!
    expect(migrated.discoveredDebris).toEqual([])
    expect(migrated.achievements).toEqual([])
    expect(migrated.leaksClosed).toBe(0)
    expect(migrated.daily).toBeNull()
    expect(migrated.dailyCompletions).toBe(0)
  })

  it("sanea ids desconocidos y duplicados", () => {
    const migrated = migrateMeta({
      version: META_VERSION,
      discoveredDebris: ["plastic_bottle", "plastic_bottle", "nada"],
      achievements: ["first_dive", "falso"],
      leaksClosed: -3,
    })!
    expect(migrated.discoveredDebris).toEqual(["plastic_bottle"])
    expect(migrated.achievements).toEqual(["first_dive"])
    expect(migrated.leaksClosed).toBe(0)
  })

  it("applyRunToMeta suma fugas y apunta el desafío diario", () => {
    const meta = createDefaultMeta()
    applyRunToMeta(meta, summary({ leaksClosed: 4, daily: "2026-11-17" }))
    expect(meta.leaksClosed).toBe(4)
    expect(meta.daily?.completed).toBe(true)
    expect(meta.dailyCompletions).toBe(1)
    // Completarlo otra vez el mismo día no cuenta doble.
    applyRunToMeta(meta, summary({ daily: "2026-11-17" }))
    expect(meta.dailyCompletions).toBe(1)
    expect(meta.daily?.attempts).toBe(2)
  })
})
