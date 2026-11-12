// src/ui/upgradeView.ts
// Estado que pinta cada tarjeta de la pantalla de mejoras. Se recalcula tras
// cada compra para actualizar las tarjetas sin volver a montar la pantalla.

import type { MetaState } from "@core/MetaState"
import type { Upgrade } from "@/tycoon/Upgrades"

export interface UpgradeView {
  level: number
  maxLevel: number
  isMax: boolean
  /** Coste del siguiente nivel (0 si ya está al máximo). */
  cost: number
  canBuy: boolean
  buttonLabel: string
  /** Por qué no se puede comprar (vacío si se puede o ya está al máximo). */
  status: string
}

export function upgradeView(
  meta: Pick<MetaState, "upgrades" | "ecoPoints">,
  upgrade: Pick<Upgrade, "id" | "maxLevel" | "costs">,
): UpgradeView {
  const level = meta.upgrades[upgrade.id] || 0
  const isMax = level >= upgrade.maxLevel
  const cost = isMax ? 0 : (upgrade.costs[level] ?? 0)
  const missing = Math.max(0, cost - meta.ecoPoints)
  const canBuy = !isMax && missing === 0

  return {
    level,
    maxLevel: upgrade.maxLevel,
    isMax,
    cost,
    canBuy,
    buttonLabel: isMax
      ? "Nivel máximo"
      : `Comprar · ${cost.toLocaleString("es")} Eco`,
    status:
      isMax || canBuy ? "" : `Te faltan ${missing.toLocaleString("es")} Eco`,
  }
}
