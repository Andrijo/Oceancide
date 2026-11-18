import * as THREE from "three"
import type { Rng } from "@core/rng"
import type {
  BossKind,
  BossStatus,
  Creature,
  CreatureContext,
  CreatureEffects,
  HostileKind,
} from "../Creature"
import { CREATURE_NAMES } from "../Creature"
import { addFresnelRim } from "../fresnelRim"
import { edgeAvoidance, turnToward } from "../steering"

export type BossAttack = "shockwave" | "charge" | "spawn"

export interface BossSpec {
  variant: "kraken" | "shark" | "serpent"
  color: number
  accent: number
  /** Fugas que hay que limpiar de su cuerpo. */
  nodes: number
  speed: number
  attacks: BossAttack[]
  minion: HostileKind
  /** Segundos entre ataques en la primera fase. */
  interval: number
}

export const BOSSES: Record<BossKind, BossSpec> = {
  netKraken: {
    variant: "kraken",
    color: 0x6d3b52,
    accent: 0x9e5a6e,
    nodes: 5,
    speed: 2.4,
    attacks: ["shockwave", "spawn"],
    minion: "jellyfish",
    interval: 6.5,
  },
  scrapShark: {
    variant: "shark",
    color: 0x5d6670,
    accent: 0xa0522d,
    nodes: 5,
    speed: 3.6,
    attacks: ["charge", "shockwave", "charge"],
    minion: "barracuda",
    interval: 5.5,
  },
  leviathan: {
    variant: "serpent",
    color: 0x2d3b2f,
    accent: 0x7a9a3a,
    nodes: 7,
    speed: 3,
    attacks: ["shockwave", "charge", "spawn"],
    minion: "eel",
    interval: 5,
  },
}

export const BOSS_NODE_RADIUS = 1.9
export const BOSS_NODE_ECO = 20
export const BOSS_DEFEAT_ECO = 150
const NODE_HEAL = 6
const DEFEAT_HEAL = 30
const BODY_TOXICITY = 16
const CHARGE_TOXICITY = 22
const BODY_COOLDOWN = 2
const TELEGRAPH = 1.1
const WAVE_SPEED = 11
const WAVE_MAX = 26
const WAVE_WIDTH = 1.4
const WAVE_HEIGHT = 3
const WAVE_TOXICITY = 14
const CHARGE_SPEED = 16
const CHARGE_TIME = 1.4
const MAX_MINIONS = 6
const NOTICE_RADIUS = 38
const EDGE_MARGIN = 14
const SERPENT_SEGMENTS = 16
const SERPENT_SPACING = 1.5

type Phase = "roam" | "telegraph" | "wave" | "charge"

const scratch = new THREE.Vector3()
const nodeWorld = new THREE.Vector3()

interface LeakNode {
  mesh: THREE.Mesh
  cleaned: boolean
}

/**
 * Megajefe de los biomas profundos: una criatura enorme contaminada con fugas
 * brillantes repartidas por el cuerpo. Tocar una fuga la limpia (da Eco y baja
 * la toxicidad); tocar el cuerpo intoxica. Cada tercio de fugas limpias pasa
 * de fase y ataca más a menudo: ondas de choque que hay que saltar (cambiar de
 * profundidad) o atravesar con dash, embestidas y crías. Con todas las fugas
 * limpias queda purificado y se marcha.
 */
export class Megaboss implements Creature {
  public readonly kind: BossKind
  public readonly mesh = new THREE.Group()

  private readonly spec: BossSpec
  private readonly root = new THREE.Group()
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly accentMaterial: THREE.MeshStandardMaterial
  private readonly nodeMaterial: THREE.MeshStandardMaterial
  private readonly cleanMaterial: THREE.MeshStandardMaterial
  private readonly nodes: LeakNode[] = []
  /** Centros del cuerpo que hacen daño al tocarlos, y su radio. */
  private readonly cores: { object: THREE.Object3D; radius: number }[] = []
  private readonly tentacles: THREE.Object3D[] = []
  private readonly segments: THREE.Object3D[] = []
  private readonly trail: THREE.Vector3[] = []
  private readonly wave: THREE.Mesh
  private readonly waveCenter = new THREE.Vector3()
  private readonly chargeDirection = new THREE.Vector3()

  private readonly phaseOffset: number
  private heading: number
  private state: Phase = "roam"
  private stateTimer = 0
  private attackTimer: number
  private attackIndex = 0
  private pendingAttack: BossAttack = "shockwave"
  private waveRadius = 0
  private waveHit = false
  private bodyCooldown = 0
  private minions = 0
  private noticed = false
  private defeated = false
  private readonly status: BossStatus

  constructor(kind: BossKind, position: THREE.Vector3, rng: Rng) {
    this.kind = kind
    this.spec = BOSSES[kind]
    this.phaseOffset = rng.range(0, Math.PI * 2)
    this.heading = rng.range(0, Math.PI * 2)
    this.attackTimer = this.spec.interval
    this.status = { kind, cleaned: 0, total: this.spec.nodes, defeated: false }

    this.mesh.name = kind
    this.mesh.userData.kind = kind
    this.mesh.position.copy(position)
    this.mesh.add(this.root)

    this.bodyMaterial = this.mat(
      new THREE.MeshStandardMaterial({
        color: this.spec.color,
        roughness: 0.6,
        metalness: 0.25,
        emissive: 0x4a1f3a,
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
    )
    addFresnelRim(this.bodyMaterial, 0.7, 2)
    this.accentMaterial = this.mat(
      new THREE.MeshStandardMaterial({
        color: this.spec.accent,
        roughness: 0.7,
        metalness: 0.3,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    )
    this.nodeMaterial = this.mat(
      new THREE.MeshStandardMaterial({
        color: 0xb6ff3a,
        emissive: 0x8cff1a,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    )
    this.cleanMaterial = this.mat(
      new THREE.MeshStandardMaterial({
        color: 0x9fe6ff,
        emissive: 0x4fc3f7,
        emissiveIntensity: 0.6,
      }),
    )

    switch (this.spec.variant) {
      case "kraken":
        this.buildKraken()
        break
      case "shark":
        this.buildShark()
        break
      case "serpent":
        this.buildSerpent(position)
        break
    }

    this.wave = new THREE.Mesh(
      this.geo(new THREE.TorusGeometry(1, 0.12, 6, 64)),
      this.mat(
        new THREE.MeshBasicMaterial({
          color: 0xc6ff4a,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        }),
      ),
    )
    this.wave.rotation.x = Math.PI / 2
    this.wave.visible = false
    this.mesh.add(this.wave)
  }

  public get isDefeated(): boolean {
    return this.defeated
  }

  public get currentState(): Phase {
    return this.state
  }

  /** Fase de combate: 0, 1 o 2 según el tercio de fugas limpias. */
  public get phase(): number {
    return Math.min(
      2,
      Math.floor((this.status.cleaned / this.status.total) * 3),
    )
  }

  /** Posiciones de las fugas pendientes (para tests y ayudas). */
  public pendingNodePositions(): THREE.Vector3[] {
    this.mesh.updateMatrixWorld(true)
    return this.nodes
      .filter((node) => !node.cleaned)
      .map((node) => node.mesh.getWorldPosition(new THREE.Vector3()))
  }

  public update(ctx: CreatureContext): CreatureEffects | null {
    const { deltaTime, time, target } = ctx
    const position = this.mesh.position
    this.bodyCooldown = Math.max(0, this.bodyCooldown - deltaTime)
    this.stateTimer = Math.max(0, this.stateTimer - deltaTime)

    const effects: CreatureEffects = { boss: this.status }
    const distance = position.distanceTo(target.position)

    if (!this.noticed && distance < NOTICE_RADIUS) {
      this.noticed = true
      effects.notice = "boss_seen"
    }

    if (this.defeated) {
      // Purificado: se aleja despacio hacia arriba, ya inofensivo.
      position.y += 0.8 * deltaTime
      this.swim(this.spec.speed * 0.4, deltaTime, 0)
      this.animate(time, deltaTime)
      this.updateWave(deltaTime, ctx, effects)
      return effects
    }

    this.updateAttacks(ctx, effects, distance)
    this.updateWave(deltaTime, ctx, effects)
    this.animate(time, deltaTime)
    this.mesh.updateMatrixWorld(true)

    // --- Fugas: tocarlas las limpia ---
    for (const node of this.nodes) {
      if (node.cleaned) continue
      node.mesh.getWorldPosition(nodeWorld)
      if (nodeWorld.distanceTo(target.position) < BOSS_NODE_RADIUS) {
        this.cleanNode(node, effects)
        if (this.defeated) return effects
      }
    }

    // --- Cuerpo: tocarlo intoxica ---
    if (this.bodyCooldown === 0) {
      for (const core of this.cores) {
        core.object.getWorldPosition(scratch)
        const reach = core.radius * this.root.scale.x
        if (scratch.distanceTo(target.position) < reach) {
          this.bodyCooldown = BODY_COOLDOWN
          effects.hit = {
            kind: this.kind,
            toxicity: this.state === "charge" ? CHARGE_TOXICITY : BODY_TOXICITY,
            slowDuration: 1.5,
            slowMultiplier: 0.5,
          }
          break
        }
      }
    }

    return effects
  }

  public dispose(): void {
    this.mesh.removeFromParent()
    for (const g of this.geometries) g.dispose()
    for (const m of this.materials) m.dispose()
  }

  // ------------------------------------------------------------------ combate

  private updateAttacks(
    ctx: CreatureContext,
    effects: CreatureEffects,
    distance: number,
  ): void {
    const { deltaTime, time, bounds, target } = ctx
    const position = this.mesh.position
    scratch.copy(target.position).sub(position)
    const towardTurtle = Math.atan2(scratch.x, scratch.z)

    switch (this.state) {
      case "roam": {
        // Ronda; si la tortuga se aleja mucho, va a buscarla.
        this.heading +=
          Math.sin(time * 0.3 + this.phaseOffset) * 0.4 * deltaTime
        if (distance > 18) {
          this.heading = turnToward(this.heading, towardTurtle, 0.5 * deltaTime)
        }
        const away = edgeAvoidance(position, bounds, EDGE_MARGIN)
        if (away !== null) {
          this.heading = turnToward(this.heading, away, 1.2 * deltaTime)
        }
        const dy = THREE.MathUtils.clamp(scratch.y, -1, 1) * 0.6
        this.swim(this.spec.speed * (1 + this.phase * 0.25), deltaTime, dy)

        // Solo ataca si la tortuga está en la pelea.
        if (distance < NOTICE_RADIUS) {
          this.attackTimer -= deltaTime
          if (this.attackTimer <= 0) {
            this.pendingAttack =
              this.spec.attacks[this.attackIndex % this.spec.attacks.length]
            this.attackIndex++
            this.state = "telegraph"
            this.stateTimer = TELEGRAPH
          }
        }
        break
      }

      case "telegraph": {
        this.heading = turnToward(this.heading, towardTurtle, 3 * deltaTime)
        if (this.stateTimer > 0) break
        this.attackTimer = this.spec.interval * (1 - this.phase * 0.2)
        if (this.pendingAttack === "shockwave") {
          this.state = "roam"
          this.waveCenter.copy(position)
          this.waveRadius = 0.5
          this.waveHit = false
          this.wave.visible = true
        } else if (this.pendingAttack === "charge") {
          this.state = "charge"
          this.stateTimer = CHARGE_TIME
          this.chargeDirection.copy(scratch).normalize()
          this.heading = Math.atan2(
            this.chargeDirection.x,
            this.chargeDirection.z,
          )
        } else {
          this.state = "roam"
          const count = Math.min(2, MAX_MINIONS - this.minions)
          if (count > 0) {
            this.minions += count
            effects.spawn = []
            for (let i = 0; i < count; i++) {
              const angle = this.heading + (i === 0 ? 1.4 : -1.4)
              effects.spawn.push({
                kind: this.spec.minion,
                position: position
                  .clone()
                  .add(
                    new THREE.Vector3(
                      Math.sin(angle) * 5,
                      0,
                      Math.cos(angle) * 5,
                    ),
                  ),
              })
            }
          }
        }
        break
      }

      case "charge": {
        position.addScaledVector(this.chargeDirection, CHARGE_SPEED * deltaTime)
        const outside =
          Math.abs(position.x) > bounds.halfSize - 4 ||
          Math.abs(position.z) > bounds.halfSize - 4
        if (this.stateTimer === 0 || outside) this.state = "roam"
        break
      }

      case "wave":
        this.state = "roam"
        break
    }
  }

  private updateWave(
    deltaTime: number,
    ctx: CreatureContext,
    effects: CreatureEffects,
  ): void {
    if (!this.wave.visible) return
    this.waveRadius += WAVE_SPEED * deltaTime
    if (this.waveRadius >= WAVE_MAX) {
      this.wave.visible = false
      return
    }
    this.wave.position.copy(this.waveCenter).sub(this.mesh.position)
    this.wave.scale.setScalar(this.waveRadius)
    ;(this.wave.material as THREE.MeshBasicMaterial).opacity =
      0.75 * (1 - this.waveRadius / WAVE_MAX)

    const { target } = ctx
    if (this.waveHit || this.defeated || target.dashing) return
    const dx = target.position.x - this.waveCenter.x
    const dz = target.position.z - this.waveCenter.z
    const ring = Math.abs(Math.hypot(dx, dz) - this.waveRadius)
    const dy = Math.abs(target.position.y - this.waveCenter.y)
    if (ring < WAVE_WIDTH && dy < WAVE_HEIGHT) {
      this.waveHit = true
      effects.hit = {
        kind: this.kind,
        toxicity: WAVE_TOXICITY,
        slowDuration: 1,
        slowMultiplier: 0.6,
      }
    }
  }

  private cleanNode(node: LeakNode, effects: CreatureEffects): void {
    node.cleaned = true
    node.mesh.material = this.cleanMaterial
    node.mesh.scale.multiplyScalar(0.6)
    this.status.cleaned++
    const name = CREATURE_NAMES[this.kind]

    if (this.status.cleaned >= this.status.total) {
      this.defeated = true
      this.status.defeated = true
      this.state = "roam"
      this.bodyMaterial.color.lerp(new THREE.Color(0x9fc9d8), 0.6)
      this.bodyMaterial.emissive.setHex(0x2a6f9a)
      this.bodyMaterial.emissiveIntensity = 0.4
      effects.eco = (effects.eco ?? 0) + BOSS_DEFEAT_ECO
      effects.heal = (effects.heal ?? 0) + DEFEAT_HEAL
      effects.message = `¡${name} purificado! +${BOSS_DEFEAT_ECO} Eco`
      return
    }

    effects.eco = (effects.eco ?? 0) + BOSS_NODE_ECO
    effects.heal = (effects.heal ?? 0) + NODE_HEAL
    effects.message = `Fuga limpiada ${this.status.cleaned}/${this.status.total} · +${BOSS_NODE_ECO} Eco`
  }

  // --------------------------------------------------------------- movimiento

  private swim(speed: number, deltaTime: number, dy: number): void {
    const position = this.mesh.position
    position.x += Math.sin(this.heading) * speed * deltaTime
    position.z += Math.cos(this.heading) * speed * deltaTime
    position.y += dy * deltaTime
  }

  private animate(time: number, deltaTime: number): void {
    const t = time + this.phaseOffset
    const flashing = this.state === "telegraph" && !this.defeated
    const glow = flashing
      ? 0.9 + Math.sin(t * 25) * 0.5
      : this.defeated
        ? 0.4
        : 0.25
    const blend = 1 - Math.exp(-10 * deltaTime)
    this.bodyMaterial.emissiveIntensity +=
      (glow - this.bodyMaterial.emissiveIntensity) * blend
    this.nodeMaterial.emissiveIntensity = 1.8 + Math.sin(t * 4) * 0.6

    if (this.spec.variant === "serpent") {
      this.layoutSerpent(t)
      return
    }

    this.root.rotation.y = this.heading
    for (const tentacle of this.tentacles) {
      const angle = tentacle.userData.angle as number
      tentacle.rotation.x =
        (tentacle.userData.baseX as number) +
        Math.sin(t * 1.5 + angle * 2) * 0.3
      tentacle.rotation.z = Math.cos(t * 1.2 + angle * 3) * 0.3
    }
    const tail = this.root.getObjectByName("tail")
    if (tail) {
      const speed = this.state === "charge" ? 14 : 4
      tail.rotation.y = Math.sin(t * speed) * 0.35
    }
  }

  // ------------------------------------------------------------------ aspecto

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g)
    return g
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.materials.push(m)
    return m
  }

  private addNode(
    parent: THREE.Object3D,
    local: THREE.Vector3,
    size = 0.55,
  ): void {
    const mesh = new THREE.Mesh(this.nodeGeometry(), this.nodeMaterial)
    mesh.position.copy(local)
    // Compensa la escala del padre para que todas las fugas midan lo mismo.
    const s = parent.scale
    mesh.scale.set(size / s.x, size / s.y, size / s.z)
    parent.add(mesh)
    this.nodes.push({ mesh, cleaned: false })
  }

  private sharedNodeGeometry: THREE.SphereGeometry | null = null

  private nodeGeometry(): THREE.SphereGeometry {
    if (!this.sharedNodeGeometry) {
      this.sharedNodeGeometry = this.geo(new THREE.SphereGeometry(1, 10, 8))
    }
    return this.sharedNodeGeometry
  }

  /** Reparte las fugas sobre un elipsoide unidad (padre escalado). */
  private spreadNodes(
    parent: THREE.Object3D,
    count: number,
    topOnly = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const y = topOnly
        ? 0.2 + (i / Math.max(1, count - 1)) * 0.7
        : 1 - ((i + 0.5) / count) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const a = i * 2.39996 + 0.5
      this.addNode(
        parent,
        new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(
          1.02,
        ),
      )
    }
  }

  private buildKraken(): void {
    const sphere = this.geo(new THREE.SphereGeometry(1, 14, 10))
    const mantle = new THREE.Mesh(sphere, this.bodyMaterial)
    mantle.scale.set(2.4, 2.9, 2.4)
    mantle.position.y = 1.2
    this.root.add(mantle)
    this.cores.push({ object: mantle, radius: 2.3 })

    const tentacleGeometry = this.geo(
      new THREE.CylinderGeometry(0.12, 0.5, 6, 6),
    )
    tentacleGeometry.translate(0, -3, 0)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const pivot = new THREE.Group()
      pivot.position.set(Math.cos(angle) * 1.5, -1.2, Math.sin(angle) * 1.5)
      pivot.userData.angle = angle
      pivot.userData.baseX = 0
      pivot.add(new THREE.Mesh(tentacleGeometry, this.accentMaterial))
      this.tentacles.push(pivot)
      this.root.add(pivot)
    }

    // Redes enredadas sobre el manto.
    const net = new THREE.Mesh(
      this.geo(new THREE.IcosahedronGeometry(1.08, 1)),
      this.mat(
        new THREE.MeshBasicMaterial({
          color: 0xd9d2b8,
          wireframe: true,
          transparent: true,
          opacity: 0.6,
        }),
      ),
    )
    mantle.add(net)

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sphere, this.nodeMaterial)
      eye.scale.set(0.12, 0.12, 0.06)
      eye.position.set(side * 0.45, -0.1, 0.9)
      mantle.add(eye)
    }
    this.spreadNodes(mantle, this.spec.nodes)
  }

  private buildShark(): void {
    const sphere = this.geo(new THREE.SphereGeometry(1, 16, 10))
    const body = new THREE.Mesh(sphere, this.bodyMaterial)
    body.scale.set(1.6, 1.8, 5.2)
    this.root.add(body)
    this.cores.push({ object: body, radius: 1.8 })
    const front = new THREE.Object3D()
    front.position.z = 3
    this.root.add(front)
    this.cores.push({ object: front, radius: 1.6 })
    const back = new THREE.Object3D()
    back.position.z = -3
    this.root.add(back)
    this.cores.push({ object: back, radius: 1.3 })

    const finShape = new THREE.Shape()
    finShape.moveTo(0, 0)
    finShape.lineTo(1.2, 2.4)
    finShape.lineTo(2.4, 0)
    finShape.closePath()
    const finGeometry = this.geo(new THREE.ShapeGeometry(finShape))
    const dorsal = new THREE.Mesh(finGeometry, this.accentMaterial)
    dorsal.position.set(0, 1.6, -1.2)
    dorsal.rotation.y = -Math.PI / 2
    this.root.add(dorsal)

    const tail = new THREE.Group()
    tail.name = "tail"
    tail.position.z = -5
    const tailFin = new THREE.Mesh(finGeometry, this.accentMaterial)
    tailFin.scale.set(1.2, 1.4, 1)
    tailFin.rotation.set(0, Math.PI / 2, 0)
    tailFin.position.set(0, -1.6, 1.4)
    tail.add(tailFin)
    this.root.add(tail)

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeometry, this.accentMaterial)
      fin.scale.set(0.9, 0.9, 1)
      fin.position.set(side * 1.3, -0.6, 1.5)
      fin.rotation.set(Math.PI / 2, 0, side > 0 ? -0.4 : Math.PI + 0.4)
      this.root.add(fin)
    }

    // Placas de chatarra clavadas y dientes.
    const plate = this.geo(new THREE.BoxGeometry(1, 0.15, 1.4))
    for (let i = 0; i < 6; i++) {
      const piece = new THREE.Mesh(plate, this.accentMaterial)
      const a = i * 1.7
      piece.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.5, -2 + i * 0.8)
      piece.lookAt(piece.position.clone().multiplyScalar(2))
      this.root.add(piece)
    }
    const tooth = this.geo(new THREE.ConeGeometry(0.12, 0.45, 4))
    const toothMaterial = this.mat(
      new THREE.MeshStandardMaterial({ color: 0xe8e2cf }),
    )
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8 - 0.5) * 2.2
      const t = new THREE.Mesh(tooth, toothMaterial)
      t.position.set(Math.sin(a) * -0.8, -0.55 + Math.cos(a) * 0.1, 4.7)
      t.rotation.x = Math.PI
      this.root.add(t)
    }
    this.spreadNodes(body, this.spec.nodes, true)
  }

  private buildSerpent(start: THREE.Vector3): void {
    const sphere = this.geo(new THREE.SphereGeometry(1, 12, 9))
    const spike = this.geo(new THREE.ConeGeometry(0.25, 1, 4))
    const nodeEvery = Math.max(
      1,
      Math.floor(SERPENT_SEGMENTS / this.spec.nodes),
    )
    let placed = 0
    for (let i = 0; i < SERPENT_SEGMENTS; i++) {
      const taper = 1 - (i / SERPENT_SEGMENTS) * 0.7
      const segment = new THREE.Mesh(
        sphere,
        i === 0 ? this.accentMaterial : this.bodyMaterial,
      )
      segment.scale.set(1.6 * taper, 1.4 * taper, 1.5 * taper)
      segment.rotation.order = "YXZ"
      this.mesh.add(segment)
      this.segments.push(segment)
      this.trail.push(
        start
          .clone()
          .add(
            new THREE.Vector3(
              -Math.sin(this.heading) * SERPENT_SPACING * i,
              0,
              -Math.cos(this.heading) * SERPENT_SPACING * i,
            ),
          ),
      )
      this.cores.push({ object: segment, radius: 1.4 * taper })
      if (i > 0 && i % 2 === 0) {
        const s = new THREE.Mesh(spike, this.accentMaterial)
        s.position.y = 1
        s.scale.set(
          1 / segment.scale.x,
          1.2 / segment.scale.y,
          1 / segment.scale.z,
        )
        segment.add(s)
      }
      if (i > 0 && i % nodeEvery === 0 && placed < this.spec.nodes) {
        const side = placed % 2 === 0 ? 1 : -1
        this.addNode(segment, new THREE.Vector3(side * 0.75, 0.75, 0))
        placed++
      }
    }
    while (placed < this.spec.nodes) {
      this.addNode(this.segments[1], new THREE.Vector3(0, 1.02, 0.2 * placed))
      placed++
    }
    // Ojos en la cabeza.
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sphere, this.nodeMaterial)
      eye.scale.set(0.12, 0.12, 0.1)
      eye.position.set(side * 0.55, 0.35, 0.8)
      this.segments[0].add(eye)
    }
    this.layoutSerpent(0)
  }

  /** El leviatán es una cadena de segmentos que sigue a la cabeza. */
  private layoutSerpent(t: number): void {
    const head = this.mesh.position
    this.trail[0].copy(head)
    for (let i = 1; i < this.trail.length; i++) {
      const previous = this.trail[i - 1]
      const current = this.trail[i]
      scratch.copy(current).sub(previous)
      const length = scratch.length()
      if (length < 1e-4)
        scratch.set(-Math.sin(this.heading), 0, -Math.cos(this.heading))
      else scratch.divideScalar(length)
      current.copy(previous).addScaledVector(scratch, SERPENT_SPACING)
    }
    const sideX = Math.cos(this.heading)
    const sideZ = -Math.sin(this.heading)
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i]
      const wave =
        Math.sin(t * 2.5 - i * 0.5) * 0.4 * (i / this.segments.length)
      segment.position
        .copy(this.trail[i])
        .sub(head)
        .add(scratch.set(sideX * wave, 0, sideZ * wave))
      if (i === 0) {
        segment.rotation.set(0, this.heading, 0)
      } else {
        const ahead = this.trail[i - 1]
        segment.rotation.set(
          0,
          Math.atan2(ahead.x - this.trail[i].x, ahead.z - this.trail[i].z),
          0,
        )
      }
    }
  }
}
