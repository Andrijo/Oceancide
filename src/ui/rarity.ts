// src/ui/rarity.ts
// Cómo se muestra cada rareza de carta. Los colores son tokens de styles.css
// (--rarity-*, aplicados con la clase `rarity-<id>`). Además del color, la
// rareza va siempre escrita, para que se distinga sin depender de él (rara y
// ultra se confunden con algunos daltonismos).

import type { CardRarity } from "@cards/Card"

export const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Común",
  rare: "Rara",
  epic: "Épica",
  legendary: "Legendaria",
  curse: "Maldición",
  ultra_legendary: "Ultra Legendaria",
  chaos: "Caos",
}

/** Clase que fija --rarity y --rarity-bg (ver styles.css). */
export function rarityClass(rarity: CardRarity): string {
  return `rarity-${rarity.replace("_", "-")}`
}
