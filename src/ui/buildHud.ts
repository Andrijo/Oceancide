// src/ui/buildHud.ts
// Contenido del HUD de la esfera filtradora (sin DOM): icono + tecla + coste +
// activas/máximo, qué impide colocarla y el texto para lectores de pantalla.

export interface BuildHudInput {
  /** Nombre de la estructura ("Esfera filtradora"). */
  name: string
  /** Tecla o botón que la coloca; `null` en táctil (botón en pantalla). */
  control: string | null
  cost: number
  eco: number
  active: number
  max: number
}

/** Lo que impide colocar el filtro ahora mismo, o `null` si se puede. */
export type BuildBlocker = "eco" | "capacity" | null

export interface BuildHudView {
  control: string | null
  cost: string
  count: string
  blocker: BuildBlocker
  /** Descripción completa, porque los iconos no se leen. */
  label: string
}

export function buildHudView(input: BuildHudInput): BuildHudView {
  const { name, control, cost, eco, active, max } = input
  const blocker: BuildBlocker =
    active >= max ? "capacity" : eco < cost ? "eco" : null

  const parts = [
    control ? `${name}, tecla ${control}` : name,
    `cuesta ${cost} de Eco`,
    `activas ${active} de ${max}`,
  ]
  if (blocker === "capacity") parts.push("no puedes colocar más")
  if (blocker === "eco") parts.push("te falta Eco")

  return {
    control,
    cost: String(cost),
    count: `${active}/${max}`,
    blocker,
    label: parts.join(". "),
  }
}
