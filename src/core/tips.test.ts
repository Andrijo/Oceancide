import { describe, expect, it } from "vitest"
import {
  TIP_DURATION,
  TIP_GAP,
  TIP_IDS,
  TipQueue,
  isTipId,
  tipText,
  type TipId,
} from "@core/tips"

function makeQueue(options: { enabled?: boolean; seen?: TipId[] } = {}) {
  const state = {
    enabled: options.enabled ?? true,
    seen: new Set<TipId>(options.seen ?? []),
    shown: [] as TipId[],
    hides: 0,
  }

  const queue = new TipQueue({
    isSeen: (id) => state.seen.has(id),
    isEnabled: () => state.enabled,
    onShow: (id) => {
      state.seen.add(id)
      state.shown.push(id)
    },
    onHide: () => {
      state.hides++
    },
  })

  return { queue, state }
}

describe("isTipId", () => {
  it("acepta solo los ids conocidos", () => {
    expect(isTipId("leak_seen")).toBe(true)
    expect(isTipId("otro")).toBe(false)
    expect(isTipId(3)).toBe(false)
  })
})

describe("tipText", () => {
  it("tiene texto para todos los avisos", () => {
    for (const id of TIP_IDS) {
      expect(
        tipText(id, { buildControl: "B", filterCost: 40 }).length,
      ).toBeGreaterThan(10)
    }
  })

  it("nombra la tecla en teclado y el botón en táctil", () => {
    const keyboard = tipText("filter_affordable", {
      buildControl: "B",
      filterCost: 40,
    })
    const touch = tipText("filter_affordable", {
      buildControl: null,
      filterCost: 40,
    })

    expect(keyboard).toContain("pulsa B")
    expect(keyboard).toContain("40")
    expect(touch).not.toContain("pulsa B")
    expect(touch).toContain("botón")
  })

  it("nombra el botón del mando cuando se juega con mando", () => {
    const gamepad = tipText("filter_affordable", {
      buildControl: "□",
      filterCost: 40,
    })

    expect(gamepad).toContain("pulsa □")
  })
})

describe("TipQueue", () => {
  it("enseña un aviso disparado en el siguiente update", () => {
    const { queue, state } = makeQueue()

    queue.trigger("debris_near")
    expect(state.shown).toEqual([])

    queue.update(0.016)
    expect(state.shown).toEqual(["debris_near"])
  })

  it("no repite un aviso ya visto", () => {
    const { queue, state } = makeQueue({ seen: ["jellyfish_hit"] })

    expect(queue.wants("jellyfish_hit")).toBe(false)
    queue.trigger("jellyfish_hit")
    queue.update(1)

    expect(state.shown).toEqual([])
  })

  it("ignora disparos repetidos del mismo aviso", () => {
    const { queue, state } = makeQueue()

    queue.trigger("time_low")
    queue.trigger("time_low")
    queue.update(0.1)
    queue.trigger("time_low")
    queue.update(TIP_DURATION)
    queue.update(TIP_GAP)
    queue.update(0.1)

    expect(state.shown).toEqual(["time_low"])
  })

  it("enseña de uno en uno, con un respiro entre avisos", () => {
    const { queue, state } = makeQueue()

    queue.trigger("debris_near")
    queue.trigger("leak_seen")
    queue.update(0.1)
    expect(state.shown).toEqual(["debris_near"])

    queue.update(TIP_DURATION - 1)
    expect(state.shown).toEqual(["debris_near"])
    expect(state.hides).toBe(0)

    queue.update(1)
    expect(state.hides).toBe(1)
    expect(state.shown).toEqual(["debris_near"])

    queue.update(TIP_GAP / 2)
    expect(state.shown).toEqual(["debris_near"])

    queue.update(TIP_GAP)
    expect(state.shown).toEqual(["debris_near", "leak_seen"])
  })

  it("no enseña nada con los avisos desactivados", () => {
    const { queue, state } = makeQueue({ enabled: false })

    queue.trigger("debris_near")
    queue.update(1)

    expect(state.shown).toEqual([])
  })

  it("descarta los pendientes si se desactivan mientras esperan", () => {
    const { queue, state } = makeQueue()

    queue.trigger("debris_near")
    queue.trigger("leak_seen")
    queue.update(0.1)
    state.enabled = false
    queue.update(TIP_DURATION)
    queue.update(TIP_GAP)
    queue.update(0.1)

    expect(state.shown).toEqual(["debris_near"])
  })

  it("clear retira el aviso actual y vacía la cola", () => {
    const { queue, state } = makeQueue()

    queue.trigger("debris_near")
    queue.trigger("leak_seen")
    queue.update(0.1)
    queue.clear()

    expect(state.hides).toBe(1)

    queue.update(TIP_DURATION + TIP_GAP)
    queue.update(0.1)
    expect(state.shown).toEqual(["debris_near"])

    // Sin aviso en pantalla, clear no vuelve a ocultar nada.
    queue.clear()
    expect(state.hides).toBe(1)
  })
})
