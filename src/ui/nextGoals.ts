// Objetivos pendientes que el resumen de la run deja a la vista: lo que faltó
// de la zona, la mejora que ya se puede comprar (o cuánto falta para la más
// barata) y el siguiente bioma sin descubrir.

import type { MetaState } from "@core/MetaState"
import { BIOME_ORDER, BIOMES, type RunSummary } from "@core/types"
import { affordableUpgrades, nextUpgrades } from "@tycoon/UpgradeManager"

export type NextGoalKind = "zone" | "upgrade" | "biome"

export interface NextGoal {
  kind: NextGoalKind
  text: string
  /** Avance hacia el objetivo (0..1), si tiene sentido pintarlo como barra. */
  progress?: number
}

export interface NextGoalsView {
  goals: NextGoal[]
  /** Mejoras que se pueden comprar ya: el resumen ofrece ir a "Mejoras". */
  affordableCount: number
}

type GoalSummary = Pick<RunSummary, "outcome" | "biomeName" | "zoneProgress">
type GoalMeta = Pick<MetaState, "ecoPoints" | "upgrades" | "bestBiomeIndex">

function formatEco(value: number): string {
  return Math.round(value).toLocaleString("es")
}

function zoneGoal(summary: GoalSummary): NextGoal | null {
  if (summary.outcome === "completed") return null
  const progress = Math.max(0, Math.min(100, summary.zoneProgress))
  if (progress >= 100) return null

  // Nunca "0 %": si quedaba algo por limpiar, se dice al menos un 1 %.
  const remaining = Math.max(1, Math.round(100 - progress))
  return {
    kind: "zone",
    text: `Te quedó un ${remaining} % del ${summary.biomeName} por limpiar`,
    progress: progress / 100,
  }
}

function upgradeGoal(meta: GoalMeta): NextGoal | null {
  const affordable = affordableUpgrades(meta)
  const first = affordable[0]
  if (first) {
    const others = affordable.length - 1
    const more =
      others === 0 ? "" : others === 1 ? " y 1 mejora más" : ` y ${others} más`
    return {
      kind: "upgrade",
      text: `Ya puedes comprar ${first.upgrade.name} (${formatEco(first.cost)} Eco)${more}`,
    }
  }

  const cheapest = nextUpgrades(meta)[0]
  if (!cheapest) return null
  return {
    kind: "upgrade",
    text: `Te faltan ${formatEco(cheapest.cost - meta.ecoPoints)} Eco para ${cheapest.upgrade.name}`,
    progress: Math.max(0, meta.ecoPoints) / cheapest.cost,
  }
}

function biomeGoal(meta: GoalMeta): NextGoal | null {
  const nextKey = BIOME_ORDER[Math.max(0, meta.bestBiomeIndex + 1)]
  if (!nextKey) return null
  const biome = BIOMES[nextKey]
  return {
    kind: "biome",
    text: `Siguiente bioma por descubrir: ${biome.name} · ${biome.depth.toLocaleString("es")} m`,
  }
}

/**
 * Objetivos para el resumen. `meta` ya debe incluir el Eco de la run (se
 * llama después de `applyRunToMeta`).
 */
export function buildNextGoals(
  summary: GoalSummary,
  meta: GoalMeta,
): NextGoalsView {
  const goals = [zoneGoal(summary), upgradeGoal(meta), biomeGoal(meta)].filter(
    (goal): goal is NextGoal => goal !== null,
  )
  return { goals, affordableCount: affordableUpgrades(meta).length }
}
