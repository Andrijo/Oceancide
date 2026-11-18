import { describe, expect, it } from "vitest"
import * as THREE from "three"
import { Rng } from "@core/rng"
import type { WorldBounds } from "@core/types"
import {
  BOSS_KINDS,
  type BossKind,
  type CreatureContext,
  type CreatureEffects,
  type CreatureTarget,
} from "@entities/Creature"
import { EnemyManager } from "@world/EnemyManager"
import { BOSS_DEFEAT_ECO, BOSS_NODE_ECO, BOSSES, Megaboss } from "./Megaboss"
import { SpeciesCreature } from "./SpeciesCreature"
import { SPECIES, type GenericKind } from "./species"

const BOUNDS: WorldBounds = { halfSize: 50, minY: -10, maxY: 10 }
const DT = 1 / 30
const FAR = new THREE.Vector3(999, 0, 999)

function target(
  position: THREE.Vector3,
  options: Partial<CreatureTarget> = {},
): CreatureTarget {
  return { position, boosting: false, dashing: false, ...options }
}

function ctx(t: CreatureTarget, time = 0, deltaTime = DT): CreatureContext {
  return { deltaTime, time, bounds: BOUNDS, target: t }
}

function make(kind: GenericKind, at = new THREE.Vector3()): SpeciesCreature {
  return new SpeciesCreature(kind, at, new Rng(3))
}

/** Avanza `seconds` y devuelve todos los efectos no nulos. */
function run(
  creature: { update(c: CreatureContext): CreatureEffects | null },
  t: CreatureTarget | (() => CreatureTarget),
  seconds: number,
): CreatureEffects[] {
  const out: CreatureEffects[] = []
  for (let time = 0; time < seconds; time += DT) {
    const current = typeof t === "function" ? t() : t
    const effects = creature.update(ctx(current, time))
    if (effects) out.push(effects)
  }
  return out
}

describe("especies", () => {
  it("todas se montan, nadan sin romperse y se liberan", () => {
    const scene = new THREE.Scene()
    for (const kind of Object.keys(SPECIES) as GenericKind[]) {
      const creature = make(kind, new THREE.Vector3(10, 0, 10))
      scene.add(creature.mesh)
      run(
        creature,
        target(new THREE.Vector3(12, 0, 10), { boosting: true }),
        20,
      )
      const p = creature.mesh.position
      expect(Number.isFinite(p.x + p.y + p.z), kind).toBe(true)
      creature.dispose()
      expect(creature.mesh.parent, kind).toBeNull()
    }
  })
})

describe("hostiles", () => {
  it("pez globo: se infla de cerca, envenena el agua y pincha", () => {
    const puffer = make("pufferfish")
    expect(puffer.update(ctx(target(FAR)))).toBeNull()

    const near = new THREE.Vector3(2.5, 0, 0)
    const first = puffer.update(ctx(target(near)))
    expect(first?.notice).toBe("puffer_inflate")
    expect(first?.drain).toBeGreaterThan(0)
    expect(puffer.isActive).toBe(true)

    const touch = puffer.update(ctx(target(puffer.mesh.position.clone())))
    expect(touch?.hit?.kind).toBe("pufferfish")
  })

  it("barracuda: persigue y muerde", () => {
    const barracuda = make("barracuda")
    const turtle = new THREE.Vector3(10, 0, 0)
    const effects = run(barracuda, target(turtle), 4)
    expect(effects[0]?.notice).toBe("barracuda_chase")
    expect(effects.some((e) => e.hit?.kind === "barracuda")).toBe(true)
    expect(barracuda.coolingDown).toBe(true)
  })

  it("rape: espera quieto y se lanza de cerca", () => {
    const angler = make("anglerfish")
    const start = angler.mesh.position.clone()
    run(angler, target(FAR), 2)
    const wandered = Math.hypot(
      angler.mesh.position.x - start.x,
      angler.mesh.position.z - start.z,
    )

    const turtle = angler.mesh.position.clone().add(new THREE.Vector3(5, 0, 0))
    const effects = run(angler, target(turtle), 1.2)
    expect(effects[0]?.notice).toBe("angler_ambush")
    expect(effects.some((e) => e.hit?.kind === "anglerfish")).toBe(true)
    expect(wandered).toBeLessThan(1.5)
  })

  it("pulpo: va a por las esferas y roba lo que atraen", () => {
    const octopus = make("octopus")
    const sphere = new THREE.Vector3(15, 0, 0)
    const effects = run(
      octopus,
      { position: FAR, boosting: false, dashing: false, spheres: [sphere] },
      8,
    )
    expect(effects.filter((e) => e.steal).length).toBeGreaterThanOrEqual(2)
    expect(octopus.mesh.position.distanceTo(sphere)).toBeLessThan(15)
  })

  it("calamar: suelta tinta tóxica si lo asustas", () => {
    const squid = make("squid")
    const turtle = new THREE.Vector3(3, 0, 0)
    const first = squid.update(ctx(target(turtle, { dashing: true })))
    expect(first?.notice).toBe("squid_ink")
    expect(first?.drain).toBeGreaterThan(0)
    // La nube se queda donde estaba; lejos de ella no hace nada.
    const away = squid.update(ctx(target(FAR)))
    expect(away?.drain).toBeUndefined()
  })

  it("cangrejo y anémona: golpean al tocarlos, con enfriamiento", () => {
    for (const kind of ["scrapCrab", "anemone"] as const) {
      const creature = make(kind)
      const at = target(creature.mesh.position)
      expect(creature.update(ctx(at, 0, 0))?.hit?.kind, kind).toBe(kind)
      expect(creature.update(ctx(at, 0, 0)), kind).toBeNull()
    }
  })
})

describe("amigas", () => {
  it("caballito de mar: limpia toxicidad y descansa", () => {
    const seahorse = make("seahorse")
    const at = target(seahorse.mesh.position)
    const effects = seahorse.update(ctx(at, 0, 0))
    expect(effects?.heal).toBeGreaterThan(0)
    expect(effects?.message).toContain("Caballito")
    expect(seahorse.update(ctx(at, 0, 0))).toBeNull()
  })

  it("delfín: acelera a la tortuga", () => {
    const dolphin = make("dolphin")
    const effects = dolphin.update(ctx(target(dolphin.mesh.position), 0, 0))
    expect(effects?.haste?.multiplier).toBeGreaterThan(1)
  })

  it("rémora: se pega, protege de un golpe y se suelta", () => {
    const remora = make("remora")
    const turtle = remora.mesh.position.clone()
    expect(remora.update(ctx(target(turtle), 0, 0))?.shield).toBe(true)
    expect(remora.isAttached).toBe(true)

    turtle.set(5, 2, 5)
    remora.update(ctx(target(turtle)))
    expect(remora.mesh.position.distanceTo(turtle)).toBeLessThan(1)

    remora.onShieldUsed()
    expect(remora.isAttached).toBe(false)
    expect(remora.coolingDown).toBe(true)
  })

  it("manta: amplía el radio de recogida mientras nadas a su lado", () => {
    const manta = make("manta")
    const near = manta.update(ctx(target(new THREE.Vector3(2, 0, 0)), 0, 0))
    expect(near?.radiusBoost).toBeGreaterThan(1)
    expect(near?.notice).toBe("manta_aura")
    expect(manta.update(ctx(target(FAR), 0, 0))).toBeNull()
  })

  it("ballena: su canto limpia el agua de alrededor", () => {
    const whale = make("whale")
    const turtle = new THREE.Vector3(5, 0, 0)
    const effects = run(
      whale,
      () => target(whale.mesh.position.clone().add(turtle)),
      20,
    )
    expect(effects.some((e) => (e.drain ?? 0) < 0)).toBe(true)
    expect(effects.some((e) => e.notice === "whale_song")).toBe(true)
  })

  it("tortuga atrapada: quedarse a su lado la libera", () => {
    const netted = make("nettedTurtle")
    const effects = run(netted, target(netted.mesh.position.clone()), 2.5)
    const reward = effects.find((e) => e.eco)
    expect(reward?.eco).toBeGreaterThan(0)
    expect(reward?.message).toContain("liberada")
    expect(netted.isFreed).toBe(true)
  })

  it("tortuga atrapada: pasar de largo no basta", () => {
    const netted = make("nettedTurtle")
    const near = netted.mesh.position.clone()
    run(netted, target(near), 1)
    run(netted, target(FAR), 3)
    run(netted, target(near), 1)
    expect(netted.isFreed).toBe(false)
  })

  it("pez limpiador: se come desechos de vez en cuando", () => {
    const cleaner = make("cleanerFish")
    const effects = run(cleaner, target(FAR), 6)
    expect(effects.filter((e) => e.graze).length).toBeGreaterThanOrEqual(2)
  })
})

describe("megajefes", () => {
  function boss(kind: BossKind = "netKraken"): Megaboss {
    return new Megaboss(kind, new THREE.Vector3(0, 0, 0), new Rng(8))
  }

  it("hay tres y cada uno tiene fugas que limpiar", () => {
    expect(BOSS_KINDS).toHaveLength(3)
    for (const kind of BOSS_KINDS) {
      const b = new Megaboss(kind, new THREE.Vector3(), new Rng(1))
      expect(b.pendingNodePositions(), kind).toHaveLength(BOSSES[kind].nodes)
      b.dispose()
    }
  })

  it("limpiar todas las fugas lo purifica y da la recompensa", () => {
    for (const kind of BOSS_KINDS) {
      const b = new Megaboss(kind, new THREE.Vector3(), new Rng(2))
      let eco = 0
      let guard = 0
      while (!b.isDefeated && guard++ < 20) {
        const [node] = b.pendingNodePositions()
        const effects = b.update(ctx(target(node, { dashing: true }), 0, 0))
        eco += effects?.eco ?? 0
      }
      expect(b.isDefeated, kind).toBe(true)
      expect(eco, kind).toBe(
        (BOSSES[kind].nodes - 1) * BOSS_NODE_ECO + BOSS_DEFEAT_ECO,
      )
      // Purificado ya no hace daño.
      const after = b.update(ctx(target(b.mesh.position.clone()), 0, 0))
      expect(after?.hit, kind).toBeUndefined()
      expect(after?.boss?.defeated).toBe(true)
    }
  })

  it("cada tercio de fugas limpias pasa de fase", () => {
    const b = boss("leviathan")
    expect(b.phase).toBe(0)
    for (let i = 0; i < 3; i++) {
      const [node] = b.pendingNodePositions()
      b.update(ctx(target(node), 0, 0))
    }
    expect(b.phase).toBe(1)
  })

  it("tocar el cuerpo intoxica", () => {
    const b = boss()
    b.mesh.updateMatrixWorld(true)
    const body = new THREE.Vector3(0, 1.2, 0)
    expect(b.update(ctx(target(body), 0, 0))?.hit?.kind).toBe("netKraken")
  })

  it("avisa la primera vez que lo ves y lanza ondas que el dash atraviesa", () => {
    const b = boss()
    const turtle = new THREE.Vector3(12, 0, 0)
    const hits = run(b, () => target(turtle), 12).filter((e) => e.hit)
    expect(hits.length).toBeGreaterThan(0)

    const dodger = boss()
    const effects = run(dodger, () => target(turtle, { dashing: true }), 12)
    expect(effects.find((e) => e.notice)?.notice).toBe("boss_seen")
    expect(effects.filter((e) => e.hit)).toHaveLength(0)
  })

  it("suelta crías que el gestor añade a la fauna", () => {
    const scene = new THREE.Scene()
    const manager = new EnemyManager(scene)
    manager.spawnKinds(["netKraken"], BOUNDS, new Rng(4))
    const kraken = manager.getCreature(0)
    const turtle = new THREE.Vector3()
    for (let time = 0; time < 20; time += DT) {
      // La tortuga se mantiene a distancia para no limpiar ni chocar.
      turtle.copy(kraken!.mesh.position).add(new THREE.Vector3(14, 6, 0))
      manager.update(DT, time, target(turtle, { dashing: true }), BOUNDS)
    }
    expect(manager.getKinds()).toContain("jellyfish")
    expect(manager.getCount()).toBeLessThanOrEqual(1 + 6)
  })
})
