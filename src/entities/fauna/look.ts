import * as THREE from "three"
import type { Rng } from "@core/rng"
import { disposeTree, type ModelKit } from "./models/kit"

/**
 * Forma de moverse de un modelo, que decide qué piezas se animan y cómo:
 * - `fish`: ondula el cuerpo y bate la cola de lado a lado;
 * - `fluke`: cola horizontal que sube y baja (delfín, ballena);
 * - `glide`: alas que ondulan despacio (manta);
 * - `jet`: el manto se contrae a pulsos y los brazos se recogen (pulpo, calamar);
 * - `crawl`: patas que se alternan (cangrejo);
 * - `sway`: tentáculos que se mecen sin desplazarse (anémona);
 * - `hover`: aletas que vibran mientras flota erguido (caballito de mar);
 * - `paddle`: remadas con cuatro aletas (tortuga).
 */
export type Gait =
  "fish" | "fluke" | "glide" | "jet" | "crawl" | "sway" | "hover" | "paddle"

export interface Rig {
  gait: Gait
  /** Velocidad del ciclo (rad/s) nadando tranquila. */
  freq: number
  /** Amplitud de la cola, las alas o las patas (rad). */
  amp: number
  /** Flotación vertical del cuerpo (unidades). */
  bob: number
  /** Cuánto se ladea en las curvas (rad por cada rad/s de giro). */
  bank: number
}

/** Piezas que se animan, para que cada especie las mueva a su manera. */
export interface CreatureLook {
  /** Se gira con el rumbo de la criatura (y se ladea en las curvas). */
  root: THREE.Group
  /** Todo el cuerpo: flota, se estira y se encoge (y el pez globo se infla). */
  body: THREE.Group
  rig: Rig
  /** Material principal (la ballena lo ilumina al cantar). */
  bodyMaterial: THREE.MeshStandardMaterial
  accentMaterial: THREE.MeshStandardMaterial
  /** Cola en cadena, de la base a la punta. `userData.axis`: eje del batido. */
  tail: THREE.Object3D[]
  /** Aletas pectorales (`userData.side`; `userData.flutter` si vibran). */
  fins: THREE.Object3D[]
  /** Alas de manta (`userData.side`; `userData.tip` en el segmento exterior). */
  wings: THREE.Object3D[]
  /** Tentáculos y brazos (`userData.angle`; `userData.depth` 0 base, 1 punta). */
  tentacles: THREE.Object3D[]
  /** Patas (`userData.side`, `userData.index`; `userData.front` en aletas). */
  legs: THREE.Object3D[]
  /** Dedos móviles de las pinzas (`userData.side`). */
  claws: THREE.Object3D[]
  /** Piezas que cuelgan y se mecen solas (tallo del señuelo, lóbulos). */
  sway: THREE.Object3D[]
  /** Mandíbula inferior (`userData.open`: apertura máxima en rad). */
  jaw: THREE.Object3D | null
  /** Púas del pez globo: se esconden escalando el grupo. */
  spikes: THREE.Group | null
  lure: THREE.Object3D | null
  lureMaterial: THREE.MeshStandardMaterial | null
  /** Red de pesca (tortuga atrapada). */
  net: THREE.Object3D | null
  /** Estado interno de la animación. */
  motion: { cycle: number; bank: number; mouth: number }
  dispose(): void
}

/** Modelo a medio montar: las listas se rellenan pieza a pieza. */
export function draftLook(
  rig: Rig,
  bodyMaterial: THREE.MeshStandardMaterial,
  accentMaterial: THREE.MeshStandardMaterial,
): CreatureLook {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  return {
    root,
    body,
    rig,
    bodyMaterial,
    accentMaterial,
    tail: [],
    fins: [],
    wings: [],
    tentacles: [],
    legs: [],
    claws: [],
    sway: [],
    jaw: null,
    spikes: null,
    lure: null,
    lureMaterial: null,
    net: null,
    motion: { cycle: 0, bank: 0, mouth: 0 },
    dispose() {
      root.removeFromParent()
      disposeTree(root)
    },
  }
}

/**
 * Cierra el modelo: funde las piezas estáticas, guarda la pose de reposo de
 * todo lo que se anima y le da un tamaño al azar dentro de `scale`.
 */
export function finishLook(
  look: CreatureLook,
  kit: ModelKit,
  rng: Rng,
  scale: [number, number],
): CreatureLook {
  kit.build()
  const animated = [
    ...look.tail,
    ...look.fins,
    ...look.wings,
    ...look.tentacles,
    ...look.legs,
    ...look.claws,
    ...look.sway,
    look.jaw,
    look.lure,
  ]
  for (const object of animated) {
    if (!object) continue
    object.userData.base = object.rotation.clone()
    object.userData.basePosition = object.position.clone()
  }
  look.root.scale.setScalar(rng.range(scale[0], scale[1]))
  return look
}

export interface LookMotion {
  deltaTime: number
  time: number
  /** Desfase propio para que dos criaturas iguales no vayan sincronizadas. */
  phase: number
  /** 1 nadando tranquila; más al cazar, huir o forcejear. */
  effort: number
  /** Velocidad de giro (rad/s), para ladearse en las curvas. */
  turn: number
  /** Escala extra del cuerpo (pez globo inflado). */
  inflate?: number
  /** 0..1: abre la boca (al cazar). */
  mouth?: number
}

type Axis = "x" | "y" | "z"

/** Gira una pieza respecto a su pose de reposo. */
function swing(object: THREE.Object3D, axis: Axis, angle: number): void {
  const base = object.userData.base as THREE.Euler | undefined
  object.rotation[axis] = (base ? base[axis] : 0) + angle
}

/**
 * Anima el modelo según su forma de moverse. El ciclo se acumula (en vez de
 * usar `time * freq`) para que acelerar no dé saltos en la animación.
 */
export function animateLook(look: CreatureLook, m: LookMotion): void {
  const { rig, body, motion } = look
  const dt = m.deltaTime
  const effort = THREE.MathUtils.clamp(m.effort, 0.3, 3)
  motion.cycle += dt * rig.freq * (0.55 + 0.45 * effort)
  const c = motion.cycle + m.phase
  const t = m.time + m.phase
  const wave = Math.sin(c)
  const amp = rig.amp * (0.8 + 0.2 * Math.min(2, effort))

  // Se ladea hacia dentro de la curva, como la tortuga.
  const bankTarget = THREE.MathUtils.clamp(-m.turn * rig.bank, -0.6, 0.6)
  motion.bank += (bankTarget - motion.bank) * (1 - Math.exp(-4 * dt))
  look.root.rotation.z = motion.bank

  // Flotación y squash & stretch según la forma de moverse.
  body.position.y = Math.sin(t * 1.6) * rig.bob
  body.rotation.set(0, 0, 0)
  let sx = 1
  let sy = 1
  let sz = 1
  switch (rig.gait) {
    case "fish":
      // El cuerpo gira al contrario que la cola: ondulación en S.
      body.rotation.y = -wave * amp * 0.14
      sz = 1 + Math.max(0, effort - 1) * 0.04
      break
    case "fluke":
      body.rotation.x = wave * amp * 0.1
      break
    case "glide":
      body.position.y -= wave * rig.bob * 0.6
      break
    case "jet": {
      const pulse = Math.max(0, wave)
      sx = sy = 1 - 0.1 * pulse
      sz = 1 + 0.14 * pulse
      break
    }
    case "crawl":
      body.position.y += Math.abs(Math.sin(c * 2)) * 0.02
      break
    case "sway":
      sx = sz = 1 + Math.sin(t * 0.9) * 0.04
      sy = 1 - Math.sin(t * 0.9) * 0.03
      break
    case "hover":
      body.rotation.x = Math.sin(t * 0.8) * 0.07
      break
    case "paddle":
      body.rotation.x = Math.sin(t * 1.4) * 0.03
      break
  }
  const inflate = m.inflate ?? 1
  body.scale.set(sx * inflate, sy * inflate, sz * inflate)

  // Cola en cadena: cada segmento va un poco por detrás del anterior.
  look.tail.forEach((segment, i) => {
    const axis = (segment.userData.axis as Axis | undefined) ?? "y"
    const a =
      (segment.userData.amp as number | undefined) ?? amp * (1 + i * 0.35)
    swing(segment, axis, Math.sin(c - i * 1.1) * a)
  })

  for (const fin of look.fins) {
    const side = fin.userData.side as number
    if (fin.userData.flutter) {
      const axis = (fin.userData.axis as Axis | undefined) ?? "y"
      swing(fin, axis, Math.sin(t * 22 + side) * 0.45)
    } else {
      swing(fin, "z", side * Math.sin(c * 0.7 + side) * 0.28)
    }
  }

  for (const wing of look.wings) {
    const side = wing.userData.side as number
    const tip = wing.userData.tip ? 1 : 0
    swing(wing, "z", side * Math.sin(c - tip * 0.9) * amp * (1 - tip * 0.2))
  }

  const pulse = rig.gait === "jet" ? Math.max(0, wave) : 0
  for (const tentacle of look.tentacles) {
    const angle = tentacle.userData.angle as number
    const depth = (tentacle.userData.depth as number | undefined) ?? 0
    const lag = depth * 0.8
    const reach = 1 + depth * 0.6
    // Con el chorro se cierran tras el cuerpo; entre pulsos se abren.
    const close = pulse * 0.35 * (depth === 0 ? 1 : -0.6)
    swing(
      tentacle,
      "x",
      Math.sin(t * 2.2 + angle * 2 - lag) * 0.22 * reach + close,
    )
    swing(tentacle, "z", Math.cos(t * 1.7 + angle * 3 - lag) * 0.2 * reach)
  }

  for (const leg of look.legs) {
    const side = leg.userData.side as number
    if (rig.gait === "paddle") {
      // Remada de tortuga: delanteras amplias, traseras como timón.
      const weight = leg.userData.front ? 1 : -0.45
      swing(leg, "x", weight * (side < 0 ? 1 : -1) * wave * amp)
    } else {
      const index = leg.userData.index as number
      const step = c + index * 2.1 + (side > 0 ? Math.PI : 0)
      swing(leg, "x", Math.sin(step) * amp)
      swing(leg, "z", side * Math.max(0, Math.cos(step)) * amp * 0.6)
    }
  }

  for (const claw of look.claws) {
    const side = claw.userData.side as number
    // Abre y cierra las pinzas de vez en cuando.
    const snap = Math.max(0, Math.sin(t * 1.1 + side * 1.7)) ** 4
    swing(claw, "y", side * snap * 0.55)
  }

  look.sway.forEach((piece, i) => {
    const a = (piece.userData.amp as number | undefined) ?? 0.12
    swing(piece, "x", Math.sin(t * 1.5 + i * 1.3) * a)
  })

  if (look.jaw) {
    motion.mouth += ((m.mouth ?? 0) - motion.mouth) * (1 - Math.exp(-8 * dt))
    const open = (look.jaw.userData.open as number | undefined) ?? 0.5
    // Respira con la boca entreabierta y la abre del todo al lanzarse.
    const breathe = 0.05 + Math.sin(t * 1.7) * 0.04
    swing(look.jaw, "x", breathe * open + motion.mouth * open)
  }

  if (look.lure) {
    const base = look.lure.userData.basePosition as THREE.Vector3 | undefined
    if (base) look.lure.position.y = base.y + Math.sin(t * 2) * 0.04
    look.lure.scale.setScalar(1 + Math.sin(t * 3) * 0.1)
  }
}
