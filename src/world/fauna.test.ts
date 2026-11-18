import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { Rng } from "@core/rng"
import { BIOME_ORDER, type BiomeKey, type WorldBounds } from "@core/types"
import {
  BOSS_KINDS,
  FRIENDLY_KINDS,
  HOSTILE_KINDS,
  isBossKind,
  isFriendlyKind,
  type CreatureContext,
  type CreatureKind,
  type CreatureTarget,
} from "@entities/Creature"
import { Debris } from "@entities/Debris"
import { Eel, EEL_DETECT_RADIUS, EEL_WINDUP } from "@entities/Eel"
import { Jellyfish } from "@entities/Enemy"
import {
  FishSchool,
  SCHOOL_REGROUP_TIME,
  SCHOOL_TRIGGER_RADIUS,
} from "@entities/FishSchool"
import {
  Lanternfish,
  LURE_COOLDOWN,
  LURE_MAX_PULL,
  LURE_RADIUS,
} from "@entities/Lanternfish"
import { EnemyManager } from "./EnemyManager"
import { BIOME_FAUNA, faunaFor } from "./fauna"

const BOUNDS: WorldBounds = { halfSize: 40, minY: -10, maxY: 10 }
const DT = 1 / 30

function target(
  position: THREE.Vector3,
  options: Partial<CreatureTarget> = {},
): CreatureTarget {
  return { position, boosting: false, dashing: false, ...options }
}

function ctx(t: CreatureTarget, time = 0, deltaTime = DT): CreatureContext {
  return { deltaTime, time, bounds: BOUNDS, target: t }
}

describe("faunaFor", () => {
  const hostileOf = (kinds: CreatureKind[]) =>
    kinds.filter((kind) => !isFriendlyKind(kind) && !isBossKind(kind))

  it("la fauna peligrosa ocupa el hueco de las medusas y siempre queda una", () => {
    for (const biome of Object.keys(BIOME_FAUNA) as BiomeKey[]) {
      for (const count of [1, 3, 7]) {
        const hostile = hostileOf(faunaFor(biome, count))
        expect(hostile, `${biome} ${count}`).toHaveLength(count)
        expect(hostile).toContain("jellyfish")
      }
    }
  })

  it("la fauna amiga se suma aparte", () => {
    const kinds = faunaFor("subphotic", 3)
    expect(kinds.filter((kind) => kind === "fishSchool")).toHaveLength(2)
    expect(kinds.filter(isFriendlyKind).length).toBeGreaterThanOrEqual(4)
  })

  it("todos los biomas de la run tienen fauna amiga y enemiga propia", () => {
    for (const biome of BIOME_ORDER) {
      const kinds = faunaFor(biome, 4)
      expect(kinds.some(isFriendlyKind), biome).toBe(true)
      expect(
        hostileOf(kinds).some((kind) => kind !== "jellyfish"),
        biome,
      ).toBe(true)
    }
  })

  it("las anguilas y los jefes solo aparecen en lo hondo", () => {
    const shallow = BIOME_ORDER.slice(0, 3).flatMap((biome) =>
      faunaFor(biome, 7),
    )
    expect(shallow).not.toContain("eel")
    expect(shallow.some(isBossKind)).toBe(false)
    expect(faunaFor("deepSea", 6)).toContain("leviathan")
  })

  it("cada especie aparece en algún bioma", () => {
    const everywhere = new Set(
      (Object.keys(BIOME_FAUNA) as BiomeKey[]).flatMap((biome) =>
        faunaFor(biome, 12),
      ),
    )
    for (const kind of [...HOSTILE_KINDS, ...FRIENDLY_KINDS, ...BOSS_KINDS]) {
      expect(everywhere.has(kind), kind).toBe(true)
    }
  })

  it("hay cinco veces más fauna que al principio (4 especies)", () => {
    const species =
      HOSTILE_KINDS.length + FRIENDLY_KINDS.length + BOSS_KINDS.length
    expect(species).toBeGreaterThanOrEqual(20)
  })
})

describe("EnemyManager con varias criaturas", () => {
  it("genera la fauna del bioma", () => {
    const scene = new THREE.Scene()
    const manager = new EnemyManager(scene)
    manager.spawn(6, BOUNDS, new Rng(3), "deepSea")
    expect(manager.getKinds()).toContain("leviathan")

    expect(manager.getKinds().sort()).toEqual(
      faunaFor("deepSea", 6).slice().sort(),
    )
    expect(scene.children).toHaveLength(manager.getCount())
  })

  it("todas nadan un buen rato sin salirse ni romperse", () => {
    const scene = new THREE.Scene()
    const manager = new EnemyManager(scene)
    manager.spawnKinds(
      ["jellyfish", "fishSchool", "lanternfish", "eel", "eel"],
      BOUNDS,
      new Rng(9),
    )
    // La tortuga va con impulso de un lado a otro para provocarlas.
    const position = new THREE.Vector3()
    for (let frame = 0; frame < 1800; frame++) {
      const time = frame * DT
      position.set(Math.sin(time * 0.3) * 30, 0, Math.cos(time * 0.2) * 30)
      manager.update(DT, time, target(position, { boosting: true }), BOUNDS)
      for (const child of scene.children) {
        const p = child.position
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
        expect(Math.abs(p.x)).toBeLessThanOrEqual(BOUNDS.halfSize)
        expect(Math.abs(p.z)).toBeLessThanOrEqual(BOUNDS.halfSize)
        expect(p.y).toBeGreaterThanOrEqual(BOUNDS.minY)
        expect(p.y).toBeLessThanOrEqual(BOUNDS.maxY)
      }
    }
  })

  it("junta los arrastres y se queda con el golpe más fuerte", () => {
    const scene = new THREE.Scene()
    const manager = new EnemyManager(scene)
    manager.spawnKinds(["lanternfish", "jellyfish"], BOUNDS, new Rng(4))
    const [lantern, jelly] = scene.children
    jelly.position.set(0, 0, 0)
    lantern.position.set(0, 0, 5)

    const frame = manager.update(0, 0, target(new THREE.Vector3()), BOUNDS)
    expect(frame.hit?.kind).toBe("jellyfish")
    expect(frame.pull.z).toBeGreaterThan(0)
  })
})

describe("medusa", () => {
  it("se aparta de la tortuga que va con impulso", () => {
    const calm = new Jellyfish(new THREE.Vector3(3, 0, 0), new Rng(1))
    const scared = new Jellyfish(new THREE.Vector3(3, 0, 0), new Rng(1))
    const turtle = new THREE.Vector3(0, 0, 0)

    for (let frame = 0; frame < 60; frame++) {
      const time = frame * DT
      calm.update(ctx(target(turtle), time))
      scared.update(ctx(target(turtle, { boosting: true }), time))
    }

    expect(scared.mesh.position.distanceTo(turtle)).toBeGreaterThan(
      calm.mesh.position.distanceTo(turtle) + 0.3,
    )
  })
})

describe("anguila", () => {
  function eelFacing(turtle: THREE.Vector3): Eel {
    const eel = new Eel(new THREE.Vector3(0, 0, 0), new Rng(2))
    eel.mesh.position.set(turtle.x, turtle.y, turtle.z - 8)
    return eel
  }

  it("no ataca a una tortuga tranquila", () => {
    const turtle = new THREE.Vector3(0, 0, 10)
    const eel = eelFacing(turtle)
    for (let frame = 0; frame < 120; frame++) {
      expect(eel.update(ctx(target(turtle), frame * DT))?.hit).toBeUndefined()
    }
    expect(eel.state).not.toBe("charge")
  })

  it("avisa, se lanza en línea recta y golpea si no la esquivas", () => {
    const turtle = new THREE.Vector3(0, 0, 10)
    const eel = eelFacing(turtle)

    const first = eel.update(ctx(target(turtle, { boosting: true })))
    expect(first?.notice).toBe("eel_charge")
    expect(eel.state).toBe("windup")

    // Durante el aviso no se mueve del sitio.
    const start = eel.mesh.position.clone()
    let time = 0
    while (eel.state === "windup") {
      time += DT
      eel.update(ctx(target(turtle), time))
    }
    expect(time).toBeCloseTo(EEL_WINDUP, 1)
    expect(eel.mesh.position.distanceTo(start)).toBeLessThan(0.01)
    expect(eel.state).toBe("charge")

    let hit = null
    for (let frame = 0; frame < 30 && !hit; frame++) {
      time += DT
      hit = eel.update(ctx(target(turtle), time))?.hit ?? null
    }
    expect(hit?.kind).toBe("eel")
    expect(eel.state).toBe("recover")
  })

  it("si te apartas durante el aviso, falla", () => {
    const turtle = new THREE.Vector3(0, 0, 10)
    const eel = eelFacing(turtle)
    eel.update(ctx(target(turtle, { dashing: true })))

    let time = 0
    while (eel.state === "windup") {
      time += DT
      eel.update(ctx(target(turtle), time))
    }
    // La tortuga se aparta de lado justo al lanzarse.
    const dodged = turtle.clone().add(new THREE.Vector3(5, 0, 0))
    for (let frame = 0; frame < 60; frame++) {
      time += DT
      expect(eel.update(ctx(target(dodged), time))?.hit).toBeUndefined()
    }
  })

  it("no nota el impulso lejos de ella", () => {
    const eel = new Eel(new THREE.Vector3(0, 0, 0), new Rng(2))
    const far = new THREE.Vector3(0, 0, EEL_DETECT_RADIUS + 2)
    eel.update(ctx(target(far, { boosting: true })))
    expect(eel.state).toBe("prowl")
  })
})

describe("pez linterna", () => {
  it("arrastra hacia su luz, más fuerte cuanto más cerca", () => {
    const fish = new Lanternfish(new THREE.Vector3(0, 0, 0), new Rng(5))
    const near = fish.update(ctx(target(new THREE.Vector3(3, 0, 0)), 0, 0))
    const nearPull = near?.pull?.clone()
    const far = fish.update(ctx(target(new THREE.Vector3(8, 0, 0)), 0, 0))

    expect(nearPull?.x).toBeLessThan(0) // hacia el pez (-x)
    expect(Math.abs(nearPull?.x ?? 0)).toBeGreaterThan(
      Math.abs(far?.pull?.x ?? 0),
    )
    expect(nearPull?.length()).toBeLessThanOrEqual(LURE_MAX_PULL)
  })

  it("fuera de su luz no hace nada", () => {
    const fish = new Lanternfish(new THREE.Vector3(0, 0, 0), new Rng(5))
    const outside = new THREE.Vector3(LURE_RADIUS + 1, 0, 0)
    expect(fish.update(ctx(target(outside), 0, 0))).toBeNull()
  })

  it("muerde al tocarlo y apaga la luz un rato", () => {
    const fish = new Lanternfish(new THREE.Vector3(0, 0, 0), new Rng(5))
    const touching = new THREE.Vector3(0.5, 0, 0)

    expect(fish.update(ctx(target(touching), 0, 0))?.hit?.kind).toBe(
      "lanternfish",
    )
    expect(fish.coolingDown).toBe(true)
    expect(fish.update(ctx(target(touching), 0, 0))).toBeNull()

    fish.update(
      ctx(target(new THREE.Vector3(99, 0, 0)), 0, LURE_COOLDOWN + 0.1),
    )
    expect(fish.coolingDown).toBe(false)
  })

  it("avisa solo al empezar a arrastrar", () => {
    const fish = new Lanternfish(new THREE.Vector3(0, 0, 0), new Rng(5))
    const inLight = new THREE.Vector3(6, 0, 0)
    expect(fish.update(ctx(target(inLight), 0, 0))?.notice).toBe("lantern_pull")
    expect(fish.update(ctx(target(inLight), 0, 0))?.notice).toBeUndefined()
  })
})

describe("banco de peces", () => {
  it("se dispersa al atravesarlo, esparce desechos y tarda en reagruparse", () => {
    const school = new FishSchool(new THREE.Vector3(0, 0, 0), new Rng(6))
    const inside = school.mesh.position.clone()

    const effects = school.update(ctx(target(inside), 0, 0))
    expect(effects?.scatter?.center.distanceTo(inside)).toBeLessThan(0.01)
    expect(effects?.notice).toBe("school_scatter")
    expect(school.scattered).toBe(true)

    // Mientras se reagrupa no vuelve a dispersarse.
    expect(school.update(ctx(target(school.mesh.position), 0, 0))).toBeNull()
    school.update(
      ctx(target(new THREE.Vector3(99, 0, 0)), 0, SCHOOL_REGROUP_TIME + 0.1),
    )
    expect(school.scattered).toBe(false)
  })

  it("no reacciona si la tortuga pasa lejos", () => {
    const school = new FishSchool(new THREE.Vector3(0, 0, 0), new Rng(6))
    const outside = new THREE.Vector3(SCHOOL_TRIGGER_RADIUS + 1, 0, 0)
    expect(school.update(ctx(target(outside), 0, 0))).toBeNull()
  })
})

describe("desechos esparcidos", () => {
  it("el empujón los mueve, se frena solo y no los saca del bioma", () => {
    const bounds: WorldBounds = { halfSize: 10, minY: -5, maxY: 5 }
    const debris = Debris.createFragment(
      new THREE.Vector3(8, 0, 0),
      new Rng(1),
      bounds,
    )
    debris.scatter(6, 0)

    for (let frame = 0; frame < 150; frame++) {
      debris.animate(frame * DT, DT)
    }
    expect(debris.mesh.position.x).toBeCloseTo(10)

    const settled = debris.mesh.position.x
    debris.scatter(-4, 0)
    for (let frame = 0; frame < 300; frame++) {
      debris.animate(frame * DT, DT)
    }
    const moved = settled - debris.mesh.position.x
    expect(moved).toBeGreaterThan(1)
    // Frenado exponencial: recorre unos v / drag (algo más por el paso discreto).
    expect(moved).toBeLessThan((4 / 2.2) * 1.05)
  })
})
