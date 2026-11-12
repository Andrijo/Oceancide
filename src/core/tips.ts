// src/core/tips.ts
// Avisos contextuales del onboarding: qué avisos hay, qué dicen y en qué orden
// se enseñan. Lógica pura; quién los dispara y cómo se pintan lo decide Game.

export const TIP_IDS = [
  "debris_near",
  "leak_seen",
  "fragile_broken",
  "jellyfish_hit",
  "time_low",
  "filter_affordable",
] as const

export type TipId = (typeof TIP_IDS)[number]

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
  /** El jugador usa los controles táctiles (no hay teclas que nombrar). */
  touch: boolean
  /** Coste en eco de la esfera filtradora. */
  filterCost: number
}

export function tipText(id: TipId, ctx: TipTextContext): string {
  switch (id) {
    case "debris_near":
      return "Eso que flota es un desecho. Nada hacia él para recogerlo."
    case "leak_seen":
      return "El desecho que late es una fuga: mantiene el agua contaminada hasta que lo recojas."
    case "fragile_broken":
      return "Era frágil y se rompió por llegar con impulso. Acércate con calma para recogerlo entero."
    case "jellyfish_hit":
      return "Las medusas te intoxican y te frenan. Tras picar se apagan unos segundos: aprovecha para alejarte."
    case "time_low":
      return "Queda poco tiempo. Al llegar a cero, la presión dispara la toxicidad: limpia la zona cuanto antes."
    case "filter_affordable":
      return ctx.touch
        ? `Tienes ${ctx.filterCost} de Eco: toca el botón del embudo para colocar una esfera filtradora que recoge desechos por ti.`
        : `Tienes ${ctx.filterCost} de Eco: pulsa B para colocar una esfera filtradora que recoge desechos por ti.`
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
