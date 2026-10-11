// src/StructureConfig.ts

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
    name: "Esfera filtradora",
    // Antes 40 → necesitabas ~1.5 desechos tóxicos para el primer filtro.
    // Ahora 25 → ~1 desecho. El primer filtro llega antes y se siente recompensa.
    cost: 25,
    radius: 12,
    interval: 1,
    capacity: 8,
    yield: 0.5,
    color: 0x44ffee,
  },
}
