// src/debrisVisuals.ts

export type DebrisShape =
  "bottle" | "drum" | "sheet" | "blob" | "ring" | "shard" | "cloud" | "bar"

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

  // MeshPhysicalMaterial
  transmission?: number
  ior?: number
  thickness?: number
  clearcoat?: number
  clearcoatRoughness?: number

  // Nuevos detalles visuales
  weathering?: number // Degradación general
  biofouling?: number // Algas / sedimento biológico
  rust?: number // Corrosión
  wetness?: number // Brillo húmedo
  deformation?: number // Irregularidad geométrica
}

export const FALLBACK_VISUAL: DebrisVisual = {
  shape: "blob",
  color: 0x54636e,
  roughness: 0.9,
  metalness: 0.05,
  weathering: 0.7,
  biofouling: 0.3,
}

export const DEBRIS_VISUALS: Record<string, DebrisVisual> = {
  // -----------------------------
  // Epipelágico superior
  // -----------------------------

  plastic_bottle: {
    shape: "bottle",
    color: 0xa8dcff,
    scale: 1,
    roughness: 0.22,
    metalness: 0,
    opacity: 0.9,
    transmission: 0.7,
    ior: 1.35,
    thickness: 0.35,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    weathering: 0.35,
    biofouling: 0.15,
    wetness: 0.8,
    deformation: 0.15,
  },

  ghost_net_shallow: {
    shape: "sheet",
    color: 0xd6d6d6,
    scale: 1.6,
    roughness: 0.8,
    metalness: 0,
    opacity: 0.78,
    wireframe: true,
    weathering: 0.55,
    biofouling: 0.25,
    deformation: 0.6,
  },

  styrofoam_chunk: {
    shape: "blob",
    color: 0xf4f4f0,
    roughness: 0.95,
    metalness: 0,
    weathering: 0.45,
    biofouling: 0.1,
    deformation: 0.8,
  },

  synthetic_microfiber: {
    shape: "cloud",
    color: 0xff9ec4,
    opacity: 0.5,
    roughness: 0.9,
    weathering: 0.4,
    deformation: 0.9,
  },

  oil_slick_patch: {
    shape: "sheet",
    color: 0x141821,
    scale: 1.4,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    wetness: 1,
    emissive: 0x3a2a6b, // iridiscencia de película de crudo; late por ser fuga
    glow: 0.15,
    deformation: 0.7,
  },

  straw: {
    shape: "bar",
    color: 0xffcf9c,
    scale: 0.8,
    roughness: 0.55,
    metalness: 0,
    weathering: 0.3,
    biofouling: 0.1,
    deformation: 0.2,
  },

  // -----------------------------
  // Pelágico
  // -----------------------------

  rubber_tire: {
    shape: "ring",
    color: 0x1f1f22,
    scale: 1.4,
    roughness: 0.85,
    metalness: 0.02,
    weathering: 0.7,
    biofouling: 0.45,
    deformation: 0.25,
  },

  aluminum_can: {
    shape: "bottle",
    color: 0xb9bec6,
    scale: 0.9,
    roughness: 0.45,
    metalness: 0.9,
    weathering: 0.5,
    biofouling: 0.2,
    rust: 0.15,
    deformation: 0.35,
  },

  glass_bottle: {
    shape: "bottle",
    color: 0x63c79a,
    opacity: 0.75,
    transmission: 0.85,
    ior: 1.5,
    thickness: 0.45,
    roughness: 0.08,
    metalness: 0,
    weathering: 0.25,
    biofouling: 0.2,
    wetness: 1,
    deformation: 0.1,
  },

  fish_trap_lost: {
    shape: "drum",
    color: 0x8f949a,
    scale: 1.3,
    roughness: 0.7,
    metalness: 0.55,
    rust: 0.55,
    weathering: 0.8,
    biofouling: 0.4,
    wireframe: true,
    deformation: 0.4,
  },

  microplastic_cluster: {
    shape: "cloud",
    color: 0xff6b6b,
    opacity: 0.6,
    roughness: 0.7,
    weathering: 0.5,
    deformation: 0.9,
  },

  // -----------------------------
  // Subfótico
  // -----------------------------

  marine_snow_light: {
    shape: "cloud",
    color: 0xeef4ff,
    scale: 0.8,
    opacity: 0.4,
    roughness: 0.95,
    weathering: 0.5,
    deformation: 0.9,
  },

  chemical_drum_corroded: {
    shape: "drum",
    color: 0x7d4526,
    roughness: 0.85,
    metalness: 0.35,
    rust: 0.8,
    biofouling: 0.4,
    weathering: 0.9,
    emissive: 0x2f7a3a,
    glow: 0.12,
    deformation: 0.25,
  },

  ship_hull_plate: {
    shape: "sheet",
    color: 0x5f4436,
    scale: 1.3,
    roughness: 0.72,
    metalness: 0.65,
    rust: 0.75,
    biofouling: 0.5,
    weathering: 0.85,
    deformation: 0.5,
  },

  nylon_rope_spool: {
    shape: "ring",
    color: 0xc9b87a,
    roughness: 0.9,
    metalness: 0,
    weathering: 0.6,
    biofouling: 0.35,
    deformation: 0.5,
  },

  drilling_mud_trace: {
    shape: "blob",
    color: 0x3b2f2a,
    roughness: 0.95,
    metalness: 0.05,
    wetness: 0.7,
    deformation: 0.9,
  },

  // -----------------------------
  // Mesopelágico superior
  // -----------------------------

  chitin_exuviae: {
    shape: "shard",
    color: 0xd9a36a,
    roughness: 0.55,
    metalness: 0.05,
    weathering: 0.4,
    deformation: 0.7,
  },

  lithium_battery: {
    shape: "bar",
    color: 0x3f6f8f,
    roughness: 0.4,
    metalness: 0.75,
    weathering: 0.55,
    rust: 0.2,
    emissive: 0x2a6bff,
    glow: 0.28,
    deformation: 0.2,
  },

  heavy_petroleum_sludge: {
    shape: "blob",
    color: 0x0d0d0f,
    roughness: 0.25,
    metalness: 0.08,
    wetness: 1,
    clearcoat: 0.7,
    deformation: 0.9,
  },

  cargo_crate_strap: {
    shape: "bar",
    color: 0x2f7ea6,
    scale: 1.2,
    roughness: 0.8,
    metalness: 0,
    weathering: 0.55,
    biofouling: 0.3,
    deformation: 0.45,
  },

  dense_marine_snow: {
    shape: "cloud",
    color: 0xe6eefc,
    opacity: 0.45,
    roughness: 0.95,
    weathering: 0.5,
    deformation: 0.9,
  },

  // -----------------------------
  // Mesopelágico profundo
  // -----------------------------

  lead_battery_casing: {
    shape: "bar",
    color: 0x5f606c,
    roughness: 0.65,
    metalness: 0.55,
    rust: 0.6,
    weathering: 0.85,
    biofouling: 0.3,
    emissive: 0x5d7a1f,
    glow: 0.12,
    deformation: 0.3,
  },

  sinking_macroplastic: {
    shape: "sheet",
    color: 0x93a0ac,
    roughness: 0.45,
    metalness: 0,
    weathering: 0.5,
    biofouling: 0.25,
    deformation: 0.6,
  },

  shipwreck_timber_treated: {
    shape: "bar",
    color: 0x5d3c22,
    scale: 1.4,
    roughness: 0.92,
    metalness: 0,
    weathering: 0.9,
    biofouling: 0.55,
    deformation: 0.35,
  },

  calcified_shells_drift: {
    shape: "blob",
    color: 0xf1e7d2,
    scale: 0.8,
    roughness: 0.7,
    metalness: 0.02,
    weathering: 0.45,
    deformation: 0.8,
  },

  discarded_sonar_buoy: {
    shape: "drum",
    color: 0xc07d18,
    roughness: 0.55,
    metalness: 0.15,
    weathering: 0.7,
    biofouling: 0.45,
    emissive: 0xff9a20,
    glow: 0.22,
    deformation: 0.3,
  },

  // -----------------------------
  // Batipelágico superior
  // -----------------------------

  whale_fall_vertebra: {
    shape: "blob",
    color: 0xe6dfc9,
    scale: 1.2,
    roughness: 0.8,
    metalness: 0,
    weathering: 0.65,
    biofouling: 0.35,
    deformation: 0.8,
  },

  radioactive_drum_vintage: {
    shape: "drum",
    color: 0xb5b53a,
    roughness: 0.7,
    metalness: 0.5,
    rust: 0.65,
    weathering: 0.85,
    biofouling: 0.35,
    emissive: 0xa8ff33,
    glow: 0.35,
    deformation: 0.3,
  },

  ceramic_insulator_chunk: {
    shape: "blob",
    color: 0x9a9a9a,
    roughness: 0.4,
    metalness: 0.05,
    weathering: 0.5,
    deformation: 0.7,
  },

  industrial_slag: {
    shape: "blob",
    color: 0x33241f,
    roughness: 0.9,
    metalness: 0.1,
    weathering: 0.8,
    emissive: 0xff4a1f,
    glow: 0.15,
    deformation: 0.9,
  },

  deep_microplastic_silt: {
    shape: "cloud",
    color: 0xff9aab,
    opacity: 0.55,
    roughness: 0.85,
    weathering: 0.6,
    deformation: 0.9,
  },

  // -----------------------------
  // Batipelágico profundo
  // -----------------------------

  whale_skeleton_decay: {
    shape: "bar",
    color: 0xd8d2bd,
    scale: 1.6,
    roughness: 0.9,
    metalness: 0,
    weathering: 0.85,
    biofouling: 0.5,
    deformation: 0.4,
  },

  mercury_slag_deposit: {
    shape: "blob",
    color: 0xa9aec0,
    roughness: 0.18,
    metalness: 0.9,
    wetness: 1,
    clearcoat: 0.6,
    deformation: 0.85,
  },

  ancient_anchor_rust: {
    shape: "shard",
    color: 0x6d351b,
    scale: 1.3,
    roughness: 0.9,
    metalness: 0.35,
    rust: 0.95,
    weathering: 1,
    biofouling: 0.6,
    deformation: 0.8,
  },

  dense_sinking_ash: {
    shape: "cloud",
    color: 0x4d4d50,
    opacity: 0.55,
    roughness: 0.95,
    weathering: 0.7,
    deformation: 0.9,
  },

  leached_pesticide_canister: {
    shape: "drum",
    color: 0x8fae35,
    roughness: 0.6,
    metalness: 0.45,
    rust: 0.5,
    weathering: 0.85,
    biofouling: 0.3,
    emissive: 0x77aa22,
    glow: 0.2,
    deformation: 0.3,
  },

  // -----------------------------
  // Abisopelágico
  // -----------------------------

  abyssal_nodule_slag: {
    shape: "blob",
    color: 0x24262e,
    roughness: 0.55,
    metalness: 0.5,
    weathering: 0.75,
    deformation: 0.9,
  },

  hydrothermal_chimney_chunk: {
    shape: "shard",
    color: 0x4a3a2a,
    scale: 1.4,
    roughness: 0.85,
    metalness: 0.15,
    weathering: 0.9,
    emissive: 0xff6a2a,
    glow: 0.3,
    deformation: 0.8,
  },

  abyssal_marine_snow_crust: {
    shape: "sheet",
    color: 0xc6bfa6,
    roughness: 0.9,
    metalness: 0.02,
    weathering: 0.8,
    biofouling: 0.4,
    deformation: 0.6,
  },

  deep_sea_cable_junk: {
    shape: "ring",
    color: 0x2c2c30,
    scale: 1.2,
    roughness: 0.75,
    metalness: 0.1,
    weathering: 0.8,
    biofouling: 0.45,
    deformation: 0.5,
  },

  heavy_radioactive_cask: {
    shape: "drum",
    color: 0x3d4d40,
    scale: 1.3,
    roughness: 0.65,
    metalness: 0.55,
    rust: 0.5,
    weathering: 0.85,
    biofouling: 0.3,
    emissive: 0x59ff33,
    glow: 0.4,
    deformation: 0.25,
  },

  // -----------------------------
  // Hadopelágico
  // -----------------------------

  trench_microplastic_trap: {
    shape: "cloud",
    color: 0xff6b9b,
    scale: 1.4,
    opacity: 0.6,
    roughness: 0.8,
    weathering: 0.7,
    deformation: 0.9,
  },

  volcanic_basalt_ash: {
    shape: "cloud",
    color: 0x242426,
    opacity: 0.55,
    roughness: 0.95,
    weathering: 0.8,
    deformation: 0.9,
  },

  crushed_titanium_landings: {
    shape: "shard",
    color: 0xb4bac2,
    scale: 1.2,
    roughness: 0.3,
    metalness: 0.85,
    weathering: 0.45,
    deformation: 0.7,
  },

  heavy_metal_silt: {
    shape: "blob",
    color: 0x7d6c22,
    roughness: 0.85,
    metalness: 0.25,
    wetness: 0.8,
    emissive: 0x8a8a18,
    glow: 0.12,
    deformation: 0.9,
  },

  amphipod_organic_mass: {
    shape: "blob",
    color: 0x8f6355,
    roughness: 0.85,
    metalness: 0,
    weathering: 0.6,
    biofouling: 0.4,
    deformation: 0.9,
  },

  // -----------------------------
  // Deep sea
  // -----------------------------

  mariana_pcb_deposit: {
    shape: "blob",
    color: 0x6d2a4d,
    roughness: 0.45,
    metalness: 0.1,
    wetness: 0.9,
    emissive: 0xd42a77,
    glow: 0.35,
    deformation: 0.9,
  },

  imploded_probe_hull: {
    shape: "shard",
    color: 0x838a94,
    scale: 1.2,
    roughness: 0.35,
    metalness: 0.8,
    rust: 0.35,
    weathering: 0.75,
    biofouling: 0.3,
    deformation: 0.8,
  },

  compressed_synthetic_sludge: {
    shape: "blob",
    color: 0x6a3358,
    roughness: 0.5,
    metalness: 0.08,
    wetness: 0.9,
    emissive: 0x9a3a9a,
    glow: 0.25,
    deformation: 0.9,
  },

  hydrothermal_sulfide_crust: {
    shape: "shard",
    color: 0xb99a12,
    roughness: 0.7,
    metalness: 0.25,
    weathering: 0.85,
    emissive: 0xffc61f,
    glow: 0.32,
    deformation: 0.8,
  },

  hadal_trench_debris_cluster: {
    shape: "blob",
    color: 0x6d3d20,
    scale: 1.5,
    roughness: 0.9,
    metalness: 0.1,
    weathering: 0.95,
    biofouling: 0.5,
    emissive: 0xd6431f,
    glow: 0.3,
    deformation: 0.9,
  },

  // Esquirla que sueltan las trampas y los desechos frágiles (Fase 1).
  // No pertenece a ningún bioma; la genera BiomeGenerator en runtime.
  microfragmento: {
    shape: "cloud",
    color: 0xdfe6ee,
    scale: 0.7,
    opacity: 0.75,
    roughness: 0.85,
    metalness: 0.05,
    weathering: 0.5,
    deformation: 0.9,
  },
}
