// src/ui/EdgeIndicators.ts
import * as THREE from "three"
import type { Debris } from "@entities/Debris"
import {
  computeEdgeIndicator,
  indicatorSlotCount,
  pickIndicatorSlots,
  type IndicatorCandidate,
} from "@ui/offscreenIndicators"
import { SEMANTIC } from "@ui/colorVision"

const MAX_SLOTS = 6
// Colores del modo para daltonismo; con él activo, la fuga cambia también de
// forma (clase edge-arrow-leak, ver styles.css).
const COLOR_DEBRIS = SEMANTIC.debris
const COLOR_LEAK = SEMANTIC.leak

interface Candidate extends IndicatorCandidate {
  position: THREE.Vector3
}

/** Flechas en el borde de la pantalla hacia los desechos fuera de cámara. */
export class EdgeIndicators {
  private readonly root: HTMLElement
  private readonly arrows: HTMLElement[] = []
  private readonly tmp = new THREE.Vector3()
  private visibleCount = 0

  constructor(container: HTMLElement) {
    this.root = document.createElement("div")
    this.root.id = "edge-indicators"
    this.root.setAttribute("aria-hidden", "true")
    this.root.style.cssText =
      "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;"
    for (let i = 0; i < MAX_SLOTS; i++) {
      const arrow = document.createElement("div")
      arrow.style.cssText = `
        position:absolute;left:0;top:0;width:0;height:0;display:none;
        border-top:9px solid transparent;border-bottom:9px solid transparent;
        border-left:18px solid ${COLOR_DEBRIS};
        filter:drop-shadow(0 0 6px currentColor);
      `
      this.root.appendChild(arrow)
      this.arrows.push(arrow)
    }
    container.appendChild(this.root)
  }

  public update(
    debrisList: readonly Debris[],
    origin: THREE.Vector3,
    camera: THREE.Camera,
    timeRatio: number,
  ): void {
    const remaining = debrisList.reduce((n, d) => n + (d.isFragment ? 0 : 1), 0)
    const slots = Math.min(MAX_SLOTS, indicatorSlotCount(remaining, timeRatio))
    const width = window.innerWidth
    const height = window.innerHeight

    const candidates: Candidate[] = []
    for (const debris of debrisList) {
      if (debris.isFragment) continue
      const position = debris.mesh.position
      const ndc = this.tmp.copy(position).project(camera)
      const behind = ndc.z > 1
      if (!behind && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) continue
      candidates.push({
        position,
        distanceSq: position.distanceToSquared(origin),
        leak: debris.hazard === "lixivia",
      })
    }

    const picked = pickIndicatorSlots(candidates, slots)

    let shown = 0
    for (const candidate of picked) {
      if (shown >= MAX_SLOTS) break
      const ndc = this.tmp.copy(candidate.position).project(camera)
      const edge = computeEdgeIndicator(ndc.x, ndc.y, ndc.z > 1, width, height)
      if (!edge) continue
      const arrow = this.arrows[shown++]
      const color = candidate.leak ? COLOR_LEAK : COLOR_DEBRIS
      arrow.style.display = "block"
      arrow.style.color = color
      arrow.style.borderLeftColor = color
      arrow.classList.toggle("edge-arrow-leak", candidate.leak)
      arrow.style.transform = `translate(${edge.x.toFixed(1)}px, ${edge.y.toFixed(1)}px) translate(-50%, -50%) rotate(${edge.angle.toFixed(3)}rad)`
    }
    for (let i = shown; i < this.visibleCount; i++) {
      this.arrows[i].style.display = "none"
    }
    this.visibleCount = shown
  }

  public clear(): void {
    for (const arrow of this.arrows) arrow.style.display = "none"
    this.visibleCount = 0
  }

  public dispose(): void {
    this.root.remove()
  }
}
