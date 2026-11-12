// src/ui/contrast.ts
// Contraste de color según WCAG 2.x, para comprobar en los tests que el HUD se
// lee sobre el agua de cualquier bioma.

/** Color sRGB con canales 0..255 y alfa 0..1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Lee `#rgb`, `#rrggbb`, `rgb(...)` o `rgba(...)`. Lanza si no lo entiende. */
export function parseColor(input: string): Rgba {
  const text = input.trim().toLowerCase()

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text)
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1]
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    }
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(text)
  if (fn) {
    const parts = fn[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
    }
  }

  throw new Error(`Color no soportado: ${input}`)
}

/** Pinta `top` (con su alfa) sobre un fondo opaco, como hace el navegador. */
export function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number): number => t * top.a + b * (1 - top.a)
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a: 1,
  }
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Canal lineal 0..1 (como los colores de Three.js) a sRGB 0..255. */
export function linearToSrgb(channel: number): number {
  const c = Math.min(1, Math.max(0, channel))
  const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return srgb * 255
}

export function relativeLuminance({ r, g, b }: Rgba): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  )
}

/** Relación de contraste (1..21) entre dos colores opacos. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Mínimo de WCAG AA para texto normal. */
export const AA_NORMAL_TEXT = 4.5
