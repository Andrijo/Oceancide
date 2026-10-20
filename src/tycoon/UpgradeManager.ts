import type { MetaState } from "@core/MetaState"
import type { TurtleStats } from "@core/types"
import { UPGRADES } from "./Upgrades"

export class UpgradeManager {
  public canBuy(meta: MetaState, upgradeId: string): boolean {
    const upgrade = UPGRADES.find((u) => u.id === upgradeId)
    if (!upgrade) return false

    const currentLevel = meta.upgrades[upgradeId] || 0
    if (currentLevel >= upgrade.maxLevel) return false

    const cost = upgrade.costs[currentLevel]
    return meta.ecoPoints >= cost
  }

  public buy(meta: MetaState, upgradeId: string): boolean {
    if (!this.canBuy(meta, upgradeId)) return false

    const upgrade = UPGRADES.find((u) => u.id === upgradeId)!
    const currentLevel = meta.upgrades[upgradeId] || 0
    const cost = upgrade.costs[currentLevel]

    meta.ecoPoints -= cost
    meta.upgrades[upgradeId] = currentLevel + 1
    return true
  }

  public applyAll(
    meta: MetaState,
    stats: TurtleStats,
  ): { ecoMult: number; toxScaleMult: number } {
    let ecoMult = 1
    let toxScaleMult = 1

    for (const upgrade of UPGRADES) {
      const level = meta.upgrades[upgrade.id] || 0
      if (level > 0) {
        upgrade.apply(stats, level)

        if (upgrade.id === "eco") ecoMult += level * 0.1
        if (upgrade.id === "immune") toxScaleMult -= level * 0.05
      }
    }

    return { ecoMult, toxScaleMult }
  }
}
