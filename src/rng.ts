// src/rng.ts
// Generador pseudoaleatorio con semilla (mulberry32): misma semilla => mismo bioma.

export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Número en [0, 1). */
  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Número en [min, max). */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Entero en [0, maxExclusive). */
  public int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  public pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/** Deriva una semilla independiente a partir de otra (p. ej. una por bioma). */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
