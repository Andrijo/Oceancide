// src/ui/zoneObjective.ts
// Texto del objetivo de zona en el HUD. Habla de lo que hay que hacer
// ("Desechos 12/30") en lugar de un porcentaje: el 100% llegaba al recoger el
// 60% de los desechos y no se entendía sin leer Cómo jugar (#109).

export type ZoneObjectiveKind = "debris" | "leaks"

export interface ZoneObjectiveView {
  kind: ZoneObjectiveKind
  /** Lo que ya está hecho (desechos recogidos o fugas cerradas). */
  done: number
  /** Lo que pide el objetivo (al menos 1). */
  total: number
}

const LABELS: Record<ZoneObjectiveKind, string> = {
  debris: "Desechos",
  leaks: "Fugas cerradas",
}

/** Acota los valores: el contador nunca pasa del total ni baja de cero. */
export function clampObjective(view: ZoneObjectiveView): ZoneObjectiveView {
  const total = Math.max(1, Math.ceil(view.total))
  const done = Math.min(total, Math.max(0, Math.floor(view.done)))
  return { kind: view.kind, done, total }
}

/** Texto visible: "Desechos 12/30". */
export function zoneObjectiveText(view: ZoneObjectiveView): string {
  const { kind, done, total } = clampObjective(view)
  return `${LABELS[kind]} ${done}/${total}`
}

/** Fracción cumplida (0..1) para la barra. */
export function zoneObjectiveRatio(view: ZoneObjectiveView): number {
  const { done, total } = clampObjective(view)
  return done / total
}
