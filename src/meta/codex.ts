// src/meta/codex.ts
// Códice: lo que la tortuga ha ido conociendo, con un dato real en cada ficha.
// Cuatro secciones: desechos (al recogerlos), fauna (al verla de cerca),
// reliquias (al encontrarlas) y biomas (al llegar a ellos). El progreso se
// guarda en MetaState (`discoveredDebris`, `discoveredCreatures`...).

import { BIOME_ORDER, BIOMES, type BiomeKey } from "@core/types"
import {
  BIOME_DEBRIS,
  MICROFRAGMENT,
  type DebrisHazard,
} from "@entities/debrisCatalog"
import {
  BOSS_KINDS,
  CREATURE_NAMES,
  FRIENDLY_KINDS,
  HOSTILE_KINDS,
  type CreatureKind,
} from "@entities/Creature"
import { RELICS } from "@/relics/RelicPool"

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
  return discover(discovered, id, isCodexId)
}

export function codexProgress(discovered: readonly string[]): {
  found: number
  total: number
} {
  const found = discovered.filter((id) => CODEX_IDS.has(id)).length
  return { found, total: CODEX_ENTRIES.length }
}

/** Marca un id como descubierto. Devuelve `true` si es nuevo (modifica `list`). */
function discover(
  list: string[],
  id: string,
  isValid: (id: unknown) => boolean,
): boolean {
  if (!isValid(id) || list.includes(id)) return false
  list.push(id)
  return true
}

// --- Fauna ---------------------------------------------------------------

export type FaunaRole = "hostile" | "friendly" | "boss"

export const FAUNA_ROLE_LABELS: Record<FaunaRole, string> = {
  hostile: "Peligrosa",
  friendly: "Aliada",
  boss: "Megajefe",
}

/**
 * Un dato real por especie y, en las que el juego exagera o inventa, un dato
 * del animal o del problema real en el que se inspiran.
 */
export const CREATURE_FACTS: Record<CreatureKind, string> = {
  jellyfish:
    "La tortuga laúd se alimenta sobre todo de medusas, y una bolsa de plástico flotando se les parece tanto que muchas se la tragan.",
  lanternfish:
    "Los peces linterna están entre los vertebrados más abundantes del planeta: cada noche suben cientos de metros a comer y al amanecer vuelven a bajar.",
  eel: "Las anguilas americana y europea cruzan el Atlántico para reproducirse en el mar de los Sargazos, aunque nadie ha visto todavía su desove en libertad.",
  pufferfish:
    "El pez globo se infla tragando agua. Muchas especies tienen tetrodotoxina, un veneno cientos de veces más potente que el cianuro.",
  barracuda:
    "La barracuda caza sobre todo con la vista y, en arrancadas cortas, puede nadar a unos 40 km/h.",
  anglerfish:
    "La luz del señuelo del pez pescador abisal no la produce él: la generan bacterias bioluminiscentes que viven dentro de ese apéndice.",
  octopus:
    "El pulpo tiene tres corazones y cerca de dos tercios de sus neuronas están en los brazos, que pueden actuar casi por su cuenta.",
  squid:
    "Algunos calamares sueltan nubes de tinta con su misma forma y tamaño: el depredador ataca a la nube mientras el calamar escapa.",
  scrapCrab:
    "A falta de conchas vacías, se han visto cangrejos ermitaños usando tapas de botella y otros plásticos como casa.",
  anemone:
    "Las anémonas son parientes de corales y medusas y pican con células llamadas cnidocitos. El pez payaso vive entre sus tentáculos sin que le piquen.",
  fishSchool:
    "Los peces de un banco nadan coordinados gracias a la línea lateral, un órgano que siente los cambios de presión del agua a su alrededor.",
  dolphin:
    "Los delfines duermen con medio cerebro a la vez: la otra mitad sigue despierta para nadar y salir a respirar.",
  seahorse:
    "En los caballitos de mar es el macho quien se embaraza: la hembra deja los huevos en su bolsa y él da a luz a las crías.",
  remora:
    "La rémora se pega a tiburones, mantas y tortugas con un disco de succión en la cabeza, que en realidad es una aleta dorsal modificada.",
  manta:
    "La manta gigante puede superar los 7 metros de ancho y tiene, en proporción a su cuerpo, uno de los cerebros más grandes entre los peces.",
  whale:
    "Los machos de ballena jorobada de una misma población cantan la misma canción, que va cambiando poco a poco de un año a otro.",
  cleanerFish:
    "En los arrecifes hay «estaciones de limpieza»: peces mucho más grandes hacen fila para que los peces limpiadores les quiten parásitos, y no se los comen.",
  nettedTurtle:
    "Los excluidores de tortugas, obligatorios en las redes camaroneras de México y Estados Unidos, son una rejilla que deja escapar a las tortugas atrapadas.",
  netKraken:
    "La leyenda del kraken probablemente nació del calamar gigante, que puede pasar de 12 metros. No se filmó vivo en su hábitat hasta 2012.",
  scrapShark:
    "Los tiburones llevan más de 400 millones de años en el mar, pero hoy más de un tercio de las especies de tiburones y rayas está amenazado, sobre todo por la sobrepesca.",
  leviathan:
    "La gran mancha de basura del Pacífico ocupa alrededor de 1.6 millones de km², más del doble que Texas, y casi la mitad de su masa son redes de pesca.",
}

function faunaRole(kind: CreatureKind): FaunaRole {
  if ((BOSS_KINDS as readonly string[]).includes(kind)) return "boss"
  if ((FRIENDLY_KINDS as readonly string[]).includes(kind)) return "friendly"
  return "hostile"
}

export interface CodexFaunaEntry {
  id: CreatureKind
  name: string
  role: FaunaRole
  fact: string
}

/** Fauna del códice: primero la peligrosa, luego la aliada y los megajefes. */
export const FAUNA_ENTRIES: readonly CodexFaunaEntry[] = [
  ...HOSTILE_KINDS,
  ...FRIENDLY_KINDS,
  ...BOSS_KINDS,
].map((kind) => ({
  id: kind,
  name: CREATURE_NAMES[kind],
  role: faunaRole(kind),
  fact: CREATURE_FACTS[kind],
}))

const FAUNA_IDS = new Set<string>(FAUNA_ENTRIES.map((entry) => entry.id))

export function isFaunaId(id: unknown): id is CreatureKind {
  return typeof id === "string" && FAUNA_IDS.has(id)
}

/** Registra una especie vista. Devuelve `true` si es la primera vez. */
export function discoverCreature(discovered: string[], kind: string): boolean {
  return discover(discovered, kind, isFaunaId)
}

// --- Reliquias -----------------------------------------------------------

/** Las reliquias son ficción; su dato real habla de lo que las inspira. */
export const RELIC_FACTS: Record<string, string> = {
  castaway_compass:
    "Las tortugas marinas se orientan con el campo magnético de la Tierra: las crías memorizan la «firma» magnética de su playa y vuelven a ella para anidar.",
  bottle_message:
    "El mensaje en una botella más antiguo que se conoce apareció en 2018 en una playa de Australia: lo habían lanzado desde un barco alemán en 1886.",
  rubber_duck:
    "En 1992 un contenedor con casi 29,000 juguetes de baño cayó al Pacífico. Siguiendo dónde aparecían, los oceanógrafos estudiaron las corrientes.",
  galleon_coin:
    "Durante 250 años, de 1565 a 1815, el Galeón de Manila cruzó el Pacífico entre Acapulco y Filipinas cargado de plata mexicana.",
  ancient_pearl:
    "Una perla se forma cuando el molusco recubre algo que lo irrita con capas de nácar, el mismo material que brilla dentro de su concha.",
  sand_glass:
    "En los barcos se medían las guardias con relojes de arena de media hora: cada vez que se volteaban, sonaba la campana de a bordo.",
  diver_lantern:
    "En un estudio en la bahía de Monterey, cerca de tres de cada cuatro animales observados entre la superficie y 4,000 metros producían su propia luz.",
  megalodon_tooth:
    "El megalodón se extinguió hace unos 3.6 millones de años. Sus dientes fósiles pueden medir más de 17 cm.",
  whispering_conch:
    "El «sonido del mar» que se oye en un caracol es el ruido de alrededor, que resuena dentro de su cavidad.",
  empty_shell:
    "Se estima que solo una de cada mil crías de tortuga marina llega a la edad adulta.",
}

export interface CodexRelicEntry {
  id: string
  name: string
  description: string
  fact: string
}

export const RELIC_ENTRIES: readonly CodexRelicEntry[] = RELICS.map(
  (relic) => ({
    id: relic.id,
    name: relic.name,
    description: relic.description,
    fact: RELIC_FACTS[relic.id] ?? "",
  }),
)

const RELIC_IDS = new Set(RELIC_ENTRIES.map((entry) => entry.id))

export function isRelicId(id: unknown): id is string {
  return typeof id === "string" && RELIC_IDS.has(id)
}

/** Registra una reliquia encontrada. Devuelve `true` si es la primera vez. */
export function discoverRelic(discovered: string[], id: string): boolean {
  return discover(discovered, id, isRelicId)
}

// --- Biomas --------------------------------------------------------------

/** Zona oceánica real a la que corresponde cada bioma. */
export const BIOME_ZONES: Record<BiomeKey, string> = {
  epipelagic_upper: "Zona fótica",
  pelagic_mid: "Zona fótica",
  subphotic: "Zona crepuscular",
  mesopelagic_upper: "Zona crepuscular",
  mesopelagic_deep: "Zona crepuscular",
  bathypelagic_upper: "Zona de medianoche",
  bathypelagic_deep: "Zona de medianoche",
  abyssopelagic: "Zona abisal",
  hadopelagic: "Zona hadal",
  deepSea: "Zona hadal",
}

/** Qué significa el nombre de cada bioma y un dato real de esa profundidad. */
export const BIOME_FACTS: Record<BiomeKey, string> = {
  epipelagic_upper:
    "Epipelágico significa «sobre el mar abierto». En sus primeros 200 metros llega casi toda la luz del sol, y el fitoplancton produce cerca de la mitad del oxígeno del planeta.",
  pelagic_mid:
    "El agua absorbe primero el color rojo: a unos pocos metros casi desaparece, y por eso el mar se ve cada vez más azul conforme bajas.",
  subphotic:
    "Subfótico significa «debajo de la luz». A partir de unos 200 metros aún llega algo de claridad, pero ya no la suficiente para la fotosíntesis.",
  mesopelagic_upper:
    "Mesopelágico significa «mar abierto intermedio». Cada noche, miles de millones de animales de esta zona suben a comer cerca de la superficie: es la migración más grande del planeta.",
  mesopelagic_deep:
    "Hacia los 1,000 metros termina la zona crepuscular: más abajo no llega nada de luz del sol y la única luz es la que producen los propios animales.",
  bathypelagic_upper:
    "Batipelágico significa «mar abierto profundo». Aquí el agua está a unos 4 °C y, a 2,000 metros, la presión es unas 200 veces la de la superficie.",
  bathypelagic_deep:
    "La profundidad media del océano es de unos 3,700 metros: la mayor parte del mar está tan oscura y fría como este bioma.",
  abyssopelagic:
    "Abisal viene del griego ábyssos, «sin fondo». Las llanuras abisales, entre 4,000 y 6,000 metros, cubren alrededor de la mitad de la superficie de la Tierra.",
  hadopelagic:
    "La zona hadal, por debajo de 6,000 metros, debe su nombre a Hades, el dios griego del inframundo. Casi toda está dentro de las fosas oceánicas.",
  deepSea:
    "El abismo Challenger, en la fosa de las Marianas, es el punto más hondo conocido, a casi 11,000 metros. Han bajado hasta él menos personas que las que han ido al espacio.",
}

export interface CodexBiomeEntry {
  id: BiomeKey
  name: string
  depth: number
  zone: string
  fact: string
}

/** Biomas de la superficie al fondo. */
export const BIOME_ENTRIES: readonly CodexBiomeEntry[] = BIOME_ORDER.map(
  (key) => ({
    id: key,
    name: BIOMES[key].name,
    depth: BIOMES[key].depth,
    zone: BIOME_ZONES[key],
    fact: BIOME_FACTS[key],
  }),
)

export function isBiomeId(id: unknown): id is BiomeKey {
  return typeof id === "string" && Object.hasOwn(BIOME_FACTS, id)
}

/** Registra un bioma alcanzado. Devuelve `true` si es la primera vez. */
export function discoverBiome(discovered: string[], key: string): boolean {
  return discover(discovered, key, isBiomeId)
}

// --- Progreso total ------------------------------------------------------

export type CodexSection = "debris" | "fauna" | "relics" | "biomes"

export const CODEX_SECTIONS: readonly CodexSection[] = [
  "debris",
  "fauna",
  "relics",
  "biomes",
]

export const CODEX_SECTION_LABELS: Record<CodexSection, string> = {
  debris: "Desechos",
  fauna: "Fauna",
  relics: "Reliquias",
  biomes: "Biomas",
}

/** Lo descubierto en cada sección (los campos de MetaState). */
export interface CodexDiscoveries {
  discoveredDebris: readonly string[]
  discoveredCreatures: readonly string[]
  discoveredRelics: readonly string[]
  discoveredBiomes: readonly string[]
}

const SECTIONS: Record<
  CodexSection,
  {
    key: keyof CodexDiscoveries
    isValid: (id: unknown) => boolean
    total: number
  }
> = {
  debris: {
    key: "discoveredDebris",
    isValid: isCodexId,
    total: CODEX_ENTRIES.length,
  },
  fauna: {
    key: "discoveredCreatures",
    isValid: isFaunaId,
    total: FAUNA_ENTRIES.length,
  },
  relics: {
    key: "discoveredRelics",
    isValid: isRelicId,
    total: RELIC_ENTRIES.length,
  },
  biomes: {
    key: "discoveredBiomes",
    isValid: isBiomeId,
    total: BIOME_ENTRIES.length,
  },
}

/** Progreso de una sección del códice. */
export function sectionProgress(
  discoveries: CodexDiscoveries,
  section: CodexSection,
): { found: number; total: number } {
  const { key, isValid, total } = SECTIONS[section]
  const found = new Set(discoveries[key].filter(isValid)).size
  return { found, total }
}

/** Progreso del códice completo, sumando todas las secciones. */
export function totalCodexProgress(discoveries: CodexDiscoveries): {
  found: number
  total: number
} {
  let found = 0
  let total = 0
  for (const section of CODEX_SECTIONS) {
    const progress = sectionProgress(discoveries, section)
    found += progress.found
    total += progress.total
  }
  return { found, total }
}
