// src/StructureConfig.ts
// Estructuras que el jugador puede construir durante una run (definidas como datos).

export type StructureKey = "filter"

export interface StructureConfig {
  name: string
  cost: number // Conciencia Ecológica que cuesta construirla
  radius: number // alcance (unidades) para atraer desechos
  interval: number // segundos entre un desecho y el siguiente
  capacity: number // desechos que absorbe antes de saturarse y desaparecer
  yield: number // fracción del ecoValue del desecho que da al absorberlo (0..1)
  color: number
}

export const STRUCTURES: Record<StructureKey, StructureConfig> = {
  filter: {
    name: "Filtro",
    cost: 40,
    radius: 12,
    interval: 1,
    capacity: 8,
    yield: 0.5,
    color: 0x44ffee,
  },
}
