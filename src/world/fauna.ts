import type { BiomeKey } from "@core/types"
import type {
  BossKind,
  CreatureKind,
  FriendlyKind,
  HostileKind,
} from "@entities/Creature"

export interface BiomeFauna {
  /**
   * Fauna peligrosa propia del bioma, por orden de prioridad: ocupa el hueco
   * de las medusas y, si no cabe toda, se quedan fuera las últimas.
   */
  hostile: Partial<Record<Exclude<HostileKind, "jellyfish">, number>>
  /** Fauna amiga e inofensiva: se suma aparte. */
  friendly: Partial<Record<FriendlyKind, number>>
  /** Megajefe del bioma. */
  boss?: BossKind
}

/**
 * Fauna de cada bioma, además de las medusas. Cuanto más hondo, más peligrosa:
 * arriba hay peces globo y cangrejos; en medio, peces linterna, calamares y
 * barracudas; abajo, anguilas, rapes, pulpos y los megajefes. La fauna amiga
 * está repartida por todos para que siempre haya alguna ayuda.
 */
export const BIOME_FAUNA: Record<BiomeKey, BiomeFauna> = {
  epipelagic_upper: {
    hostile: { pufferfish: 1, scrapCrab: 1 },
    friendly: { dolphin: 1, seahorse: 1, nettedTurtle: 1, cleanerFish: 1 },
  },
  pelagic_mid: {
    hostile: { barracuda: 1, pufferfish: 1 },
    friendly: { fishSchool: 1, dolphin: 1, manta: 1 },
  },
  subphotic: {
    hostile: { barracuda: 1, squid: 1, pufferfish: 1 },
    friendly: { fishSchool: 2, manta: 1, nettedTurtle: 1, remora: 1 },
  },
  mesopelagic_upper: {
    hostile: { lanternfish: 1, squid: 1, scrapCrab: 1 },
    friendly: { fishSchool: 1, seahorse: 1, whale: 1 },
  },
  mesopelagic_deep: {
    hostile: { lanternfish: 2, squid: 1, anemone: 1 },
    friendly: { fishSchool: 1, whale: 1, cleanerFish: 1, remora: 1 },
  },
  bathypelagic_upper: {
    hostile: { eel: 1, anglerfish: 1, lanternfish: 1, anemone: 1 },
    friendly: { nettedTurtle: 1, seahorse: 1 },
  },
  bathypelagic_deep: {
    hostile: { eel: 1, anglerfish: 1, octopus: 1, lanternfish: 1 },
    friendly: { whale: 1, nettedTurtle: 1, seahorse: 1 },
    boss: "netKraken",
  },
  abyssopelagic: {
    hostile: { eel: 1, octopus: 1, anglerfish: 1, anemone: 1, scrapCrab: 1 },
    friendly: { remora: 1, cleanerFish: 1, manta: 1 },
    boss: "scrapShark",
  },
  hadopelagic: {
    hostile: { eel: 2, anglerfish: 2, octopus: 1 },
    friendly: { seahorse: 1, remora: 1 },
    boss: "netKraken",
  },
  deepSea: {
    hostile: { eel: 1, octopus: 1, anglerfish: 1, lanternfish: 1, squid: 1 },
    friendly: { whale: 1, nettedTurtle: 1, remora: 1, seahorse: 1 },
    boss: "leviathan",
  },
}

/**
 * Lista de criaturas de un bioma. `hostileCount` es el total de fauna
 * peligrosa (lo que antes eran solo medusas): las criaturas propias del bioma
 * que hacen daño ocupan su hueco y siempre queda al menos una medusa. La fauna
 * amiga y el megajefe se suman aparte.
 */
export function faunaFor(
  biome: BiomeKey,
  hostileCount: number,
): CreatureKind[] {
  const total = Math.max(0, Math.floor(hostileCount))
  const { hostile, friendly, boss } = BIOME_FAUNA[biome]
  const fauna: CreatureKind[] = []

  let placed = 0
  for (const [kind, count] of Object.entries(hostile) as [
    HostileKind,
    number,
  ][]) {
    for (let i = 0; i < count && placed < total - 1; i++) {
      fauna.push(kind)
      placed++
    }
  }
  for (let i = placed; i < total; i++) fauna.push("jellyfish")

  for (const [kind, count] of Object.entries(friendly) as [
    FriendlyKind,
    number,
  ][]) {
    for (let i = 0; i < count; i++) fauna.push(kind)
  }

  if (boss) fauna.push(boss)
  return fauna
}
