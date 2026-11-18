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
  BIOME_ENTRIES,
  CODEX_ENTRIES,
  CODEX_SECTIONS,
  DEBRIS_FACTS,
  FAUNA_ENTRIES,
  RELIC_ENTRIES,
  codexProgress,
  discoverBiome,
  discoverCreature,
  discoverDebris,
  discoverRelic,
  isCodexId,
  sectionProgress,
  totalCodexProgress,
} from "@/meta/codex"
import { RELICS } from "@/relics/RelicPool"
import { BIOME_ORDER } from "@core/types"
import { BOSS_KINDS, FRIENDLY_KINDS, HOSTILE_KINDS } from "@entities/Creature"
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

describe("códice ampliado", () => {
  const empty = {
    discoveredDebris: [],
    discoveredCreatures: [],
    discoveredRelics: [],
    discoveredBiomes: [],
  }

  it("cada especie, reliquia y bioma tiene su ficha con un dato real", () => {
    const kinds = [...HOSTILE_KINDS, ...FRIENDLY_KINDS, ...BOSS_KINDS]
    expect(FAUNA_ENTRIES.map((entry) => entry.id)).toEqual(kinds)
    expect(RELIC_ENTRIES.map((entry) => entry.id)).toEqual(
      RELICS.map((relic) => relic.id),
    )
    expect(BIOME_ENTRIES.map((entry) => entry.id)).toEqual(BIOME_ORDER)
    for (const entry of [
      ...FAUNA_ENTRIES,
      ...RELIC_ENTRIES,
      ...BIOME_ENTRIES,
    ]) {
      expect(entry.fact.length, entry.id).toBeGreaterThan(40)
    }
  })

  it("registra cada entrada solo la primera vez y rechaza ids falsos", () => {
    const creatures: string[] = []
    expect(discoverCreature(creatures, "whale")).toBe(true)
    expect(discoverCreature(creatures, "whale")).toBe(false)
    expect(discoverCreature(creatures, "unicornio")).toBe(false)

    const relics: string[] = []
    expect(discoverRelic(relics, "rubber_duck")).toBe(true)
    expect(discoverRelic(relics, "rubber_duck")).toBe(false)
    expect(discoverRelic(relics, "toString")).toBe(false)

    const biomes: string[] = []
    expect(discoverBiome(biomes, "subphotic")).toBe(true)
    expect(discoverBiome(biomes, "subphotic")).toBe(false)
    expect(discoverBiome(biomes, "toString")).toBe(false)
  })

  it("suma el progreso de todas las secciones", () => {
    const discoveries = {
      discoveredDebris: ["plastic_bottle"],
      discoveredCreatures: ["whale", "whale", "falso"],
      discoveredRelics: ["rubber_duck"],
      discoveredBiomes: ["subphotic", "deepSea"],
    }
    expect(sectionProgress(discoveries, "fauna")).toEqual({
      found: 1,
      total: FAUNA_ENTRIES.length,
    })
    expect(totalCodexProgress(discoveries)).toEqual({
      found: 5,
      total:
        CODEX_ENTRIES.length +
        FAUNA_ENTRIES.length +
        RELIC_ENTRIES.length +
        BIOME_ENTRIES.length,
    })
    expect(
      CODEX_SECTIONS.map((section) => sectionProgress(empty, section).found),
    ).toEqual([0, 0, 0, 0])
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

  it("sanea las secciones nuevas del códice", () => {
    const migrated = migrateMeta({
      version: META_VERSION,
      discoveredCreatures: ["whale", "whale", "dragón"],
      discoveredRelics: ["rubber_duck", 7],
      discoveredBiomes: "subphotic",
    })!
    expect(migrated.discoveredCreatures).toEqual(["whale"])
    expect(migrated.discoveredRelics).toEqual(["rubber_duck"])
    expect(migrated.discoveredBiomes).toEqual([])
  })

  it("un guardado v1 conoce los biomas hasta su zona más profunda", () => {
    const fresh = migrateMeta({ version: 1, bestBiomeIndex: -1 })!
    expect(fresh.version).toBe(META_VERSION)
    expect(fresh.discoveredBiomes).toEqual([])

    // Zona 2 = tercera capa de la ruta: se dan por conocidas sus dos opciones.
    const veteran = migrateMeta({ version: 1, bestBiomeIndex: 2 })!
    expect([...veteran.discoveredBiomes].sort()).toEqual(
      [
        "epipelagic_upper",
        "subphotic",
        "pelagic_mid",
        "mesopelagic_deep",
        "mesopelagic_upper",
      ].sort(),
    )
    expect(veteran.discoveredCreatures).toEqual([])
    expect(veteran.discoveredRelics).toEqual([])
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
