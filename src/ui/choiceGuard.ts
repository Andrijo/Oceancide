// src/ui/choiceGuard.ts
// Protección contra elecciones accidentales en las pantallas de cartas y
// eventos. Se abren en mitad de la acción, con la primera opción enfocada: un
// Espacio (backflip), un Enter o un doble clic que llegue justo entonces
// elegiría una opción sin haberla leído. Lógica sin DOM para poder probarla.

/**
 * Milisegundos tras abrir la elección durante los que se ignora la entrada.
 * Algo más que la animación de entrada de las cartas (~0,7 s), para que dé
 * tiempo a verlas quietas antes de poder elegir.
 */
export const CHOICE_INPUT_LOCK_MS = 1200

/** Teclas que activan el botón enfocado. */
function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " "
}

export class ChoiceGuard {
  private openedAt = Number.NEGATIVE_INFINITY
  private readonly now: () => number
  public readonly lockMs: number
  /**
   * Teclas de activación pulsadas de nuevo con la elección ya desbloqueada.
   * Solo esas pueden elegir al soltarse.
   */
  private readonly armed = new Set<string>()

  constructor(
    now: () => number = () => performance.now(),
    lockMs: number = CHOICE_INPUT_LOCK_MS,
  ) {
    this.now = now
    this.lockMs = lockMs
  }

  /** Marca el momento en que se abre una elección. */
  public open(): void {
    this.openedAt = this.now()
    this.armed.clear()
  }

  /** `true` si ya ha pasado el bloqueo y se puede elegir. */
  public canChoose(): boolean {
    return this.now() - this.openedAt >= this.lockMs
  }

  /** Registra una pulsación (llamar en fase de captura, antes que el botón). */
  public keyDown(key: string, repeat: boolean): void {
    if (isActivationKey(key) && !repeat && this.canChoose()) {
      this.armed.add(key)
    }
  }

  /**
   * Registra que se suelta una tecla. Devuelve `true` si ese Espacio/Enter no
   * debe elegir: se pulsó antes de abrir la elección o durante el bloqueo (el
   * navegador activa el botón con Espacio al soltarlo, no al pulsarlo).
   */
  public keyUp(key: string): boolean {
    if (!isActivationKey(key)) return false
    const fresh = this.armed.delete(key)
    return !fresh
  }
}

/**
 * `true` si la tecla es Enter o Espacio mantenidos (auto-repetición): activaría
 * el botón enfocado una y otra vez, y una tecla que venía pulsada de la
 * pantalla anterior elegiría también en la siguiente.
 */
export function isRepeatedActivation(event: {
  repeat: boolean
  key: string
}): boolean {
  return event.repeat && isActivationKey(event.key)
}
