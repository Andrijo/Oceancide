// src/debrisCatalog.ts

import type { BiomeKey } from "@core/types"

export type OceanDebrisType = {
  id: string
  name: string
  description: string
  toxicityImpact: number // 0..1: contaminación que aporta al agua mientras siga ahí; recogerlo la elimina
}

export const BIOME_DEBRIS: Record<BiomeKey, OceanDebrisType[]> = {
  epipelagic_upper: [
    {
      id: "plastic_bottle",
      name: "Botella de Plástico",
      description:
        "Envase de PET flotante altamente expuesto a la radiación UV.",
      toxicityImpact: 0.05,
    },
    {
      id: "ghost_net_shallow",
      name: "Red Fantasma Superficial",
      description: "Fragmento de red de nailon enganchado en la zona fótica.",
      toxicityImpact: 0.1,
    },
    {
      id: "styrofoam_chunk",
      name: "Bloque de Unicel",
      description: "Poliestireno expandido disgregado por el oleaje.",
      toxicityImpact: 0.08,
    },
    {
      id: "synthetic_microfiber",
      name: "Nube de Microfibras",
      description:
        "Fibras sintéticas textiles suspendidas en agua superficial.",
      toxicityImpact: 0.12,
    },
    {
      id: "oil_slick_patch",
      name: "Mancha de Petróleo Superficial",
      description: "Película fina de hidrocarburos ligeros en la superficie.",
      toxicityImpact: 0.2,
    },
    {
      id: "straw",
      name: "Popote",
      description: "Envase de plástico descartable usado para beber líquidos.",
      toxicityImpact: 0.05,
    },
  ],

  pelagic_mid: [
    {
      id: "rubber_tire",
      name: "Neumático Desgastado",
      description: "Rueda de caucho vulcanizado suspendida a media agua.",
      toxicityImpact: 0.15,
    },
    {
      id: "aluminum_can",
      name: "Lata de Aluminio Oxidada",
      description: "Lata de bebida en proceso de corrosión salina.",
      toxicityImpact: 0.07,
    },
    {
      id: "glass_bottle",
      name: "Botella de Vidrio",
      description: "Envase denso que desciende gradualmente acumulando algas.",
      toxicityImpact: 0.02,
    },
    {
      id: "fish_trap_lost",
      name: "Nassa de Pesca Perdida",
      description: "Estructura metálica y sintética de captura fantasma.",
      toxicityImpact: 0.18,
    },
    {
      id: "microplastic_cluster",
      name: "Aglomerado de Microplásticos",
      description: "Pellets y fragmentos de plástico degradado por fotólisis.",
      toxicityImpact: 0.25,
    },
  ],

  subphotic: [
    {
      id: "marine_snow_light",
      name: "Nieve Marina Fina",
      description: "Agregados detritíticos orgánicos y moco planctónico.",
      toxicityImpact: 0.03,
    },
    {
      id: "chemical_drum_corroded",
      name: "Barril Químico Corroído",
      description: "Contenedor industrial metálico con filtraciones leves.",
      toxicityImpact: 0.35,
    },
    {
      id: "ship_hull_plate",
      name: "Chapa de Casco de Barco",
      description:
        "Fragmento metálico pesado cubierto de óxido y pintura antiincrustante.",
      toxicityImpact: 0.15,
    },
    {
      id: "nylon_rope_spool",
      name: "Carrete de Amarra",
      description: "Cuerda pesada de fibra sintética hundida.",
      toxicityImpact: 0.08,
    },
    {
      id: "drilling_mud_trace",
      name: "Lodo de Perforación Petroquímica",
      description:
        "Residuo denso suspendido de operaciones petroleras offshore.",
      toxicityImpact: 0.3,
    },
  ],

  mesopelagic_upper: [
    {
      id: "chitin_exuviae",
      name: "Mudas de Quitina",
      description:
        "Exoesqueletos desechados de enjambres de krill y zooplancton.",
      toxicityImpact: 0.01,
    },
    {
      id: "lithium_battery",
      name: "Batería de Litio Descargada",
      description:
        "Celda electrónica que lixivia metales pesados en la penumbra.",
      toxicityImpact: 0.45,
    },
    {
      id: "heavy_petroleum_sludge",
      name: "Alquitrán Marino Denso",
      description: "Grumos viscosos de crudo pesado consolidados al hundirse.",
      toxicityImpact: 0.38,
    },
    {
      id: "cargo_crate_strap",
      name: "Flejes de Carga Sintéticos",
      description:
        "Bandas de polipropileno de alta densidad que flotan a la deriva.",
      toxicityImpact: 0.12,
    },
    {
      id: "dense_marine_snow",
      name: "Nieve Marina Biogénica",
      description:
        "Lluvia orgánica espesa rica en fecal pellets y fitoplancton muerto.",
      toxicityImpact: 0.04,
    },
  ],

  mesopelagic_deep: [
    {
      id: "lead_battery_casing",
      name: "Carcasa de Batería de Plomo",
      description: "Residuo de navío con escape de ácidos y sales de plomo.",
      toxicityImpact: 0.55,
    },
    {
      id: "sinking_macroplastic",
      name: "Lámina de PVC Denso",
      description: "Plástico industrial altamente cargado de aditivos tóxicos.",
      toxicityImpact: 0.22,
    },
    {
      id: "shipwreck_timber_treated",
      name: "Madera Tratada Química",
      description:
        "Restos de naufragio sumergido impregnados con preservantes metálicos.",
      toxicityImpact: 0.18,
    },
    {
      id: "calcified_shells_drift",
      name: "Lluvia de Conchas Calcáreas",
      description:
        "Acumulación descendente de pterópodos y foraminíferos muertos.",
      toxicityImpact: 0.0,
    },
    {
      id: "discarded_sonar_buoy",
      name: "Sonoboya Militar Abandonada",
      description:
        "Dispositivo electrónico náutico con circuitos y componentes oxidados.",
      toxicityImpact: 0.28,
    },
  ],

  bathypelagic_upper: [
    {
      id: "whale_fall_vertebra",
      name: "Hueso de Cetáceo (Whale Fall)",
      description:
        "Resto óseo de gran mamífero desprendiendo lípidos y sulfuros.",
      toxicityImpact: 0.05,
    },
    {
      id: "radioactive_drum_vintage",
      name: "Barril de Residuo Radiactivo",
      description: "Contenedor de baja actividad sumergido en décadas pasadas.",
      toxicityImpact: 0.75,
    },
    {
      id: "ceramic_insulator_chunk",
      name: "Restos Cerámicos y Hormigón",
      description:
        "Materiales inertes de construcción pesada hundidos al fondo.",
      toxicityImpact: 0.02,
    },
    {
      id: "industrial_slag",
      name: "Escoria Metalúrgica Sumida",
      description:
        "Subproducto siderúrgico rico en silicatos y restos de hierro.",
      toxicityImpact: 0.32,
    },
    {
      id: "deep_microplastic_silt",
      name: "Seda de Microplásticos Hundidos",
      description:
        "Partículas microscópicas atrapadas en la columna de agua profunda.",
      toxicityImpact: 0.3,
    },
  ],

  bathypelagic_deep: [
    {
      id: "whale_skeleton_decay",
      name: "Esqueleto de Ballena Sulfofílico",
      description:
        "Estructura ósea colonizada por bacterias quimiotróficas reductoras de sulfato.",
      toxicityImpact: 0.08,
    },
    {
      id: "mercury_slag_deposit",
      name: "Sedimento de Metilmercurio",
      description:
        "Depósito químico derivado de la metilación bacteriana profunda.",
      toxicityImpact: 0.65,
    },
    {
      id: "ancient_anchor_rust",
      name: "Ancla de Hierro en Corrosión",
      description:
        "Artefacto histórico emitiendo plumas de óxido ferroso a gran presión.",
      toxicityImpact: 0.1,
    },
    {
      id: "dense_sinking_ash",
      name: "Ceniza Volcánica Sumergida",
      description:
        "Partículas piroclásticas finas asentadas tras erupciones de arcos oceánicos.",
      toxicityImpact: 0.14,
    },
    {
      id: "leached_pesticide_canister",
      name: "Bidón de Pesticidas Químicos",
      description:
        "Contenedor industrial presurizado con grietas estructurales.",
      toxicityImpact: 0.8,
    },
  ],

  abyssopelagic: [
    {
      id: "abyssal_nodule_slag",
      name: "Desecho de Minería de Nódulos",
      description:
        "Pluma de sedimento y metales pesados proveniente de dragado abisal.",
      toxicityImpact: 0.7,
    },
    {
      id: "hydrothermal_chimney_chunk",
      name: "Fragmento de Chimenea Hidrotermal",
      description: "Sulfuros masivos ricos en cobre, zinc y hierro volcánico.",
      toxicityImpact: 0.25,
    },
    {
      id: "abyssal_marine_snow_crust",
      name: "Costra de Nieve Marina Detritívora",
      description:
        "Materia orgánica densa acumulada durante meses en el lecho plano.",
      toxicityImpact: 0.05,
    },
    {
      id: "deep_sea_cable_junk",
      name: "Tramo de Cable Submarino Obsoleto",
      description:
        "Aislamiento de polietileno, acero y cobre degradado a 5,000 metros.",
      toxicityImpact: 0.2,
    },
    {
      id: "heavy_radioactive_cask",
      name: "Cilindro Radiactivo Blindado",
      description:
        "Residuo nuclear de alta densidad con fuga térmica y radiológica.",
      toxicityImpact: 0.9,
    },
  ],

  hadopelagic: [
    {
      id: "trench_microplastic_trap",
      name: "Trampa de Microplásticos en Trinchera",
      description:
        "Acumulación masiva de sintéticos arrastrados por corrientes hacia la fosa.",
      toxicityImpact: 0.6,
    },
    {
      id: "volcanic_basalt_ash",
      name: "Ceniza Basáltica de Fosa",
      description:
        "Depósitos minerales hidrotermales y silicio volcánico extremo.",
      toxicityImpact: 0.15,
    },
    {
      id: "crushed_titanium_landings",
      name: "Restos de Módulo Titánico Aplastado",
      description:
        "Estructura de sumergible o sonda destruida por implosión hiperbárica.",
      toxicityImpact: 0.3,
    },
    {
      id: "heavy_metal_silt",
      name: "Limo de Metales Pesados",
      description:
        "Precipitados concentrados de cadmio, plomo y arsénico abisal.",
      toxicityImpact: 0.85,
    },
    {
      id: "amphipod_organic_mass",
      name: "Detrito Orgánico Hadal",
      description:
        "Materia orgánica compactada atrapada en el fondo del relieve tectónico.",
      toxicityImpact: 0.08,
    },
  ],

  // Antes "hadal_deep": renombrado para coincidir con BiomeKey
  deepSea: [
    {
      id: "mariana_pcb_deposit",
      name: "Suelo Contaminado con Bifenilos Policlorados (PCB)",
      description:
        "Químicos persistentes súper concentrados en el punto más profundo del planeta.",
      toxicityImpact: 1.0,
    },
    {
      id: "imploded_probe_hull",
      name: "Casco Implosionado de Sonda",
      description:
        "Fragmentos de aleación superresiliente destrozados por presiones > 1,000 bar.",
      toxicityImpact: 0.4,
    },
    {
      id: "compressed_synthetic_sludge",
      name: "Lodo Sintético Hipercompreso",
      description:
        "Fusión de microplásticos y sedimento mineral bajo presión aplastante.",
      toxicityImpact: 0.9,
    },
    {
      id: "hydrothermal_sulfide_crust",
      name: "Costra de Sulfuro Quimiotrófico",
      description:
        "Mineralización extrema cargada de azufre, arsénico y metales raros.",
      toxicityImpact: 0.5,
    },
    {
      id: "hadal_trench_debris_cluster",
      name: "Aglomerado Fosilizado de Basura Antrópica",
      description:
        "Mezcla de plásticos, metales pesados y materia orgánica atrapada sin salida.",
      toxicityImpact: 0.95,
    },
  ],
}
