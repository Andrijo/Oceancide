import { BIOME_ORDER, BIOMES } from "@core/types"

export interface DevApi {
  getBiomeIndex(): number
  goToBiome(index: number): void
  isGodMode(): boolean
  setGodMode(enabled: boolean): void
  clearToxicity(): void
  completeZone(): void
  restartRun(): void
}

export class DevMenu {
  private api: DevApi
  private toggleBtn: HTMLButtonElement
  private panel: HTMLElement
  private open = false

  constructor(api: DevApi) {
    this.api = api
    const container = document.getElementById("game-container")!

    this.toggleBtn = document.createElement("button")
    this.toggleBtn.textContent = "DEV"
    this.toggleBtn.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 500;
      padding: 6px 14px;
      font: bold 12px monospace;
      color: #0f0;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid #0f0;
      border-radius: 6px;
      pointer-events: auto;
    `
    this.toggleBtn.addEventListener("click", () => this.setOpen(!this.open))

    this.panel = document.createElement("div")
    this.panel.style.cssText = `
      position: absolute;
      top: 46px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 500;
      width: min(320px, 92vw);
      max-height: 70dvh;
      overflow-y: auto;
      padding: 10px;
      font: 12px monospace;
      color: #0f0;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid #0f0;
      border-radius: 8px;
      pointer-events: auto;
      touch-action: pan-y;
      display: none;
    `

    container.append(this.toggleBtn, this.panel)

    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") this.setOpen(!this.open)
    })

    this.render()
  }

  /** Vuelve a pintar el panel (si está abierto), p. ej. tras cambiar de bioma. */
  public refresh(): void {
    if (this.open) this.render()
  }

  private setOpen(open: boolean): void {
    this.open = open
    this.panel.style.display = open ? "block" : "none"
    if (open) this.render()
  }

  private makeButton(
    label: string,
    onClick: () => void,
    active = false,
  ): HTMLButtonElement {
    const btn = document.createElement("button")
    btn.textContent = label
    btn.style.cssText = `
      padding: 6px 8px;
      font: 12px monospace;
      text-align: left;
      color: ${active ? "#000" : "#0f0"};
      background: ${active ? "#0f0" : "rgba(0, 60, 0, 0.6)"};
      border: 1px solid #0a0;
      border-radius: 4px;
    `
    btn.addEventListener("click", () => {
      onClick()
      this.render()
    })
    return btn
  }

  private makeTitle(text: string): HTMLElement {
    const el = document.createElement("div")
    el.textContent = text
    el.style.cssText =
      "margin: 10px 0 6px; opacity: 0.7; text-transform: uppercase;"
    return el
  }

  private render(): void {
    this.panel.replaceChildren()

    // --- Biomas ---
    this.panel.append(this.makeTitle("Ir a bioma"))
    const biomeGrid = document.createElement("div")
    biomeGrid.style.cssText =
      "display: grid; grid-template-columns: 1fr; gap: 4px;"
    const current = this.api.getBiomeIndex()
    BIOME_ORDER.forEach((key, i) => {
      const biome = BIOMES[key]
      biomeGrid.append(
        this.makeButton(
          `${i + 1}. ${biome.name} (${biome.depth} m)`,
          () => this.api.goToBiome(i),
          i === current,
        ),
      )
    })
    this.panel.append(biomeGrid)

    // --- Utilidades ---
    this.panel.append(this.makeTitle("Utilidades"))
    const tools = document.createElement("div")
    tools.style.cssText =
      "display: grid; grid-template-columns: 1fr 1fr; gap: 4px;"
    const god = this.api.isGodMode()
    tools.append(
      this.makeButton(
        `Modo dios: ${god ? "ON" : "OFF"}`,
        () => this.api.setGodMode(!god),
        god,
      ),
      this.makeButton("Limpiar toxicidad", () => this.api.clearToxicity()),
      this.makeButton("Completar zona", () => this.api.completeZone()),
      this.makeButton("Reiniciar run", () => this.api.restartRun()),
    )
    this.panel.append(tools)
  }
}
