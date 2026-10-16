// src/cards/CardManager.ts
// Lógica de selección y aplicación de cartas.

import type { Rng } from "@core/rng"
import type { Card, CardContext, CardRarity } from "./Card"
import { CARD_POOL, RARITY_WEIGHTS } from "./CardPool"

// Umbrales de pity (en cantidad de rollos consecutivos sin ver la rareza).
const PITY_THRESHOLDS = {
  rare: 4,
  epic: 10,
  legendary: 20,
  ultra: 40,
} as const

// Rarezas que cuentan para cada nivel de pity.
const PITY_QUALIFIES: Record<
  "rare" | "epic" | "legendary" | "ultra",
  CardRarity[]
> = {
  rare: ["rare", "epic", "legendary", "ultra_legendary"],
  epic: ["epic", "legendary", "ultra_legendary"],
  legendary: ["legendary", "ultra_legendary"],
  ultra: ["ultra_legendary"],
}

export class CardManager {
  private pool: Card[]

  // Contadores de pity: cuántos rollos consecutivos sin ver la rareza mínima.
  private pityRare = 0
  private pityEpic = 0
  private pityLegendary = 0
  private pityUltra = 0

  constructor() {
    this.pool = [...CARD_POOL]
  }

  // Resetea los contadores de pity. Llamar al empezar una run.
  public resetPity(): void {
    this.pityRare = 0
    this.pityEpic = 0
    this.pityLegendary = 0
    this.pityUltra = 0
  }

  // Estado actual del pity, para debug o HUD.
  public getPityState(): {
    rare: number
    epic: number
    legendary: number
    ultra: number
  } {
    return {
      rare: this.pityRare,
      epic: this.pityEpic,
      legendary: this.pityLegendary,
      ultra: this.pityUltra,
    }
  }

  // Devuelve `count` cartas únicas ponderadas por rareza, aplicando el pity system.
  public rollChoices(count: number, rng: Rng): Card[] {
    const chosen = this.rollWithoutPity(count, rng)
    this.applyPity(chosen, rng)
    this.updatePityCounters(chosen)
    return chosen
  }

  // Aplica la carta y la guarda en el RunState.
  public pick(card: Card, ctx: CardContext): void {
    card.apply(ctx)
    ctx.run.cards.push(card)
  }

  // --- Roll base ---

  // Roll puro por pesos, sin pity. Devuelve cartas únicas.
  private rollWithoutPity(count: number, rng: Rng): Card[] {
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

  // --- Pity system ---

  // Aplica el pity del nivel MÁS ALTO activo (nunca fuerza varias cartas a la vez).
  private applyPity(choices: Card[], rng: Rng): void {
    // Ultra
    if (this.pityUltra >= PITY_THRESHOLDS.ultra) {
      if (!this.hasRarity(choices, PITY_QUALIFIES.ultra)) {
        this.replaceLastWith(choices, "ultra_legendary", rng)
      }
      return
    }

    // Legendaria+
    if (this.pityLegendary >= PITY_THRESHOLDS.legendary) {
      if (!this.hasRarity(choices, PITY_QUALIFIES.legendary)) {
        this.replaceLastWith(choices, "legendary", rng)
      }
      return
    }

    // Épica+
    if (this.pityEpic >= PITY_THRESHOLDS.epic) {
      if (!this.hasRarity(choices, PITY_QUALIFIES.epic)) {
        this.replaceLastWith(choices, "epic", rng)
      }
      return
    }

    // Rara+
    if (this.pityRare >= PITY_THRESHOLDS.rare) {
      if (!this.hasRarity(choices, PITY_QUALIFIES.rare)) {
        this.replaceLastWith(choices, "rare", rng)
      }
    }
  }

  // True si `choices` contiene al menos una carta con una rareza del set.
  private hasRarity(choices: Card[], rarities: CardRarity[]): boolean {
    return choices.some((c) => rarities.includes(c.rarity))
  }

  // Reemplaza la última carta por una de la rareza pedida, evitando duplicados.
  private replaceLastWith(choices: Card[], rarity: CardRarity, rng: Rng): void {
    const candidates = this.pool.filter((c) => c.rarity === rarity)
    if (candidates.length === 0) return

    // Preferir cartas que no estén ya en `choices`
    const picked = new Set(choices.map((c) => c.id))
    const available = candidates.filter((c) => !picked.has(c.id))
    const pool = available.length > 0 ? available : candidates

    const forced = pool[rng.int(pool.length)]

    if (choices.length > 0) {
      choices[choices.length - 1] = forced
    } else {
      choices.push(forced)
    }
  }

  // Actualiza los contadores: se resetea si su rareza mínima aparece, si no sube 1.
  private updatePityCounters(choices: Card[]): void {
    const has = (rarities: CardRarity[]) =>
      choices.some((c) => rarities.includes(c.rarity))

    if (has(PITY_QUALIFIES.ultra)) {
      this.pityUltra = 0
    } else {
      this.pityUltra++
    }

    if (has(PITY_QUALIFIES.legendary)) {
      this.pityLegendary = 0
    } else {
      this.pityLegendary++
    }

    if (has(PITY_QUALIFIES.epic)) {
      this.pityEpic = 0
    } else {
      this.pityEpic++
    }

    if (has(PITY_QUALIFIES.rare)) {
      this.pityRare = 0
    } else {
      this.pityRare++
    }
  }
}
