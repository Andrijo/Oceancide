import { afterEach, describe, expect, it, vi } from "vitest"
import type { InputState } from "@core/types"
import {
  InputController,
  applyHoldAction,
  type InputControllerActions,
} from "@core/InputController"
import { createDefaultKeyBindings, rebindKey } from "@core/keyBindings"

function makeInput(): InputState {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    moveX: 0,
    moveY: 0,
    vertical: 0,
  }
}

function makeActions(
  overrides: Partial<InputControllerActions> = {},
): InputControllerActions {
  return {
    isOverlayActive: vi.fn(() => false),
    isPaused: vi.fn(() => false),
    isPlaying: vi.fn(() => true),
    blocksGameplay: vi.fn(() => false),
    togglePause: vi.fn(),
    setPaused: vi.fn(),
    backflip: vi.fn(),
    requestAbandon: vi.fn(),
    build: vi.fn(),
    dash: vi.fn(),
    setLookBack: vi.fn(),
    ...overrides,
  }
}

function keyEvent(
  code: string,
  overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    code,
    repeat: false,
    defaultPrevented: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("applyHoldAction", () => {
  it("aplica las acciones de mantener a su campo", () => {
    const input = makeInput()

    expect(applyHoldAction(input, "boost", true)).toBe(true)
    expect(input.boost).toBe(true)
    expect(applyHoldAction(input, "boost", false)).toBe(true)
    expect(input.boost).toBe(false)
  })

  it("devuelve false y no toca el estado con una acción puntual", () => {
    const input = makeInput()

    expect(applyHoldAction(input, "build", true)).toBe(false)
    expect(input).toEqual(makeInput())
  })
})

describe("InputController: teclas por defecto", () => {
  const mappings: Array<{
    codes: string[]
    field: "forward" | "backward" | "left" | "right" | "up" | "down" | "boost"
  }> = [
    { codes: ["KeyW", "ArrowUp"], field: "forward" },
    { codes: ["KeyS", "ArrowDown"], field: "backward" },
    { codes: ["KeyA", "ArrowLeft"], field: "left" },
    { codes: ["KeyD", "ArrowRight"], field: "right" },
    { codes: ["Space", "KeyU"], field: "up" },
    { codes: ["KeyC", "KeyJ"], field: "down" },
    { codes: ["ShiftLeft", "ShiftRight", "KeyI"], field: "boost" },
  ]

  it("mapea cada tecla (principal y alternativas) a su eje", () => {
    for (const { codes, field } of mappings) {
      for (const code of codes) {
        const input = makeInput()
        const controller = new InputController(input, makeActions())

        controller.handleKeyDown(keyEvent(code))
        expect(input[field]).toBe(true)

        controller.handleKeyUp(keyEvent(code))
        expect(input[field]).toBe(false)
      }
    }
  })

  it("ignora las teclas sin acción", () => {
    const input = makeInput()
    const actions = makeActions()
    const controller = new InputController(input, actions)
    const event = keyEvent("KeyZ")

    controller.handleKeyDown(event)

    expect(input).toEqual(makeInput())
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})

describe("InputController: teclas reasignadas", () => {
  it("usa las asignaciones actuales en cada pulsación", () => {
    let bindings = createDefaultKeyBindings()
    const input = makeInput()
    const actions = makeActions()
    const controller = new InputController(input, actions, () => bindings)

    bindings = rebindKey(bindings, "build", "KeyG")
    controller.handleKeyDown(keyEvent("KeyG"))
    controller.handleKeyDown(keyEvent("KeyB"))

    expect(actions.build).toHaveBeenCalledOnce()
  })

  it("al intercambiar teclas, cada una hace la acción nueva", () => {
    const bindings = rebindKey(createDefaultKeyBindings(), "up", "KeyC")
    const input = makeInput()
    const controller = new InputController(input, makeActions(), () => bindings)

    controller.handleKeyDown(keyEvent("KeyC"))
    controller.handleKeyDown(keyEvent("Space"))

    expect(input.up).toBe(true)
    expect(input.down).toBe(true)
  })

  it("la tecla principal gana a una alternativa de otra acción", () => {
    const bindings = rebindKey(createDefaultKeyBindings(), "build", "ArrowUp")
    const input = makeInput()
    const actions = makeActions()
    const controller = new InputController(input, actions, () => bindings)

    controller.handleKeyDown(keyEvent("ArrowUp"))

    expect(actions.build).toHaveBeenCalledOnce()
    expect(input.forward).toBe(false)
  })
})

describe("InputController.clear", () => {
  it("resetea todos los ejes y el look-back", () => {
    const input = makeInput()
    input.forward = true
    input.backward = true
    input.left = true
    input.right = true
    input.up = true
    input.down = true
    input.boost = true
    input.moveX = 1
    input.moveY = -1
    input.vertical = 0.5
    const actions = makeActions()

    new InputController(input, actions).clear()

    expect(input).toEqual(makeInput())
    expect(actions.setLookBack).toHaveBeenCalledWith(false)
  })
})

describe("InputController.handleKeyDown", () => {
  it("mueve con las teclas de dirección", () => {
    const input = makeInput()
    const controller = new InputController(input, makeActions())

    controller.handleKeyDown(keyEvent("KeyW"))

    expect(input.forward).toBe(true)
  })

  it("ignora todo si hay un overlay activo", () => {
    const input = makeInput()
    const actions = makeActions({ isOverlayActive: () => true })
    const controller = new InputController(input, actions)

    controller.handleKeyDown(keyEvent("KeyW"))
    controller.handleKeyDown(keyEvent("Escape"))

    expect(input.forward).toBe(false)
    expect(actions.togglePause).not.toHaveBeenCalled()
  })

  it("Escape alterna la pausa, salvo en auto-repeat", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("Escape"))
    controller.handleKeyDown(keyEvent("Escape", { repeat: true }))

    expect(actions.togglePause).toHaveBeenCalledOnce()
  })

  it("Enter pausa la partida y evita el comportamiento por defecto", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)
    const event = keyEvent("Enter")

    controller.handleKeyDown(event)

    expect(actions.setPaused).toHaveBeenCalledWith(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it("Enter no pausa si ya está pausado, no se juega o el evento está repetido", () => {
    const controllerPaused = new InputController(
      makeInput(),
      makeActions({ isPaused: () => true }),
    )
    const controllerHub = new InputController(
      makeInput(),
      makeActions({ isPlaying: () => false }),
    )
    const actions = makeActions()
    const controllerRepeat = new InputController(makeInput(), actions)

    controllerPaused.handleKeyDown(keyEvent("Enter"))
    controllerHub.handleKeyDown(keyEvent("Enter"))
    controllerRepeat.handleKeyDown(keyEvent("Enter", { repeat: true }))

    expect(actions.setPaused).not.toHaveBeenCalled()
  })

  it("Enter respeta el control que tiene el foco", () => {
    class FakeElement {
      public closest(): object {
        return {}
      }
    }
    vi.stubGlobal("HTMLElement", FakeElement)

    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(
      keyEvent("Enter", {
        target: new FakeElement() as unknown as EventTarget,
      }),
    )

    expect(actions.setPaused).not.toHaveBeenCalled()
  })

  it("F hace la voltereta si no hay transición", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)
    const event = keyEvent("KeyF")

    controller.handleKeyDown(event)

    expect(actions.backflip).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it("F no hace la voltereta durante una transición", () => {
    const actions = makeActions({ blocksGameplay: () => true })
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyF"))

    expect(actions.backflip).not.toHaveBeenCalled()
  })

  it("en la inmersión, Espacio sube y no activa el botón enfocado", () => {
    const input = makeInput()
    const controller = new InputController(input, makeActions())
    const event = keyEvent("Space")

    controller.handleKeyDown(event)

    expect(input.up).toBe(true)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it("fuera de la inmersión, Espacio conserva su comportamiento normal", () => {
    const controller = new InputController(
      makeInput(),
      makeActions({ isPlaying: () => false }),
    )
    const event = keyEvent("Space")

    controller.handleKeyDown(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("R pide abandonar (pausa con confirmación) solo si se está jugando y no es auto-repeat", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyR"))
    controller.handleKeyDown(keyEvent("KeyR", { repeat: true }))

    expect(actions.requestAbandon).toHaveBeenCalledOnce()
  })

  it("R no pide abandonar desde el hub", () => {
    const actions = makeActions({ isPlaying: () => false })
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyR"))

    expect(actions.requestAbandon).not.toHaveBeenCalled()
  })

  it("B construye un filtro", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyB"))

    expect(actions.build).toHaveBeenCalledOnce()
  })

  it("V activa el look-back", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyV"))

    expect(actions.setLookBack).toHaveBeenCalledWith(true)
  })

  it("Q y E lanzan el dash en su dirección", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyDown(keyEvent("KeyQ"))
    controller.handleKeyDown(keyEvent("KeyE"))

    expect(actions.dash).toHaveBeenNthCalledWith(1, "left")
    expect(actions.dash).toHaveBeenNthCalledWith(2, "right")
  })

  it("no procesa acciones ni movimiento mientras está pausado", () => {
    const input = makeInput()
    const actions = makeActions({ isPaused: () => true })
    const controller = new InputController(input, actions)

    controller.handleKeyDown(keyEvent("KeyW"))
    controller.handleKeyDown(keyEvent("KeyB"))
    controller.handleKeyDown(keyEvent("KeyQ"))

    expect(input.forward).toBe(false)
    expect(actions.build).not.toHaveBeenCalled()
    expect(actions.dash).not.toHaveBeenCalled()
  })
})

describe("InputController.handleKeyUp", () => {
  it("suelta la tecla de movimiento", () => {
    const input = makeInput()
    input.forward = true
    const controller = new InputController(input, makeActions())

    controller.handleKeyUp(keyEvent("KeyW"))

    expect(input.forward).toBe(false)
  })

  it("desactiva el look-back al soltar V", () => {
    const actions = makeActions()
    const controller = new InputController(makeInput(), actions)

    controller.handleKeyUp(keyEvent("KeyV"))

    expect(actions.setLookBack).toHaveBeenCalledWith(false)
  })

  it("ignora las teclas si hay un overlay activo", () => {
    const input = makeInput()
    input.forward = true
    const controller = new InputController(
      input,
      makeActions({ isOverlayActive: () => true }),
    )

    controller.handleKeyUp(keyEvent("KeyW"))

    expect(input.forward).toBe(true)
  })
})
