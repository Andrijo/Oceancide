import { describe, expect, it, vi } from "vitest"
import type { InputState } from "@core/types"
import {
  GamepadController,
  NAV_REPEAT_DELAY,
  NAV_REPEAT_INTERVAL,
  PAD_BUTTON,
  navDirection,
  padStyleFromId,
  radialDeadzone,
  triggerValue,
  type GamepadHooks,
  type GamepadMode,
} from "@core/gamepad"
import {
  createDefaultPadBindings,
  rebindPadButton,
  type PadBindings,
} from "@core/padBindings"

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

/** Mando falso con la distribución "standard" (17 botones y 4 ejes). */
class FakePad {
  public id = "Xbox Wireless Controller"
  public connected = true
  public timestamp = 1
  public axes = [0, 0, 0, 0]
  public buttons = Array.from({ length: 17 }, () => ({
    pressed: false,
    value: 0,
  }))

  public press(index: number, value = 1): void {
    this.buttons[index] = { pressed: value > 0, value }
  }

  public releaseAll(): void {
    for (let i = 0; i < this.buttons.length; i++) {
      this.buttons[i] = { pressed: false, value: 0 }
    }
  }
}

function setup(mode: GamepadMode = "gameplay") {
  const pad = new FakePad()
  const input = makeInput()
  let currentMode = mode
  const hooks: GamepadHooks = {
    getMode: () => currentMode,
    onActivity: vi.fn(),
    togglePause: vi.fn(),
    dash: vi.fn(),
    backflip: vi.fn(),
    build: vi.fn(),
    setLookBack: vi.fn(),
    navigate: vi.fn(),
    activate: vi.fn(),
    back: vi.fn(),
    scroll: vi.fn(),
  }
  let pads: (FakePad | null)[] = [pad]
  let bindings = createDefaultPadBindings()
  const controller = new GamepadController(
    input,
    hooks,
    () => pads as unknown as Gamepad[],
    () => bindings,
  )
  return {
    pad,
    input,
    hooks,
    controller,
    setBindings: (next: PadBindings) => {
      bindings = next
    },
    setMode: (m: GamepadMode) => {
      currentMode = m
    },
    disconnect: () => {
      pads = []
    },
  }
}

describe("radialDeadzone", () => {
  it("anula la entrada dentro de la zona muerta", () => {
    expect(radialDeadzone(0.1, 0.1, 0.2)).toEqual({ x: 0, y: 0 })
  })

  it("reescala para aprovechar todo el recorrido", () => {
    const full = radialDeadzone(1, 0, 0.2)
    const half = radialDeadzone(0.6, 0, 0.2)

    expect(full.x).toBeCloseTo(1)
    expect(half.x).toBeCloseTo(0.5)
  })
})

describe("triggerValue", () => {
  it("aplica la zona muerta y reescala", () => {
    expect(triggerValue(0.05)).toBe(0)
    expect(triggerValue(1)).toBe(1)
    expect(triggerValue(0.55, 0.1)).toBeCloseTo(0.5)
  })
})

describe("padStyleFromId", () => {
  it("reconoce los mandos de PlayStation", () => {
    expect(padStyleFromId("DualSense Wireless Controller")).toBe("playstation")
    expect(
      padStyleFromId("Wireless Controller (STANDARD GAMEPAD Vendor: 054c)"),
    ).toBe("playstation")
  })

  it("usa los glifos de Xbox para el resto", () => {
    expect(padStyleFromId("Xbox 360 Controller (XInput)")).toBe("xbox")
    expect(padStyleFromId("Generic USB Joystick")).toBe("xbox")
  })
})

describe("navDirection", () => {
  const none = Array.from({ length: 17 }, () => false)

  it("lee la cruceta", () => {
    const buttons = [...none]
    buttons[PAD_BUTTON.left] = true
    expect(navDirection(buttons, [0, 0])).toBe("left")
  })

  it("lee el stick por su eje dominante", () => {
    expect(navDirection(none, [0.2, -0.9])).toBe("up")
    expect(navDirection(none, [0.8, 0.3])).toBe("right")
    expect(navDirection(none, [0.3, 0.2])).toBeNull()
  })
})

describe("GamepadController en la inmersión", () => {
  it("el stick izquierdo mueve (arriba = adelante)", () => {
    const { pad, input, controller } = setup()
    pad.axes = [0, -1, 0, 0]

    controller.update(0.016)

    expect(input.moveX).toBe(0)
    expect(input.moveY).toBeCloseTo(1)
    expect(input.vertical).toBe(0)
  })

  it("el stick derecho sube (arriba) y baja (abajo)", () => {
    const { pad, input, controller } = setup()
    pad.axes = [0, 0, 0, -1]
    controller.update(0.016)
    expect(input.vertical).toBeCloseTo(1)

    pad.axes = [0, 0, 0, 1]
    controller.update(0.016)
    expect(input.vertical).toBeCloseTo(-1)
  })

  it("la cruceta también cambia la profundidad", () => {
    const { pad, input, controller } = setup()
    pad.press(PAD_BUTTON.down)

    controller.update(0.016)

    expect(input.vertical).toBe(-1)
  })

  it("los gatillos ya no cambian la profundidad", () => {
    const { pad, input, controller } = setup()
    pad.press(PAD_BUTTON.lt, 1)

    controller.update(0.016)

    expect(input.vertical).toBe(0)
  })

  it("al soltar el stick vuelve a cero una vez y luego no pisa otros controles", () => {
    const { pad, input, controller } = setup()
    pad.axes = [1, 0, 0, 0]
    controller.update(0.016)
    pad.axes = [0, 0, 0, 0]
    controller.update(0.016)

    expect(input.moveX).toBe(0)

    // Otro control (el táctil) escribe después: el mando no lo pisa.
    input.moveX = 0.7
    controller.update(0.016)
    expect(input.moveX).toBe(0.7)
  })

  it("RT / R2 mantiene el impulso mientras está pulsado", () => {
    const { pad, input, controller } = setup()
    pad.press(PAD_BUTTON.rt, 1)
    controller.update(0.016)
    expect(input.boost).toBe(true)

    pad.releaseAll()
    controller.update(0.016)
    expect(input.boost).toBe(false)
  })

  it("un roce del gatillo no activa el impulso", () => {
    const { pad, input, controller } = setup()
    pad.press(PAD_BUTTON.rt, 0.15)

    controller.update(0.016)

    expect(input.boost).toBe(false)
  })

  it("A ya no lanza el impulso", () => {
    const { pad, input, controller } = setup()
    pad.press(PAD_BUTTON.a)

    controller.update(0.016)

    expect(input.boost).toBe(false)
  })

  it("usa los botones reasignados", () => {
    const { pad, input, hooks, controller, setBindings } = setup()
    // El impulso pasa a Y; la voltereta (que estaba en Y) se queda con RT.
    setBindings(
      rebindPadButton(createDefaultPadBindings(), "boost", PAD_BUTTON.y),
    )
    pad.press(PAD_BUTTON.y)
    controller.update(0.016)
    expect(input.boost).toBe(true)
    expect(hooks.backflip).not.toHaveBeenCalled()

    pad.releaseAll()
    controller.update(0.016)
    pad.press(PAD_BUTTON.rt)
    controller.update(0.016)
    expect(hooks.backflip).toHaveBeenCalledOnce()
    expect(input.boost).toBe(false)
  })

  it("Select pausa salvo que esté asignado a otra acción", () => {
    const { pad, hooks, controller, setBindings } = setup()
    pad.press(PAD_BUTTON.select)
    controller.update(0.016)
    expect(hooks.togglePause).toHaveBeenCalledOnce()

    setBindings(
      rebindPadButton(createDefaultPadBindings(), "build", PAD_BUTTON.select),
    )
    pad.releaseAll()
    controller.update(0.016)
    pad.press(PAD_BUTTON.select)
    controller.update(0.016)
    expect(hooks.togglePause).toHaveBeenCalledOnce()
    expect(hooks.build).toHaveBeenCalledOnce()
  })

  it("dispara cada acción una vez por pulsación", () => {
    const { pad, hooks, controller } = setup()
    pad.press(PAD_BUTTON.lb)
    pad.press(PAD_BUTTON.rb)
    pad.press(PAD_BUTTON.x)
    pad.press(PAD_BUTTON.y)
    pad.press(PAD_BUTTON.start)

    controller.update(0.016)
    controller.update(0.016)

    expect(hooks.dash).toHaveBeenCalledTimes(2)
    expect(hooks.dash).toHaveBeenCalledWith("left")
    expect(hooks.dash).toHaveBeenCalledWith("right")
    expect(hooks.build).toHaveBeenCalledOnce()
    expect(hooks.backflip).toHaveBeenCalledOnce()
    expect(hooks.togglePause).toHaveBeenCalledOnce()
  })

  it("B activa el look-back mientras está pulsado", () => {
    const { pad, hooks, controller } = setup()
    pad.press(PAD_BUTTON.b)
    controller.update(0.016)
    pad.releaseAll()
    controller.update(0.016)

    expect(hooks.setLookBack).toHaveBeenNthCalledWith(1, true)
    expect(hooks.setLookBack).toHaveBeenNthCalledWith(2, false)
  })

  it("avisa de la actividad con la familia del mando", () => {
    const { pad, hooks, controller } = setup()
    pad.id = "DualShock 4"
    pad.press(PAD_BUTTON.a)

    controller.update(0.016)

    expect(hooks.onActivity).toHaveBeenCalledWith("playstation")
  })

  it("al desconectarse suelta lo que mantenía", () => {
    const { pad, input, controller, disconnect } = setup()
    pad.axes = [0, -1, 0, 0]
    pad.press(PAD_BUTTON.rt)
    controller.update(0.016)

    disconnect()
    controller.update(0.016)

    expect(input.moveY).toBe(0)
    expect(input.boost).toBe(false)
  })
})

describe("GamepadController en los menús", () => {
  it("A activa, B vuelve y Start alterna la pausa", () => {
    const { pad, hooks, controller } = setup("menu")
    controller.update(0.016)
    pad.press(PAD_BUTTON.a)
    pad.press(PAD_BUTTON.b)
    pad.press(PAD_BUTTON.start)

    controller.update(0.016)

    expect(hooks.activate).toHaveBeenCalledOnce()
    expect(hooks.back).toHaveBeenCalledOnce()
    expect(hooks.togglePause).toHaveBeenCalledOnce()
    expect(hooks.dash).not.toHaveBeenCalled()
  })

  it("la cruceta mueve el foco y repite si se mantiene", () => {
    const { pad, hooks, controller } = setup("menu")
    pad.press(PAD_BUTTON.down)

    controller.update(0.016)
    expect(hooks.navigate).toHaveBeenCalledTimes(1)

    controller.update(NAV_REPEAT_DELAY / 2)
    expect(hooks.navigate).toHaveBeenCalledTimes(1)

    controller.update(NAV_REPEAT_DELAY / 2 + 0.001)
    expect(hooks.navigate).toHaveBeenCalledTimes(2)

    controller.update(NAV_REPEAT_INTERVAL + 0.001)
    expect(hooks.navigate).toHaveBeenCalledTimes(3)
    expect(hooks.navigate).toHaveBeenCalledWith("down")
  })

  it("el stick derecho desplaza la pantalla", () => {
    const { pad, hooks, controller } = setup("menu")
    pad.axes = [0, 0, 0, 1]

    controller.update(0.1)

    expect(hooks.scroll).toHaveBeenCalledWith(expect.any(Number))
    expect(vi.mocked(hooks.scroll).mock.calls[0]?.[0]).toBeGreaterThan(0)
  })

  it("un botón que venía pulsado no elige al abrirse un menú hasta que se suelta", () => {
    const { pad, input, hooks, controller, setMode } = setup("gameplay")
    pad.press(PAD_BUTTON.a)
    pad.press(PAD_BUTTON.rt)
    controller.update(0.016)
    expect(input.boost).toBe(true)

    setMode("menu")
    controller.update(0.016)
    expect(hooks.activate).not.toHaveBeenCalled()
    expect(input.boost).toBe(false)

    pad.releaseAll()
    controller.update(0.016)
    pad.press(PAD_BUTTON.a)
    controller.update(0.016)
    expect(hooks.activate).toHaveBeenCalledOnce()
  })

  it("un botón pulsado en el menú no actúa al volver al juego hasta soltarlo", () => {
    const { pad, input, controller, setMode } = setup("menu")
    controller.update(0.016)
    pad.press(PAD_BUTTON.rt)
    controller.update(0.016)

    setMode("gameplay")
    controller.update(0.016)
    expect(input.boost).toBe(false)
  })
})

describe("GamepadController: captura para reasignar", () => {
  it("entrega el siguiente botón pulsado y no navega mientras tanto", () => {
    const { pad, hooks, controller } = setup("menu")
    controller.update(0.016)
    const onButton = vi.fn()
    controller.captureButton(onButton)

    pad.press(PAD_BUTTON.b)
    controller.update(0.016)

    expect(onButton).toHaveBeenCalledWith(PAD_BUTTON.b)
    expect(hooks.back).not.toHaveBeenCalled()
  })

  it("ignora el botón que abrió la captura hasta que se suelta", () => {
    const { pad, hooks, controller } = setup("menu")
    controller.update(0.016)
    pad.press(PAD_BUTTON.a)
    controller.update(0.016)
    expect(hooks.activate).toHaveBeenCalledOnce()

    const onButton = vi.fn()
    controller.captureButton(onButton)
    controller.update(0.016)
    expect(onButton).not.toHaveBeenCalled()

    pad.releaseAll()
    controller.update(0.016)
    pad.press(PAD_BUTTON.a)
    controller.update(0.016)
    expect(onButton).toHaveBeenCalledWith(PAD_BUTTON.a)
    expect(hooks.activate).toHaveBeenCalledOnce()
  })

  it("la cruceta cancela", () => {
    const { pad, hooks, controller } = setup("menu")
    controller.update(0.016)
    const onButton = vi.fn()
    controller.captureButton(onButton)

    pad.press(PAD_BUTTON.left)
    controller.update(0.016)
    // Sigue pulsada unos frames: no debe mover el foco al acabar la captura.
    controller.update(0.016)
    controller.update(NAV_REPEAT_DELAY + 0.1)

    expect(onButton).toHaveBeenCalledWith(null)
    expect(hooks.navigate).not.toHaveBeenCalled()
  })

  it("se puede dejar de escuchar", () => {
    const { pad, hooks, controller } = setup("menu")
    controller.update(0.016)
    const onButton = vi.fn()
    const stop = controller.captureButton(onButton)

    stop()
    pad.press(PAD_BUTTON.b)
    controller.update(0.016)

    expect(onButton).not.toHaveBeenCalled()
    expect(hooks.back).toHaveBeenCalledOnce()
  })
})
