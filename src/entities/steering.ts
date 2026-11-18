import * as THREE from "three"
import type { WorldBounds } from "@core/types"

/** Diferencia angular más corta entre dos rumbos, en -PI..PI. */
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

/** Gira `heading` hacia `target` sin pasar de `maxTurn` radianes. */
export function turnToward(
  heading: number,
  target: number,
  maxTurn: number,
): number {
  const turn = angleDelta(heading, target)
  return heading + THREE.MathUtils.clamp(turn, -maxTurn, maxTurn)
}

/**
 * Rumbo hacia el centro si la posición se acerca al borde del bioma, o `null`
 * si está lejos de él.
 */
export function edgeAvoidance(
  position: THREE.Vector3,
  bounds: WorldBounds,
  margin: number,
): number | null {
  const edge = bounds.halfSize - margin
  if (Math.abs(position.x) <= edge && Math.abs(position.z) <= edge) return null
  return Math.atan2(-position.x, -position.z)
}
