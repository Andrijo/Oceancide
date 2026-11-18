import type { Rng } from "@core/rng"
import type { CreatureLook } from "../look"
import type { GenericKind } from "../species"
import {
  cleanerFish,
  dolphin,
  manta,
  nettedTurtle,
  remora,
  seahorse,
  whale,
} from "./friendly"
import {
  anemone,
  anglerfish,
  barracuda,
  lanternfish,
  octopus,
  pufferfish,
  scrapCrab,
  squid,
} from "./hostile"

/** Especies con modelo propio montado con el kit. */
export type ModelKind = GenericKind | "lanternfish"

const BUILDERS: Record<ModelKind, (rng: Rng) => CreatureLook> = {
  pufferfish,
  barracuda,
  anglerfish,
  octopus,
  squid,
  scrapCrab,
  anemone,
  lanternfish,
  dolphin,
  seahorse,
  remora,
  manta,
  whale,
  cleanerFish,
  nettedTurtle,
}

export const MODEL_KINDS = Object.keys(BUILDERS) as ModelKind[]

/** Monta el modelo de una especie (tamaño al azar dentro de su rango). */
export function buildModel(kind: ModelKind, rng: Rng): CreatureLook {
  return BUILDERS[kind](rng)
}
