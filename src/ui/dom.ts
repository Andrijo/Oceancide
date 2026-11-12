// src/ui/dom.ts
// Piezas básicas para montar las pantallas. Los estilos viven en styles.css
// (clases .btn, .ui-icon...); aquí solo se crean los nodos.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export type ButtonVariant = "primary" | "danger" | "neutral" | "upgrade"

/** Clases de un botón según su variante (`neutral` es el aspecto base). */
export function buttonClass(variant: ButtonVariant): string {
  return variant === "neutral" ? "btn" : `btn btn--${variant}`
}

/**
 * Botón de acción. Si está marcado como no disponible (`setUnavailable`), el
 * clic no hace nada, pero sigue recibiendo foco para que el lector de
 * pantalla lo anuncie y explique por qué.
 */
export function makeButton(
  label: string,
  onClick: () => void,
  variant: ButtonVariant = "neutral",
): HTMLButtonElement {
  const btn = el("button", buttonClass(variant), label)
  btn.type = "button"
  btn.addEventListener("click", () => {
    if (btn.getAttribute("aria-disabled") === "true") return
    onClick()
  })
  return btn
}

export function setUnavailable(
  btn: HTMLButtonElement,
  unavailable: boolean,
): void {
  if (unavailable) btn.setAttribute("aria-disabled", "true")
  else btn.removeAttribute("aria-disabled")
}

/** Icono de trazo (viewBox 24×24), decorativo. */
export function icon(paths: readonly string[], size = 20): HTMLElement {
  const span = el("span", "ui-icon")
  span.style.setProperty("--icon-size", `${size}px`)
  span.setAttribute("aria-hidden", "true")
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" focusable="false">
    ${paths.map((d) => `<path d="${d}"/>`).join("")}
  </svg>`
  return span
}
