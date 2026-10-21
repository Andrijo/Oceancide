// src/world/BiomeProps.ts
import * as THREE from "three"
import type { BiomeKey } from "@core/types"
import type { Rng } from "@core/rng"

export interface BiomeLightAnchor {
  position: THREE.Vector3
  color: number
  intensity: number
}

type BiomePropPalette = {
  rock: number
  coral: number[]
  shell: number
  seaweed: number
  sponge: number
  reef: number
  bone: number
  vent: number
  glow: number
}

type PropFactory = (rng: Rng, palette: BiomePropPalette) => THREE.Object3D

type BiomePropConfig = {
  count: number
  factories: PropFactory[]
}

type SwayConfig = {
  amplitude: number
  speed: number
  phase: number
}

type SwayBase = {
  x: number
  z: number
}

const PROP_HALF_SIZE = 85

// Paletas por bioma: la misma familia de props cambia de color al descender.
// Así el jugador reconoce la zona sin depender solo de la niebla o la luz.

const BIOME_PROP_PALETTES: Record<BiomeKey, BiomePropPalette> = {
  epipelagic_upper: {
    rock: 0x46545c,
    coral: [0xd96a7f, 0xd08a4a, 0x7f6bb0, 0x3fa79b, 0xc9a55a],
    shell: 0xcbb794,
    seaweed: 0x2c6b44,
    sponge: 0x7a5f8f,
    reef: 0x5d6b60,
    bone: 0xd8d0b8,
    vent: 0x3a3f44,
    glow: 0x7cf7d4,
  },
  pelagic_mid: {
    rock: 0x43515b,
    coral: [0xc76a80, 0xb9824e, 0x6f6aa8, 0x3d948c, 0xb89a5e],
    shell: 0xc2b497,
    seaweed: 0x2f6a52,
    sponge: 0x6a5a86,
    reef: 0x56645f,
    bone: 0xd0c7ae,
    vent: 0x343a40,
    glow: 0x6fe8d0,
  },
  subphotic: {
    rock: 0x3e4d58,
    coral: [0xa85f78, 0xa87952, 0x625f96, 0x3a7f80, 0x9b875c],
    shell: 0xb3a68c,
    seaweed: 0x2c5c4a,
    sponge: 0x5d5378,
    reef: 0x4d5a55,
    bone: 0xc4bba4,
    vent: 0x2f353b,
    glow: 0x62d8c4,
  },
  mesopelagic_upper: {
    rock: 0x38434e,
    coral: [0x8f5a7a, 0x8a6a55, 0x5b5688, 0x3a6d75, 0x84745a],
    shell: 0xa79b84,
    seaweed: 0x2a4d45,
    sponge: 0x544b6e,
    reef: 0x454f4c,
    bone: 0xb8b09c,
    vent: 0x2b3036,
    glow: 0x9d7bff,
  },
  mesopelagic_deep: {
    rock: 0x343b47,
    coral: [0x7d5478, 0x765d55, 0x554d7d, 0x35606a, 0x746750],
    shell: 0x998e7b,
    seaweed: 0x27413f,
    sponge: 0x4a4363,
    reef: 0x3e4745,
    bone: 0xaaa28f,
    vent: 0x272b31,
    glow: 0xcc77ff,
  },
  bathypelagic_upper: {
    rock: 0x30343f,
    coral: [0x6b4e6b, 0x66524d, 0x4a446e, 0x31545d, 0x635946],
    shell: 0x8b8171,
    seaweed: 0x243836,
    sponge: 0x403b56,
    reef: 0x373e3d,
    bone: 0x9c9483,
    vent: 0x23262b,
    glow: 0xff77dd,
  },
  bathypelagic_deep: {
    rock: 0x2c2d37,
    coral: [0x5e475f, 0x5a4a45, 0x413c60, 0x2d4a52, 0x574e3e],
    shell: 0x7e7567,
    seaweed: 0x213230,
    sponge: 0x38334b,
    reef: 0x303635,
    bone: 0x8e8777,
    vent: 0x1f2226,
    glow: 0xff6688,
  },
  abyssopelagic: {
    rock: 0x28333a,
    coral: [0x4f4a5c, 0x4e4a44, 0x3a3e56, 0x2a4b4e, 0x4b463c],
    shell: 0x72756b,
    seaweed: 0x1f2d2e,
    sponge: 0x32364a,
    reef: 0x2a3332,
    bone: 0x828577,
    vent: 0x1b2226,
    glow: 0x44ffdd,
  },
  hadopelagic: {
    rock: 0x2a2a2c,
    coral: [0x4a4148, 0x4b443a, 0x393744, 0x2d4140, 0x454033],
    shell: 0x6e6a5b,
    seaweed: 0x202a28,
    sponge: 0x30303a,
    reef: 0x292e2b,
    bone: 0x7b7869,
    vent: 0x181b1e,
    glow: 0xffdd44,
  },
  deepSea: {
    rock: 0x2b2422,
    coral: [0x4e3b3b, 0x513f33, 0x41363c, 0x34413e, 0x4a3e30],
    shell: 0x6d5f52,
    seaweed: 0x242a24,
    sponge: 0x383039,
    reef: 0x2c2926,
    bone: 0x79705f,
    vent: 0x1a1716,
    glow: 0xff6633,
  },
}

function randomColor(rng: Rng, base: number, variation = 0.08): THREE.Color {
  const color = new THREE.Color(base)

  color.offsetHSL(
    rng.range(-variation / 2, variation / 2),
    rng.range(-variation / 2, variation / 2),
    rng.range(-variation / 2, variation / 2),
  )

  return color
}

function tagProp(object: THREE.Object3D, kind: string): THREE.Object3D {
  object.userData.kind = kind
  return object
}

function markSway(
  object: THREE.Object3D,
  rng: Rng,
  amplitude: number,
  speed: number,
): void {
  object.userData.sway = {
    amplitude: rng.range(amplitude * 0.5, amplitude * 1.5),
    speed: rng.range(speed * 0.7, speed * 1.3),
    phase: rng.range(0, Math.PI * 2),
  } satisfies SwayConfig
}

function markLight(
  object: THREE.Object3D,
  color: number,
  intensity: number,
  yOffset: number,
): void {
  object.userData.light = {
    color,
    intensity,
    offset: new THREE.Vector3(0, yOffset, 0),
  }
}

// Caché de geometrías compartidas

const geometryCache = new Map<string, THREE.BufferGeometry>()

function cachedGeometry(
  key: string,
  factory: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  let geometry = geometryCache.get(key)
  if (!geometry) {
    geometry = factory()
    geometryCache.set(key, geometry)
  }
  return geometry
}

// Fabricación de props

// La roca varía de tamaño por escala, pero el radio de la malla se cuantiza a un
// puñado de valores para poder compartir (y no acumular) geometrías entre props.
const ROCK_RADIUS_STEPS = 5

function createRock(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const step = Math.round((rng.range(0, 2) / 2) * (ROCK_RADIUS_STEPS - 1))
  const radius = 1 + (step / (ROCK_RADIUS_STEPS - 1)) * 2

  const geometry = cachedGeometry(
    `rock-${step}`,
    () => new THREE.DodecahedronGeometry(radius, 0),
  )

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.rock, 0.08),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })

  const rock = new THREE.Mesh(geometry, material)

  rock.scale.set(rng.range(1.2, 2.4), rng.range(0.7, 1.5), rng.range(1.2, 2.4))

  rock.rotation.set(
    rng.range(0, Math.PI),
    rng.range(0, Math.PI),
    rng.range(0, Math.PI),
  )

  return tagProp(rock, "rock")
}

function createCoral(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const color = randomColor(rng, rng.pick(palette.coral), 0.06)

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  })

  const branches = rng.int(5) + 5

  const branchGeometry = cachedGeometry(
    "coral-branch",
    () => new THREE.CylinderGeometry(0.07, 0.16, 1, 5),
  )

  for (let i = 0; i < branches; i++) {
    const height = rng.range(0.8, 2.3)

    const branch = new THREE.Mesh(branchGeometry, material)

    branch.position.set(rng.range(-0.4, 0.4), height / 2, rng.range(-0.4, 0.4))
    branch.scale.set(1, height, 1)

    branch.rotation.set(
      rng.range(-0.3, 0.3),
      rng.range(0, Math.PI),
      rng.range(-0.3, 0.3),
    )

    group.add(branch)
  }

  group.scale.setScalar(rng.range(1.5, 2.9))
  markSway(group, rng, 0.012, 0.7)
  return tagProp(group, "coral")
}

function createShell(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const geometry = cachedGeometry(
    "shell",
    () => new THREE.SphereGeometry(0.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  )

  const shell = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: randomColor(rng, palette.shell, 0.08),
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
    }),
  )

  shell.scale.set(1, 0.55, 1.15)
  shell.rotation.y = rng.range(0, Math.PI * 2)

  const group = new THREE.Group()
  group.add(shell)

  group.scale.setScalar(rng.range(1.2, 2))
  return tagProp(group, "shell")
}

function createSeaweed(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.seaweed, 0.08),
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })

  const blades = rng.int(5) + 4

  const bladeGeometry = cachedGeometry(
    "seaweed-blade",
    () => new THREE.BoxGeometry(0.12, 1, 0.04),
  )

  for (let i = 0; i < blades; i++) {
    const height = rng.range(1.6, 4.6)

    const blade = new THREE.Mesh(bladeGeometry, material)

    blade.position.set(
      rng.range(-0.35, 0.35),
      height / 2,
      rng.range(-0.35, 0.35),
    )
    blade.scale.set(1, height, 1)

    blade.rotation.z = rng.range(-0.11, 0.11)
    group.add(blade)
  }

  group.scale.setScalar(rng.range(1.2, 2.2))
  markSway(group, rng, 0.04, 1)
  return tagProp(group, "seaweed")
}

function createSponge(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.sponge, 0.08),
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })

  const bodyGeometry = cachedGeometry(
    "sponge-body",
    () => new THREE.DodecahedronGeometry(0.75, 0),
  )

  const body = new THREE.Mesh(bodyGeometry, material)

  body.scale.set(1, 1.25, 1)
  body.position.y = 0.6
  group.add(body)

  const openingGeometry = cachedGeometry(
    "sponge-opening",
    () => new THREE.CylinderGeometry(0.16, 0.22, 0.35, 7),
  )

  const opening = new THREE.Mesh(openingGeometry, material)

  opening.position.y = 1.15
  group.add(opening)

  group.scale.setScalar(rng.range(1.2, 2.2))
  markSway(group, rng, 0.008, 0.6)
  return tagProp(group, "sponge")
}

function createReefMound(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.reef, 0.07),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })

  const moundGeometry = cachedGeometry(
    "reef-mound",
    () => new THREE.DodecahedronGeometry(1.9, 0),
  )

  const mound = new THREE.Mesh(moundGeometry, material)

  mound.scale.set(1.3, 0.65, 1.3)
  mound.position.y = 0.35
  group.add(mound)

  const coralMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, rng.pick(palette.coral), 0.06),
    roughness: 0.9,
    flatShading: true,
  })

  const corals = rng.int(4) + 3

  const coralGeometry = cachedGeometry(
    "reef-coral",
    () => new THREE.ConeGeometry(0.24, 1, 5),
  )

  for (let i = 0; i < corals; i++) {
    const height = rng.range(0.7, 1.5)

    const coral = new THREE.Mesh(coralGeometry, coralMaterial)
    coral.scale.set(1, height, 1)

    coral.position.set(
      rng.range(-0.9, 0.9),
      rng.range(0.55, 0.85),
      rng.range(-0.9, 0.9),
    )

    coral.rotation.set(
      rng.range(-0.175, 0.175),
      rng.range(0, Math.PI),
      rng.range(-0.175, 0.175),
    )

    group.add(coral)
  }

  group.scale.setScalar(rng.range(1.3, 2.4))
  return tagProp(group, "reef")
}

function createKelp(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.seaweed, 0.08),
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  })

  const bladeGeometry = cachedGeometry(
    "kelp-blade",
    () => new THREE.BoxGeometry(0.16, 1, 0.05),
  )
  const bulbGeometry = cachedGeometry(
    "kelp-bulb",
    () => new THREE.SphereGeometry(0.16, 6, 4),
  )

  const blades = rng.int(4) + 3

  for (let i = 0; i < blades; i++) {
    const height = rng.range(2.8, 7.5)

    const blade = new THREE.Mesh(bladeGeometry, material)
    blade.position.set(
      rng.range(-0.35, 0.35),
      height / 2,
      rng.range(-0.35, 0.35),
    )
    blade.scale.set(1, height, 1)
    blade.rotation.z = rng.range(-0.08, 0.08)
    group.add(blade)

    if (rng.next() < 0.35) {
      const bulb = new THREE.Mesh(bulbGeometry, material)
      bulb.position.set(blade.position.x, height + 0.05, blade.position.z)
      group.add(bulb)
    }
  }

  group.scale.setScalar(rng.range(0.9, 1.5))
  markSway(group, rng, 0.045, 0.9)
  return tagProp(group, "kelp")
}

function createSeaFan(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, rng.pick(palette.coral), 0.06),
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  })

  const branchGeometry = cachedGeometry(
    "sea-fan-branch",
    () => new THREE.CylinderGeometry(0.035, 0.08, 1, 5),
  )

  const branches = rng.int(6) + 6

  for (let i = 0; i < branches; i++) {
    const height = rng.range(1.2, 2.8)
    const spread = (i / (branches - 1)) * 2 - 1

    const branch = new THREE.Mesh(branchGeometry, material)
    branch.position.set(spread * 0.35, height / 2, rng.range(-0.15, 0.15))
    branch.scale.set(1, height, 1)
    branch.rotation.z = -spread * rng.range(0.35, 0.7)
    group.add(branch)
  }

  group.scale.setScalar(rng.range(1.2, 2.2))
  markSway(group, rng, 0.025, 0.8)
  return tagProp(group, "seaFan")
}

function createSeaPen(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, rng.pick(palette.coral), 0.05),
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  })

  const stalkHeight = rng.range(1.4, 2.4)
  const stalkGeometry = cachedGeometry(
    "sea-pen-stalk",
    () => new THREE.CylinderGeometry(0.05, 0.09, 1, 5),
  )
  const stalk = new THREE.Mesh(stalkGeometry, material)
  stalk.scale.y = stalkHeight
  stalk.position.y = stalkHeight / 2
  group.add(stalk)

  const featherGeometry = cachedGeometry(
    "sea-pen-feather",
    () => new THREE.CylinderGeometry(0.02, 0.06, 1, 4),
  )
  const feathers = rng.int(5) + 5

  for (let i = 0; i < feathers; i++) {
    const angle = (i / feathers) * Math.PI * 2
    const length = rng.range(0.4, 1.1)

    const feather = new THREE.Mesh(featherGeometry, material)
    feather.scale.y = length
    feather.position.set(
      Math.cos(angle) * 0.18,
      stalkHeight - 0.1 + rng.range(-0.2, 0.2),
      Math.sin(angle) * 0.18,
    )
    feather.rotation.z = Math.cos(angle) * 0.8
    feather.rotation.x = Math.sin(angle) * 0.8
    group.add(feather)
  }

  const tipMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.glow, 0.05),
    emissive: palette.glow,
    emissiveIntensity: rng.range(0.2, 0.7),
    roughness: 0.5,
    flatShading: true,
  })
  const tipGeometry = cachedGeometry(
    "sea-pen-tip",
    () => new THREE.SphereGeometry(0.06, 5, 4),
  )
  const tip = new THREE.Mesh(tipGeometry, tipMaterial)
  tip.position.y = stalkHeight + 0.08
  group.add(tip)

  const scale = rng.range(1, 1.8)
  group.scale.setScalar(scale)
  markSway(group, rng, 0.03, 0.65)

  if (rng.next() < 0.45) {
    markLight(group, palette.glow, 0.45, (stalkHeight + 0.1) * scale)
  }

  return tagProp(group, "seaPen")
}

function createWhaleBone(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.bone, 0.06),
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  })

  const spineLength = rng.range(2.5, 4.5)
  const spineGeometry = cachedGeometry(
    "whale-spine",
    () => new THREE.CylinderGeometry(0.16, 0.22, 1, 5),
  )
  const spine = new THREE.Mesh(spineGeometry, material)
  spine.scale.y = spineLength
  spine.rotation.x = Math.PI / 2
  spine.position.y = 0.28
  group.add(spine)

  const ribGeometry = cachedGeometry(
    "whale-rib",
    () => new THREE.TorusGeometry(1.05, 0.09, 5, 10, Math.PI * 0.65),
  )
  const ribs = rng.int(4) + 4

  for (let i = 0; i < ribs; i++) {
    const rib = new THREE.Mesh(ribGeometry, material)
    rib.position.set(
      rng.range(-0.1, 0.1),
      0.3,
      -spineLength / 2 + (i / (ribs - 1)) * spineLength,
    )
    rib.rotation.set(0, rng.range(-0.2, 0.2), rng.range(-0.15, 0.15))
    rib.scale.setScalar(rng.range(0.55, 1))
    group.add(rib)
  }

  group.scale.setScalar(rng.range(1, 1.8))
  return tagProp(group, "whaleBone")
}

function createTubeWorm(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const tubeMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.bone, 0.05),
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  })

  const tipColor = new THREE.Color(palette.coral[0]).lerp(
    new THREE.Color(palette.glow),
    0.5,
  )
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: tipColor,
    emissive: palette.glow,
    emissiveIntensity: 0.35,
    roughness: 0.7,
    flatShading: true,
  })

  const tubeGeometry = cachedGeometry(
    "tube-worm-tube",
    () => new THREE.CylinderGeometry(0.07, 0.11, 1, 5),
  )
  const tipGeometry = cachedGeometry(
    "tube-worm-tip",
    () => new THREE.SphereGeometry(0.12, 6, 4),
  )

  const count = rng.int(6) + 7

  for (let i = 0; i < count; i++) {
    const height = rng.range(0.8, 2.6)
    const x = rng.range(-0.6, 0.6)
    const z = rng.range(-0.6, 0.6)

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial)
    tube.position.set(x, height / 2, z)
    tube.scale.y = height
    tube.rotation.set(
      rng.range(-0.1, 0.1),
      rng.range(0, Math.PI),
      rng.range(-0.1, 0.1),
    )
    group.add(tube)

    const tip = new THREE.Mesh(tipGeometry, tipMaterial)
    tip.position.set(x, height + 0.02, z)
    group.add(tip)
  }

  const scale = rng.range(1, 1.8)
  group.scale.setScalar(scale)
  markSway(group, rng, 0.015, 0.9)

  if (rng.next() < 0.35) {
    markLight(group, palette.glow, 0.5, 1.5 * scale)
  }

  return tagProp(group, "tubeWorm")
}

function createNodule(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.rock, 0.1),
    roughness: 0.95,
    metalness: 0.12,
    flatShading: true,
  })

  const geometry = cachedGeometry(
    "nodule",
    () => new THREE.DodecahedronGeometry(0.35, 0),
  )
  const count = rng.int(5) + 3

  for (let i = 0; i < count; i++) {
    const nodule = new THREE.Mesh(geometry, material)
    const scale = rng.range(0.5, 1.4)

    nodule.scale.set(scale, scale * rng.range(0.5, 0.9), scale)
    nodule.position.set(
      rng.range(-0.8, 0.8),
      0.12 * scale,
      rng.range(-0.8, 0.8),
    )
    nodule.rotation.set(
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
      rng.range(0, Math.PI),
    )
    group.add(nodule)
  }

  group.scale.setScalar(rng.range(1.2, 2.2))
  return tagProp(group, "nodule")
}

function createGlassSponge(
  rng: Rng,
  palette: BiomePropPalette,
): THREE.Object3D {
  const group = new THREE.Group()

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.sponge, 0.06),
    emissive: palette.glow,
    emissiveIntensity: rng.range(0.08, 0.25),
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: rng.range(0.35, 0.6),
    side: THREE.DoubleSide,
    flatShading: true,
  })

  const bodyGeometry = cachedGeometry(
    "glass-sponge-body",
    () => new THREE.CylinderGeometry(0.38, 0.2, 1.5, 8, 1, true),
  )
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.8
  group.add(body)

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: palette.glow,
    emissive: palette.glow,
    emissiveIntensity: 0.7,
    roughness: 0.4,
    flatShading: true,
  })
  const rimGeometry = cachedGeometry(
    "glass-sponge-rim",
    () => new THREE.TorusGeometry(0.38, 0.04, 5, 10),
  )
  const rim = new THREE.Mesh(rimGeometry, rimMaterial)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 1.55
  group.add(rim)

  const baseGeometry = cachedGeometry(
    "glass-sponge-base",
    () => new THREE.DodecahedronGeometry(0.35, 0),
  )
  const base = new THREE.Mesh(baseGeometry, bodyMaterial)
  base.position.y = 0.15
  base.scale.set(1.2, 0.5, 1.2)
  group.add(base)

  const scale = rng.range(1.1, 2)
  group.scale.setScalar(scale)
  markSway(group, rng, 0.012, 0.6)

  if (rng.next() < 0.55) {
    markLight(group, palette.glow, 0.4, 1.6 * scale)
  }

  return tagProp(group, "glassSponge")
}

function createVent(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.vent, 0.08),
    roughness: 1,
    metalness: 0.05,
    flatShading: true,
  })

  const stackHeight = rng.range(1.4, 3.2)
  const stackGeometry = cachedGeometry(
    "vent-stack",
    () => new THREE.CylinderGeometry(0.35, 0.75, 1, 7),
  )
  const stack = new THREE.Mesh(stackGeometry, rockMaterial)
  stack.scale.y = stackHeight
  stack.position.y = stackHeight / 2
  stack.rotation.y = rng.range(0, Math.PI)
  group.add(stack)

  const baseGeometry = cachedGeometry(
    "vent-base",
    () => new THREE.DodecahedronGeometry(0.9, 0),
  )
  const base = new THREE.Mesh(baseGeometry, rockMaterial)
  base.position.y = 0.25
  base.scale.set(1.4, 0.45, 1.4)
  group.add(base)

  const crustGeometry = cachedGeometry(
    "vent-crust",
    () => new THREE.DodecahedronGeometry(0.18, 0),
  )
  const crusts = rng.int(4) + 3

  for (let i = 0; i < crusts; i++) {
    const crust = new THREE.Mesh(crustGeometry, rockMaterial)
    crust.position.set(
      rng.range(-0.8, 0.8),
      rng.range(0.2, 0.8),
      rng.range(-0.8, 0.8),
    )
    crust.scale.setScalar(rng.range(0.5, 1.2))
    group.add(crust)
  }

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: palette.glow,
    transparent: true,
    opacity: 0.9,
  })
  const glowGeometry = cachedGeometry(
    "vent-glow",
    () => new THREE.TorusGeometry(0.28, 0.05, 5, 10),
  )
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  glow.rotation.x = Math.PI / 2
  glow.position.y = stackHeight + 0.03
  group.add(glow)

  const scale = rng.range(1, 1.6)
  group.scale.setScalar(scale)
  markLight(group, palette.glow, 1.3, (stackHeight + 0.15) * scale)

  return tagProp(group, "vent")
}

function createSpire(rng: Rng, palette: BiomePropPalette): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, palette.rock, 0.1),
    roughness: 1,
    metalness: 0.05,
    flatShading: true,
  })

  const geometry = cachedGeometry(
    "spire",
    () => new THREE.ConeGeometry(0.7, 1, 6),
  )
  const shards = rng.int(3) + 2

  for (let i = 0; i < shards; i++) {
    const height = rng.range(2.5, 7)
    const shard = new THREE.Mesh(geometry, material)

    shard.scale.set(rng.range(0.6, 1.3), height, rng.range(0.6, 1.3))
    shard.position.set(rng.range(-0.8, 0.8), height / 2, rng.range(-0.8, 0.8))
    shard.rotation.set(
      rng.range(-0.18, 0.18),
      rng.range(0, Math.PI),
      rng.range(-0.18, 0.18),
    )
    group.add(shard)
  }

  group.scale.setScalar(rng.range(1, 1.8))
  return tagProp(group, "spire")
}

const PROP_FACTORIES: Record<string, PropFactory> = {
  rock: createRock,
  coral: createCoral,
  shell: createShell,
  seaweed: createSeaweed,
  sponge: createSponge,
  reef: createReefMound,
  kelp: createKelp,
  seaFan: createSeaFan,
  seaPen: createSeaPen,
  whaleBone: createWhaleBone,
  tubeWorm: createTubeWorm,
  nodule: createNodule,
  glassSponge: createGlassSponge,
  vent: createVent,
  spire: createSpire,
}

// Cada bioma usa una mezcla propia: los props profundos ya no reutilizan
// coral, conchas ni arrecifes de aguas someras.
const BIOME_PROPS: Record<BiomeKey, BiomePropConfig> = {
  epipelagic_upper: {
    count: 240,
    factories: [
      PROP_FACTORIES.coral,
      PROP_FACTORIES.kelp,
      PROP_FACTORIES.seaFan,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.seaweed,
      PROP_FACTORIES.reef,
      PROP_FACTORIES.rock,
    ],
  },
  pelagic_mid: {
    count: 220,
    factories: [
      PROP_FACTORIES.kelp,
      PROP_FACTORIES.seaFan,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.seaweed,
      PROP_FACTORIES.rock,
    ],
  },
  subphotic: {
    count: 210,
    factories: [
      PROP_FACTORIES.seaFan,
      PROP_FACTORIES.kelp,
      PROP_FACTORIES.sponge,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.rock,
    ],
  },
  mesopelagic_upper: {
    count: 190,
    factories: [
      PROP_FACTORIES.seaPen,
      PROP_FACTORIES.glassSponge,
      PROP_FACTORIES.sponge,
      PROP_FACTORIES.rock,
    ],
  },
  mesopelagic_deep: {
    count: 190,
    factories: [
      PROP_FACTORIES.seaPen,
      PROP_FACTORIES.glassSponge,
      PROP_FACTORIES.sponge,
      PROP_FACTORIES.rock,
    ],
  },
  bathypelagic_upper: {
    count: 180,
    factories: [
      PROP_FACTORIES.tubeWorm,
      PROP_FACTORIES.whaleBone,
      PROP_FACTORIES.sponge,
      PROP_FACTORIES.rock,
    ],
  },
  bathypelagic_deep: {
    count: 180,
    factories: [
      PROP_FACTORIES.tubeWorm,
      PROP_FACTORIES.whaleBone,
      PROP_FACTORIES.glassSponge,
      PROP_FACTORIES.rock,
    ],
  },
  abyssopelagic: {
    count: 190,
    factories: [
      PROP_FACTORIES.nodule,
      PROP_FACTORIES.glassSponge,
      PROP_FACTORIES.seaPen,
      PROP_FACTORIES.rock,
    ],
  },
  hadopelagic: {
    count: 210,
    factories: [
      PROP_FACTORIES.nodule,
      PROP_FACTORIES.vent,
      PROP_FACTORIES.tubeWorm,
      PROP_FACTORIES.spire,
      PROP_FACTORIES.rock,
    ],
  },
  deepSea: {
    count: 200,
    factories: [
      PROP_FACTORIES.vent,
      PROP_FACTORIES.tubeWorm,
      PROP_FACTORIES.spire,
      PROP_FACTORIES.nodule,
      PROP_FACTORIES.rock,
    ],
  },
}

export class BiomeProps {
  private group = new THREE.Group()
  private scene: THREE.Scene
  private lightAnchors: BiomeLightAnchor[] = []
  private elapsed = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.group)
  }

  public generate(
    biomeKey: BiomeKey,
    rng: Rng,
    getFloorHeight: (x: number, z: number) => number,
  ): void {
    this.clear()

    const config = BIOME_PROPS[biomeKey]
    const palette = BIOME_PROP_PALETTES[biomeKey]

    for (let i = 0; i < config.count; i++) {
      const factory = rng.pick(config.factories)
      const prop = factory(rng, palette)

      const x = rng.range(-PROP_HALF_SIZE, PROP_HALF_SIZE)
      const z = rng.range(-PROP_HALF_SIZE, PROP_HALF_SIZE)

      const isTallProp = prop instanceof THREE.Group && prop.children.length > 2

      const yOffset = isTallProp ? 0.2 : 0.08

      prop.position.set(x, getFloorHeight(x, z) + yOffset, z)

      prop.rotation.y = rng.range(0, Math.PI * 2)

      if (prop.userData.sway) {
        prop.userData.swayBase = {
          x: prop.rotation.x,
          z: prop.rotation.z,
        } satisfies SwayBase
      }

      this.group.add(prop)

      const light = prop.userData.light as
        { color: number; intensity: number; offset?: THREE.Vector3 } | undefined

      if (light) {
        const position = prop.position.clone()
        if (light.offset) position.add(light.offset)

        this.lightAnchors.push({
          position,
          color: light.color,
          intensity: light.intensity,
        })
      }
    }
  }

  /** Anima el balanceo de la flora y de los animales sésiles. */
  public update(deltaTime: number): void {
    this.elapsed += deltaTime

    for (const prop of this.group.children) {
      const sway = prop.userData.sway as SwayConfig | undefined
      if (!sway) continue

      const base = prop.userData.swayBase as SwayBase | undefined
      if (!base) continue

      const wave = Math.sin(this.elapsed * sway.speed + sway.phase)

      prop.rotation.z = base.z + wave * sway.amplitude
      prop.rotation.x =
        base.x +
        Math.cos(this.elapsed * sway.speed * 0.73 + sway.phase) *
          sway.amplitude *
          0.3
    }
  }

  /** Anclas de luz generadas por props bioluminiscentes (fuentes, esponjas, plumas). */
  public getLightAnchors(): readonly BiomeLightAnchor[] {
    return this.lightAnchors
  }

  /** Limpia los props: conserva geometrías compartidas y libera solo los materiales únicos. */
  public clear(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      const material = object.material

      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose())
      } else {
        material.dispose()
      }
    })

    this.group.clear()
    this.lightAnchors = []
    this.elapsed = 0
  }
}
