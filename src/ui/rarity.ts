// src/ui/rarity.ts
// Cómo se muestra cada rareza de carta. Los colores son tokens de styles.css
// (--rarity-*, aplicados con la clase `rarity-<id>`); además del color, cada
// rareza tiene un icono con forma propia para que se distingan sin depender
// de él (rara y ultra se confunden con algunos daltonismos).

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

/** Silueta de cada rareza (viewBox 24×24, relleno con currentColor). */
export const RARITY_ICON_PATHS: Record<CardRarity, string> = {
  // Círculo
  common: "M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z",
  // Rombo
  rare: "M12 3l8 9-8 9-8-9z",
  // Triángulo
  epic: "M12 3l9 17H3z",
  // Estrella de cinco puntas
  legendary:
    "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z",
  // Aspa
  curse:
    "M5.6 3.5L12 9.9l6.4-6.4 2.1 2.1L14.1 12l6.4 6.4-2.1 2.1L12 14.1l-6.4 6.4-2.1-2.1L9.9 12 3.5 5.6z",
  // Destello de cuatro puntas
  ultra_legendary: "M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z",
  // Rayo
  chaos: "M13 2L4 14h7l-1 8 9-12h-7z",
}

/** Clase que fija --rarity y --rarity-bg (ver styles.css). */
export function rarityClass(rarity: CardRarity): string {
  return `rarity-${rarity.replace("_", "-")}`
}

/** Icono decorativo de la rareza; el nombre va siempre en el texto. */
export function rarityIcon(rarity: CardRarity): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("aria-hidden", "true")
  svg.setAttribute("focusable", "false")
  svg.classList.add("rarity-icon")
  const path = document.createElementNS(ns, "path")
  path.setAttribute("d", RARITY_ICON_PATHS[rarity])
  path.setAttribute("fill", "currentColor")
  svg.append(path)
  return svg
}
