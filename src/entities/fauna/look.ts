import * as THREE from "three"
import type { Rng } from "@core/rng"
import { addFresnelRim } from "../fresnelRim"

/**
 * Aspecto de una especie, montado a partir de piezas sencillas: un cuerpo
 * elipsoidal y los apéndices que la distinguen. Sin texturas ni luces propias
 * (cambiar el número de luces recompila todos los shaders): el brillo sale del
 * emisivo y del bloom.
 */
export interface LookSpec {
  color: number
  /** Color de aletas, pinzas, tentáculos y rayas. */
  accent: number
  emissive?: number
  glow?: number
  /** Radios del cuerpo: ancho, alto, largo (el largo va en +Z, la cabeza). */
  body: [number, number, number]
  tail?: "fork" | "fluke" | "whip" | "fin"
  /** Aletas laterales pequeñas, alas de manta o aleta dorsal. */
  fins?: "side" | "wings" | "dorsal" | "sideDorsal"
  /** Hocico o pico alargado delante de la cabeza. */
  snout?: number
  spikes?: number
  tentacles?: { count: number; length: number; up?: boolean; front?: boolean }
  legs?: number
  claws?: boolean
  lure?: boolean
  shell?: boolean
  /** Red de pesca alrededor (la tortuga atrapada). */
  net?: boolean
  /** Rayas del color de acento a lo largo del cuerpo. */
  stripes?: number
  eyeSize?: number
  scale: [number, number]
}

/** Piezas que se animan, para que cada especie las mueva a su manera. */
export interface CreatureLook {
  /** Se gira con el rumbo de la criatura. */
  root: THREE.Group
  body: THREE.Mesh
  bodyMaterial: THREE.MeshStandardMaterial
  accentMaterial: THREE.MeshStandardMaterial
  tail: THREE.Object3D | null
  fins: THREE.Object3D[]
  wings: THREE.Object3D[]
  tentacles: THREE.Object3D[]
  legs: THREE.Object3D[]
  spikes: THREE.Group | null
  lure: THREE.Mesh | null
  lureMaterial: THREE.MeshStandardMaterial | null
  net: THREE.Mesh | null
  dispose(): void
}

export function buildLook(spec: LookSpec, rng: Rng): CreatureLook {
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g)
    return g
  }
  const mat = <T extends THREE.Material>(m: T): T => {
    materials.push(m)
    return m
  }

  const root = new THREE.Group()
  const [w, h, l] = spec.body

  const bodyMaterial = mat(
    new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: 0.45,
      metalness: 0.15,
      emissive: spec.emissive ?? spec.color,
      emissiveIntensity: spec.glow ?? 0.18,
    }),
  )
  addFresnelRim(bodyMaterial, 0.5, 2.5)
  const accentMaterial = mat(
    new THREE.MeshStandardMaterial({
      color: spec.accent,
      roughness: 0.5,
      metalness: 0.1,
      emissive: spec.accent,
      emissiveIntensity: (spec.glow ?? 0.18) * 0.8,
      side: THREE.DoubleSide,
    }),
  )

  const unitSphere = geo(new THREE.SphereGeometry(1, 16, 12))
  const body = new THREE.Mesh(unitSphere, bodyMaterial)
  body.scale.set(w, h, l)
  root.add(body)

  // --- Cola ---
  let tail: THREE.Object3D | null = null
  if (spec.tail) {
    tail = new THREE.Group()
    tail.position.z = -l * 0.92
    const size = Math.max(w, h)
    if (spec.tail === "whip") {
      const whip = new THREE.Mesh(
        geo(new THREE.CylinderGeometry(0.015, w * 0.12, l * 1.6, 5)),
        accentMaterial,
      )
      whip.rotation.x = Math.PI / 2
      whip.position.z = -l * 0.8
      tail.add(whip)
    } else {
      const fluke = spec.tail === "fluke"
      const shape = new THREE.Shape()
      const span = size * (fluke ? 1.4 : 1.1)
      const depth = size * (spec.tail === "fin" ? 0.6 : 0.9)
      shape.moveTo(0, 0)
      shape.lineTo(-span, -depth)
      shape.lineTo(-span * 0.3, -depth * 0.55)
      shape.lineTo(0, -depth * 0.75)
      shape.lineTo(span * 0.3, -depth * 0.55)
      shape.lineTo(span, -depth)
      shape.closePath()
      const fin = new THREE.Mesh(
        geo(new THREE.ShapeGeometry(shape)),
        accentMaterial,
      )
      // La forma está en XY; la cola se abre hacia atrás (-Z), vertical u horizontal.
      fin.rotation.x = fluke ? Math.PI / 2 : 0
      if (!fluke) fin.rotation.set(0, Math.PI / 2, Math.PI / 2)
      tail.add(fin)
    }
    root.add(tail)
  }

  // --- Aletas ---
  const fins: THREE.Object3D[] = []
  const wings: THREE.Object3D[] = []
  const finShape = new THREE.Shape()
  finShape.moveTo(0, 0)
  finShape.lineTo(1, -0.35)
  finShape.lineTo(0.9, 0.3)
  finShape.closePath()
  const finGeometry = geo(new THREE.ShapeGeometry(finShape))

  if (spec.fins === "side" || spec.fins === "sideDorsal") {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.set(side * w * 0.85, -h * 0.2, l * 0.15)
      const fin = new THREE.Mesh(finGeometry, accentMaterial)
      fin.scale.set(side * w * 0.9, l * 0.35, 1)
      fin.rotation.x = Math.PI / 2
      pivot.add(fin)
      pivot.userData.side = side
      fins.push(pivot)
      root.add(pivot)
    }
  }
  if (spec.fins === "dorsal" || spec.fins === "sideDorsal") {
    const dorsal = new THREE.Mesh(finGeometry, accentMaterial)
    dorsal.scale.set(h * 0.9, l * 0.4, 1)
    dorsal.rotation.set(0, Math.PI / 2, Math.PI / 2)
    dorsal.position.set(0, h * 0.85, -l * 0.1)
    root.add(dorsal)
  }
  if (spec.fins === "wings") {
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, l * 0.7)
    wingShape.quadraticCurveTo(w * 2.4, l * 0.1, w * 2.6, -l * 0.3)
    wingShape.quadraticCurveTo(w * 1.2, -l * 0.5, 0, -l * 0.6)
    wingShape.closePath()
    const wingGeometry = geo(new THREE.ShapeGeometry(wingShape))
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.x = side * w * 0.6
      const wing = new THREE.Mesh(wingGeometry, accentMaterial)
      wing.rotation.x = Math.PI / 2
      wing.scale.x = side
      pivot.add(wing)
      pivot.userData.side = side
      wings.push(pivot)
      root.add(pivot)
    }
  }

  // --- Hocico ---
  if (spec.snout) {
    const snout = new THREE.Mesh(unitSphere, bodyMaterial)
    snout.scale.set(w * 0.35, h * 0.3, spec.snout)
    snout.position.z = l * 0.85 + spec.snout * 0.5
    root.add(snout)
  }

  // --- Rayas ---
  for (let i = 0; i < (spec.stripes ?? 0); i++) {
    const t = (i + 1) / ((spec.stripes ?? 0) + 1)
    const z = l * (0.6 - t * 1.2)
    const radius = Math.sqrt(Math.max(0.05, 1 - (z / l) ** 2))
    const stripe = new THREE.Mesh(
      geo(new THREE.TorusGeometry(1, 0.06, 4, 16)),
      accentMaterial,
    )
    stripe.scale.set(w * radius * 1.01, h * radius * 1.01, 1)
    stripe.position.z = z
    root.add(stripe)
  }

  // --- Púas (se esconden al escalar el grupo) ---
  let spikes: THREE.Group | null = null
  if (spec.spikes) {
    spikes = new THREE.Group()
    const spikeGeometry = geo(new THREE.ConeGeometry(0.05, 0.3, 4))
    for (let i = 0; i < spec.spikes; i++) {
      // Reparto uniforme sobre la esfera (espiral de Fibonacci).
      const y = 1 - (i / (spec.spikes - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const a = i * 2.39996
      const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
      const spike = new THREE.Mesh(spikeGeometry, accentMaterial)
      spike.position.set(dir.x * w, dir.y * h, dir.z * l)
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      spikes.add(spike)
    }
    root.add(spikes)
  }

  // --- Tentáculos ---
  const tentacles: THREE.Object3D[] = []
  if (spec.tentacles) {
    const { count, length, up, front } = spec.tentacles
    const tentacleGeometry = geo(
      new THREE.CylinderGeometry(0.03, 0.09, length, 5, 1, true),
    )
    tentacleGeometry.translate(0, -length / 2, 0)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const pivot = new THREE.Group()
      const tentacle = new THREE.Mesh(tentacleGeometry, accentMaterial)
      pivot.add(tentacle)
      if (front) {
        pivot.position.set(
          Math.cos(angle) * w * 0.4,
          Math.sin(angle) * h * 0.4,
          l * 0.8,
        )
        pivot.rotation.x = -Math.PI / 2
      } else if (up) {
        pivot.position.set(
          Math.cos(angle) * w * 0.6,
          h * 0.6,
          Math.sin(angle) * l * 0.6,
        )
        pivot.rotation.x = Math.PI
      } else {
        pivot.position.set(
          Math.cos(angle) * w * 0.6,
          -h * 0.5,
          Math.sin(angle) * l * 0.6,
        )
      }
      pivot.userData.angle = angle
      pivot.userData.baseX = pivot.rotation.x
      tentacles.push(pivot)
      root.add(pivot)
    }
  }

  // --- Patas y pinzas ---
  const legs: THREE.Object3D[] = []
  if (spec.legs) {
    const legGeometry = geo(new THREE.CylinderGeometry(0.03, 0.05, w * 1.1, 4))
    legGeometry.translate(0, -w * 0.55, 0)
    const perSide = Math.ceil(spec.legs / 2)
    for (let i = 0; i < spec.legs; i++) {
      const side = i < perSide ? -1 : 1
      const index = i % perSide
      const pivot = new THREE.Group()
      pivot.position.set(
        side * w * 0.8,
        -h * 0.2,
        l * (0.5 - (index / Math.max(1, perSide - 1)) * 1),
      )
      pivot.rotation.z = side * 1.0
      const leg = new THREE.Mesh(legGeometry, accentMaterial)
      pivot.add(leg)
      pivot.userData.side = side
      pivot.userData.index = index
      legs.push(pivot)
      root.add(pivot)
    }
  }
  if (spec.claws) {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(unitSphere, accentMaterial)
      claw.scale.set(w * 0.35, h * 0.3, l * 0.45)
      claw.position.set(side * w * 0.75, 0, l * 1.15)
      claw.rotation.y = -side * 0.4
      root.add(claw)
    }
  }

  // --- Caparazón ---
  if (spec.shell) {
    const shellMaterial = mat(
      new THREE.MeshStandardMaterial({
        color: spec.accent,
        roughness: 0.7,
        flatShading: true,
      }),
    )
    const shell = new THREE.Mesh(
      geo(new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
      shellMaterial,
    )
    shell.scale.set(w * 1.15, h * 1.4, l * 1.1)
    root.add(shell)
  }

  // --- Señuelo ---
  let lure: THREE.Mesh | null = null
  let lureMaterial: THREE.MeshStandardMaterial | null = null
  if (spec.lure) {
    const stalk = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(0.02, 0.035, h * 1.4, 5)),
      bodyMaterial,
    )
    stalk.position.set(0, h * 1.1, l * 0.6)
    stalk.rotation.x = 0.7
    root.add(stalk)
    lureMaterial = mat(
      new THREE.MeshStandardMaterial({
        color: 0xfff3b0,
        emissive: 0xffe066,
        emissiveIntensity: 2.4,
      }),
    )
    lure = new THREE.Mesh(
      geo(new THREE.SphereGeometry(0.15, 10, 8)),
      lureMaterial,
    )
    lure.position.set(0, h * 1.6, l * 1.05)
    root.add(lure)
  }

  // --- Ojos ---
  const eyeMaterial = mat(new THREE.MeshBasicMaterial({ color: 0x0b0d12 }))
  const eyeSize = spec.eyeSize ?? Math.min(w, h) * 0.18
  const eyeGeometry = geo(new THREE.SphereGeometry(eyeSize, 6, 5))
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    eye.position.set(side * w * 0.62, h * 0.3, l * 0.7)
    root.add(eye)
  }

  // --- Red de pesca ---
  let net: THREE.Mesh | null = null
  if (spec.net) {
    net = new THREE.Mesh(
      geo(new THREE.IcosahedronGeometry(Math.max(w, l) * 1.9, 1)),
      mat(
        new THREE.MeshBasicMaterial({
          color: 0xd9d2b8,
          wireframe: true,
          transparent: true,
          opacity: 0.75,
        }),
      ),
    )
    root.add(net)
  }

  root.scale.setScalar(rng.range(spec.scale[0], spec.scale[1]))

  return {
    root,
    body,
    bodyMaterial,
    accentMaterial,
    tail,
    fins,
    wings,
    tentacles,
    legs,
    spikes,
    lure,
    lureMaterial,
    net,
    dispose() {
      root.removeFromParent()
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}

/** Anima las piezas comunes: cola, aletas, alas, tentáculos y patas. */
export function animateLook(
  look: CreatureLook,
  time: number,
  phase: number,
  effort = 1,
): void {
  const t = time + phase
  if (look.tail) look.tail.rotation.y = Math.sin(t * 6 * effort) * 0.35
  for (const fin of look.fins) {
    const side = fin.userData.side as number
    fin.rotation.z = side * Math.sin(t * 5) * 0.3
  }
  for (const wing of look.wings) {
    const side = wing.userData.side as number
    wing.rotation.z = side * Math.sin(t * 1.6 * effort) * 0.45
  }
  for (const tentacle of look.tentacles) {
    const angle = tentacle.userData.angle as number
    const baseX = tentacle.userData.baseX as number
    tentacle.rotation.x = baseX + Math.sin(t * 2.2 + angle * 2) * 0.25
    tentacle.rotation.z = Math.cos(t * 1.7 + angle * 3) * 0.25
  }
  for (const leg of look.legs) {
    const side = leg.userData.side as number
    const index = leg.userData.index as number
    leg.rotation.x = Math.sin(t * 9 * effort + index * 1.4 + side) * 0.35
  }
}
