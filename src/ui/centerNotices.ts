// src/ui/centerNotices.ts
// Avisos de la zona central de la pantalla. Cada tipo de aviso tiene su propio
// hueco: un aviso nuevo solo sustituye al anterior del mismo tipo, así un
// mensaje corto ("¡DASH!", "¡MEDUSA!"...) nunca borra el aviso de reliquia.
// Lógica sin DOM para poder probarla; quién pinta y coloca los nodos es
// UIManager.

/** Huecos de la zona central. */
export type CenterSlot = "message" | "relic"

/** Lo mínimo que necesita la cola de un aviso pintado: poder quitarlo. */
export interface CenterNotice {
  remove(): void
}

export class CenterNotices<T extends CenterNotice = CenterNotice> {
  private readonly items = new Map<CenterSlot, T>()
  private readonly timers = new Map<CenterSlot, ReturnType<typeof setTimeout>>()

  /**
   * Enseña `notice` en su hueco durante `duration` ms. Retira el aviso
   * anterior de ese mismo hueco; los de los demás huecos no se tocan.
   */
  public show(slot: CenterSlot, notice: T, duration: number): void {
    this.dismiss(slot)
    this.items.set(slot, notice)
    this.timers.set(
      slot,
      setTimeout(() => {
        if (this.items.get(slot) !== notice) return
        notice.remove()
        this.items.delete(slot)
        this.timers.delete(slot)
      }, duration),
    )
  }

  /** Aviso que ocupa ahora el hueco, si lo hay. */
  public get(slot: CenterSlot): T | undefined {
    return this.items.get(slot)
  }

  /** Quita el aviso del hueco (si lo hay) y cancela su temporizador. */
  public dismiss(slot: CenterSlot): void {
    clearTimeout(this.timers.get(slot))
    this.timers.delete(slot)
    this.items.get(slot)?.remove()
    this.items.delete(slot)
  }

  /** Quita todos los avisos. */
  public clear(): void {
    for (const slot of [...this.items.keys()]) this.dismiss(slot)
  }
}

/**
 * Posición vertical (en px, relativa al contenedor) en la que debe empezar un
 * mensaje para quedar justo debajo del aviso de reliquia, sin solaparse.
 */
export function messageTopBelow(
  relicBottom: number,
  containerTop: number,
  gap: number,
): number {
  return relicBottom - containerTop + gap
}
