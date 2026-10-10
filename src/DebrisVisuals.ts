// src/debrisVisuals.ts

export type DebrisShape =
  | "bottle" // Botella con cuello y detalle
  | "drum" // Barril/bidón con relieves
  | "sheet" // Lámina o red
  | "blob" // Fragmento orgánico/roca deformado
  | "ring" // Toroide (neumático, cable)
  | "shard" // Cristal o fragmento afilado
  | "cloud" // Masa de partículas/microplásticos
  | "bar" // Barra o madero rectilíneo

export interface DebrisVisual {
  shape: DebrisShape
  color: number
  scale?: number
  roughness?: number
  metalness?: number
  opacity?: number
  emissive?: number
  glow?: number
  wireframe?: boolean

  // Propiedades físicas para materiales avanzados (MeshPhysicalMaterial)
  transmission?: number // Translucidez/refracción (plásticos, vidrio)
  ior?: number // Índice de refracción (1.33 = agua, 1.5 = vidrio/PET)
  clearcoat?: number // Capa de barniz/brillo superficial de humedad
  clearcoatRoughness?: number
}

export const FALLBACK_VISUAL: DebrisVisual = { shape: "blob", color: 0xff00ff }

export const DEBRIS_VISUALS: Record<string, DebrisVisual> = {
  // Desechos del epilágico superior
  plastic_bottle: {
    shape: "bottle",
    color: 0x9fd8ff,
    opacity: 0.85,
    transmission: 0.7,
    ior: 1.35,
    roughness: 0.2,
    clearcoat: 0.5,
  },
  ghost_net_shallow: {
    shape: "sheet",
    color: 0xd0d0d0,
    scale: 1.6,
    wireframe: true,
  },
  styrofoam_chunk: { shape: "blob", color: 0xf2f2f2, roughness: 0.9 },
  synthetic_microfiber: { shape: "cloud", color: 0xff99cc, opacity: 0.45 },
  oil_slick_patch: {
    shape: "sheet",
    color: 0x1a1a2e,
    scale: 1.4,
    roughness: 0.1,
    metalness: 0.6,
    clearcoat: 1.0,
  },
  straw: { shape: "bar", color: 0xffcc99, scale: 0.8, roughness: 0.8 },

  // Desechos del pelágico
  rubber_tire: { shape: "ring", color: 0x222222, scale: 1.4, roughness: 0.8 },
  aluminum_can: {
    shape: "bottle",
    color: 0xc0c0c8,
    scale: 0.9,
    metalness: 0.85,
    roughness: 0.25,
  },
  glass_bottle: {
    shape: "bottle",
    color: 0x66cc99,
    opacity: 0.7,
    transmission: 0.85,
    ior: 1.5,
    roughness: 0.1,
  },
  fish_trap_lost: {
    shape: "drum",
    color: 0x8a8a8a,
    scale: 1.3,
    wireframe: true,
  },
  microplastic_cluster: { shape: "cloud", color: 0xff6b6b, opacity: 0.55 },

  // Desechos del subfótico
  marine_snow_light: {
    shape: "cloud",
    color: 0xffffff,
    scale: 0.8,
    opacity: 0.35,
  },
  chemical_drum_corroded: {
    shape: "drum",
    color: 0x8a4b2a,
    emissive: 0x44ff66,
    glow: 0.15,
    roughness: 0.8,
  },
  ship_hull_plate: {
    shape: "sheet",
    color: 0x6b4a3a,
    scale: 1.3,
    metalness: 0.6,
    roughness: 0.7,
  },
  nylon_rope_spool: { shape: "ring", color: 0xc8b878, roughness: 0.9 },
  drilling_mud_trace: { shape: "blob", color: 0x3b2f2a, roughness: 1 },

  // --- mesopelagic_upper ---
  chitin_exuviae: { shape: "shard", color: 0xd9a36a, roughness: 0.6 },
  lithium_battery: {
    shape: "bar",
    color: 0x44aaff,
    emissive: 0x2266ff,
    glow: 0.4,
    metalness: 0.7,
  },
  heavy_petroleum_sludge: { shape: "blob", color: 0x0d0d0d, roughness: 0.3 },
  cargo_crate_strap: { shape: "bar", color: 0x3a8fb7, scale: 1.2 },
  dense_marine_snow: { shape: "cloud", color: 0xe8f0ff, opacity: 0.4 },

  // --- mesopelagic_deep ---
  lead_battery_casing: {
    shape: "bar",
    color: 0x6a6a78,
    emissive: 0x88ff00,
    glow: 0.15,
    metalness: 0.5,
  },
  sinking_macroplastic: { shape: "sheet", color: 0x9aa5b1 },
  shipwreck_timber_treated: {
    shape: "bar",
    color: 0x6b4423,
    scale: 1.4,
    roughness: 0.9,
  },
  calcified_shells_drift: { shape: "blob", color: 0xf3e9d2, scale: 0.8 },
  discarded_sonar_buoy: {
    shape: "drum",
    color: 0xcc8800,
    emissive: 0xffaa00,
    glow: 0.25,
    metalness: 0.4,
  },

  // --- bathypelagic_upper ---
  whale_fall_vertebra: {
    shape: "blob",
    color: 0xe9e2cc,
    scale: 1.2,
    roughness: 0.8,
  },
  radioactive_drum_vintage: {
    shape: "drum",
    color: 0xdddd00,
    emissive: 0xccff00,
    glow: 0.6,
  },
  ceramic_insulator_chunk: { shape: "blob", color: 0x9a9a9a, roughness: 0.4 },
  industrial_slag: {
    shape: "blob",
    color: 0x3a2a2a,
    emissive: 0xff4400,
    glow: 0.15,
    roughness: 0.9,
  },
  deep_microplastic_silt: { shape: "cloud", color: 0xff99aa, opacity: 0.5 },

  // --- bathypelagic_deep ---
  whale_skeleton_decay: {
    shape: "bar",
    color: 0xdcd6c0,
    scale: 1.6,
    roughness: 0.9,
  },
  mercury_slag_deposit: {
    shape: "blob",
    color: 0xb0b0c0,
    metalness: 0.9,
    roughness: 0.2,
  },
  ancient_anchor_rust: {
    shape: "shard",
    color: 0x7a3b1d,
    scale: 1.3,
    roughness: 0.9,
  },
  dense_sinking_ash: { shape: "cloud", color: 0x555555, opacity: 0.5 },
  leached_pesticide_canister: {
    shape: "drum",
    color: 0x99cc33,
    emissive: 0x88ff22,
    glow: 0.35,
  },

  // --- abyssopelagic ---
  abyssal_nodule_slag: {
    shape: "blob",
    color: 0x2b2b33,
    metalness: 0.7,
    roughness: 0.4,
  },
  hydrothermal_chimney_chunk: {
    shape: "shard",
    color: 0x4a3a2a,
    scale: 1.4,
    emissive: 0xff7733,
    glow: 0.3,
  },
  abyssal_marine_snow_crust: { shape: "sheet", color: 0xc9c2a8 },
  deep_sea_cable_junk: {
    shape: "ring",
    color: 0x333333,
    scale: 1.2,
    roughness: 0.7,
  },
  heavy_radioactive_cask: {
    shape: "drum",
    color: 0x445544,
    scale: 1.3,
    emissive: 0x66ff33,
    glow: 0.7,
  },

  // --- hadopelagic ---
  trench_microplastic_trap: {
    shape: "cloud",
    color: 0xff6b9b,
    scale: 1.4,
    opacity: 0.6,
  },
  volcanic_basalt_ash: { shape: "cloud", color: 0x2a2a2a, opacity: 0.5 },
  crushed_titanium_landings: {
    shape: "shard",
    color: 0xb7bcc4,
    scale: 1.2,
    metalness: 0.8,
    roughness: 0.3,
  },
  heavy_metal_silt: {
    shape: "blob",
    color: 0x8a7a2a,
    emissive: 0xaaaa00,
    glow: 0.15,
  },
  amphipod_organic_mass: { shape: "blob", color: 0x9b6b5b, roughness: 0.8 },

  // --- deepSea ---
  mariana_pcb_deposit: {
    shape: "blob",
    color: 0xff44aa,
    emissive: 0xff2288,
    glow: 0.6,
  },
  imploded_probe_hull: {
    shape: "shard",
    color: 0x8a9099,
    scale: 1.2,
    metalness: 0.8,
    roughness: 0.3,
  },
  compressed_synthetic_sludge: {
    shape: "blob",
    color: 0x7a3a6a,
    emissive: 0xaa44aa,
    glow: 0.3,
  },
  hydrothermal_sulfide_crust: {
    shape: "shard",
    color: 0xe6c200,
    emissive: 0xffcc00,
    glow: 0.4,
  },
  hadal_trench_debris_cluster: {
    shape: "blob",
    color: 0x884422,
    scale: 1.5,
    emissive: 0xff5522,
    glow: 0.4,
  },
}
