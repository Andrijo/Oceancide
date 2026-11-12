// src/ui/choiceGuard.ts
// Protección contra elecciones accidentales en las pantallas de cartas y
// eventos. Se abren en mitad de la acción, con la primera opción enfocada: un
// Espacio (backflip), un Enter o un doble clic que llegue justo entonces
// elegiría una opción sin haberla leído. Lógica sin DOM para poder probarla.

/** Milisegundos tras abrir la elección durante los que se ignora la entrada. */
export const CHOICE_INPUT_LOCK_MS = 350

export class ChoiceGuard {
  private openedAt = Number.NEGATIVE_INFINITY
  private readonly now: () => number
  private readonly lockMs: number

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
  }

  /** `true` si ya ha pasado el bloqueo y se puede elegir. */
  public canChoose(): boolean {
    return this.now() - this.openedAt >= this.lockMs
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
  return event.repeat && (event.key === "Enter" || event.key === " ")
}
