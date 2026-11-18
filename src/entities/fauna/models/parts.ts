import type * as THREE from "three"
import type { CreatureLook } from "../look"
import { fin, type ModelKit, type Paint, type Vec3 } from "./kit"

/**
 * Siluetas de aletas y piezas que comparten varias especies. Las verticales
 * van con X hacia atrás e Y hacia arriba; las horizontales, con X hacia fuera
 * e Y hacia atrás (ver `fin`).
 */

const PI = Math.PI

export type Outline = Array<[number, number]>

/** Cola ahorquillada (barracuda, rémora, pez limpiador, pez linterna). */
export const FORKED_TAIL: Outline = [
  [0, 0.1],
  [0.3, 0.14],
  [0.72, 0.62],
  [0.5, 0],
  [0.72, -0.62],
  [0.3, -0.14],
  [0, -0.1],
]

/** Cola en abanico (pez globo, rape). */
export const ROUND_TAIL: Outline = [
  [0, 0.08],
  [0.28, 0.3],
  [0.46, 0.2],
  [0.52, 0],
  [0.46, -0.2],
  [0.28, -0.3],
  [0, -0.08],
]

/** Aleta caudal horizontal de cetáceo (X a los lados, Y hacia atrás). */
export const FLUKE: Outline = [
  [0, -0.05],
  [0.35, 0.15],
  [0.75, 0.42],
  [0.6, 0.55],
  [0.22, 0.42],
  [0, 0.5],
  [-0.22, 0.42],
  [-0.6, 0.55],
  [-0.75, 0.42],
  [-0.35, 0.15],
]

export const PECTORAL: Outline = [
  [0, 0],
  [0.75, 0.28],
  [0.85, 0.55],
  [0.55, 0.62],
  [0, 0.32],
]

export const DORSAL: Outline = [
  [0, 0],
  [0.2, 0.55],
  [0.45, 0.45],
  [0.7, 0],
]

/** Aleta dorsal en hoz (delfín). */
export const FALCATE: Outline = [
  [0, 0],
  [0.22, 0.3],
  [0.5, 0.48],
  [0.4, 0.22],
  [0.55, 0],
]

/** Aleta baja y larga (rémora, pez limpiador). */
export const LONG_FIN: Outline = [
  [0, 0],
  [0.08, 0.09],
  [0.42, 0.06],
  [0.48, 0],
]

export const SMALL_FIN: Outline = [
  [0, 0],
  [0.12, 0.18],
  [0.26, 0.02],
]

/** Aleta vertical estática sobre el lomo (o bajo el vientre con `below`). */
export function verticalFin(
  kit: ModelKit,
  parent: THREE.Object3D,
  outline: Outline,
  at: Vec3,
  size: number,
  material: THREE.Material,
  below = false,
): void {
  kit.part(parent, fin(outline), material, {
    at,
    rot: [0, PI / 2, 0],
    scale: [size, below ? -size : size, 1],
  })
}

export interface PectoralOptions {
  outline?: Outline
  /** Cuánto caen hacia abajo (rad). */
  droop?: number
  thickness?: number
  paint?: Paint | number
}

/** Par de aletas pectorales articuladas (`at` es la del lado derecho). */
export function pectorals(
  kit: ModelKit,
  look: CreatureLook,
  at: Vec3,
  size: number,
  material: THREE.Material,
  options: PectoralOptions = {},
): void {
  const geometry = fin(
    options.outline ?? PECTORAL,
    options.thickness ?? 0.03,
    options.paint,
  )
  const droop = options.droop ?? 0.25
  for (const side of [-1, 1]) {
    const pivot = kit.pivot(
      look.body,
      [side * at[0], at[1], at[2]],
      [0, 0, -side * droop],
    )
    pivot.userData.side = side
    kit.part(pivot, geometry, material, {
      rot: [-PI / 2, 0, 0],
      scale: [side * size, size, 1],
    })
    look.fins.push(pivot)
  }
}

/** Aleta caudal vertical en su propio pivote, al final de la cola. */
export function tailFin(
  kit: ModelKit,
  look: CreatureLook,
  parent: THREE.Object3D,
  at: Vec3,
  outline: Outline,
  size: number,
  material: THREE.Material,
): THREE.Group {
  const pivot = kit.pivot(parent, at)
  kit.part(pivot, fin(outline), material, {
    rot: [0, PI / 2, 0],
    scale: [size, size, 1],
  })
  look.tail.push(pivot)
  return pivot
}

/** Aleta caudal horizontal (cetáceos): bate arriba y abajo. */
export function flukeFin(
  kit: ModelKit,
  look: CreatureLook,
  parent: THREE.Object3D,
  at: Vec3,
  size: number,
  material: THREE.Material,
  paint?: Paint | number,
  thickness = 0.04,
): THREE.Group {
  const pivot = kit.pivot(parent, at)
  pivot.userData.axis = "x"
  kit.part(pivot, fin(FLUKE, thickness, paint), material, {
    rot: [-PI / 2, 0, 0],
    scale: [size, size, 1],
  })
  look.tail.push(pivot)
  return pivot
}
