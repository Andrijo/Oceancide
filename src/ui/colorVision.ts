// src/ui/colorVision.ts
// Modo para daltonismo. Las paletas viven en styles.css como variables
// (--c-good, --c-bad, --c-warn, --c-leak, --c-debris) y cambian según
// `data-color-vision` en <html>. Con cualquier modo activo se añade además la
// clase `color-assist`, que activa pistas que no dependen del color (símbolos
// ▲ ▼ y formas distintas).

import type { ColorVisionMode } from "@core/settings"

export const COLOR_ASSIST_CLASS = "color-assist"

/**
 * Colores con significado. Úsalos en estilos en línea en lugar de un hex fijo
 * para que respeten el modo para daltonismo.
 */
export const SEMANTIC = {
  good: "var(--c-good)",
  bad: "var(--c-bad)",
  warn: "var(--c-warn)",
  leak: "var(--c-leak)",
  debris: "var(--c-debris)",
} as const

/** Mezcla un color semántico con transparencia (bordes y fondos suaves). */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

/** Aplica el modo al momento: paleta y pistas sin color. */
export function setColorVisionMode(next: ColorVisionMode): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.dataset.colorVision = next
  root.classList.toggle(COLOR_ASSIST_CLASS, next !== "off")
}
