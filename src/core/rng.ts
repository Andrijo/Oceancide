// src/rng.ts
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  public range(min: number, max: number): number {
    if (min > max) {
      console.warn(`[Rng.range] min (${min}) > max (${max}); se intercambian`)
      ;[min, max] = [max, min]
    }
    return min + this.next() * (max - min)
  }

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

export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
