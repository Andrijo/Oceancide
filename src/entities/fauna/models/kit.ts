import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { addFresnelRim } from "../../fresnelRim"

/**
 * Herramientas para montar la fauna con el mismo estilo que la tortuga:
 * low-poly facetado (`flatShading`), piezas anatómicas propias y colores por
 * cara en vez de texturas.
 *
 * Para no disparar las llamadas de dibujo, las piezas que no se mueven por sí
 * solas se fusionan: todas las de un mismo padre y material acaban en una
 * sola malla (`ModelKit.part` + `ModelKit.build`). Lo que se anima va en
 * pivotes (`ModelKit.pivot`), y sus piezas se fusionan dentro del pivote.
 */

export type Vec3 = [number, number, number]

export interface Place {
  at?: Vec3
  rot?: Vec3
  /** Alternativa a `rot`: orientación ya calculada. */
  quat?: THREE.Quaternion
  scale?: Vec3 | number
}

/**
 * Color de una cara a partir de su centro (`c`) y su normal (`n`), en las
 * coordenadas propias de la geometría (antes de colocarla). En un casco
 * (`hull`) el centro va en la esfera unidad: `c.y = 1` es el lomo, `-1` el
 * vientre, `c.z = 1` el hocico y `-1` la cola.
 */
export type Paint = (c: THREE.Vector3, n: THREE.Vector3) => number

const matrix = new THREE.Matrix4()
const quaternion = new THREE.Quaternion()
const euler = new THREE.Euler()
const position = new THREE.Vector3()
const scaleVector = new THREE.Vector3()
const colorA = new THREE.Color()
const colorB = new THREE.Color()
const UP = new THREE.Vector3(0, 1, 0)

export const smoothstep = THREE.MathUtils.smoothstep

export function lerpHex(a: number, b: number, t: number): number {
  return colorA
    .setHex(a)
    .lerp(colorB.setHex(b), THREE.MathUtils.clamp(t, 0, 1))
    .getHex()
}

/** Ruido fijo por posición (0..1): manchas y moteado sin depender del rng. */
export function hash3(c: THREE.Vector3, seed = 0): number {
  const s =
    Math.sin(c.x * 127.1 + c.y * 311.7 + c.z * 74.7 + seed * 19.19) * 43758.5453
  return s - Math.floor(s)
}

/** Lomo oscuro y vientre claro (contrasombreado), con una franja intermedia. */
export function countershade(
  back: number,
  belly: number,
  line = 0,
  soft = 0.25,
): Paint {
  return (c) => lerpHex(belly, back, smoothstep(c.y, line - soft, line + soft))
}

/** Arriba un color y abajo otro, según hacia dónde mire la cara (alas, aletas). */
export function topBottom(top: number, bottom: number): Paint {
  return (_c, n) => (n.z >= -0.2 ? top : bottom)
}

export function placeMatrix(place: Place = {}): THREE.Matrix4 {
  const [x, y, z] = place.at ?? [0, 0, 0]
  position.set(x, y, z)
  if (place.quat) quaternion.copy(place.quat)
  else {
    const [rx, ry, rz] = place.rot ?? [0, 0, 0]
    quaternion.setFromEuler(euler.set(rx, ry, rz))
  }
  const s = place.scale ?? 1
  if (typeof s === "number") scaleVector.setScalar(s)
  else scaleVector.set(s[0], s[1], s[2])
  return matrix.compose(position, quaternion, scaleVector)
}

/** Orientación que lleva el eje +Y de una pieza hacia `dir`. */
export function aim(dir: Vec3): THREE.Quaternion {
  const d = new THREE.Vector3(...dir).normalize()
  return new THREE.Quaternion().setFromUnitVectors(UP, d)
}

/** Geometría sin índices ni UV (lista para pintar por caras y fusionar). */
function prepare(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  g.deleteAttribute("uv")
  if (!g.getAttribute("normal")) g.computeVertexNormals()
  return g
}

/** Pinta cada triángulo de un color (la geometría no debe tener índices). */
export function paintFaces(
  geometry: THREE.BufferGeometry,
  paint: Paint | number,
): void {
  const pos = geometry.getAttribute("position")
  const colors = new Float32Array(pos.count * 3)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const centre = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (let i = 0; i + 2 < pos.count; i += 3) {
    let hex: number
    if (typeof paint === "number") hex = paint
    else {
      a.fromBufferAttribute(pos, i)
      b.fromBufferAttribute(pos, i + 1)
      c.fromBufferAttribute(pos, i + 2)
      centre
        .copy(a)
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3)
      normal.subVectors(c, b).cross(a.sub(b)).normalize()
      hex = paint(centre, normal)
    }
    colorA.setHex(hex)
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = colorA.r
      colors[(i + k) * 3 + 1] = colorA.g
      colors[(i + k) * 3 + 2] = colorA.b
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
}

/** Invierte el orden de los vértices de cada triángulo (sin índices). */
function flipWinding(geometry: THREE.BufferGeometry): void {
  for (const attribute of Object.values(geometry.attributes)) {
    const array = attribute.array
    const size = attribute.itemSize
    for (let i = 0; i + 2 < attribute.count; i += 3) {
      for (let k = 0; k < size; k++) {
        const b = (i + 1) * size + k
        const c = (i + 2) * size + k
        const tmp = array[b]
        array[b] = array[c]
        array[c] = tmp
      }
    }
    attribute.needsUpdate = true
  }
}

export interface HullOptions {
  /** Subdivisión del icosaedro: 1 para casi todo, 2 para los grandes. */
  detail?: number
  /** Cuánto adelgaza hacia la cola (-Z): 0 elipsoide, 1 acaba en punta. */
  taper?: number
  /** Lo mismo hacia el hocico (+Z). */
  nose?: number
  /** Aplana el vientre por debajo de esta altura (en la esfera unidad). */
  flat?: number
  paint?: Paint | number
}

/** Deforma un punto de la esfera unidad igual que `hull`. */
function deform(
  v: THREE.Vector3,
  radii: Vec3,
  options: HullOptions,
  out: THREE.Vector3,
): THREE.Vector3 {
  let s = 1
  if (options.taper && v.z < 0) s *= 1 - options.taper * (-v.z) ** 1.4
  if (options.nose && v.z > 0) s *= 1 - options.nose * v.z ** 1.6
  let y = v.y * s
  if (options.flat !== undefined && y < -options.flat) {
    y = -options.flat + (y + options.flat) * 0.25
  }
  return out.set(v.x * s * radii[0], y * radii[1], v.z * radii[2])
}

/**
 * Cuerpo facetado: un icosaedro deformado a lo largo del eje Z, con radios
 * `[ancho, alto, largo]`. Se pinta antes de deformarlo, así las coordenadas
 * de `paint` son siempre las de la esfera unidad.
 */
export function hull(
  radii: Vec3,
  options: HullOptions = {},
): THREE.BufferGeometry {
  const g = prepare(new THREE.IcosahedronGeometry(1, options.detail ?? 1))
  if (options.paint !== undefined) paintFaces(g, options.paint)
  const pos = g.getAttribute("position")
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    deform(v.fromBufferAttribute(pos, i), radii, options, v)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Punto de la superficie de un casco en la dirección `dir` (no hace falta
 * normalizarla): sirve para pegar ojos, púas o fotóforos a la piel.
 */
export function hullPoint(
  radii: Vec3,
  options: HullOptions,
  dir: Vec3,
  lift = 0,
): Vec3 {
  const v = new THREE.Vector3(...dir).normalize()
  const p = deform(v, radii, options, new THREE.Vector3())
  p.addScaledVector(v, lift)
  return [p.x, p.y, p.z]
}

/**
 * Aleta plana con grosor, a partir de su silueta en el plano XY. Se extruye
 * en Z y queda centrada. Para colocarla:
 * - vertical a lo largo del cuerpo (dorsal, caudal): `rot: [0, PI/2, 0]`
 *   (X de la silueta → hacia atrás, Y → arriba);
 * - horizontal (pectoral, ala, aleta de ballena): `rot: [-PI/2, 0, 0]`
 *   (X → hacia fuera, Y → hacia atrás; `scale.x = -1` para el lado izquierdo).
 */
export function fin(
  outline: Array<[number, number]>,
  thickness = 0.035,
  paint?: Paint | number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    shape.lineTo(outline[i][0], outline[i][1])
  }
  shape.closePath()
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 3,
  })
  extruded.translate(0, 0, -thickness / 2)
  const g = prepare(extruded)
  extruded.dispose()
  if (paint !== undefined) paintFaces(g, paint)
  return g
}

/**
 * Tubo que va de `from` a `to` (patas, brazos, tallos). Los radios son los de
 * cada extremo.
 */
export function limb(
  from: Vec3,
  to: Vec3,
  r0: number,
  r1: number,
  segments = 5,
): { geometry: THREE.BufferGeometry; place: Place } {
  const dir: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const length = Math.hypot(...dir)
  // CylinderGeometry: radio de arriba (+Y) y de abajo; +Y apunta a `to`.
  const geometry = new THREE.CylinderGeometry(r1, r0, length, segments)
  return {
    geometry,
    place: {
      at: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      quat: aim(dir),
    },
  }
}

/** Tubo que cuelga del origen hacia -Y (tentáculos, brazos, colas en cadena). */
export function strand(
  length: number,
  r0: number,
  r1: number,
  segments = 6,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r0, r1, length, segments)
  g.translate(0, -length / 2, 0)
  return g
}

/** Puntos repartidos de forma uniforme sobre la esfera (espiral de Fibonacci). */
export function fibonacciSphere(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = i * 2.39996
    points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  return points
}

export interface MaterialOptions {
  roughness?: number
  metalness?: number
  /** Color emisivo (por defecto, el propio color). */
  emissive?: number
  /** Intensidad del emisivo: lo justo para leerse en el agua oscura. */
  glow?: number
  /** Borde fresnel `[fuerza, potencia]`. */
  rim?: [number, number]
  doubleSide?: boolean
}

export interface EyeOptions {
  /** Posición del ojo derecho; el izquierdo es su reflejo en X. */
  at: Vec3
  size: number
  /** Anillo de color alrededor de la pupila. */
  iris?: number
  /** Pupila alargada en horizontal (pulpo). */
  slit?: boolean
  /** Brillo del iris (ojos tóxicos de los megajefes). */
  irisGlow?: number
}

/**
 * Taller de un modelo: crea materiales y piezas, junta las estáticas y libera
 * todo al final.
 */
export class ModelKit {
  private readonly buckets = new Map<
    THREE.Object3D,
    Map<THREE.Material, THREE.BufferGeometry[]>
  >()
  private readonly sources = new Set<THREE.BufferGeometry>()
  private eyeMaterial: THREE.MeshStandardMaterial | null = null
  private readonly irisMaterials = new Map<number, THREE.MeshStandardMaterial>()

  /** Material facetado sin colores por vértice. */
  public material(
    color: number,
    options: MaterialOptions = {},
  ): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.7,
      metalness: options.metalness ?? 0.05,
      emissive: options.emissive ?? color,
      emissiveIntensity: options.glow ?? 0,
      flatShading: true,
      side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    })
    if (options.rim) addFresnelRim(material, options.rim[0], options.rim[1])
    return material
  }

  /**
   * Material de la piel: blanco con los colores pintados en cada cara. Lleva
   * borde fresnel y un poco de emisivo para que se distinga en la oscuridad.
   */
  public skin(
    emissive: number,
    options: MaterialOptions = {},
  ): THREE.MeshStandardMaterial {
    const material = this.material(0xffffff, {
      roughness: 0.6,
      metalness: 0.08,
      emissive,
      glow: 0.16,
      rim: [0.45, 2.5],
      ...options,
    })
    material.vertexColors = true
    return material
  }

  /** Grupo que se anima. Guarda su rotación de reposo en `userData.base`. */
  public pivot(parent: THREE.Object3D, at?: Vec3, rot?: Vec3): THREE.Group {
    const group = new THREE.Group()
    if (at) group.position.set(...at)
    if (rot) group.rotation.set(...rot)
    parent.add(group)
    return group
  }

  /**
   * Pieza estática: se fusiona con las demás del mismo padre y material al
   * llamar a `build`. Con un material de colores por vértice, `paint` da el
   * color si la geometría aún no lo tiene.
   */
  public part(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    place?: Place,
    paint?: Paint | number,
  ): void {
    this.sources.add(geometry)
    const g = prepare(geometry)
    const usesColors = (material as THREE.MeshStandardMaterial).vertexColors
    if (usesColors && paint !== undefined) paintFaces(g, paint)
    else if (usesColors && !g.getAttribute("color")) paintFaces(g, 0xffffff)
    else if (!usesColors) g.deleteAttribute("color")
    const m = placeMatrix(place)
    g.applyMatrix4(m)
    // Un espejo (escala negativa) invierte el orden de los vértices: sin
    // corregirlo, la cara de fuera se descarta y se ve la de dentro.
    if (m.determinant() < 0) flipWinding(g)

    let byMaterial = this.buckets.get(parent)
    if (!byMaterial) {
      byMaterial = new Map()
      this.buckets.set(parent, byMaterial)
    }
    const list = byMaterial.get(material) ?? []
    list.push(g)
    byMaterial.set(material, list)
  }

  /** Un par de ojos brillantes como los de la tortuga, con iris opcional. */
  public eyes(parent: THREE.Object3D, options: EyeOptions): void {
    const { at, size } = options
    // Lisos y brillantes, como los de la tortuga (lo demás va facetado).
    this.eyeMaterial ??= this.material(0x101010, {
      roughness: 0.25,
      metalness: 0,
    })
    this.eyeMaterial.flatShading = false
    const ball = new THREE.SphereGeometry(1, 8, 6)
    for (const side of [-1, 1]) {
      const x = at[0] * side
      if (options.iris !== undefined) {
        let iris = this.irisMaterials.get(options.iris)
        if (!iris) {
          iris = this.material(options.iris, {
            roughness: 0.35,
            glow: options.irisGlow ?? 0.25,
          })
          iris.flatShading = false
          this.irisMaterials.set(options.iris, iris)
        }
        this.part(parent, ball, iris, {
          at: [x, at[1], at[2]],
          scale: size,
        })
        const pupil = options.slit ? [0.5, 0.32, 0.75] : [0.5, 0.62, 0.62]
        this.part(parent, ball, this.eyeMaterial, {
          at: [x + side * size * 0.62, at[1], at[2]],
          scale: [size * pupil[0], size * pupil[1], size * pupil[2]],
        })
      } else {
        this.part(parent, ball, this.eyeMaterial, {
          at: [x, at[1], at[2]],
          scale: size,
        })
      }
    }
  }

  /** Funde las piezas estáticas: una malla por padre y material. */
  public build(): void {
    for (const [parent, byMaterial] of this.buckets) {
      for (const [material, list] of byMaterial) {
        const geometry =
          list.length === 1 ? list[0] : mergeGeometries(list, false)
        if (!geometry) throw new Error("[ModelKit] no se pudo fusionar")
        if (list.length > 1) for (const g of list) g.dispose()
        geometry.computeBoundingSphere()
        parent.add(new THREE.Mesh(geometry, material))
      }
    }
    this.buckets.clear()
    for (const g of this.sources) g.dispose()
    this.sources.clear()
  }
}

/** Libera las geometrías y materiales de todo lo que cuelga de `root`. */
export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of list) materials.add(m)
  })
  for (const g of geometries) g.dispose()
  for (const m of materials) m.dispose()
}
