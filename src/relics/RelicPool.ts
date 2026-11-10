// src/relics/RelicPool.ts
// Reliquias: objetos perdidos en el mar que se esconden dentro de un desecho a
// partir de la primera carta elegida. Recoger ese desecho entrega la recompensa.

import type { Rng } from "@core/rng"
import type { EventEffects } from "@/events/EventEffects"

export interface Relic {
  id: string
  name: string
  /** Texto de ambientación; aquí viven los guiños. */
  description: string
  /** Recompensa declarativa: se aplica igual que los efectos de un evento. */
  effects: EventEffects
}

export const RELICS: Relic[] = [
  {
    id: "castaway_compass",
    name: "Brújula del Náufrago",
    description:
      "Ya no señala el norte: apunta a lo que el mar quiere devolver.",
    effects: { collectionRadius: 0.5 },
  },
  {
    id: "bottle_message",
    name: "Mensaje en una Botella",
    description: "«Si lees esto, limpia un poco también por mí.»",
    effects: { eco: 200 },
  },
  {
    id: "rubber_duck",
    name: "Patito de Goma",
    description:
      "Uno de los casi 29.000 que cayeron al Pacífico en 1992. Sigue de viaje.",
    effects: { speedMultiplier: 1.05 },
  },
  {
    id: "galleon_coin",
    name: "Moneda de Galeón",
    description: "Lleva siglos esperando a que alguien la gaste en algo bueno.",
    effects: { eco: 350 },
  },
  {
    id: "ancient_pearl",
    name: "Perla Antigua",
    description:
      "Una ostra tardó una vida entera en convertir un daño en esto.",
    effects: { toxicity: -30 },
  },
  {
    id: "sand_glass",
    name: "Ampolleta de Arena",
    description:
      "El reloj de un barco que nunca llegó a puerto. Aún le queda arena.",
    effects: { nextBiomeTimeDelta: 20 },
  },
  {
    id: "diver_lantern",
    name: "Farol de Buzo",
    description: "Sigue encendido. Nadie sabe quién lo dejó aquí abajo.",
    effects: { glow: 0.3, eco: 100 },
  },
  {
    id: "megalodon_tooth",
    name: "Diente de Megalodón",
    description: "Del tamaño de tu aleta. Su dueño ya no lo necesita.",
    effects: { filterCapacity: 1 },
  },
  {
    id: "whispering_conch",
    name: "Caracola Susurrante",
    description:
      "Si escuchas con calma, dentro todavía suena un océano limpio.",
    effects: { toxicity: -15, eco: 100 },
  },
  {
    id: "empty_shell",
    name: "Caparazón Vacío",
    description:
      "Alguien intentó limpiar todo esto antes que tú. Ahora te toca a ti.",
    effects: { speedMultiplier: 1.03, collectionRadius: 0.3 },
  },
]

/**
 * Elige la reliquia del bioma. Evita repetir las ya encontradas en la run y,
 * si se han encontrado todas (modo sin fin), vuelve a sortear entre el total.
 */
export function pickRelic(rng: Rng, foundIds: readonly string[] = []): Relic {
  const fresh = RELICS.filter((relic) => !foundIds.includes(relic.id))
  return rng.pick(fresh.length > 0 ? fresh : RELICS)
}

/** Lo mínimo que hace falta saber de un desecho para esconderle una reliquia. */
export interface RelicCarrierCandidate {
  isFragment: boolean
  removed: boolean
  claimed: boolean
}

/**
 * Elige el desecho que esconde la reliquia: cualquiera que cuente para la
 * zona (no microfragmentos) y siga libre. `null` si no hay ninguno.
 */
export function pickRelicCarrier<T extends RelicCarrierCandidate>(
  candidates: readonly T[],
  rng: Rng,
): T | null {
  const eligible = candidates.filter(
    (debris) => !debris.isFragment && !debris.removed && !debris.claimed,
  )
  return eligible.length > 0 ? rng.pick(eligible) : null
}
