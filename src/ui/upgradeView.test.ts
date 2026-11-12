import { describe, expect, it } from "vitest"
import { upgradeView } from "@ui/upgradeView"

const upgrade = { id: "fins", maxLevel: 2, costs: [100, 250] }

describe("upgradeView", () => {
  it("se puede comprar con Eco suficiente", () => {
    const view = upgradeView({ upgrades: {}, ecoPoints: 100 }, upgrade)
    expect(view).toMatchObject({ level: 0, cost: 100, canBuy: true })
    expect(view.buttonLabel).toBe("Comprar · 100 Eco")
    expect(view.status).toBe("")
  })

  it("dice cuánto Eco falta si no llega", () => {
    const view = upgradeView({ upgrades: { fins: 1 }, ecoPoints: 220 }, upgrade)
    expect(view).toMatchObject({ level: 1, cost: 250, canBuy: false })
    expect(view.status).toBe("Te faltan 30 Eco")
  })

  it("al máximo no se compra ni muestra lo que falta", () => {
    const view = upgradeView({ upgrades: { fins: 2 }, ecoPoints: 0 }, upgrade)
    expect(view).toMatchObject({ isMax: true, canBuy: false, cost: 0 })
    expect(view.buttonLabel).toBe("Nivel máximo")
    expect(view.status).toBe("")
  })
})
