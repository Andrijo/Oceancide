// src/ui/ConfirmDialog.ts
// Diálogo de confirmación propio, en lugar de window.confirm (que rompe la
// estética, no se traduce y algunos navegadores embebidos lo bloquean). Solo
// monta los nodos; ScreenManager.confirm lo coloca sobre la pantalla abierta,
// la vuelve inerte y mantiene el foco dentro (estilos en styles.css).

import { el, makeButton } from "@ui/dom"

export interface ConfirmOptions {
  title: string
  message?: string
  /** Aviso destacado: lo que se pierde al confirmar. */
  warning?: string
  confirmLabel: string
  cancelLabel: string
}

export interface ConfirmDialogParts {
  layer: HTMLElement
  confirmButton: HTMLButtonElement
  cancelButton: HTMLButtonElement
}

export function createConfirmDialog(
  options: ConfirmOptions,
  onConfirm: () => void,
  onCancel: () => void,
): ConfirmDialogParts {
  const layer = el("div", "confirm-layer")
  // Tocar fuera del recuadro cancela, como en cualquier diálogo.
  layer.addEventListener("click", (event) => {
    if (event.target === layer) onCancel()
  })

  const box = el("div", "confirm-box")
  box.setAttribute("role", "alertdialog")
  box.setAttribute("aria-modal", "true")

  const title = el("h2", "confirm-title", options.title)
  title.id = "confirm-dialog-title"
  box.setAttribute("aria-labelledby", title.id)
  box.append(title)

  const described: string[] = []
  if (options.message) {
    const message = el("p", "confirm-message", options.message)
    message.id = "confirm-dialog-message"
    described.push(message.id)
    box.append(message)
  }
  if (options.warning) {
    const warning = el("p", "confirm-warning", options.warning)
    warning.id = "confirm-dialog-warning"
    described.push(warning.id)
    box.append(warning)
  }
  if (described.length > 0) {
    box.setAttribute("aria-describedby", described.join(" "))
  }

  // La acción segura va rellena, a la derecha y con el foco: un doble clic o
  // un Enter de más cancelan en vez de confirmar.
  const confirmButton = makeButton(options.confirmLabel, onConfirm, "danger")
  confirmButton.classList.add("is-side")
  const cancelButton = makeButton(options.cancelLabel, onCancel, "primary")
  cancelButton.classList.add("is-main")

  const actions = el("div", "action-row confirm-actions")
  actions.append(confirmButton, cancelButton)
  actions.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const target =
      document.activeElement === confirmButton ? cancelButton : confirmButton
    target.focus()
  })
  box.append(actions)

  layer.append(box)
  return { layer, confirmButton, cancelButton }
}
