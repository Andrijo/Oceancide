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
  limb,
  ModelKit,
  strand,
  type HullOptions,
  type Paint,
  type Vec3,
} from "./kit"
import { FALCATE, pectorals, SMALL_FIN, verticalFin } from "./parts"

/**
 * Modelos de los megajefes, al nivel de la tortuga y del resto de la fauna.
 * Son animales enormes enfermos por la contaminación: el kraken arrastra
 * redes, el tiburón lleva chatarra y anzuelos clavados y el leviatán, un aro
 * de plástico al cuello. La jugabilidad (fugas, zonas de daño, ataques) está
 * en `Megaboss`; aquí solo se dice dónde van las fugas y los centros que
 * hacen daño.
 */

const PI = Math.PI
const frac = (v: number): number => v - Math.floor(v)

/** Brillo púrpura enfermizo que se enciende al avisar de un ataque. */
const SICK_GLOW = 0x4a1f3a
const BONE = 0xe8e2cf
const ROPE = 0xc8b88a

export interface BossCore {
  object: THREE.Object3D
  radius: number
}

export interface LeakAnchor {
  parent: THREE.Object3D
  at: THREE.Vector3
}

export interface BossModel {
  look: CreatureLook
  /** Centros del cuerpo que intoxican al tocarlos. */
  cores: BossCore[]
  /** Dónde brotan las fugas, en coordenadas de su padre. */
  leaks: LeakAnchor[]
}

/** Punto fijo dentro del cuerpo (centro de daño). */
function anchor(parent: THREE.Object3D, at: Vec3): THREE.Object3D {
  const object = new THREE.Object3D()
  object.position.set(...at)
  parent.add(object)
  return object
}

/** Red de pesca irregular de alambre (sin romper la malla al deformarla). */
function netGeometry(radius: number, squash: Vec3): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 1)
  const pos = g.getAttribute("position")
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = 1 + (hash3(v.clone().normalize()) - 0.5) * 0.2
    pos.setXYZ(i, v.x * r * squash[0], v.y * r * squash[1], v.z * r * squash[2])
  }
  return g
}

// ------------------------------------------------------------ kraken de redes

export function netKraken(rng: Rng, leakCount: number): BossModel {
  const kit = new ModelKit()
  const skin = kit.skin(SICK_GLOW, { glow: 0.25, rim: [0.7, 2] })
  const accent = kit.material(0x9e5a6e, { glow: 0.1 })
  const rope = kit.material(ROPE, { roughness: 0.9 })
  const look = draftLook(
    { gait: "jet", freq: 1.2, amp: 0.25, bob: 0.25, bank: 0.15 },
    skin,
    accent,
  )
  const { body } = look
  // Piel moteada con manchas verdosas de enfermedad.
  const mottled: Paint = (c) => {
    const h = hash3(c)
    if (h > 0.92) return 0x5a6a3a
    if (c.y < -0.45) return 0x9e5a6e
    return h > 0.62 ? 0x4a2238 : 0x6d3b52
  }

  // Manto echado hacia atrás: aquí brotan las fugas.
  const mantleRadii: Vec3 = [2.4, 2.9, 2.4]
  const mantle = kit.pivot(body, [0, 1.2, -0.3], [-0.35, 0, 0])
  kit.part(mantle, hull(mantleRadii, { paint: mottled }), skin)
  kit.part(mantle, netGeometry(1, [2.55, 3.05, 2.55]), wireNet())
  const buoy = kit.material(0xff7a2a, { glow: 0.25 })
  const float = new THREE.IcosahedronGeometry(0.4, 1)
  for (const dir of [
    [0.6, 0.7, 0.4],
    [-0.7, 0.5, -0.3],
    [0.1, 0.4, -0.9],
  ] as Vec3[]) {
    kit.part(mantle, float, buoy, { at: hullPoint(mantleRadii, {}, dir, 0.35) })
  }

  // Cabeza con ojos enormes, tóxicos y de pupila alargada.
  kit.part(body, hull([1.9, 1.5, 1.8], { paint: mottled }), skin, {
    at: [0, -0.6, 0.4],
  })
  kit.eyes(body, {
    at: [1.45, -0.3, 1.05],
    size: 0.42,
    iris: 0xb6ff3a,
    irisGlow: 1.4,
    slit: true,
  })
  for (const side of [-1, 1]) {
    kit.part(body, hull([0.5, 0.22, 0.45], { paint: 0x4a2238 }), skin, {
      at: [side * 1.35, 0.15, 1.0],
      rot: [0, 0, side * -0.3],
    })
  }

  // Ocho brazos de dos tramos, con ventosas y cuerdas enrolladas.
  const suckers: Paint = (_c, n) => (n.z < -0.3 ? 0xd9a0a8 : 0x7e4058)
  const upper = strand(3.2, 0.55, 0.3, 7)
  const lower = strand(3.0, 0.3, 0.06, 7)
  const coil = new THREE.TorusGeometry(0.45, 0.07, 4, 10)
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) / 8) * PI * 2
    const arm = kit.pivot(body, [
      Math.sin(angle) * 1.4,
      -1.4,
      Math.cos(angle) * 1.4 + 0.3,
    ])
    arm.rotation.order = "YXZ"
    // En falda alrededor del cuerpo, con las puntas abiertas hacia fuera.
    arm.rotation.set(-0.55 + (i % 2) * 0.15, angle, 0)
    arm.userData.angle = angle
    kit.part(arm, upper, skin, undefined, suckers)
    if (i % 3 === 0) {
      kit.part(arm, coil, rope, { at: [0, -1.6, 0], rot: [PI / 2, 0, 0.3] })
    }
    const tip = kit.pivot(arm, [0, -3.2, 0], [-0.7, 0, 0])
    tip.userData.angle = angle
    tip.userData.depth = 1
    kit.part(tip, lower, skin, undefined, suckers)
    look.tentacles.push(arm, tip)
  }

  const cores = [{ object: anchor(body, [0, 1.2, 0]), radius: 2.3 }]
  const leaks: LeakAnchor[] = []
  for (let i = 0; i < leakCount; i++) {
    const y = 0.9 - (i / Math.max(1, leakCount - 1)) * 1.1
    const r = Math.sqrt(1 - y * y)
    const a = i * 2.39996 + 0.5
    leaks.push({
      parent: mantle,
      at: new THREE.Vector3(
        ...hullPoint(
          mantleRadii,
          {},
          [Math.cos(a) * r, y, Math.sin(a) * r],
          0.05,
        ),
      ),
    })
  }
  return { look: finishLook(look, kit, rng, [1, 1]), cores, leaks }
}

function wireNet(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    color: 0xd9d2b8,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  })
}

// --------------------------------------------------------- tiburón de chatarra

export function scrapShark(rng: Rng, leakCount: number): BossModel {
  const kit = new ModelKit()
  const skin = kit.skin(SICK_GLOW, { glow: 0.25, rim: [0.6, 2] })
  const accent = kit.material(0x4d565f, { glow: 0.1, doubleSide: true })
  const metal = kit.material(0xa0522d, { metalness: 0.5, roughness: 0.5 })
  const steel = kit.material(0xb9bec4, { metalness: 0.7, roughness: 0.3 })
  const bone = kit.material(BONE, { roughness: 0.4, glow: 0.1 })
  const dark = kit.material(0x15181c)
  const look = draftLook(
    { gait: "fish", freq: 2.4, amp: 0.18, bob: 0.12, bank: 0.3 },
    skin,
    accent,
  )
  const { body } = look
  const radii: Vec3 = [1.6, 1.8, 5.2]
  const shape: HullOptions = { detail: 2, taper: 0.6, nose: 0.35 }
  const shade = countershade(0x4d565f, 0xc9cfd4, -0.15, 0.15)
  // Lomo gris con regueros de óxido.
  const paint: Paint = (c, n) =>
    c.y > 0 && hash3(c) > 0.86 ? 0x8a4a2a : shade(c, n)
  kit.part(body, hull(radii, { ...shape, paint }), skin)

  // Boca: interior oscuro, dientes arriba y una mandíbula que se abre.
  kit.part(body, hull([1.0, 0.3, 1.1], { paint: 0x1a0f12 }), skin, {
    at: [0, -0.8, 3.7],
  })
  const tooth = new THREE.ConeGeometry(0.13, 0.5, 4)
  for (let i = 0; i < 11; i++) {
    const a = -1.2 + (i / 10) * 2.4
    kit.part(body, tooth, bone, {
      at: [Math.sin(a) * 0.95, -0.7, 3.7 + Math.cos(a) * 0.95],
      rot: [PI, 0, 0],
    })
  }
  const jaw = kit.pivot(body, [0, -1.05, 2.9])
  jaw.userData.open = 0.45
  kit.part(jaw, hull([1.05, 0.32, 1.5], { paint: 0xc9cfd4 }), skin, {
    at: [0, -0.05, 0.75],
  })
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + (i / 8) * 2.2
    kit.part(jaw, tooth, bone, {
      at: [Math.sin(a) * 0.85, 0.3, 0.8 + Math.cos(a) * 0.85],
      scale: 0.8,
    })
  }
  look.jaw = jaw

  // Ojos negros, branquias y aletas de tiburón.
  const eye = hullPoint(radii, shape, [1, 0.32, 0.72])
  kit.eyes(body, { at: [eye[0], eye[1], eye[2]], size: 0.2 })
  const gill = new THREE.BoxGeometry(0.05, 1.0, 0.08)
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const p = hullPoint(radii, shape, [side, -0.05, 0.42 - k * 0.05])
      kit.part(body, gill, dark, {
        at: p,
        rot: [0.15, 0, 0],
        scale: [1, 1 - k * 0.08, 1],
      })
    }
  }
  verticalFin(kit, body, FALCATE, [0, 1.4, -0.4], 3.6, accent)
  verticalFin(kit, body, SMALL_FIN, [0, 0.75, -3.4], 2.6, accent)
  verticalFin(kit, body, SMALL_FIN, [0, -0.75, -3.2], 2.2, accent, true)
  pectorals(kit, look, [1.3, -0.8, 1.6], 2.4, accent, {
    droop: 0.35,
    thickness: 0.08,
  })

  // Cola heterocerca: el lóbulo de arriba, más largo.
  const peduncle = kit.pivot(body, [0, 0, -4.6])
  kit.part(
    peduncle,
    hull([0.45, 0.7, 1.3], { taper: 0.4, paint: shade }),
    skin,
    {
      at: [0, 0, -0.8],
    },
  )
  look.tail.push(peduncle)
  const tail = kit.pivot(peduncle, [0, 0, -1.8])
  kit.part(
    tail,
    fin(
      [
        [0, 0.35],
        [0.9, 1.0],
        [2.4, 2.7],
        [1.6, 0.6],
        [1.1, 0],
        [1.5, -1.1],
        [0, -0.35],
      ],
      0.1,
    ),
    accent,
    { rot: [0, PI / 2, 0] },
  )
  look.tail.push(tail)

  // Placas de chatarra atornilladas al cuerpo.
  const plate = new THREE.BoxGeometry(1, 0.15, 1.4)
  const rivet = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 6)
  let placed = 0
  for (const dir of fibonacciSphere(30)) {
    if (placed >= 7 || dir.z > 0.6 || dir.z < -0.7 || dir.y < -0.4) continue
    if (hash3(dir, 3) < 0.45) continue
    const d: Vec3 = [dir.x, dir.y, dir.z]
    const normal = aim(d)
    kit.part(body, plate, metal, {
      at: hullPoint(radii, shape, d, 0.03),
      quat: normal,
    })
    kit.part(body, rivet, steel, {
      at: hullPoint(radii, shape, d, 0.12),
      quat: normal,
    })
    placed++
  }

  // Anzuelos clavados con su sedal.
  const bend = new THREE.TorusGeometry(0.2, 0.04, 4, 8, PI * 1.3)
  for (const [x, y, z] of [
    [0.9, 0.2, 0.55],
    [-1, -0.1, 0.2],
    [0.7, 0.5, -0.3],
  ] as Vec3[]) {
    const p = hullPoint(radii, shape, [x, y, z])
    kit.part(body, bend, steel, { at: p, rot: [0, PI / 2, 0.6] })
    const line = limb(p, [p[0] * 1.1, p[1] - 0.6, p[2] - 2.4], 0.015, 0.01, 3)
    kit.part(body, line.geometry, bone, line.place)
  }

  const cores = [
    { object: anchor(body, [0, 0, 0]), radius: 1.8 },
    { object: anchor(body, [0, 0, 3]), radius: 1.6 },
    { object: anchor(body, [0, 0, -3]), radius: 1.3 },
  ]
  const leaks: LeakAnchor[] = []
  for (let i = 0; i < leakCount; i++) {
    const y = 0.2 + (i / Math.max(1, leakCount - 1)) * 0.7
    const r = Math.sqrt(1 - y * y)
    const a = i * 2.39996 + 0.5
    leaks.push({
      parent: body,
      at: new THREE.Vector3(
        ...hullPoint(radii, shape, [Math.cos(a) * r, y, Math.sin(a) * r], 0.05),
      ),
    })
  }
  return { look: finishLook(look, kit, rng, [1, 1]), cores, leaks }
}

// ---------------------------------------------------------- leviatán (serpiente)

export interface SerpentModel {
  /** Cabeza y vértebras: cada una sigue a la anterior. */
  segments: THREE.Group[]
  /** Radio de cada segmento (centro de daño). */
  radii: number[]
  jaw: THREE.Group
  bodyMaterial: THREE.MeshStandardMaterial
  leaks: LeakAnchor[]
}

/** Tamaño de un segmento según su posición en la cadena. */
function serpentTaper(i: number, count: number): number {
  return 1 - (i / count) * 0.7
}

export function leviathan(count: number, leakCount: number): SerpentModel {
  const kit = new ModelKit()
  const skin = kit.skin(0x3a5a1f, { glow: 0.25, rim: [0.6, 2] })
  const accent = kit.material(0x7a9a3a, { glow: 0.15 })
  const bone = kit.material(BONE, { roughness: 0.4, glow: 0.1 })
  const plastic = kit.material(0xe8ecd8, { roughness: 0.3, glow: 0.2 })
  // Lomo verde podrido con manchas y placas ventrales claras.
  const scales: Paint = (c) => {
    if (c.y < -0.4) return frac(c.z * 2.5 + 5) < 0.5 ? 0x7a9a3a : 0x5f7a2e
    return hash3(c) > 0.85 ? 0x1f2a20 : 0x2d3b2f
  }
  const vertebra = hull([1, 1, 1], { paint: scales })
  const spike = new THREE.ConeGeometry(0.25, 1, 4)
  const frill = fin(
    [
      [0, 0],
      [0.9, 0.35],
      [0.75, 0.75],
      [0, 0.5],
    ],
    0.05,
  )

  const segments: THREE.Group[] = []
  const radii: number[] = []
  for (let i = 0; i < count; i++) {
    const segment = new THREE.Group()
    segment.rotation.order = "YXZ"
    const t = serpentTaper(i, count)
    radii.push(1.4 * t)
    if (i > 0) {
      kit.part(segment, vertebra, skin, { scale: [1.6 * t, 1.4 * t, 1.5 * t] })
      // Cresta de púas y aletas laterales rasgadas cada dos segmentos.
      kit.part(segment, spike, accent, {
        at: [0, 1.3 * t, -0.1],
        rot: [-0.5, 0, 0],
        scale: [t, t * (i % 2 === 0 ? 1.4 : 0.8), t],
      })
      if (i % 2 === 1 && i < count - 2) {
        for (const side of [-1, 1]) {
          kit.part(segment, frill, accent, {
            at: [side * 1.3 * t, -0.3 * t, 0],
            rot: [-PI / 2, 0, -side * 0.5],
            scale: [side * t * 1.4, t * 1.4, 1],
          })
        }
      }
    }
    segments.push(segment)
  }

  // Cabeza de dragón marino: cráneo, cuernos, bigotes y ojos tóxicos.
  const head = segments[0]
  const skull: Vec3 = [1.35, 1.05, 1.9]
  kit.part(head, hull(skull, { nose: 0.35, paint: scales }), skin, {
    at: [0, 0.1, 0.2],
  })
  for (const side of [-1, 1]) {
    const horn = limb(
      [side * 0.6, 0.85, -0.2],
      [side * 1.0, 1.7, -1.6],
      0.25,
      0.03,
      5,
    )
    kit.part(head, horn.geometry, bone, horn.place)
    const whisker = limb(
      [side * 0.55, -0.35, 1.8],
      [side * 1.3, -1.2, 2.6],
      0.06,
      0.015,
      4,
    )
    kit.part(head, whisker.geometry, accent, whisker.place)
  }
  kit.eyes(head, {
    at: [0.95, 0.45, 1.0],
    size: 0.24,
    iris: 0xb6ff3a,
    irisGlow: 1.6,
    slit: true,
  })
  const tooth = new THREE.ConeGeometry(0.09, 0.4, 4)
  for (let k = 0; k < 6; k++) {
    for (const side of [-1, 1]) {
      kit.part(head, tooth, bone, {
        at: [side * (0.85 - k * 0.1), -0.45, 0.6 + k * 0.28],
        rot: [PI, 0, 0],
      })
    }
  }
  const jaw = kit.pivot(head, [0, -0.55, 0.2])
  kit.part(jaw, hull([1.1, 0.35, 1.6], { nose: 0.3, paint: 0x5f7a2e }), skin, {
    at: [0, -0.1, 0.6],
  })
  for (let k = 0; k < 5; k++) {
    for (const side of [-1, 1]) {
      kit.part(jaw, tooth, bone, {
        at: [side * (0.75 - k * 0.11), 0.15, 0.6 + k * 0.28],
        scale: 0.8,
      })
    }
  }

  // Un aro de plástico de latas atascado en el cuello.
  const ring = new THREE.TorusGeometry(1.45, 0.08, 4, 16)
  kit.part(segments[2], ring, plastic, { rot: [0.25, 0, 0] })
  kit.part(segments[2], ring, plastic, {
    at: [0, -0.35, -0.3],
    rot: [0.4, 0, 0.15],
    scale: 0.85,
  })

  // Aleta en la punta de la cola.
  const last = count - 1
  kit.part(
    segments[last],
    fin(
      [
        [0, 0.6],
        [1.6, 0],
        [0, -0.6],
      ],
      0.06,
    ),
    accent,
    { at: [0, 0, -0.3], rot: [0, PI / 2, 0] },
  )
  kit.build()

  // Las fugas, repartidas a lo largo del lomo, alternando los lados.
  const leaks: LeakAnchor[] = []
  const every = Math.max(1, Math.floor(count / leakCount))
  for (let i = 1; i < count && leaks.length < leakCount; i++) {
    if (i % every !== 0) continue
    const side = leaks.length % 2 === 0 ? 1 : -1
    const t = serpentTaper(i, count)
    leaks.push({
      parent: segments[i],
      at: new THREE.Vector3(side * 0.75 * 1.6 * t, 0.75 * 1.4 * t, 0),
    })
  }
  while (leaks.length < leakCount) {
    leaks.push({
      parent: segments[1],
      at: new THREE.Vector3(0, 1.45, 0.3 * leaks.length),
    })
  }

  return { segments, radii, jaw, bodyMaterial: skin, leaks }
}
