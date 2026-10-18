import type { BiomeKey } from "@core/types"

/**
 * Movimiento del desecho antes de ser tocado (eje A). Omitido = inerte.
 *
 * `hunde`, `flota` y `reposa` se resuelven contra los bounds del bioma, NO
 * contra el lecho: la tortuga queda limitada a `bounds.minY` (hay una pared
 * invisible sobre el suelo), así que "reposar" significa flotar pegado al
 * borde inferior de la banda jugable.
 */
export type DebrisMotion = "deriva" | "hunde" | "flota" | "reposa"

/**
 * Consecuencia de tocarlo (eje B). Omitida = ninguna.
 *
 * - `fragil`:  si la tortuga llega en boost, se rompe y suelta microfragmentos
 *              sin dar eco (premia acercarse con calma).
 * - `trampa`:  al recogerlo suelta microfragmentos que también hay que limpiar.
 * - `lixivia`: mientras siga ahí mantiene el agua contaminada por encima del
 *              suelo de contaminación (no deja que el bioma se vea limpio).
 */
export type DebrisHazard = "fragil" | "trampa" | "lixivia"

export type OceanDebrisType = {
  id: string
  name: string
  description: string
  toxicityImpact: number // 0..1: contaminación que aporta al agua mientras siga ahí; recogerlo la elimina
  /** Peso relativo de aparición dentro del bioma (por defecto 1). */
  weight?: number
  /** Comportamiento de movimiento (eje A); omitido = inerte. */
  motion?: DebrisMotion
  /** Consecuencia al tocarlo (eje B); omitida = ninguna. */
  hazard?: DebrisHazard
}

/**
 * Esquirla que sueltan las trampas y los desechos frágiles. No pertenece a
 * ningún bioma (nunca se elige al azar): la genera `BiomeGenerator` en runtime.
 */
export const MICROFRAGMENT: OceanDebrisType = {
  id: "microfragmento",
  name: "Pedacito de plástico",
  description:
    "Una basurita flotando por ahí. Da más lata quitarla de lo que parece.",
  toxicityImpact: 0.02,
}

export const BIOME_DEBRIS: Record<BiomeKey, OceanDebrisType[]> = {
  epipelagic_upper: [
    {
      id: "plastic_bottle",
      name: "Botella de plástico",
      description:
        "Vieja y despintada por el sol. Lleva un buen rato flotando por aquí.",
      toxicityImpact: 0.05,
      weight: 3,
      motion: "deriva",
    },
    {
      id: "ghost_net_shallow",
      name: "Red abandonada",
      description: "Mala idea meterte ahí, se te enreda con cualquier cosa.",
      toxicityImpact: 0.1,
      weight: 1,
      hazard: "trampa",
    },
    {
      id: "styrofoam_chunk",
      name: "Pedazo de unicel",
      description:
        "Está tan reseco por el sol que se desmorona si lo empujas muy fuerte.",
      toxicityImpact: 0.08,
      weight: 2,
      hazard: "fragil",
    },
    {
      id: "synthetic_microfiber",
      name: "Nube de pelusas",
      description: "Hilitos de ropa que dejan el agua hecha un asco.",
      toxicityImpact: 0.12,
      weight: 1.5,
    },
    {
      id: "oil_slick_patch",
      name: "Mancha de aceite",
      description: "Capa grasosa en la superficie que no deja pasar la luz.",
      toxicityImpact: 0.2,
      weight: 0.7,
      hazard: "lixivia",
    },
    {
      id: "straw",
      name: "Popote",
      description: "Lo usas cinco minutos y se queda aquí 500 años.",
      toxicityImpact: 0.05,
      weight: 3,
    },
  ],

  pelagic_mid: [
    {
      id: "rubber_tire",
      name: "Llanta vieja",
      description:
        "Pesada y estorbosa, se va hundiendo poco a poco hacia el fondo.",
      toxicityImpact: 0.15,
      weight: 2,
      motion: "hunde",
    },
    {
      id: "aluminum_can",
      name: "Lata oxidada",
      description:
        "Una lata de refresco a la que se le está cayendo la pintura.",
      toxicityImpact: 0.07,
      weight: 3,
    },
    {
      id: "glass_bottle",
      name: "Botella de vidrio",
      description: "Se va al fondo toda cubierta de lama y algas.",
      toxicityImpact: 0.02,
      weight: 2,
      motion: "hunde",
    },
    {
      id: "fish_trap_lost",
      name: "Jaula de pesca",
      description: "Alguien la perdió y se quedó atrapando todo lo que pasa.",
      toxicityImpact: 0.18,
      weight: 0.8,
      hazard: "trampa",
    },
    {
      id: "microplastic_cluster",
      name: "Chispitas de plástico",
      description:
        "Un montón de pedacitos de colores que salen volando si los chocas.",
      toxicityImpact: 0.25,
      weight: 1.5,
      hazard: "fragil",
    },
  ],

  subphotic: [
    {
      id: "marine_snow_light",
      name: "Copos del mar",
      description:
        "Una lluvia suave de cositas que van cayendo hacia la penumbra.",
      toxicityImpact: 0.03,
      weight: 3,
    },
    {
      id: "chemical_drum_corroded",
      name: "Tambo con fuga",
      description: "Está todo agrietado y sigue soltando una mugre apestosa.",
      toxicityImpact: 0.35,
      weight: 1,
      hazard: "lixivia",
    },
    {
      id: "ship_hull_plate",
      name: "Pedazo de barco",
      description: "Placa de metal toda oxidada, clavada en la arena.",
      toxicityImpact: 0.15,
      weight: 1.5,
      motion: "reposa",
    },
    {
      id: "nylon_rope_spool",
      name: "Cuerda",
      description:
        "Un lazo sintético todo enredado que alguien aventó por la borda.",
      toxicityImpact: 0.08,
      weight: 0.8,
      hazard: "trampa",
    },
    {
      id: "drilling_mud_trace",
      name: "Chapopote",
      description:
        "Lodo espeso y sucio que viene de las plataformas petroleras.",
      toxicityImpact: 0.3,
      weight: 2.5,
      motion: "hunde",
    },
  ],

  mesopelagic_upper: [
    {
      id: "chitin_exuviae",
      name: "Cascarones abandonados",
      description: "Pellejos viejos que dejaron los bichos marinos al crecer.",
      toxicityImpact: 0.01,
      weight: 3,
    },
    {
      id: "lithium_battery",
      name: "Pila de litio",
      description: "Chiquita pero muy tóxica: ensucia el agua a su alrededor.",
      toxicityImpact: 0.45,
      weight: 0.8,
      hazard: "lixivia",
    },
    {
      id: "heavy_petroleum_sludge",
      name: "Bola de petróleo",
      description: "Un pegote negro y pesado que se va hundiendo despacito.",
      toxicityImpact: 0.38,
      weight: 1.5,
      motion: "hunde",
    },
    {
      id: "cargo_crate_strap",
      name: "Cintas de embalaje",
      description: "Tiras de plástico duro que andan flotando como víboras.",
      toxicityImpact: 0.12,
      weight: 2,
      motion: "deriva",
    },
    {
      id: "dense_marine_snow",
      name: "Nieve gris del mar",
      description: "Cortina espesa de residuos que cae lento hacia abajo.",
      toxicityImpact: 0.04,
      weight: 2.5,
    },
  ],

  mesopelagic_deep: [
    {
      id: "lead_battery_casing",
      name: "Batería de barco",
      description:
        "Está rota y sigue soltando un líquido feísimo en el agua fría.",
      toxicityImpact: 0.55,
      weight: 0.8,
      hazard: "lixivia",
    },
    {
      id: "sinking_macroplastic",
      name: "Lona de plástico",
      description: "Plástico pesado que se va derechito al fondo, sin prisa.",
      toxicityImpact: 0.22,
      weight: 2.5,
      motion: "hunde",
    },
    {
      id: "shipwreck_timber_treated",
      name: "Tabla de naufragio",
      description:
        "Viga de un barco antiguo, manchada con un barniz raro que no se quita.",
      toxicityImpact: 0.18,
      weight: 1.5,
      motion: "reposa",
    },
    {
      id: "calcified_shells_drift",
      name: "Polvo de conchitas",
      description: "Restos de conchitas que caen hacia la oscuridad.",
      toxicityImpact: 0.0,
      weight: 3,
    },
    {
      id: "discarded_sonar_buoy",
      name: "Sonar viejo",
      description: "Un cacharro electrónico lleno de cables y piezas oxidadas.",
      toxicityImpact: 0.28,
      weight: 1.5,
    },
  ],

  bathypelagic_upper: [
    {
      id: "whale_fall_vertebra",
      name: "Hueso de ballena",
      description:
        "Parte de un gigante caído. Los bichos de por aquí le sacan buen provecho.",
      toxicityImpact: 0.05,
      weight: 1.5,
    },
    {
      id: "radioactive_drum_vintage",
      name: "Barril radiactivo",
      description:
        "Un bote bien viejo y medio podrido que suelta algo nada bueno.",
      toxicityImpact: 0.75,
      weight: 0.6,
      hazard: "lixivia",
    },
    {
      id: "ceramic_insulator_chunk",
      name: "Pedazos de concreto",
      description: "Escombro pesado tirado en medio de la nada.",
      toxicityImpact: 0.02,
      weight: 2.5,
      motion: "reposa",
    },
    {
      id: "industrial_slag",
      name: "Chatarra de metal",
      description: "Desperdicio pesado de fábrica que se fue hasta el fondo.",
      toxicityImpact: 0.32,
      weight: 2,
      motion: "reposa",
    },
    {
      id: "deep_microplastic_silt",
      name: "Polvillo de plástico",
      description:
        "Casi ni se ve, pero anda flotando por todos lados y lo enturbia todo.",
      toxicityImpact: 0.3,
      weight: 3,
    },
  ],

  bathypelagic_deep: [
    {
      id: "whale_skeleton_decay",
      name: "Esqueleto antiguo",
      description: "Huesos viejos cubiertos de bacterias del fondo marino.",
      toxicityImpact: 0.08,
      weight: 1.5,
      motion: "reposa",
    },
    {
      id: "mercury_slag_deposit",
      name: "Mancha química",
      description: "Mugre venenosa que se quedó estancada en el fondo.",
      toxicityImpact: 0.65,
      weight: 1,
    },
    {
      id: "ancient_anchor_rust",
      name: "Ancla enmohecida",
      description:
        "Un fierro viejo soltando nubes de óxido bajo tanta presión.",
      toxicityImpact: 0.1,
      weight: 2,
      motion: "reposa",
    },
    {
      id: "dense_sinking_ash",
      name: "Ceniza del fondo",
      description: "Polvo mineral que escupieron los volcanes sumergidos.",
      toxicityImpact: 0.14,
      weight: 3,
      motion: "hunde",
    },
    {
      id: "leached_pesticide_canister",
      name: "Bote de veneno",
      description: "Bote industrial aplastado que no deja de soltar químicos.",
      toxicityImpact: 0.8,
      weight: 0.5,
      hazard: "lixivia",
    },
  ],

  abyssopelagic: [
    {
      id: "abyssal_nodule_slag",
      name: "Nube de minería",
      description:
        "Polvareda espesa que dejaron las máquinas al raspar el suelo.",
      toxicityImpact: 0.7,
      weight: 1,
      motion: "deriva",
    },
    {
      id: "hydrothermal_chimney_chunk",
      name: "Piedra volcánica",
      description: "Pedazo de roca pesada que nació del calor de la tierra.",
      toxicityImpact: 0.25,
      weight: 2,
      motion: "reposa",
    },
    {
      id: "abyssal_marine_snow_crust",
      name: "Capa de lama abisal",
      description:
        "Lodo viejo que se fue juntando durante años en la planicie.",
      toxicityImpact: 0.05,
      weight: 3,
      motion: "reposa",
    },
    {
      id: "deep_sea_cable_junk",
      name: "Cable submarino roto",
      description:
        "Un tramo de cable de internet o de teléfono que quedó olvidado a miles de metros.",
      toxicityImpact: 0.2,
      weight: 2,
      motion: "reposa",
    },
    {
      id: "heavy_radioactive_cask",
      name: "Cilindro sellado peligroso",
      description:
        "Una cosa pesadísima que quema de lo caliente y tóxica que está.",
      toxicityImpact: 0.9,
      weight: 0.6,
      motion: "reposa",
      hazard: "lixivia",
    },
  ],

  hadopelagic: [
    {
      id: "trench_microplastic_trap",
      name: "Basurero de la grieta",
      description: "Todo lo que cae al mar acaba amontonado aquí abajo.",
      toxicityImpact: 0.6,
      weight: 1.5,
    },
    {
      id: "volcanic_basalt_ash",
      name: "Arena negra volcánica",
      description: "Polvo mineral pesado que sale de las grietas de la fosa.",
      toxicityImpact: 0.15,
      weight: 2.5,
      motion: "hunde",
    },
    {
      id: "crushed_titanium_landings",
      name: "Sonda aplastada",
      description:
        "Lo que quedó de un robot explorador que no aguantó la presión.",
      toxicityImpact: 0.3,
      weight: 1.5,
      motion: "reposa",
    },
    {
      id: "heavy_metal_silt",
      name: "Fango pesado y tóxico",
      description: "Lodo espeso cargado del veneno que se juntó en la grieta.",
      toxicityImpact: 0.85,
      weight: 0.8,
      hazard: "lixivia",
    },
    {
      id: "amphipod_organic_mass",
      name: "Masa orgánica",
      description:
        "Restos orgánicos hechos papilla en lo más hondo de la fosa.",
      toxicityImpact: 0.08,
      weight: 3,
    },
  ],

  deepSea: [
    {
      id: "mariana_pcb_deposit",
      name: "Suelo de químicos concentrados",
      description:
        "Toxinas acumuladas en el punto más hondo y escondido del mundo.",
      toxicityImpact: 1.0,
      weight: 0.5,
      hazard: "lixivia",
    },
    {
      id: "imploded_probe_hull",
      name: "Casco destrozado",
      description:
        "Pedazos de metal durísimo que la presión dobló como si fueran papel.",
      toxicityImpact: 0.4,
      weight: 2.5,
      motion: "reposa",
    },
    {
      id: "compressed_synthetic_sludge",
      name: "Lodo de plástico duro",
      description:
        "Mezcla de plástico y tierra aplastada por todo el peso del agua.",
      toxicityImpact: 0.9,
      weight: 2,
      motion: "reposa",
    },
    {
      id: "hydrothermal_sulfide_crust",
      name: "Costra de azufre",
      description:
        "Roca mineral bien cargada de metales pesados del lecho marino.",
      toxicityImpact: 0.5,
      weight: 2.5,
      motion: "reposa",
    },
    {
      id: "hadal_trench_debris_cluster",
      name: "Bola de mugre fosilizada",
      description:
        "Mezcolanza de plásticos y fierros que quedó atorada al final del mar.",
      toxicityImpact: 0.95,
      weight: 1,
    },
  ],
}
