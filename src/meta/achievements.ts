// src/meta/achievements.ts
// Logros: objetivos a largo plazo. Algunos desbloquean cartas que no salen en
// las elecciones hasta conseguirlos, así que siempre queda algo que perseguir
// aunque se hayan comprado todas las mejoras.

import type { RunSummary } from "@core/types"
import type { CardRarity } from "@cards/Card"
import { CARD_POOL } from "@cards/CardPool"
import { codexProgress } from "@/meta/codex"

/** Lo que miran los logros: el progreso guardado y, si acaba de terminar, la run. */
export interface AchievementContext {
  meta: {
    runsPlayed: number
    runsCompleted: number
    totalDebris: number
    lifetimeEco: number
    leaksClosed: number
    discoveredDebris: readonly string[]
  }
  /** Run recién terminada (no hay al revisar los logros desde el inicio). */
  summary?: RunSummary
}

export interface Achievement {
  id: string
  name: string
  description: string
  check(ctx: AchievementContext): boolean
  /** Cartas que se añaden a las elecciones al conseguirlo. */
  unlocksCards?: readonly string[]
}

const rarityOf = (id: string): CardRarity | undefined =>
  CARD_POOL.find((card) => card.id === id)?.rarity

const completed = (s?: RunSummary): s is RunSummary =>
  s !== undefined && !s.endless && s.outcome === "completed"

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first_dive",
    name: "Primera inmersión",
    description: "Termina tu primera inmersión, como sea.",
    check: ({ meta }) => meta.runsPlayed >= 1,
  },
  {
    id: "first_clear",
    name: "Hasta el fondo",
    description: "Limpia los seis biomas en el modo normal.",
    check: ({ meta }) => meta.runsCompleted >= 1,
    unlocksCards: ["ocean_heart"],
  },
  {
    id: "no_revive",
    name: "Sin red",
    description: "Completa una inmersión sin usar ningún revive.",
    check: ({ summary }) =>
      completed(summary) && (summary.revivesUsed ?? 0) === 0,
    unlocksCards: ["abyssal_fury"],
  },
  {
    id: "commons_only",
    name: "Con lo básico",
    description:
      "Completa una inmersión eligiendo solo cartas comunes (al menos 3).",
    check: ({ summary }) =>
      completed(summary) &&
      summary.cardsPicked.length >= 3 &&
      summary.cardsPicked.every((id) => rarityOf(id) === "common"),
    unlocksCards: ["ancestral_current"],
  },
  {
    id: "leaks_50",
    name: "Plomera del océano",
    description: "Cierra 50 fugas en total.",
    check: ({ meta }) => meta.leaksClosed >= 50,
    unlocksCards: ["leak_hunter"],
  },
  {
    id: "debris_1000",
    name: "Mil desechos",
    description: "Recoge 1,000 desechos en total.",
    check: ({ meta }) => meta.totalDebris >= 1000,
    unlocksCards: ["whirlwind"],
  },
  {
    id: "codex_half",
    name: "Naturalista",
    description: "Registra la mitad de los desechos del códice.",
    check: ({ meta }) => {
      const { found, total } = codexProgress(meta.discoveredDebris)
      return found * 2 >= total
    },
    unlocksCards: ["bioluminescence"],
  },
  {
    id: "codex_full",
    name: "Enciclopedia marina",
    description: "Registra todos los desechos del códice.",
    check: ({ meta }) => {
      const { found, total } = codexProgress(meta.discoveredDebris)
      return found >= total
    },
  },
  {
    id: "endless_loop",
    name: "Sin fin",
    description: "Cierra una vuelta completa en la inmersión sin fin.",
    check: ({ summary }) =>
      summary !== undefined && summary.endless && summary.loopsCompleted >= 1,
    unlocksCards: ["endless_tide"],
  },
  {
    id: "daily_clear",
    name: "Constancia",
    description: "Completa un desafío diario.",
    check: ({ summary }) => completed(summary) && summary.daily !== undefined,
  },
  {
    id: "eco_20000",
    name: "Conciencia ecológica",
    description: "Acumula 20,000 de Eco a lo largo de todas tus inmersiones.",
    check: ({ meta }) => meta.lifetimeEco >= 20000,
    unlocksCards: ["amplifier"],
  },
]

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id))

export function isAchievementId(id: unknown): id is string {
  return typeof id === "string" && ACHIEVEMENT_IDS.has(id)
}

/** Ids de los logros que se consiguen ahora y no estaban en `unlocked`. */
export function evaluateAchievements(
  ctx: AchievementContext,
  unlocked: readonly string[],
): string[] {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !unlocked.includes(achievement.id) && achievement.check(ctx),
  ).map((achievement) => achievement.id)
}

/** Cartas que siguen bloqueadas: las que desbloquean logros aún no conseguidos. */
export function lockedCards(unlocked: readonly string[]): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id)).flatMap(
    (a) => a.unlocksCards ?? [],
  )
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id)
}

/** Texto de la recompensa ("Desbloquea: Corazón del Océano"). */
export function rewardText(achievement: Achievement): string | null {
  const names = (achievement.unlocksCards ?? []).map(
    (id) => CARD_POOL.find((card) => card.id === id)?.name ?? id,
  )
  return names.length > 0 ? `Desbloquea: ${names.join(", ")}` : null
}
