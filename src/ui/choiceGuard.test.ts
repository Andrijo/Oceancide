import { describe, expect, it } from "vitest"
import {
  CHOICE_INPUT_LOCK_MS,
  ChoiceGuard,
  isRepeatedActivation,
} from "./choiceGuard"

function clock(start = 1000) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe("ChoiceGuard", () => {
  it("permite elegir si nunca se ha abierto una elección", () => {
    const { now } = clock()
    expect(new ChoiceGuard(now).canChoose()).toBe(true)
  })

  it("bloquea la elección justo después de abrirse", () => {
    const { now, advance } = clock()
    const guard = new ChoiceGuard(now)

    guard.open()
    expect(guard.canChoose()).toBe(false)

    advance(CHOICE_INPUT_LOCK_MS - 1)
    expect(guard.canChoose()).toBe(false)
  })

  it("permite elegir al terminar el bloqueo", () => {
    const { now, advance } = clock()
    const guard = new ChoiceGuard(now)

    guard.open()
    advance(CHOICE_INPUT_LOCK_MS)
    expect(guard.canChoose()).toBe(true)
  })

  it("cada apertura reinicia el bloqueo (evento seguido de cartas)", () => {
    const { now, advance } = clock()
    const guard = new ChoiceGuard(now, 300)

    guard.open()
    advance(300)
    expect(guard.canChoose()).toBe(true)

    guard.open()
    advance(100)
    expect(guard.canChoose()).toBe(false)
  })
})

describe("ChoiceGuard: Espacio/Enter al soltarse", () => {
  function unlocked() {
    const { now, advance } = clock()
    const guard = new ChoiceGuard(now)
    guard.open()
    advance(CHOICE_INPUT_LOCK_MS)
    return { guard, advance }
  }

  it("da tiempo a ver las cartas tras su animación de entrada", () => {
    expect(CHOICE_INPUT_LOCK_MS).toBeGreaterThanOrEqual(1000)
  })

  it("un Espacio pulsado antes de abrir (backflip) no elige al soltarlo", () => {
    const { guard } = unlocked()
    // Mantenido: solo llegan repeticiones mientras la elección está abierta.
    guard.keyDown(" ", true)
    expect(guard.keyUp(" ")).toBe(true)
  })

  it("un Espacio pulsado durante el bloqueo no elige aunque se suelte después", () => {
    const { now, advance } = clock()
    const guard = new ChoiceGuard(now)
    guard.open()

    advance(CHOICE_INPUT_LOCK_MS - 100)
    guard.keyDown(" ", false)
    advance(200)
    expect(guard.canChoose()).toBe(true)
    expect(guard.keyUp(" ")).toBe(true)
  })

  it("un Espacio o Enter pulsados de nuevo tras el bloqueo sí eligen", () => {
    const { guard } = unlocked()
    guard.keyDown(" ", false)
    expect(guard.keyUp(" ")).toBe(false)
    guard.keyDown("Enter", false)
    expect(guard.keyUp("Enter")).toBe(false)
  })

  it("abrir otra elección olvida las pulsaciones anteriores", () => {
    const { guard, advance } = unlocked()
    guard.keyDown(" ", false)
    guard.open()
    advance(CHOICE_INPUT_LOCK_MS)
    expect(guard.keyUp(" ")).toBe(true)
  })

  it("no interfiere con otras teclas", () => {
    const { guard } = unlocked()
    guard.keyDown("1", false)
    expect(guard.keyUp("1")).toBe(false)
    expect(guard.keyUp("ArrowRight")).toBe(false)
  })
})

describe("isRepeatedActivation", () => {
  it("detecta Enter y Espacio mantenidos", () => {
    expect(isRepeatedActivation({ repeat: true, key: "Enter" })).toBe(true)
    expect(isRepeatedActivation({ repeat: true, key: " " })).toBe(true)
  })

  it("deja pasar la primera pulsación", () => {
    expect(isRepeatedActivation({ repeat: false, key: "Enter" })).toBe(false)
    expect(isRepeatedActivation({ repeat: false, key: " " })).toBe(false)
  })

  it("no afecta a otras teclas mantenidas", () => {
    expect(isRepeatedActivation({ repeat: true, key: "ArrowDown" })).toBe(false)
    expect(isRepeatedActivation({ repeat: true, key: "1" })).toBe(false)
  })
})
