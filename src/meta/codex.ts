// src/meta/codex.ts
// Códice de desechos: cada tipo de desecho que se recoge por primera vez queda
// registrado con su descripción y un dato real sobre ese residuo (degradación,
// impacto en la fauna). El progreso se guarda en MetaState.discoveredDebris.

import { BIOMES, type BiomeKey } from "@core/types"
import {
  BIOME_DEBRIS,
  MICROFRAGMENT,
  type DebrisHazard,
} from "@entities/debrisCatalog"

/**
 * Un dato real por cada tipo de desecho. Los nombres del juego son coloquiales;
 * el dato habla del residuo real que representan.
 */
export const DEBRIS_FACTS: Record<string, string> = {
  plastic_bottle:
    "Una botella de PET tarda unos 450 años en degradarse y nunca desaparece del todo: se parte en microplásticos.",
  ghost_net_shallow:
    "Las redes fantasma son alrededor del 10% de la basura marina y siguen atrapando peces, tortugas y delfines durante décadas.",
  styrofoam_chunk:
    "El unicel (poliestireno expandido) no se biodegrada: se desmenuza en bolitas que peces y aves confunden con huevos o comida.",
  synthetic_microfiber:
    "Un solo lavado de ropa sintética puede soltar cientos de miles de microfibras que las plantas de tratamiento no retienen.",
  oil_slick_patch:
    "Una película de aceite frena el paso de oxígeno y luz al agua y apelmaza las plumas de las aves, que pierden su aislamiento.",
  straw:
    "Los popotes están entre los residuos más recogidos en las limpiezas de playas de todo el mundo.",
  rubber_tire:
    "El desgaste de las llantas es una de las mayores fuentes de microplásticos que llegan al mar.",
  aluminum_can:
    "Una lata de aluminio tarda entre 80 y 200 años en degradarse en el mar, pero se puede reciclar una y otra vez sin perder calidad.",
  glass_bottle:
    "El vidrio puede durar miles de años en el fondo marino. Es inerte, pero sus fragmentos cortan, y se recicla al 100%.",
  fish_trap_lost:
    "Las jaulas y trampas de pesca perdidas siguen pescando solas: es la «pesca fantasma», que atrapa cangrejos y peces durante años.",
  microplastic_cluster:
    "Se calcula que flotan en los océanos más de 170 billones de partículas de plástico.",
  marine_snow_light:
    "La nieve marina, restos orgánicos que caen hacia el fondo, alimenta la vida profunda; los microplásticos viajan con ella hacia abajo.",
  chemical_drum_corroded:
    "Durante décadas se tiraron tambos de residuos químicos al mar; el Convenio de Londres (1972) empezó a prohibir esos vertimientos.",
  ship_hull_plate:
    "Las pinturas antiincrustantes con TBT de los cascos alteraban el sexo de los caracoles marinos; se prohibieron en todo el mundo en 2008.",
  nylon_rope_spool:
    "El hilo de pescar y la cuerda de nylon pueden tardar unos 600 años en degradarse, y enredan aletas y picos mucho antes.",
  drilling_mud_trace:
    "Los lodos de perforación de las plataformas petroleras pueden dejar bario y otros metales acumulados en el sedimento a su alrededor.",
  chitin_exuviae:
    "Las mudas de los crustáceos son naturales: la quitina se biodegrada y alimenta a las bacterias del fondo. No todo lo que flota es basura.",
  lithium_battery:
    "Las pilas desechadas sueltan metales como el litio, el cobalto o el níquel, tóxicos para los organismos que filtran el agua.",
  heavy_petroleum_sludge:
    "Las bolas de chapopote son petróleo envejecido que puede viajar miles de kilómetros antes de hundirse o llegar a una playa.",
  cargo_crate_strap:
    "Las cintas de plástico para embalar forman lazos cerrados en los que focas y lobos marinos quedan atrapados por el cuello.",
  dense_marine_snow:
    "Se han encontrado microplásticos dentro de la nieve marina a miles de metros: es una de las vías por las que el plástico llega al abismo.",
  lead_battery_casing:
    "El plomo de las baterías no se degrada: se acumula en los tejidos y pasa de presa a depredador a lo largo de la cadena alimentaria.",
  sinking_macroplastic:
    "Plásticos como el PET o el PVC son más densos que el agua de mar: se hunden aunque nada tire de ellos.",
  shipwreck_timber_treated:
    "La madera de barco se trataba con creosota y otros compuestos tóxicos que siguen filtrándose al agua durante décadas.",
  calcified_shells_drift:
    "El océano absorbe parte del CO₂ del aire y se acidifica, lo que dificulta a corales y moluscos construir sus conchas.",
  discarded_sonar_buoy:
    "Las boyas de sonar y otros aparatos perdidos llevan pilas, circuitos y plásticos que se degradan muy despacio en el agua fría.",
  whale_fall_vertebra:
    "Un esqueleto de ballena en el fondo puede alimentar a comunidades enteras de organismos durante décadas: es una «caída de ballena».",
  radioactive_drum_vintage:
    "Entre 1946 y 1993 varios países hundieron residuos radiactivos en el mar; el Convenio de Londres prohibió esos vertimientos en 1993.",
  ceramic_insulator_chunk:
    "Los escombros de construcción tirados al mar entierran los hábitats del fondo y enturbian el agua al asentarse.",
  industrial_slag:
    "La escoria industrial vertida al mar puede liberar metales pesados como el cromo o el zinc al sedimento.",
  deep_microplastic_silt:
    "Los sedimentos del fondo marino guardan millones de toneladas de microplásticos: es uno de los mayores sumideros de plástico del planeta.",
  whale_skeleton_decay:
    "Algunos gusanos del género Osedax solo viven sobre huesos de ballena, de los que sacan nutrientes con ayuda de bacterias.",
  mercury_slag_deposit:
    "El mercurio se convierte en el agua en metilmercurio, que se acumula en peces grandes como el atún o el pez espada.",
  ancient_anchor_rust:
    "Las anclas y cadenas de los barcos arrastran el fondo y pueden destruir praderas marinas y corales que tardan siglos en crecer.",
  dense_sinking_ash:
    "La ceniza de las erupciones aporta hierro al océano y puede provocar floraciones de plancton; no todo lo que cae del cielo es contaminación.",
  leached_pesticide_canister:
    "El DDT, prohibido en muchos países desde los años 70, todavía aparece en los sedimentos y en la grasa de los mamíferos marinos.",
  abyssal_nodule_slag:
    "La minería de nódulos del fondo levanta nubes de sedimento que pueden asfixiar a la fauna a kilómetros del punto de extracción.",
  hydrothermal_chimney_chunk:
    "Las fuentes hidrotermales sostienen ecosistemas que viven de la química y no del sol, con especies que no existen en ningún otro lugar.",
  abyssal_marine_snow_crust:
    "En la llanura abisal el sedimento se acumula a un ritmo de milímetros o pocos centímetros cada mil años.",
  deep_sea_cable_junk:
    "Más del 95% del tráfico internacional de internet viaja por cables submarinos, que a veces se rompen por anclas y redes de arrastre.",
  heavy_radioactive_cask:
    "Algunos residuos radiactivos siguen siendo peligrosos durante miles de años, mucho más que cualquier contenedor que los guarde.",
  trench_microplastic_trap:
    "En la fosa de las Marianas, a casi 11,000 metros, se encontró una bolsa de plástico: la basura llega al punto más hondo del océano.",
  volcanic_basalt_ash:
    "El basalto es la roca más común del fondo oceánico: casi todo el lecho del mar se formó con lava enfriada.",
  crushed_titanium_landings:
    "A 11,000 metros la presión supera las 1,000 atmósferas: una tonelada sobre cada centímetro cuadrado.",
  heavy_metal_silt:
    "Las fosas oceánicas funcionan como embudos: acumulan sedimentos y contaminantes que bajan por sus laderas.",
  amphipod_organic_mass:
    "En anfípodos de la fosa de las Marianas se han medido PCB en niveles más altos que en cangrejos de ríos muy contaminados de China.",
  mariana_pcb_deposit:
    "Los PCB, prohibidos desde hace décadas, se han detectado en animales de las fosas más profundas del planeta.",
  imploded_probe_hull:
    "Los vehículos que bajan a las fosas necesitan esferas de titanio o cerámica para aguantar presiones que aplastarían un submarino militar.",
  compressed_synthetic_sludge:
    "El plástico que llega al fondo profundo casi no se degrada: allí no hay luz ultravioleta y el agua está a pocos grados.",
  hydrothermal_sulfide_crust:
    "Los sulfuros de las fuentes hidrotermales son ricos en cobre, zinc y oro, y ya interesan a la minería submarina.",
  hadal_trench_debris_cluster:
    "Se han encontrado plásticos en el estómago de anfípodos de todas las grandes fosas oceánicas estudiadas.",
}

export interface CodexEntry {
  id: string
  name: string
  description: string
  fact: string
  /** Primer bioma (por profundidad) en el que aparece. */
  biome: BiomeKey
  hazard?: DebrisHazard
}

const BIOMES_BY_DEPTH = (Object.keys(BIOMES) as BiomeKey[]).sort(
  (a, b) => BIOMES[a].depth - BIOMES[b].depth,
)

/** Todas las entradas del códice, de la superficie al fondo. */
export const CODEX_ENTRIES: readonly CodexEntry[] = (() => {
  const seen = new Set<string>()
  const entries: CodexEntry[] = []
  for (const biome of BIOMES_BY_DEPTH) {
    for (const debris of BIOME_DEBRIS[biome]) {
      if (seen.has(debris.id)) continue
      seen.add(debris.id)
      entries.push({
        id: debris.id,
        name: debris.name,
        description: debris.description,
        fact: DEBRIS_FACTS[debris.id] ?? "",
        biome,
        hazard: debris.hazard,
      })
    }
  }
  return entries
})()

const CODEX_IDS = new Set(CODEX_ENTRIES.map((entry) => entry.id))

/** `true` si el id es un desecho del códice (los microfragmentos no lo son). */
export function isCodexId(id: unknown): id is string {
  return typeof id === "string" && id !== MICROFRAGMENT.id && CODEX_IDS.has(id)
}

/**
 * Apunta un desecho en el códice. Devuelve `true` si es la primera vez
 * (modifica `discovered`).
 */
export function discoverDebris(discovered: string[], id: string): boolean {
  if (!isCodexId(id) || discovered.includes(id)) return false
  discovered.push(id)
  return true
}

export function codexProgress(discovered: readonly string[]): {
  found: number
  total: number
} {
  const found = discovered.filter((id) => CODEX_IDS.has(id)).length
  return { found, total: CODEX_ENTRIES.length }
}
