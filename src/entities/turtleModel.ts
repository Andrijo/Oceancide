import * as THREE from "three"

/** Colores del modelo de tortuga (caparazón, piel, escudos y borde). */
export interface TurtlePalette {
  shell: number
  skin: number
  plate: number
  rim: number
}

/** La tortuga del jugador. */
export const TURTLE_PALETTE: TurtlePalette = {
  shell: 0x0a4d20,
  skin: 0x61b112,
  plate: 0x0f6329,
  rim: 0xf0c053,
}

export interface TurtleModel {
  model: THREE.Group
  body: THREE.Group
  flippers: {
    leftFront: THREE.Mesh
    rightFront: THREE.Mesh
    leftBack: THREE.Mesh
    rightBack: THREE.Mesh
  }
  tail: THREE.Mesh
  materials: {
    shell: THREE.MeshStandardMaterial
    skin: THREE.MeshStandardMaterial
    plate: THREE.MeshStandardMaterial
    rim: THREE.MeshStandardMaterial
  }
}

/**
 * Modelo low-poly de tortuga marina: caparazón facetado con escudos, borde,
 * cabeza, ojos, cuatro aletas y cola. Lo usan la tortuga del jugador y las
 * tortugas atrapadas en redes (con otra paleta).
 *
 * Orden de los hijos: `model > body > [caparazón, ...]` (los tests lo usan).
 */
export function buildTurtleModel(
  palette: TurtlePalette = TURTLE_PALETTE,
): TurtleModel {
  const model = new THREE.Group()
  const body = new THREE.Group()
  model.add(body)

  const shellMaterial = new THREE.MeshStandardMaterial({
    color: palette.shell,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  })

  const shellRimMaterial = new THREE.MeshStandardMaterial({
    color: palette.rim,
    roughness: 0.75,
    flatShading: true,
  })

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: palette.skin,
    roughness: 0.7,
    flatShading: true,
  })

  const shell = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    shellMaterial,
  )
  shell.scale.set(1, 0.55, 1.5)
  body.add(shell)

  const plateMaterial = new THREE.MeshStandardMaterial({
    color: palette.plate,
    roughness: 0.65,
    metalness: 0.08,
    flatShading: true,
  })

  const platePositions: Array<[number, number, number, number]> = [
    [0, 0.52, 0.55, 0],
    [0, 0.58, 0, 0],
    [0, 0.52, -0.55, 0],
    [-0.42, 0.42, 0.28, 0.5],
    [0.42, 0.42, 0.28, -0.5],
    [-0.42, 0.42, -0.28, -0.5],
    [0.42, 0.42, -0.28, 0.5],
  ]

  const plateGeometry = new THREE.DodecahedronGeometry(0.26, 0)
  for (const [x, y, z, rotation] of platePositions) {
    const plate = new THREE.Mesh(plateGeometry, plateMaterial)
    plate.position.set(x, y, z)
    plate.rotation.y = rotation
    plate.scale.set(1.1, 0.45, 1.25)
    body.add(plate)
  }

  const shellRim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 0.82, 0.22, 10),
    shellRimMaterial,
  )
  shellRim.position.y = -0.16
  shellRim.scale.set(1, 1, 1.45)
  body.add(shellRim)

  const head = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.36, 0),
    skinMaterial,
  )
  head.position.set(0, 0.18, 1.22)
  head.scale.set(0.9, 0.85, 1.1)
  body.add(head)

  const eyeGeometry = new THREE.SphereGeometry(0.09, 8, 6)
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x101010,
    roughness: 0.25,
  })

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    eye.position.set(side * 0.18, 0.28, 1.38)
    body.add(eye)
  }

  const frontFlipperGeometry = new THREE.BoxGeometry(0.85, 0.12, 0.42)

  const leftFrontFlipper = new THREE.Mesh(frontFlipperGeometry, skinMaterial)
  leftFrontFlipper.position.set(-0.85, 0, 0.5)
  leftFrontFlipper.rotation.z = 0.3
  body.add(leftFrontFlipper)

  const rightFrontFlipper = new THREE.Mesh(frontFlipperGeometry, skinMaterial)
  rightFrontFlipper.position.set(0.85, 0, 0.5)
  rightFrontFlipper.rotation.z = -0.3
  body.add(rightFrontFlipper)

  const backFlipperGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.3)

  const leftBackFlipper = new THREE.Mesh(backFlipperGeometry, skinMaterial)
  leftBackFlipper.position.set(-0.6, -0.15, -0.8)
  body.add(leftBackFlipper)

  const rightBackFlipper = new THREE.Mesh(backFlipperGeometry, skinMaterial)
  rightBackFlipper.position.set(0.6, -0.15, -0.8)
  body.add(rightBackFlipper)

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.6, 6),
    skinMaterial,
  )
  tail.position.set(0, 0, -1.42)
  tail.rotation.x = -Math.PI / 2
  body.add(tail)

  return {
    model,
    body,
    flippers: {
      leftFront: leftFrontFlipper,
      rightFront: rightFrontFlipper,
      leftBack: leftBackFlipper,
      rightBack: rightBackFlipper,
    },
    tail,
    materials: {
      shell: shellMaterial,
      skin: skinMaterial,
      plate: plateMaterial,
      rim: shellRimMaterial,
    },
  }
}
