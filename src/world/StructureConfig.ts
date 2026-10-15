export type StructureKey = "filter"

export interface StructureConfig {
  name: string
  cost: number
  radius: number
  interval: number
  capacity: number
  yield: number
  color: number
}

export const STRUCTURES: Record<StructureKey, StructureConfig> = {
  filter: {
    name: "Esfera filtradora",
    cost: 40,
    radius: 12,
    interval: 1,
    capacity: 8,
    yield: 0.75,
    color: 0x44ffee,
  },
}
