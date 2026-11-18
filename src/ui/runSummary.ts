// src/ui/runSummary.ts
// Piezas puras del resumen de la run: enlace de la semilla, fichas de cartas
// ordenadas por rareza y textos de los récords.

import type { Card, CardRarity } from "@cards/Card"
import type { RecordKind } from "@core/records"

/**
 * Enlace que abre el juego con la misma semilla (`?seed=`, lo lee
 * `seedFromUrl`). Conserva la ruta y el resto de parámetros de `href`.
 */
export function seedShareUrl(href: string, seed: number): string {
  const url = new URL(href)
  url.hash = ""
  url.searchParams.set("seed", String(seed >>> 0))
  return url.toString()
}

/** Orden de las fichas del resumen: de la rareza más alta a la más baja. */
const RARITY_ORDER: readonly CardRarity[] = [
  "ultra_legendary",
  "legendary",
  "epic",
  "rare",
  "common",
  "chaos",
  "curse",
]

export interface SummaryCardChip {
  card: Card
  count: number
}

/**
 * Cartas elegidas agrupadas (la misma carta varias veces es una sola ficha
 * con ×N) y ordenadas por rareza; dentro de una rareza, por orden de elección.
 * Los ID que ya no existen en `pool` se descartan.
 */
export function summaryCardChips(
  cardIds: readonly string[],
  pool: readonly Card[],
): SummaryCardChip[] {
  const chips = new Map<string, SummaryCardChip>()
  for (const id of cardIds) {
    const existing = chips.get(id)
    if (existing) {
      existing.count++
      continue
    }
    const card = pool.find((c) => c.id === id)
    if (card) chips.set(id, { card, count: 1 })
  }
  return [...chips.values()].sort(
    (a, b) =>
      RARITY_ORDER.indexOf(a.card.rarity) - RARITY_ORDER.indexOf(b.card.rarity),
  )
}

export const RECORD_LABELS: Record<RecordKind, string> = {
  biome: "Zona más profunda",
  debris: "Más desechos",
  eco: "Más Eco",
  endless: "Más biomas sin fin",
  fastest: "Inmersión más rápida",
}
