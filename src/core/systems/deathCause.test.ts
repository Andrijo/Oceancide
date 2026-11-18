import { describe, expect, it } from "vitest"
import { describeDeathCause, passiveDeathCause } from "./deathCause"

describe("passiveDeathCause", () => {
  it("es contaminación sin presión de tiempo", () => {
    expect(passiveDeathCause(1)).toEqual({ kind: "passive" })
  })

  it("es tiempo agotado con presión de tiempo", () => {
    expect(passiveDeathCause(5)).toEqual({ kind: "time" })
  })
})

describe("describeDeathCause", () => {
  it("incluye el nombre de la fuente si lo hay", () => {
    const text = describeDeathCause({ kind: "chaos", source: "Pacto caótico" })
    expect(text.title).toBe("Una carta: Pacto caótico")
    expect(text.detail).not.toBe("")
  })

  it("sin fuente usa solo el título de la causa", () => {
    expect(describeDeathCause({ kind: "jellyfish" }).title).toBe(
      "Picadura de medusa",
    )
  })
})
