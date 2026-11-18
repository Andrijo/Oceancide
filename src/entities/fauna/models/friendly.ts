import * as THREE from "three"
import type { Rng } from "@core/rng"
import { buildTurtleModel, type TurtlePalette } from "../../turtleModel"
import { draftLook, finishLook, type CreatureLook } from "../look"
import {
  fin,
  hash3,
  hull,
  hullPoint,
  limb,
  ModelKit,
  strand,
  topBottom,
  type Paint,
  type Vec3,
} from "./kit"
import {
  FALCATE,
  flukeFin,
  FORKED_TAIL,
  LONG_FIN,
  pectorals,
  SMALL_FIN,
  tailFin,
  verticalFin,
} from "./parts"

const PI = Math.PI
const frac = (v: number): number => v - Math.floor(v)

// ---------------------------------------------------------------------- delfín

export function dolphin(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x6c8ea8)
  const accent = kit.material(0x4f6f88, { glow: 0.12, doubleSide: true })
  const dark = kit.material(0x1a2530)
  const look = draftLook(
    { gait: "fluke", freq: 4, amp: 0.28, bob: 0.04, bank: 0.45 },
    skin,
    accent,
  )
  const { body } = look
  const tones: Paint = (c) =>
    c.y > 0.3 ? 0x4f6f88 : c.y > -0.3 ? 0x8fb1c9 : 0xe9eff3
  kit.part(
    body,
    hull([0.36, 0.4, 1.25], { taper: 0.6, nose: 0.2, paint: tones }),
    skin,
  )

  // Melón (la frente) y pico.
  kit.part(body, hull([0.26, 0.27, 0.32], { paint: tones }), skin, {
    at: [0, 0.05, 1.0],
  })
  kit.part(
    body,
    hull([0.1, 0.075, 0.26], {
      paint: (c) => (c.y > 0 ? 0x8fb1c9 : 0xe9eff3),
    }),
    skin,
    { at: [0, -0.07, 1.3] },
  )
  kit.eyes(body, { at: [0.24, 0, 0.95], size: 0.045 })
  kit.part(body, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 6), dark, {
    at: [0, 0.345, 0.6],
  })

  verticalFin(kit, body, FALCATE, [0, 0.3, 0.05], 0.75, accent)
  pectorals(kit, look, [0.3, -0.2, 0.55], 0.55, accent, { droop: 0.45 })

  const peduncle = kit.pivot(body, [0, 0, -1.0])
  peduncle.userData.axis = "x"
  kit.part(
    peduncle,
    hull([0.12, 0.17, 0.38], { taper: 0.5, paint: tones }),
    skin,
    {
      at: [0, 0, -0.25],
    },
  )
  look.tail.push(peduncle)
  flukeFin(kit, look, peduncle, [0, 0, -0.6], 0.75, accent)

  return finishLook(look, kit, rng, [1, 1.2])
}

// --------------------------------------------------------------- caballito de mar

export function seahorse(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0xffa94d, { glow: 0.3 })
  const accent = kit.material(0xffd27a, { glow: 0.35, doubleSide: true })
  const look = draftLook(
    { gait: "hover", freq: 2, amp: 0.2, bob: 0.08, bank: 0.2 },
    skin,
    accent,
  )
  const { body } = look
  // Cuerpo erguido con anillos óseos.
  const rings: Paint = (c) =>
    frac((c.y + 1) * 4) < 0.22 ? 0xffd27a : c.z > 0.55 ? 0xffc06a : 0xffa94d
  kit.part(body, hull([0.2, 0.4, 0.24], { paint: rings }), skin)
  kit.part(body, hull([0.17, 0.24, 0.17], { paint: rings }), skin, {
    at: [0, -0.08, 0.09],
  })
  kit.part(body, hull([0.11, 0.16, 0.12], { paint: rings }), skin, {
    at: [0, 0.36, 0.03],
    rot: [0.4, 0, 0],
  })
  kit.part(body, hull([0.12, 0.13, 0.18], { paint: 0xffa94d }), skin, {
    at: [0, 0.5, 0.1],
  })
  kit.part(
    body,
    new THREE.CylinderGeometry(0.035, 0.05, 0.28, 6),
    skin,
    {
      at: [0, 0.47, 0.33],
      rot: [PI / 2 + 0.2, 0, 0],
    },
    0xffa94d,
  )
  const crown = new THREE.ConeGeometry(0.025, 0.1, 4)
  for (let k = 0; k < 3; k++) {
    kit.part(body, crown, accent, { at: [0, 0.63, 0.04 + k * 0.05] })
  }
  kit.eyes(body, { at: [0.1, 0.52, 0.14], size: 0.04, iris: 0x7a3a10 })

  // Aleta dorsal y pectorales que vibran muy rápido.
  const dorsal = kit.pivot(body, [0, -0.02, -0.22])
  dorsal.userData.side = 1
  dorsal.userData.flutter = true
  kit.part(
    dorsal,
    fin([
      [0, -0.14],
      [0.15, -0.1],
      [0.17, 0.1],
      [0, 0.14],
    ]),
    accent,
    { rot: [0, PI / 2, 0] },
  )
  look.fins.push(dorsal)
  const fan = fin([
    [0, -0.06],
    [0.12, -0.04],
    [0.13, 0.05],
    [0, 0.06],
  ])
  for (const side of [-1, 1]) {
    const pivot = kit.pivot(body, [side * 0.11, 0.4, 0.02])
    pivot.userData.side = side
    pivot.userData.flutter = true
    pivot.userData.axis = "z"
    kit.part(pivot, fan, accent, { rot: [-PI / 2, 0, 0], scale: [side, 1, 1] })
    look.fins.push(pivot)
  }

  // Cola prensil que se enrosca hacia delante.
  const tailRings: Paint = (c) => (frac(-c.y * 10) < 0.3 ? 0xffd27a : 0xffa94d)
  const segments: Array<[number, number, number, number]> = [
    // largo, radio arriba, radio abajo, curvatura
    [0.22, 0.085, 0.065, 0.12],
    [0.2, 0.065, 0.048, -0.35],
    [0.18, 0.048, 0.032, -0.6],
    [0.16, 0.032, 0.012, -0.85],
  ]
  let parent: THREE.Object3D = body
  let at: Vec3 = [0, -0.34, -0.03]
  for (const [length, r0, r1, curl] of segments) {
    const segment = kit.pivot(parent, at, [curl, 0, 0])
    segment.userData.axis = "x"
    segment.userData.amp = 0.08
    kit.part(segment, strand(length, r0, r1), skin, undefined, tailRings)
    look.tail.push(segment)
    parent = segment
    at = [0, -length, 0]
  }

  return finishLook(look, kit, rng, [0.9, 1.1])
}

// ---------------------------------------------------------------------- rémora

export function remora(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x5f6b73)
  const accent = kit.material(0x4a555d, { glow: 0.1, doubleSide: true })
  const dark = kit.material(0x2c3338)
  const look = draftLook(
    { gait: "fish", freq: 6, amp: 0.25, bob: 0.03, bank: 0.3 },
    skin,
    accent,
  )
  const { body } = look
  // Franja lateral oscura con bordes claros.
  const striped: Paint = (c) => {
    const y = Math.abs(c.y)
    if (y < 0.16) return 0x2c3338
    if (y < 0.32) return 0xc9d2d8
    return c.y > 0 ? 0x4a555d : 0x8a969e
  }
  kit.part(
    body,
    hull([0.16, 0.12, 0.6], { taper: 0.5, nose: 0.25, paint: striped }),
    skin,
  )

  // El disco de succión sobre la cabeza, con sus láminas.
  kit.part(body, hull([0.095, 0.03, 0.23], { paint: 0x9aa5ad }), skin, {
    at: [0, 0.11, 0.22],
  })
  const lamella = new THREE.BoxGeometry(0.16, 0.012, 0.014)
  for (let k = 0; k < 8; k++) {
    kit.part(body, lamella, dark, { at: [0, 0.135, 0.05 + k * 0.045] })
  }
  const jaw = kit.pivot(body, [0, -0.035, 0.5])
  jaw.userData.open = 0.3
  kit.part(jaw, hull([0.065, 0.028, 0.12], { paint: 0x8a969e }), skin, {
    at: [0, 0, 0.09],
  })
  look.jaw = jaw
  kit.eyes(body, { at: [0.1, 0.04, 0.42], size: 0.032 })

  verticalFin(kit, body, LONG_FIN, [0, 0.09, -0.08], 0.9, accent)
  verticalFin(kit, body, LONG_FIN, [0, -0.09, -0.08], 0.9, accent, true)
  pectorals(kit, look, [0.14, -0.03, 0.25], 0.18, accent)
  tailFin(kit, look, body, [0, 0, -0.56], FORKED_TAIL, 0.3, accent)

  return finishLook(look, kit, rng, [1, 1.15])
}

// ----------------------------------------------------------------- manta raya

export function manta(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x3e5878, { glow: 0.14 })
  const accent = kit.material(0x3e5878, { glow: 0.12, doubleSide: true })
  const dark = kit.material(0x182230)
  const look = draftLook(
    { gait: "glide", freq: 1.5, amp: 0.4, bob: 0.06, bank: 0.5 },
    skin,
    accent,
  )
  const { body } = look
  const TOP = 0x2c3e55
  const PATCH = 0xd5dee6
  const BELLY = 0xe6ecef
  // Lomo oscuro con manchas blancas en los hombros; vientre blanco moteado.
  const back: Paint = (c) => {
    if (c.y < 0) return hash3(c) > 0.86 ? 0x3a4a60 : BELLY
    if (c.z > 0.05 && Math.abs(c.x) > 0.35) return PATCH
    return TOP
  }
  kit.part(
    body,
    hull([0.55, 0.16, 0.82], { nose: 0.25, taper: 0.45, paint: back }),
    skin,
  )

  // Alas en dos tramos para que ondulen de la raíz a la punta.
  const wingPaint: Paint = (c, n) => {
    if (n.z < -0.2) return BELLY
    return n.z > 0.2 && c.x < 0.3 && c.y < 0 ? PATCH : TOP
  }
  const inner = fin(
    [
      [0, -0.55],
      [0.75, -0.12],
      [0.75, 0.42],
      [0, 0.6],
    ],
    0.06,
    wingPaint,
  )
  const outer = fin(
    [
      [0, -0.12],
      [0.8, 0.35],
      [0.62, 0.48],
      [0, 0.42],
    ],
    0.05,
    topBottom(TOP, BELLY),
  )
  for (const side of [-1, 1]) {
    const root = kit.pivot(body, [side * 0.45, 0, 0.02])
    root.userData.side = side
    kit.part(root, inner, skin, { rot: [-PI / 2, 0, 0], scale: [side, 1, 1] })
    const tip = kit.pivot(root, [side * 0.73, 0, 0])
    tip.userData.side = side
    tip.userData.tip = true
    kit.part(tip, outer, skin, { rot: [-PI / 2, 0, 0], scale: [side, 1, 1] })
    look.wings.push(root, tip)

    // Aletas cefálicas: los «cuernos» que guían la comida a la boca.
    const lobe = kit.pivot(body, [side * 0.22, -0.02, 0.8])
    lobe.userData.amp = 0.15
    kit.part(lobe, hull([0.05, 0.03, 0.2], { paint: TOP }), skin, {
      at: [0, 0, 0.14],
      rot: [0, side * 0.15, 0],
    })
    look.sway.push(lobe)

    // Hendiduras branquiales bajo el cuerpo.
    for (let k = 0; k < 5; k++) {
      kit.part(body, new THREE.BoxGeometry(0.1, 0.01, 0.014), dark, {
        at: [side * 0.18, -0.135, 0.42 - k * 0.07],
      })
    }
  }
  kit.eyes(body, { at: [0.3, 0.05, 0.62], size: 0.045 })

  const tail = kit.pivot(body, [0, 0, -0.75])
  tail.userData.amp = 0.12
  const whip = limb([0, 0, 0], [0, 0, -1.2], 0.035, 0.006)
  kit.part(tail, whip.geometry, skin, whip.place, TOP)
  look.tail.push(tail)

  return finishLook(look, kit, rng, [1.2, 1.5])
}

// --------------------------------------------------------------------- ballena

export function whale(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  // El emisivo cian es el que se enciende al cantar.
  const skin = kit.skin(0x7fd4ff, { glow: 0.12 })
  const accent = kit.material(0x5b7e9c, { glow: 0.1, doubleSide: true })
  const look = draftLook(
    { gait: "fluke", freq: 1.4, amp: 0.18, bob: 0.1, bank: 0.25 },
    skin,
    accent,
  )
  const { body } = look
  const BACK = 0x3f5f7a
  const BELLY = 0xc9d6e0
  // Lomo moteado y pliegues ventrales en la garganta (yubarta).
  const paint: Paint = (c) => {
    if (c.y < -0.35) {
      if (c.z > -0.15) return frac(c.x * 9 + 10) < 0.5 ? BELLY : 0x8fa5b5
      return BELLY
    }
    return hash3(c) > 0.86 ? 0x557590 : BACK
  }
  const radii: Vec3 = [1.2, 1.05, 3.4]
  const shape = { detail: 2, taper: 0.6, nose: 0.15 }
  kit.part(body, hull(radii, { ...shape, paint }), skin)

  // Tubérculos de la cabeza.
  const knob = new THREE.IcosahedronGeometry(0.08, 0)
  for (let k = 0; k < 9; k++) {
    const x = ((k % 3) - 1) * 0.25
    const z = 0.72 + Math.floor(k / 3) * 0.08
    kit.part(
      body,
      knob,
      skin,
      {
        at: hullPoint(radii, shape, [x, 0.75, z]),
      },
      0x2f4a60,
    )
  }
  verticalFin(kit, body, SMALL_FIN, [0, 0.72, -1.4], 1.2, accent)
  kit.eyes(body, { at: [0.8, -0.2, 2.25], size: 0.11 })

  // Aletas pectorales larguísimas con el borde ondulado.
  pectorals(kit, look, [0.95, -0.45, 1.3], 1, skin, {
    outline: [
      [0, -0.2],
      [0.6, -0.16],
      [1.2, -0.06],
      [1.8, 0.12],
      [2.3, 0.4],
      [2.2, 0.56],
      [1.5, 0.42],
      [0.8, 0.34],
      [0, 0.32],
    ],
    droop: 0.5,
    thickness: 0.06,
    paint: topBottom(0x4a6a86, 0xd8e2ea),
  })

  const peduncle = kit.pivot(body, [0, 0, -3.0])
  peduncle.userData.axis = "x"
  kit.part(
    peduncle,
    hull([0.22, 0.32, 0.9], { taper: 0.5, paint: BACK }),
    skin,
    {
      at: [0, 0, -0.5],
    },
  )
  look.tail.push(peduncle)
  flukeFin(
    kit,
    look,
    peduncle,
    [0, 0, -1.25],
    1.9,
    skin,
    topBottom(BACK, 0xd8e2ea),
    0.07,
  )

  return finishLook(look, kit, rng, [1.3, 1.6])
}

// --------------------------------------------------------------- pez limpiador

export function cleanerFish(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x4fc3f7, { glow: 0.4 })
  const accent = kit.material(0x0d2a4a, {
    emissive: 0x4fc3f7,
    glow: 0.2,
    doubleSide: true,
  })
  const look = draftLook(
    { gait: "fish", freq: 9, amp: 0.35, bob: 0.03, bank: 0.3 },
    skin,
    accent,
  )
  const { body } = look
  // Azul eléctrico con una franja negra que se ensancha hacia la cola.
  const paint: Paint = (c) => {
    const width = 0.16 + Math.max(0, -c.z) * 0.12
    if (Math.abs(c.y - 0.05) < width && c.z > -0.98) return 0x0d2a4a
    return c.y < -0.45 ? 0xd8f2ff : 0x4fc3f7
  }
  kit.part(
    body,
    hull([0.12, 0.16, 0.44], { taper: 0.45, nose: 0.35, paint }),
    skin,
  )
  kit.eyes(body, { at: [0.075, 0.06, 0.32], size: 0.026 })

  verticalFin(kit, body, LONG_FIN, [0, 0.13, -0.05], 0.6, accent)
  verticalFin(kit, body, LONG_FIN, [0, -0.12, -0.1], 0.45, accent, true)
  pectorals(kit, look, [0.1, -0.03, 0.12], 0.14, accent)
  tailFin(kit, look, body, [0, 0, -0.42], FORKED_TAIL, 0.26, accent)

  return finishLook(look, kit, rng, [1, 1.2])
}

// ------------------------------------------------------------ tortuga atrapada

/** Tortuga lora: más pequeña y de tonos oliva (no se confunde con la tuya). */
const OLIVE_RIDLEY: TurtlePalette = {
  shell: 0x55643a,
  skin: 0x9aa874,
  plate: 0x46552e,
  rim: 0xd9c48c,
}

/**
 * Tortuga enredada en una red: el mismo modelo que la del jugador, más
 * pequeña y con otra paleta, que forcejea con las aletas hasta que la sueltas.
 */
export function nettedTurtle(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const turtle = buildTurtleModel(OLIVE_RIDLEY)
  const look = draftLook(
    { gait: "paddle", freq: 3.2, amp: 0.3, bob: 0.04, bank: 0.3 },
    turtle.materials.shell,
    turtle.materials.skin,
  )
  // Ladeada, como si la red la tuviera torcida.
  const holder = kit.pivot(look.body, [0, 0, 0], [0.15, 0, 0.3])
  holder.scale.setScalar(0.5)
  holder.add(turtle.model)

  const { leftFront, rightFront, leftBack, rightBack } = turtle.flippers
  for (const [flipper, side, front] of [
    [leftFront, -1, true],
    [rightFront, 1, true],
    [leftBack, -1, false],
    [rightBack, 1, false],
  ] as const) {
    flipper.userData.side = side
    flipper.userData.front = front
    look.legs.push(flipper)
  }
  turtle.tail.userData.amp = 0.18
  look.tail.push(turtle.tail)

  // Red de pesca irregular con dos boyas.
  const net = kit.pivot(look.body)
  const mesh = new THREE.IcosahedronGeometry(1.25, 1)
  const pos = mesh.getAttribute("position")
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    // Mismo desplazamiento para vértices repetidos: la malla no se rompe.
    const r = 1 + (hash3(v) - 0.5) * 0.25
    pos.setXYZ(i, v.x * r, v.y * r * 0.85, v.z * r)
  }
  kit.part(
    net,
    mesh,
    new THREE.MeshBasicMaterial({
      color: 0xd9d2b8,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    }),
  )
  const buoy = kit.material(0xff7a2a, { glow: 0.25 })
  const float = new THREE.IcosahedronGeometry(0.14, 1)
  kit.part(net, float, buoy, { at: [0.6, 0.95, 0.3] })
  kit.part(net, float, buoy, { at: [-0.5, 0.9, -0.5] })
  look.net = net

  return finishLook(look, kit, rng, [0.9, 1.05])
}
