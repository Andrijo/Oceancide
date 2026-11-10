// src/ui/PerfOverlay.ts
// Overlay de rendimiento (FPS, ms/frame, draw calls, triángulos, programas y
// memoria de GPU). Se activa con `?perf` (en dev o junto a `?dev`).

import type * as THREE from "three"

export interface PerfSnapshot {
  fps: number
  frameMs: number
  maxFrameMs: number
  calls: number
  triangles: number
  programs: number
  geometries: number
  textures: number
  lights: number
}

const REFRESH_INTERVAL = 0.5 // s entre refrescos del texto

export class PerfOverlay {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private el: HTMLElement

  private frames = 0
  private accum = 0
  private maxFrame = 0
  private lastTime = 0
  private snapshot: PerfSnapshot = {
    fps: 0,
    frameMs: 0,
    maxFrameMs: 0,
    calls: 0,
    triangles: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
    lights: 0,
  }

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer
    this.scene = scene

    // Con bloom hay varios render() por frame: se acumulan y se resetea a mano
    // en beginFrame() para que `calls` sea el total real del frame.
    renderer.info.autoReset = false

    this.el = document.createElement("pre")
    this.el.id = "perf-overlay"
    this.el.style.cssText = `
      position: absolute;
      top: 10px;
      left: 64px;
      z-index: 500;
      margin: 0;
      padding: 6px 10px;
      font: 11px/1.45 monospace;
      color: #0f0;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #0a0;
      border-radius: 6px;
      pointer-events: none;
      white-space: pre;
    `
    document.getElementById("game-container")!.appendChild(this.el)
  }

  public getSnapshot(): PerfSnapshot {
    return this.snapshot
  }

  /** Llamar al principio del frame, antes de renderizar. */
  public beginFrame(): void {
    this.renderer.info.reset()
  }

  /** Llamar al final del frame, después de renderizar. */
  public endFrame(nowMs: number): void {
    if (this.lastTime === 0) {
      this.lastTime = nowMs
      return
    }

    const frameMs = nowMs - this.lastTime
    this.lastTime = nowMs
    this.frames++
    this.accum += frameMs
    this.maxFrame = Math.max(this.maxFrame, frameMs)

    if (this.accum < REFRESH_INTERVAL * 1000) return

    const info = this.renderer.info
    const avg = this.accum / this.frames
    this.snapshot = {
      fps: 1000 / avg,
      frameMs: avg,
      maxFrameMs: this.maxFrame,
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      lights: this.countLights(),
    }
    this.frames = 0
    this.accum = 0
    this.maxFrame = 0

    const s = this.snapshot
    this.el.textContent =
      `${s.fps.toFixed(0)} fps  ${s.frameMs.toFixed(1)} ms (máx ${s.maxFrameMs.toFixed(0)})\n` +
      `calls ${s.calls}  tris ${(s.triangles / 1000).toFixed(1)}k\n` +
      `programas ${s.programs}  luces ${s.lights}\n` +
      `geom ${s.geometries}  tex ${s.textures}`
  }

  private countLights(): number {
    let count = 0
    this.scene.traverse((obj) => {
      if ((obj as THREE.Light).isLight) count++
    })
    return count
  }
}
