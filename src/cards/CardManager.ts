// Lógica de selección y aplicación de cartas.

import type { Rng } from "@core/rng"
import type { Card, CardContext } from "./Card"
import { CARD_POOL, RARITY_WEIGHTS } from "./CardPool"

export class CardManager {
  private pool: Card[]

  constructor() {
    this.pool = [...CARD_POOL]
  }

  /** Devuelve `count` cartas únicas, ponderadas por rareza. */
  public rollChoices(count: number, rng: Rng): Card[] {
    const chosen: Card[] = []
    const used = new Set<string>()

    // Protección contra pools pequeños
    const maxTries = count * 20
    let tries = 0

    while (chosen.length < count && tries < maxTries) {
      tries++
      const card = this.rollOne(rng)
      if (used.has(card.id)) continue
      used.add(card.id)
      chosen.push(card)
    }

    return chosen
  }

  private rollOne(rng: Rng): Card {
    // Suma total de pesos
    let total = 0
    for (const card of this.pool) {
      total += RARITY_WEIGHTS[card.rarity]
    }

    let roll = rng.next() * total
    for (const card of this.pool) {
      roll -= RARITY_WEIGHTS[card.rarity]
      if (roll <= 0) return card
    }

    // Fallback por si algo va mal
    return this.pool[0]
  }

  /** Aplica la carta y la guarda en el RunState. */
  public pick(card: Card, ctx: CardContext): void {
    card.apply(ctx)
    ctx.run.cards.push(card)
  }
}
