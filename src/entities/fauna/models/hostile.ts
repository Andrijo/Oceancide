import * as THREE from "three"
import type { Rng } from "@core/rng"
import { draftLook, finishLook, type CreatureLook } from "../look"
import {
  aim,
  countershade,
  fibonacciSphere,
  fin,
  hash3,
  hull,
  hullPoint,
  lerpHex,
  limb,
  ModelKit,
  smoothstep,
  strand,
  type HullOptions,
  type Paint,
  type Vec3,
} from "./kit"
import {
  DORSAL,
  FORKED_TAIL,
  pectorals,
  ROUND_TAIL,
  SMALL_FIN,
  tailFin,
  verticalFin,
} from "./parts"

const PI = Math.PI
const frac = (v: number): number => v - Math.floor(v)

/** Señuelo luminoso con tallo de dos tramos (rape y pez linterna). */
function lure(
  kit: ModelKit,
  look: CreatureLook,
  at: Vec3,
  lengths: [number, number],
  bulb: number,
  material: THREE.Material,
  glow: number,
): void {
  const stalk = kit.pivot(look.body, at, [0.45, 0, 0])
  kit.part(
    stalk,
    new THREE.CylinderGeometry(0.02, 0.035, lengths[0], 5).translate(
      0,
      lengths[0] / 2,
      0,
    ),
    material,
  )
  const tip = kit.pivot(stalk, [0, lengths[0], 0], [0.95, 0, 0])
  tip.userData.amp = 0.16
  kit.part(
    tip,
    new THREE.CylinderGeometry(0.014, 0.02, lengths[1], 5).translate(
      0,
      lengths[1] / 2,
      0,
    ),
    material,
  )
  look.sway.push(tip)

  const lureMaterial = kit.material(0xfff3b0, {
    emissive: 0xffe066,
    glow,
    roughness: 0.3,
  })
  const bulbPivot = kit.pivot(tip, [0, lengths[1] + bulb * 0.6, 0])
  kit.part(bulbPivot, new THREE.IcosahedronGeometry(bulb, 1), lureMaterial)
  look.lure = bulbPivot
  look.lureMaterial = lureMaterial
}

// ------------------------------------------------------------------ pez globo

export function pufferfish(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0xb08a3a)
  const accent = kit.material(0x8a6a2a, { glow: 0.14, doubleSide: true })
  const look = draftLook(
    { gait: "fish", freq: 6, amp: 0.35, bob: 0.05, bank: 0.2 },
    skin,
    accent,
  )
  const { body } = look
  const radii: Vec3 = [0.45, 0.42, 0.52]
  const shade = countershade(0xd9b45a, 0xf4ead0, -0.15)
  const paint: Paint = (c, n) =>
    c.y > -0.1 && hash3(c) > 0.72 ? 0x7a5a24 : shade(c, n)
  kit.part(body, hull(radii, { taper: 0.25, paint }), skin)

  // Boquita en «O» y ojos saltones.
  kit.part(body, new THREE.TorusGeometry(0.07, 0.03, 4, 8), accent, {
    at: [0, -0.06, 0.5],
  })
  kit.eyes(body, { at: [0.26, 0.14, 0.33], size: 0.095, iris: 0x8fbf4a })

  pectorals(kit, look, [0.36, -0.02, 0.12], 0.32, accent)
  verticalFin(kit, body, SMALL_FIN, [0, 0.36, -0.18], 0.9, accent)
  verticalFin(kit, body, SMALL_FIN, [0, -0.33, -0.18], 0.9, accent, true)
  tailFin(kit, look, body, [0, 0, -0.48], ROUND_TAIL, 0.55, accent)

  // Púas: escondidas hasta que se infla (un solo grupo, una sola malla).
  const spikes = kit.pivot(body)
  look.spikes = spikes
  const cone = new THREE.ConeGeometry(0.035, 0.22, 4)
  for (const dir of fibonacciSphere(34)) {
    if (dir.z > 0.8) continue // la cara queda libre
    kit.part(spikes, cone, accent, {
      at: [dir.x * radii[0], dir.y * radii[1], dir.z * radii[2]],
      quat: aim([dir.x, dir.y, dir.z]),
    })
  }

  return finishLook(look, kit, rng, [0.9, 1.15])
}

// ------------------------------------------------------------------ barracuda

export function barracuda(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x7d93a3)
  const accent = kit.material(0x4c6070, { glow: 0.12, doubleSide: true })
  const tooth = kit.material(0xf2efe6, { roughness: 0.4, glow: 0.1 })
  const look = draftLook(
    { gait: "fish", freq: 5, amp: 0.22, bob: 0.03, bank: 0.35 },
    skin,
    accent,
  )
  const { body } = look
  const paint: Paint = (c) => {
    // Barras oscuras en el lomo y manchas negras cerca de la cola.
    if (c.y > 0.05 && c.z > -0.75 && c.z < 0.55 && frac((c.z + 1) * 7) < 0.3)
      return 0x34444f
    if (c.z < -0.55 && c.y < 0.1 && hash3(c) > 0.62) return 0x1d2329
    if (c.y > 0.35) return 0x4f6676
    if (c.y > -0.35) return 0xaebfcb
    return 0xe8eef2
  }
  kit.part(
    body,
    hull([0.2, 0.25, 1.2], { taper: 0.55, nose: 0.3, paint }),
    skin,
  )

  // Hocico afilado y mandíbula inferior adelantada, con dientes.
  kit.part(
    body,
    new THREE.ConeGeometry(0.1, 0.36, 6),
    skin,
    { at: [0, 0.03, 1.3], rot: [PI / 2, 0, 0], scale: [1, 1, 0.7] },
    0x5d7484,
  )
  const jaw = kit.pivot(body, [0, -0.08, 1.0])
  jaw.userData.open = 0.45
  kit.part(
    jaw,
    new THREE.ConeGeometry(0.085, 0.5, 6),
    skin,
    { at: [0, 0, 0.27], rot: [PI / 2, 0, 0], scale: [1, 1, 0.55] },
    0xdfe6eb,
  )
  look.jaw = jaw
  const fang = new THREE.ConeGeometry(0.013, 0.07, 3)
  for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) {
      kit.part(jaw, fang, tooth, { at: [side * 0.035, 0.035, 0.1 + k * 0.08] })
      kit.part(body, fang, tooth, {
        at: [side * 0.045, -0.04, 1.14 + k * 0.07],
        rot: [PI, 0, 0],
      })
    }
  }

  kit.eyes(body, { at: [0.11, 0.08, 0.92], size: 0.055, iris: 0xd9c34a })
  verticalFin(kit, body, DORSAL, [0, 0.2, 0.15], 0.32, accent)
  verticalFin(kit, body, DORSAL, [0, 0.15, -0.55], 0.22, accent)
  verticalFin(kit, body, DORSAL, [0, -0.15, -0.55], 0.22, accent, true)
  pectorals(kit, look, [0.16, -0.08, 0.55], 0.28, accent)

  const peduncle = kit.pivot(body, [0, 0, -1.0])
  kit.part(peduncle, hull([0.07, 0.11, 0.25], { paint: 0xaebfcb }), skin, {
    at: [0, 0, -0.15],
  })
  look.tail.push(peduncle)
  tailFin(kit, look, peduncle, [0, 0, -0.35], FORKED_TAIL, 0.5, accent)

  return finishLook(look, kit, rng, [1, 1.25])
}

// ---------------------------------------------------------------- rape abisal

export function anglerfish(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x41325a, { glow: 0.2 })
  const accent = kit.material(0x5a3f5e, { glow: 0.16, doubleSide: true })
  const bone = kit.material(0xe8e2cf, { roughness: 0.4, glow: 0.15 })
  const look = draftLook(
    { gait: "fish", freq: 3, amp: 0.25, bob: 0.03, bank: 0.15 },
    skin,
    accent,
  )
  const { body } = look
  const shade = countershade(0x2b2533, 0x3c3247, -0.2)
  const warts: Paint = (c, n) => (hash3(c) > 0.82 ? 0x4d3f5a : shade(c, n))
  kit.part(body, hull([0.72, 0.62, 0.78], { taper: 0.35, paint: warts }), skin)

  // Boca enorme: mandíbula inferior adelantada y colmillos hacia dentro.
  kit.part(body, hull([0.5, 0.14, 0.32], { paint: 0x120c16 }), skin, {
    at: [0, -0.18, 0.45],
  })
  const jaw = kit.pivot(body, [0, -0.2, 0.25])
  jaw.userData.open = 0.55
  kit.part(
    jaw,
    hull([0.6, 0.2, 0.6], { paint: countershade(0x2b2533, 0x3c3247, 0.3) }),
    skin,
    { at: [0, -0.05, 0.35] },
  )
  look.jaw = jaw
  const fang = new THREE.ConeGeometry(0.035, 0.22, 4)
  for (let i = 0; i < 9; i++) {
    const a = -1.15 + (i / 8) * 2.3
    const long = i % 2 === 0 ? 1.15 : 0.8
    kit.part(jaw, fang, bone, {
      at: [Math.sin(a) * 0.5, 0.12, 0.35 + Math.cos(a) * 0.55],
      scale: [1, long, 1],
    })
    kit.part(body, fang, bone, {
      at: [Math.sin(a) * 0.6, -0.12, 0.15 + Math.cos(a) * 0.62],
      rot: [PI, 0, 0],
      scale: [1, long, 1],
    })
  }

  lure(kit, look, [0, 0.55, 0.42], [0.6, 0.42], 0.12, accent, 2.4)
  kit.eyes(body, { at: [0.42, 0.28, 0.5], size: 0.07, iris: 0xa89a70 })
  pectorals(kit, look, [0.62, -0.28, 0], 0.42, accent, { droop: 0.6 })

  // Espinas dorsales y verrugas puntiagudas.
  const spine = new THREE.ConeGeometry(0.03, 0.3, 4)
  for (let k = 0; k < 3; k++) {
    kit.part(body, spine, accent, {
      at: [0, 0.6 - k * 0.08, -k * 0.22],
      rot: [-0.4, 0, 0],
    })
  }
  const wart = new THREE.ConeGeometry(0.03, 0.12, 4)
  for (const dir of fibonacciSphere(26)) {
    if (dir.y < 0.15 || dir.z > 0.6) continue
    kit.part(body, wart, accent, {
      at: hullPoint([0.72, 0.62, 0.78], { taper: 0.35 }, [dir.x, dir.y, dir.z]),
      quat: aim([dir.x, dir.y, dir.z]),
    })
  }
  tailFin(kit, look, body, [0, 0, -0.7], ROUND_TAIL, 0.6, accent)

  return finishLook(look, kit, rng, [1, 1.3])
}

// ---------------------------------------------------------------------- pulpo

export function octopus(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x8c3446)
  const accent = kit.material(0x8c3446, { glow: 0.14 })
  const look = draftLook(
    { gait: "jet", freq: 2.2, amp: 0.3, bob: 0.08, bank: 0.2 },
    skin,
    accent,
  )
  const { body } = look
  const mottled: Paint = (c) =>
    c.y < -0.45 ? 0xd9808a : hash3(c) > 0.66 ? 0x7e2a3c : 0xb2475a
  // Manto echado hacia atrás sobre la cabeza.
  kit.part(body, hull([0.5, 0.6, 0.55], { paint: mottled }), skin, {
    at: [0, 0.5, -0.28],
    rot: [-0.55, 0, 0],
  })
  kit.part(body, hull([0.42, 0.34, 0.4], { paint: mottled }), skin, {
    at: [0, 0.02, 0.05],
  })
  kit.eyes(body, {
    at: [0.32, 0.14, 0.18],
    size: 0.1,
    iris: 0xe7c86a,
    slit: true,
  })
  for (const side of [-1, 1]) {
    kit.part(body, hull([0.12, 0.06, 0.12], { paint: 0x9a3a4c }), skin, {
      at: [side * 0.3, 0.26, 0.18],
    })
  }
  kit.part(body, new THREE.CylinderGeometry(0.05, 0.08, 0.22, 6), accent, {
    at: [0.3, -0.05, -0.12],
    rot: [0, 0, 1.2],
  })

  // Ocho brazos de dos tramos, con ventosas claras por dentro.
  const suckers: Paint = (_c, n) => (n.z < -0.3 ? 0xf0b8b0 : 0xa33f52)
  const upper = strand(0.62, 0.12, 0.065)
  const lower = strand(0.6, 0.065, 0.015)
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) / 8) * PI * 2
    const arm = kit.pivot(body, [
      Math.sin(angle) * 0.24,
      -0.2,
      Math.cos(angle) * 0.24 + 0.05,
    ])
    arm.rotation.order = "YXZ"
    // Abiertos en falda alrededor del cuerpo y con las puntas recogidas.
    arm.rotation.set(-1.0 + (i % 2) * 0.15, angle, 0)
    arm.userData.angle = angle
    kit.part(arm, upper, skin, undefined, suckers)
    const tip = kit.pivot(arm, [0, -0.6, 0], [0.75, 0, 0])
    tip.userData.angle = angle
    tip.userData.depth = 1
    kit.part(tip, lower, skin, undefined, suckers)
    look.tentacles.push(arm, tip)
  }

  return finishLook(look, kit, rng, [0.9, 1.2])
}

// -------------------------------------------------------------------- calamar

export function squid(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x7a6bd0, { glow: 0.35 })
  const accent = kit.material(0x9f8fd6, {
    emissive: 0x7a6bd0,
    glow: 0.3,
    doubleSide: true,
  })
  const look = draftLook(
    { gait: "jet", freq: 2.6, amp: 0.25, bob: 0.05, bank: 0.3 },
    skin,
    accent,
  )
  const { body } = look
  const spotted: Paint = (c) =>
    hash3(c) > 0.7 ? 0xa48fe0 : c.y > 0.55 ? 0xb8a8ea : 0xd8d0f0
  kit.part(
    body,
    hull([0.28, 0.28, 0.85], { taper: 0.8, paint: spotted }),
    skin,
    {
      at: [0, 0, -0.5],
    },
  )
  kit.part(body, hull([0.21, 0.19, 0.24], { paint: spotted }), skin, {
    at: [0, 0, 0.38],
  })
  kit.part(
    body,
    new THREE.TorusGeometry(0.22, 0.035, 4, 10),
    skin,
    {
      at: [0, 0, 0.3],
    },
    0xc9bdf0,
  )
  kit.eyes(body, { at: [0.17, 0.05, 0.4], size: 0.085, iris: 0x6fd8ff })

  // Aletas romboidales en la punta del manto.
  const rhombus = fin(
    [
      [0, -0.3],
      [0.36, 0.02],
      [0, 0.32],
    ],
    0.03,
  )
  for (const side of [-1, 1]) {
    const pivot = kit.pivot(body, [side * 0.1, 0, -1.0])
    pivot.userData.side = side
    kit.part(pivot, rhombus, accent, {
      rot: [-PI / 2, 0, 0],
      scale: [side, 1, 1],
    })
    look.fins.push(pivot)
  }

  // Ocho brazos cortos hacia delante y dos tentáculos largos con maza.
  const arm = strand(0.55, 0.05, 0.012, 5)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * PI * 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const pivot = kit.pivot(body, [dx * 0.11, dy * 0.11, 0.55])
    pivot.quaternion.copy(aim([-dx * 0.3, -dy * 0.3, -1]))
    pivot.userData.angle = angle
    kit.part(pivot, arm, skin, undefined, 0xc9bdf0)
    look.tentacles.push(pivot)
  }
  const whip = strand(1.0, 0.035, 0.02, 5)
  const club = hull([0.05, 0.14, 0.04])
  for (const side of [-1, 1]) {
    const pivot = kit.pivot(body, [side * 0.07, -0.04, 0.55])
    pivot.quaternion.copy(aim([-side * 0.15, 0.1, -1]))
    pivot.userData.angle = side * 1.3
    kit.part(pivot, whip, skin, undefined, 0xc9bdf0)
    kit.part(pivot, club, skin, { at: [0, -1.05, 0] }, 0xa48fe0)
    look.tentacles.push(pivot)
  }

  return finishLook(look, kit, rng, [0.9, 1.15])
}

// --------------------------------------------------------- cangrejo de chatarra

export function scrapCrab(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x6a5a4e, { glow: 0.14 })
  const accent = kit.material(0x8a4a2e, { glow: 0.1 })
  const metal = kit.material(0xb9bec4, {
    metalness: 0.6,
    roughness: 0.35,
    glow: 0.1,
  })
  const look = draftLook(
    { gait: "crawl", freq: 7, amp: 0.35, bob: 0.02, bank: 0.1 },
    skin,
    accent,
  )
  const { body } = look
  // Caparazón oxidado con parches de metal: vive entre chatarra.
  const rusty: Paint = (c) => {
    const h = hash3(c)
    if (c.y > 0 && h > 0.62) return 0xb3542f
    if (c.y > 0 && h > 0.48) return 0x8f969c
    return c.y < -0.3 ? 0xb8a58c : 0x7d6f62
  }
  const shell: HullOptions = { flat: 0.35, paint: rusty }
  const radii: Vec3 = [0.72, 0.3, 0.55]
  kit.part(body, hull(radii, shell), skin, { at: [0, 0.05, 0] })
  const spike = new THREE.ConeGeometry(0.035, 0.14, 4)
  for (let i = 0; i < 5; i++) {
    const x = -0.5 + i * 0.25
    const p = hullPoint(radii, shell, [x / 0.72, 0.15, 0.8])
    kit.part(body, spike, accent, {
      at: [p[0], p[1] + 0.05, p[2]],
      quat: aim([x * 0.5, 0.25, 1]),
    })
  }

  // Una corcholata incrustada en el lomo, con remaches.
  kit.part(body, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), metal, {
    at: [0.15, 0.32, -0.08],
    rot: [0.12, 0, 0.18],
  })
  kit.part(body, new THREE.TorusGeometry(0.2, 0.025, 3, 14), metal, {
    at: [0.15, 0.32, -0.08],
    rot: [PI / 2 + 0.12, 0, 0.18],
  })
  const rivet = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6)
  for (const [x, z] of [
    [-0.35, 0.1],
    [-0.25, -0.2],
    [0.4, 0.2],
  ]) {
    const p = hullPoint(radii, shell, [x / 0.72, 0.9, z / 0.55])
    kit.part(body, rivet, metal, { at: [p[0], p[1] + 0.05, p[2]] })
  }

  // Ojos en pedúnculo y piezas bucales.
  for (const side of [-1, 1]) {
    const stalk = limb(
      [side * 0.15, 0.22, 0.42],
      [side * 0.18, 0.42, 0.48],
      0.03,
      0.022,
    )
    kit.part(body, stalk.geometry, skin, stalk.place, 0x7d6f62)
  }
  kit.eyes(body, { at: [0.18, 0.45, 0.49], size: 0.055 })
  kit.part(body, hull([0.18, 0.08, 0.06], { paint: 0x9a6a50 }), skin, {
    at: [0, -0.05, 0.52],
  })

  // Seis patas articuladas (fémur y tibia en una pieza).
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index++) {
      const leg = kit.pivot(
        body,
        [side * 0.58, -0.02, 0.22 - index * 0.24],
        [0, side * (0.25 - index * 0.25), 0],
      )
      leg.userData.side = side
      leg.userData.index = index
      const femur = limb([0, 0, 0], [side * 0.4, 0.24, 0], 0.055, 0.045)
      const tibia = limb(
        [side * 0.4, 0.24, 0],
        [side * 0.62, -0.3, 0],
        0.045,
        0.018,
      )
      kit.part(leg, femur.geometry, accent, femur.place)
      kit.part(leg, tibia.geometry, accent, tibia.place)
      look.legs.push(leg)
    }
  }

  // Pinzas: brazo, palma y un dedo móvil que se abre y cierra.
  const finger = new THREE.ConeGeometry(0.045, 0.24, 4)
  for (const side of [-1, 1]) {
    const arm = limb(
      [side * 0.45, 0, 0.38],
      [side * 0.62, 0.05, 0.62],
      0.06,
      0.05,
    )
    kit.part(body, arm.geometry, accent, arm.place)
    kit.part(body, hull([0.13, 0.1, 0.2], { paint: 0xb3542f }), skin, {
      at: [side * 0.66, 0.06, 0.78],
    })
    kit.part(body, finger, accent, {
      at: [side * 0.62, 0.03, 0.98],
      rot: [PI / 2, 0, 0],
    })
    const pincer = kit.pivot(body, [side * 0.72, 0.08, 0.88])
    pincer.userData.side = side
    kit.part(pincer, finger, accent, { at: [0, 0, 0.11], rot: [PI / 2, 0, 0] })
    look.claws.push(pincer)
  }

  return finishLook(look, kit, rng, [0.9, 1.3])
}

// -------------------------------------------------------------------- anémona

export function anemone(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x6b2f5c, { glow: 0.12 })
  const tentacleSkin = kit.skin(0x9aff3c, { glow: 0.4, rim: [0.6, 2] })
  const rock = kit.material(0x3d3a40, { roughness: 0.95, glow: 0.05 })
  const look = draftLook(
    { gait: "sway", freq: 1.4, amp: 0.25, bob: 0, bank: 0 },
    skin,
    tentacleSkin,
  )
  const { body } = look

  // Roca, columna con franjas y disco oral. Sin ojos: es una anémona.
  kit.part(body, new THREE.DodecahedronGeometry(0.75, 0), rock, {
    at: [0, -0.48, 0],
    scale: [1, 0.45, 1],
  })
  const banded: Paint = (c) =>
    Math.floor(((Math.atan2(c.x, c.z) + PI) / (2 * PI)) * 18) % 2
      ? 0x6b2f5c
      : 0x823a70
  kit.part(
    body,
    new THREE.CylinderGeometry(0.4, 0.5, 0.5, 9),
    skin,
    {
      at: [0, -0.05, 0],
    },
    banded,
  )
  kit.part(
    body,
    new THREE.CylinderGeometry(0.55, 0.42, 0.1, 12),
    skin,
    {
      at: [0, 0.24, 0],
    },
    0x9a4a86,
  )
  kit.part(
    body,
    new THREE.CylinderGeometry(0.14, 0.14, 0.02, 8),
    skin,
    {
      at: [0, 0.3, 0],
    },
    0x2a0f24,
  )

  // Tentáculos: morados en la base y verde tóxico en la punta.
  const gradient: Paint = (c) =>
    lerpHex(0x6b2f5c, 0xb7ff5c, smoothstep(c.y, 0.1, 0.8))
  const tentacle = new THREE.CylinderGeometry(0.03, 0.08, 1.0, 5).translate(
    0,
    0.5,
    0,
  )
  const tip = new THREE.IcosahedronGeometry(0.075, 0)
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * PI * 2
    const pivot = kit.pivot(body, [
      Math.sin(angle) * 0.45,
      0.28,
      Math.cos(angle) * 0.45,
    ])
    pivot.rotation.order = "YXZ"
    pivot.rotation.set(0.38 + (i % 3) * 0.08, angle, 0)
    pivot.userData.angle = angle
    kit.part(pivot, tentacle, tentacleSkin, undefined, gradient)
    kit.part(pivot, tip, tentacleSkin, { at: [0, 1.02, 0] }, 0xd8ff8a)
    look.tentacles.push(pivot)
  }
  const inner = new THREE.CylinderGeometry(0.025, 0.05, 0.5, 5).translate(
    0,
    0.25,
    0,
  )
  for (let i = 0; i < 7; i++) {
    const angle = ((i + 0.5) / 7) * PI * 2
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    kit.part(
      body,
      inner,
      tentacleSkin,
      { at: [dx * 0.2, 0.28, dz * 0.2], quat: aim([dx * 0.3, 1, dz * 0.3]) },
      gradient,
    )
  }

  return finishLook(look, kit, rng, [1, 1.4])
}

// --------------------------------------------------------------- pez linterna

export function lanternfish(rng: Rng): CreatureLook {
  const kit = new ModelKit()
  const skin = kit.skin(0x3a4f9a, { glow: 0.25, rim: [0.6, 2.5] })
  const accent = kit.material(0x2a3350, {
    emissive: 0x3a4f9a,
    glow: 0.18,
    doubleSide: true,
  })
  const photophore = kit.material(0x9ff6ff, { emissive: 0x5ff0ff, glow: 1.8 })
  const look = draftLook(
    { gait: "fish", freq: 5, amp: 0.3, bob: 0.05, bank: 0.25 },
    skin,
    accent,
  )
  const { body } = look
  const radii: Vec3 = [0.42, 0.48, 0.72]
  const shape: HullOptions = { taper: 0.5, nose: 0.25 }
  const shade = countershade(0x1c2233, 0x7f8aa6, -0.25)
  kit.part(
    body,
    hull(radii, {
      ...shape,
      paint: (c, n) => (hash3(c) > 0.86 ? 0x2c3550 : shade(c, n)),
    }),
    skin,
  )

  // Ojos enormes para la penumbra y boca entreabierta.
  kit.eyes(body, { at: [0.26, 0.14, 0.45], size: 0.13, iris: 0xc9d8e8 })
  const jaw = kit.pivot(body, [0, -0.12, 0.55])
  jaw.userData.open = 0.35
  kit.part(jaw, hull([0.2, 0.06, 0.18], { paint: 0x2c3550 }), skin, {
    at: [0, -0.01, 0.06],
  })
  look.jaw = jaw

  // Dos hileras de fotóforos a lo largo del vientre.
  const dot = new THREE.IcosahedronGeometry(0.032, 0)
  for (const side of [-1, 1]) {
    for (const dy of [-0.45, -0.72]) {
      for (let k = 0; k < 7; k++) {
        const dz = 0.6 - k * 0.2
        const dx = Math.sqrt(Math.max(0.02, 1 - dy * dy - dz * dz))
        kit.part(body, dot, photophore, {
          at: hullPoint(radii, shape, [side * dx, dy, dz], 0.01),
        })
      }
    }
  }

  lure(kit, look, [0, 0.45, 0.35], [0.6, 0.35], 0.15, accent, 2.6)
  pectorals(kit, look, [0.34, -0.12, 0.15], 0.3, accent)
  verticalFin(kit, body, DORSAL, [0, 0.4, -0.05], 0.35, accent)
  verticalFin(kit, body, SMALL_FIN, [0, -0.38, -0.3], 0.8, accent, true)
  tailFin(kit, look, body, [0, 0, -0.66], FORKED_TAIL, 0.5, accent)

  return finishLook(look, kit, rng, [0.9, 1.15])
}
