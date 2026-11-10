// src/world/DebrisBatcher.ts
// Dibuja los desechos con un InstancedMesh por tipo del catálogo.
//
// Cada Debris conserva su propio Object3D (posición, rotación y escala se
// siguen animando igual), pero ese objeto ya no es una malla: aquí se copia su
// matriz a la instancia correspondiente una vez por frame. Geometría y
// material ya estaban cacheados por id, así que cada tipo es una draw call.

import * as THREE from "three"
import type { Debris } from "@entities/Debris"

type Batch = {
  mesh: THREE.InstancedMesh
  capacity: number
  count: number
}

const MIN_CAPACITY = 8

export class DebrisBatcher {
  private group = new THREE.Group()
  private batches = new Map<string, Batch>()

  constructor(scene: THREE.Scene) {
    this.group.name = "debris-batches"
    scene.add(this.group)
  }

  /** Copia las matrices de los desechos vivos a sus instancias. Llamar antes de renderizar. */
  public sync(debrisList: readonly Debris[]): void {
    for (const batch of this.batches.values()) batch.count = 0

    for (const debris of debrisList) {
      const source = debris.batch
      if (!source || debris.removed) continue

      let batch = this.batches.get(source.key)
      if (!batch || batch.count >= batch.capacity) {
        batch = this.allocate(source.key, debris, debrisList, batch)
      }

      debris.mesh.updateMatrix()
      batch.mesh.setMatrixAt(batch.count++, debris.mesh.matrix)
    }

    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.count
      batch.mesh.visible = batch.count > 0
      if (batch.count > 0) batch.mesh.instanceMatrix.needsUpdate = true
    }
  }

  /** Número de mallas instanciadas con al menos un desecho. */
  public getActiveBatchCount(): number {
    let active = 0
    for (const batch of this.batches.values()) if (batch.count > 0) active++
    return active
  }

  /** Elimina todas las instancias (al cambiar de bioma). Geometrías y materiales son compartidos y se conservan. */
  public clear(): void {
    for (const batch of this.batches.values()) {
      this.group.remove(batch.mesh)
      batch.mesh.dispose()
    }
    this.batches.clear()
  }

  /** Crea el lote de un tipo, o lo amplía conservando lo ya escrito este frame. */
  private allocate(
    key: string,
    sample: Debris,
    debrisList: readonly Debris[],
    previous: Batch | undefined,
  ): Batch {
    let needed = 0
    for (const debris of debrisList) {
      if (debris.batch?.key === key && !debris.removed) needed++
    }
    const capacity = Math.max(
      MIN_CAPACITY,
      needed,
      previous ? previous.capacity * 2 : 0,
    )

    const source = sample.batch!
    const mesh = new THREE.InstancedMesh(
      source.geometry,
      source.material,
      capacity,
    )
    mesh.name = `debris:${key}`
    // Las instancias están repartidas por todo el bioma.
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const batch: Batch = { mesh, capacity, count: 0 }

    if (previous) {
      const copied = previous.count
      mesh.instanceMatrix.array.set(
        (previous.mesh.instanceMatrix.array as Float32Array).subarray(
          0,
          copied * 16,
        ),
      )
      batch.count = copied
      this.group.remove(previous.mesh)
      previous.mesh.dispose()
    }

    this.group.add(mesh)
    this.batches.set(key, batch)
    return batch
  }
}
