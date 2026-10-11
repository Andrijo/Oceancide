// src/BiomeProps.ts
import * as THREE from "three"
import type { BiomeKey } from "./types"
import type { Rng } from "./rng"

type PropFactory = (rng: Rng) => THREE.Object3D

type BiomePropConfig = {
  count: number
  factories: PropFactory[]
}

const PROP_HALF_SIZE = 100

function randomColor(rng: Rng, base: number, variation = 0.08): THREE.Color {
  const color = new THREE.Color(base)

  color.offsetHSL(
    rng.range(-variation / 2, variation / 2),
    rng.range(-variation / 2, variation / 2),
    rng.range(-variation / 2, variation / 2),
  )

  return color
}

function createRock(rng: Rng): THREE.Object3D {
  const geometry = new THREE.DodecahedronGeometry(1 + rng.range(0, 2), 0)

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, 0x3d4a54, 0.08),
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

  return rock
}

function createCoral(rng: Rng): THREE.Object3D {
  const group = new THREE.Group()

  const colors = [0xd96a7f, 0xd08a4a, 0x7f6bb0, 0x3fa79b, 0xc9a55a]

  const color = randomColor(rng, colors[rng.int(colors.length)], 0.06)

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  })

  const branches = rng.int(5) + 5

  for (let i = 0; i < branches; i++) {
    const height = rng.range(0.8, 2.3)

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.16, height, 5),
      material,
    )

    branch.position.set(rng.range(-0.4, 0.4), height / 2, rng.range(-0.4, 0.4))

    branch.rotation.set(
      rng.range(-0.3, 0.3),
      rng.range(0, Math.PI),
      rng.range(-0.3, 0.3),
    )

    group.add(branch)
  }

  group.scale.setScalar(rng.range(1.5, 2.9))
  return group
}

function createShell(rng: Rng): THREE.Object3D {
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: randomColor(rng, 0xcbb794, 0.08),
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
  return group
}

function createSeaweed(rng: Rng): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, 0x2c6b44, 0.08),
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })

  const blades = rng.int(5) + 4

  for (let i = 0; i < blades; i++) {
    const height = rng.range(1.6, 4.6)

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, height, 0.04),
      material,
    )

    blade.position.set(
      rng.range(-0.35, 0.35),
      height / 2,
      rng.range(-0.35, 0.35),
    )

    blade.rotation.z = rng.range(-0.11, 0.11)
    group.add(blade)
  }

  group.scale.setScalar(rng.range(1.2, 2.2))
  return group
}

function createSponge(rng: Rng): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, 0x7a5f8f, 0.08),
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  })

  const body = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rng.range(0.55, 0.95), 0),
    material,
  )

  body.scale.set(1, 1.25, 1)
  body.position.y = 0.6
  group.add(body)

  const opening = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 0.35, 7),
    material,
  )

  opening.position.y = 1.15
  group.add(opening)

  group.scale.setScalar(rng.range(1.2, 2.2))
  return group
}

function createReefMound(rng: Rng): THREE.Object3D {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: randomColor(rng, 0x5d6b60, 0.07),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  })

  const mound = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rng.range(1.4, 2.4), 0),
    material,
  )

  mound.scale.set(1.3, 0.65, 1.3)
  mound.position.y = 0.35
  group.add(mound)

  const coralColors = [0xc06a7c, 0xb98a4d, 0x6f5f9c, 0x3d8d84]

  const coralMaterial = new THREE.MeshStandardMaterial({
    color: randomColor(rng, coralColors[rng.int(coralColors.length)], 0.06),
    roughness: 0.9,
    flatShading: true,
  })

  const corals = rng.int(4) + 3

  for (let i = 0; i < corals; i++) {
    const coral = new THREE.Mesh(
      new THREE.ConeGeometry(rng.range(0.18, 0.3), rng.range(0.7, 1.5), 5),
      coralMaterial,
    )

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
  return group
}

const PROP_FACTORIES: Record<string, PropFactory> = {
  rock: createRock,
  coral: createCoral,
  shell: createShell,
  seaweed: createSeaweed,
  sponge: createSponge,
  reef: createReefMound,
}

const BIOME_PROPS: Record<BiomeKey, BiomePropConfig> = {
  epipelagic_upper: {
    count: 240,
    factories: [
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.seaweed,
      PROP_FACTORIES.rock,
      PROP_FACTORIES.reef,
    ],
  },

  pelagic_mid: {
    count: 210,
    factories: [
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.rock,
      PROP_FACTORIES.seaweed,
      PROP_FACTORIES.reef,
    ],
  },

  subphotic: {
    count: 210,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.seaweed,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  mesopelagic_upper: {
    count: 190,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  mesopelagic_deep: {
    count: 190,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  bathypelagic_upper: {
    count: 180,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  bathypelagic_deep: {
    count: 180,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  abyssopelagic: {
    count: 190,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  hadopelagic: {
    count: 210,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
    ],
  },

  deepSea: {
    count: 200,
    factories: [
      PROP_FACTORIES.rock,
      PROP_FACTORIES.coral,
      PROP_FACTORIES.shell,
      PROP_FACTORIES.sponge,
      PROP_FACTORIES.reef,
    ],
  },
}

export class BiomeProps {
  private group = new THREE.Group()
  private scene: THREE.Scene

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

    for (let i = 0; i < config.count; i++) {
      const factory = rng.pick(config.factories)
      const prop = factory(rng)

      const x = rng.range(-PROP_HALF_SIZE, PROP_HALF_SIZE)
      const z = rng.range(-PROP_HALF_SIZE, PROP_HALF_SIZE)

      const isTallProp = prop instanceof THREE.Group && prop.children.length > 2

      const yOffset = isTallProp ? 0.2 : 0.08

      prop.position.set(x, getFloorHeight(x, z) + yOffset, z)

      prop.rotation.y = rng.range(0, Math.PI * 2)

      this.group.add(prop)
    }
  }

  public clear(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      object.geometry.dispose()

      const material = object.material

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose())
      } else {
        material.dispose()
      }
    })

    this.group.clear()
  }
}
