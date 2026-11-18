// src/core/tips.ts
// Avisos contextuales del onboarding: qué avisos hay, qué dicen y en qué orden
// se enseñan. Lógica pura; quién los dispara y cómo se pintan lo decide Game.

export const TIP_IDS = [
  "touch_move",
  "touch_depth",
  "touch_boost",
  "touch_dash",
  "debris_near",
  "leak_seen",
  "fragile_broken",
  "jellyfish_hit",
  "eel_charge",
  "lantern_pull",
  "school_scatter",
  "puffer_inflate",
  "barracuda_chase",
  "angler_ambush",
  "octopus_steal",
  "squid_ink",
  "friendly_help",
  "rescue_net",
  "manta_aura",
  "whale_song",
  "boss_seen",
  "time_low",
  "filter_affordable",
] as const

export type TipId = (typeof TIP_IDS)[number]

/**
 * Avisos de los controles táctiles, en el orden en que se enseñan. Solo se
 * disparan jugando con la pantalla táctil (en teclado y mando ya está la
 * pista de controles).
 */
export const TOUCH_TIP_IDS = [
  "touch_move",
  "touch_depth",
  "touch_boost",
  "touch_dash",
] as const satisfies readonly TipId[]

export type TouchTipId = (typeof TOUCH_TIP_IDS)[number]

/**
 * Control táctil que enseña cada aviso: si el jugador ya lo ha usado, el
 * aviso sobra y se da por visto sin mostrarlo.
 */
export const TOUCH_TIP_CONTROL = {
  touch_move: "move",
  touch_depth: "depth",
  touch_boost: "boost",
  touch_dash: "dash",
} as const satisfies Record<TouchTipId, string>

export function isTipId(value: unknown): value is TipId {
  return (
    typeof value === "string" && (TIP_IDS as readonly string[]).includes(value)
  )
}

/** Segundos que un aviso permanece en pantalla. */
export const TIP_DURATION = 6.5
/** Pausa entre dos avisos seguidos, para que no se pisen. */
export const TIP_GAP = 1.2
/** El aviso de tiempo salta cuando queda esta fracción del límite del bioma. */
export const TIP_TIME_LOW_RATIO = 0.3

export interface TipTextContext {
  /**
   * Tecla o botón del mando que coloca el filtro, o `null` si el jugador usa
   * los controles táctiles (no hay teclas que nombrar).
   */
  buildControl: string | null
  /** Coste en eco de la esfera filtradora. */
  filterCost: number
}

export function tipText(id: TipId, ctx: TipTextContext): string {
  switch (id) {
    case "touch_move":
      return "Arrastra el dedo en la mitad izquierda de la pantalla para nadar: hacia arriba avanzas y a los lados giras."
    case "touch_depth":
      return "Desliza arriba o abajo en la mitad derecha para subir o bajar. Puedes hacerlo mientras nadas."
    case "touch_boost":
      return "Para impulsarte, empuja el joystick más allá de su borde. Así puedes impulsarte y cambiar de profundidad a la vez."
    case "touch_dash":
      return "Desliza rápido a un lado en la mitad izquierda para hacer un giro de 360° con dash. También tienes el botón «Dash»."
    case "debris_near":
      return "Eso que flota es un desecho. Nada hacia él para recogerlo."
    case "leak_seen":
      return "El desecho que late es una fuga: mantiene el agua contaminada hasta que lo recojas."
    case "fragile_broken":
      return "Era frágil y se rompió por llegar con impulso. Acércate con calma para recogerlo entero."
    case "jellyfish_hit":
      return "Las medusas te intoxican y te frenan. Tras picar se apagan unos segundos: aprovecha para alejarte."
    case "eel_charge":
      return "¡Una anguila! Cuando te ve con impulso se encara, brilla y embiste en línea recta. Apártate de lado."
    case "lantern_pull":
      return "La luz del pez linterna te arrastra hacia él y muerde si lo tocas. Nada en contra para escapar."
    case "school_scatter":
      return "Al atravesar un banco de peces, los desechos de alrededor salen despedidos. Rodéalo si quieres que sigan juntos."
    case "puffer_inflate":
      return "El pez globo se infla si te acercas: sus púas pinchan y alrededor el agua se vuelve tóxica. Espera a que se desinfle."
    case "barracuda_chase":
      return "Una barracuda te persigue. Es algo más lenta que tú: usa el impulso para dejarla atrás."
    case "angler_ambush":
      return "El rape espera quieto en el fondo con su luz encendida y se lanza si pasas cerca. Mantén la distancia."
    case "octopus_steal":
      return "El pulpo roba los desechos que atraen tus esferas. Coloca las esferas lejos de él."
    case "squid_ink":
      return "El calamar suelta tinta tóxica al asustarse. Sal de la nube cuanto antes y no lo persigas con impulso."
    case "friendly_help":
      return "Hay animales que ayudan: el caballito de mar te limpia, el delfín te acelera y la rémora te protege de un golpe. Nada hacia ellos."
    case "rescue_net":
      return "¡Una tortuga atrapada en una red! Quédate a su lado un momento para liberarla."
    case "manta_aura":
      return "Mientras nadas junto a la manta raya, recoges desechos desde más lejos."
    case "whale_song":
      return "El canto de la ballena limpia el agua: cerca de ella, la toxicidad baja mientras canta."
    case "boss_seen":
      return "¡Un megajefe! Toca las fugas brillantes de su cuerpo para purificarlo. Evita el cuerpo y salta sus ondas cambiando de profundidad o con dash."
    case "time_low":
      return "Queda poco tiempo. Al llegar a cero, la presión dispara la toxicidad: limpia la zona cuanto antes."
    case "filter_affordable":
      return ctx.buildControl === null
        ? `Tienes ${ctx.filterCost} de Eco: toca el botón «Filtro» (el embudo) para colocar una esfera filtradora que recoge desechos por ti.`
        : `Tienes ${ctx.filterCost} de Eco: pulsa ${ctx.buildControl} para colocar una esfera filtradora que recoge desechos por ti.`
  }
}

export interface TipQueueHooks {
  /** El jugador ya vio este aviso en alguna partida. */
  isSeen(id: TipId): boolean
  /** Los avisos están activados en los ajustes. */
  isEnabled(): boolean
  /** Hay que pintar el aviso (y darlo por visto). */
  onShow(id: TipId): void
  /** Hay que retirar el aviso que esté en pantalla. */
  onHide(): void
}

/**
 * Cola de avisos: enseña de uno en uno, cada aviso como mucho una vez, y deja
 * un respiro entre dos seguidos. El tiempo lo marca `update`, así que la cola
 * se congela sola cuando el juego está en pausa.
 */
export class TipQueue {
  private readonly hooks: TipQueueHooks
  private pending: TipId[] = []
  private current: TipId | null = null
  /** Tiempo restante del aviso actual o, sin aviso, del respiro. */
  private timer = 0

  constructor(hooks: TipQueueHooks) {
    this.hooks = hooks
  }

  /** `true` si disparar este aviso serviría de algo (para ahorrar cálculos). */
  public wants(id: TipId): boolean {
    return (
      this.hooks.isEnabled() &&
      !this.hooks.isSeen(id) &&
      this.current !== id &&
      !this.pending.includes(id)
    )
  }

  public trigger(id: TipId): void {
    if (this.wants(id)) this.pending.push(id)
  }

  public update(deltaTime: number): void {
    if (this.timer > 0) {
      this.timer -= deltaTime
      if (this.timer > 0) return

      if (this.current) {
        this.current = null
        this.timer = TIP_GAP
        this.hooks.onHide()
        return
      }
    }

    if (this.current) return

    while (this.pending.length > 0) {
      const next = this.pending.shift()!
      // Pudo desactivarse o verse mientras esperaba en la cola.
      if (!this.hooks.isEnabled() || this.hooks.isSeen(next)) continue

      this.current = next
      this.timer = TIP_DURATION
      this.hooks.onShow(next)
      return
    }
  }

  /** Retira el aviso actual y descarta los pendientes (fin de la partida). */
  public clear(): void {
    const showing = this.current !== null
    this.pending = []
    this.current = null
    this.timer = 0
    if (showing) this.hooks.onHide()
  }
}
