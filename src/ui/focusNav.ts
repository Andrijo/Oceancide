// src/ui/focusNav.ts
// Navegación espacial por los controles de una pantalla: mueve el foco al
// control más cercano en una dirección según su posición en pantalla. La usan
// las flechas en las cuadrículas de botones y la cruceta del mando.

export type Direction = "up" | "down" | "left" | "right"

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** Vector unitario (en coordenadas de pantalla) de cada dirección. */
const VECTORS: Record<Direction, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

/**
 * Candidato más cercano a `from` en la dirección pedida. La desviación lateral
 * pesa el doble para preferir el vecino alineado. `undefined` si no hay
 * ninguno en esa dirección.
 */
export function pickNeighbor<T>(
  from: Rect,
  candidates: readonly { item: T; rect: Rect }[],
  direction: Direction,
): T | undefined {
  const dir = VECTORS[direction]
  const fx = from.left + from.width / 2
  const fy = from.top + from.height / 2

  let best: T | undefined
  let bestScore = Infinity
  for (const { item, rect } of candidates) {
    const dx = rect.left + rect.width / 2 - fx
    const dy = rect.top + rect.height / 2 - fy
    const along = dx * dir.x + dy * dir.y
    if (along <= 1) continue
    const across = Math.abs(dx * dir.y) + Math.abs(dy * dir.x)
    const score = along + across * 2
    if (score < bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

/**
 * Controles enfocables y visibles de `root`, en orden de documento. Salta lo
 * que esté bajo un `inert` (la pantalla tapada por un diálogo de confirmación).
 */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => {
      if (el.closest("[inert]")) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    },
  )
}

/**
 * A dónde lleva Tab (o Mayús+Tab con `backwards`) para que el foco no salga de
 * un diálogo: al pasar del último vuelve al primero y al revés, y si el foco
 * está fuera, entra por el principio (o el final). `null` cuando el navegador
 * puede moverlo él solo.
 */
export function trapTabTarget<T>(
  items: readonly T[],
  active: T | null,
  backwards: boolean,
): T | null {
  const first = items[0]
  const last = items[items.length - 1]
  if (first === undefined || last === undefined) return null
  if (active === null || !items.includes(active)) {
    return backwards ? last : first
  }
  if (backwards && active === first) return last
  if (!backwards && active === last) return first
  return null
}

function focusedIn(root: HTMLElement): HTMLElement | null {
  const current = document.activeElement
  return current instanceof HTMLElement && root.contains(current)
    ? current
    : null
}

function isRange(el: HTMLElement): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === "range"
}

/**
 * Mueve el foco dentro de `root`. En un slider, izquierda y derecha cambian su
 * valor. Sin nada enfocado, enfoca el primer control.
 */
export function moveFocus(root: HTMLElement, direction: Direction): void {
  const current = focusedIn(root)
  if (!current) {
    focusables(root)[0]?.focus()
    return
  }

  if (isRange(current) && (direction === "left" || direction === "right")) {
    const before = current.value
    if (direction === "right") current.stepUp()
    else current.stepDown()
    if (current.value !== before) {
      current.dispatchEvent(new Event("input", { bubbles: true }))
    }
    return
  }

  const target = pickNeighbor(
    current.getBoundingClientRect(),
    focusables(root)
      .filter((el) => el !== current)
      .map((el) => ({ item: el, rect: el.getBoundingClientRect() })),
    direction,
  )
  target?.focus()
}

/** Pulsa el control enfocado (botón, opción o casilla). */
export function activateFocused(root: HTMLElement): void {
  const current = focusedIn(root)
  if (!current) {
    focusables(root)[0]?.focus()
    return
  }
  if (isRange(current)) return
  current.click()
}

function isScrollable(el: HTMLElement): boolean {
  const overflow = getComputedStyle(el).overflowY
  return (
    (overflow === "auto" || overflow === "scroll") &&
    el.scrollHeight > el.clientHeight
  )
}

/**
 * Desplaza en vertical el contenedor con scroll que contiene el foco (o el
 * primero que haya en `root`), para leer las pantallas largas.
 */
export function scrollFocused(root: HTMLElement, pixels: number): void {
  for (
    let node: HTMLElement | null = focusedIn(root);
    node && node !== root;
    node = node.parentElement
  ) {
    if (isScrollable(node)) {
      node.scrollTop += pixels
      return
    }
  }

  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]
  const scroller = all.find(isScrollable)
  if (scroller) scroller.scrollTop += pixels
}
