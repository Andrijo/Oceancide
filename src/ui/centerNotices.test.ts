import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CenterNotices, messageTopBelow } from "./centerNotices"

function notice() {
  return { remove: vi.fn() }
}

describe("CenterNotices", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("un mensaje corto no borra el aviso de reliquia", () => {
    const notices = new CenterNotices()
    const relic = notice()
    const dash = notice()

    notices.show("relic", relic, 4200)
    notices.show("message", dash, 700)

    expect(relic.remove).not.toHaveBeenCalled()
    expect(notices.get("relic")).toBe(relic)
    expect(notices.get("message")).toBe(dash)
  })

  it("el aviso de reliquia no borra un mensaje corto", () => {
    const notices = new CenterNotices()
    const jellyfish = notice()

    notices.show("message", jellyfish, 1000)
    notices.show("relic", notice(), 4200)

    expect(jellyfish.remove).not.toHaveBeenCalled()
    expect(notices.get("message")).toBe(jellyfish)
  })

  it("un aviso sustituye al anterior del mismo hueco", () => {
    const notices = new CenterNotices()
    const first = notice()
    const second = notice()

    notices.show("message", first, 2000)
    notices.show("message", second, 2000)

    expect(first.remove).toHaveBeenCalledOnce()
    expect(notices.get("message")).toBe(second)
  })

  it("al vencer su tiempo, cada aviso se retira solo", () => {
    const notices = new CenterNotices()
    const relic = notice()
    const dash = notice()

    notices.show("relic", relic, 4200)
    notices.show("message", dash, 700)

    vi.advanceTimersByTime(700)
    expect(dash.remove).toHaveBeenCalledOnce()
    expect(notices.get("message")).toBeUndefined()
    expect(relic.remove).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3500)
    expect(relic.remove).toHaveBeenCalledOnce()
    expect(notices.get("relic")).toBeUndefined()
  })

  it("el temporizador de un aviso sustituido no retira al nuevo", () => {
    const notices = new CenterNotices()
    const first = notice()
    const second = notice()

    notices.show("message", first, 500)
    vi.advanceTimersByTime(400)
    notices.show("message", second, 2000)
    vi.advanceTimersByTime(200)

    expect(second.remove).not.toHaveBeenCalled()
    expect(notices.get("message")).toBe(second)
  })

  it("clear retira todos los avisos y cancela sus temporizadores", () => {
    const notices = new CenterNotices()
    const relic = notice()
    const dash = notice()

    notices.show("relic", relic, 4200)
    notices.show("message", dash, 700)
    notices.clear()

    expect(relic.remove).toHaveBeenCalledOnce()
    expect(dash.remove).toHaveBeenCalledOnce()
    expect(notices.get("relic")).toBeUndefined()

    vi.advanceTimersByTime(5000)
    expect(relic.remove).toHaveBeenCalledOnce()
    expect(dash.remove).toHaveBeenCalledOnce()
  })
})

describe("messageTopBelow", () => {
  it("coloca el mensaje bajo el aviso, relativo al contenedor", () => {
    expect(messageTopBelow(260, 20, 12)).toBe(252)
  })
})
