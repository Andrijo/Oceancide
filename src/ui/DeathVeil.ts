// Velo verde tóxico del momento de derrota (ver core/systems/deathSequence).
// El juego fija la opacidad en cada frame; al retirarse (cuando ya está el
// resumen encima) se funde con la transición de CSS de `.death-veil`.

export class DeathVeil {
  private el: HTMLDivElement

  constructor(container: HTMLElement) {
    this.el = document.createElement("div")
    this.el.className = "death-veil"
    this.el.setAttribute("aria-hidden", "true")
    container.appendChild(this.el)
  }

  public setOpacity(opacity: number): void {
    this.el.classList.add("active")
    this.el.style.opacity = String(opacity)
  }

  public hide(): void {
    this.el.classList.remove("active")
    this.el.style.opacity = "0"
  }
}
