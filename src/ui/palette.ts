// src/ui/palette.ts
// Paleta de la interfaz. Los tres colores base y sus derivados; los colores con
// significado propio (rarezas, peligro, toxicidad, positivo/negativo) no salen
// de aquí porque tienen que distinguirse de la paleta.

/** Crema: texto principal y superficies claras. */
export const CREAM = "#f5eedd"
/** Azul niebla: acentos, bordes, foco y texto secundario. */
export const MIST = "#84b3c3"
/** Azul profundo: fondos de botones, paneles y avisos. */
export const DEEP = "#16587b"
/** Azul profundo aclarado, para el hover de lo que usa DEEP de fondo. */
export const DEEP_HOVER = "#1d6a92"

const CREAM_RGB = "245, 238, 221"
const MIST_RGB = "132, 179, 195"
const DEEP_RGB = "22, 88, 123"

export const cream = (alpha: number): string => `rgba(${CREAM_RGB}, ${alpha})`
export const mist = (alpha: number): string => `rgba(${MIST_RGB}, ${alpha})`
export const deep = (alpha: number): string => `rgba(${DEEP_RGB}, ${alpha})`
