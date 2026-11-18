// src/ui/codexView.ts
// Contenido de cada sección del códice: tarjetas con lo descubierto (y su dato
// real) y tarjetas ocultas para lo que falta. Las pestañas viven en
// ScreenManager.showCodex.

import { LOCALE } from "@core/locale"
import { BIOMES } from "@core/types"
import type { DebrisHazard } from "@entities/debrisCatalog"
import {
  BIOME_ENTRIES,
  CODEX_ENTRIES,
  FAUNA_ENTRIES,
  FAUNA_ROLE_LABELS,
  RELIC_ENTRIES,
  type CodexDiscoveries,
  type CodexSection,
} from "@/meta/codex"
import { el } from "@ui/dom"

/** Etiqueta del peligro de un desecho en el códice. */
const HAZARD_LABELS: Record<DebrisHazard, string> = {
  fragil: "Frágil",
  trampa: "Trampa",
  lixivia: "Fuga",
}

/** Cómo se registra una entrada de cada sección (subtítulo del códice). */
export const CODEX_SECTION_HINTS: Record<CodexSection, string> = {
  debris: "Recoge un desecho para registrarlo.",
  fauna: "Acércate a una especie para registrarla.",
  relics: "Encuentra una reliquia para registrarla.",
  biomes: "Llega a un bioma para registrarlo.",
}

/** Texto de las tarjetas aún ocultas. */
const UNKNOWN_TEXT: Record<CodexSection, string> = {
  debris: "Aún no lo has recogido.",
  fauna: "Aún no la has visto de cerca.",
  relics: "Aún no la has encontrado.",
  biomes: "Aún no has llegado aquí.",
}

interface CardContent {
  name: string
  tag?: string
  description?: string
  fact: string
}

function codexCard(
  section: CodexSection,
  content: CardContent | null,
): HTMLElement {
  if (!content) {
    const card = el("article", "upgrade-card codex-card is-unknown")
    card.append(
      el("h3", "upgrade-name", "???"),
      el("p", "upgrade-desc", UNKNOWN_TEXT[section]),
    )
    return card
  }
  const card = el("article", "upgrade-card codex-card")
  const header = el("div", "upgrade-header")
  header.append(el("h3", "upgrade-name", content.name))
  if (content.tag) header.append(el("span", "upgrade-level", content.tag))
  card.append(header)
  if (content.description) {
    card.append(el("p", "upgrade-desc", content.description))
  }
  card.append(el("p", "codex-fact", content.fact))
  return card
}

function grid(cards: HTMLElement[]): HTMLElement {
  const node = el("div", "upgrade-grid codex-grid")
  node.append(...cards)
  return node
}

/** Desechos, agrupados por el primer bioma en el que aparecen. */
function debrisList(discoveries: CodexDiscoveries): HTMLElement[] {
  const nodes: HTMLElement[] = []
  let currentBiome: string | null = null
  let current: HTMLElement | null = null
  for (const entry of CODEX_ENTRIES) {
    if (entry.biome !== currentBiome || !current) {
      currentBiome = entry.biome
      current = grid([])
      nodes.push(el("h2", "codex-biome", BIOMES[entry.biome].name), current)
    }
    const known = discoveries.discoveredDebris.includes(entry.id)
    current.append(
      codexCard(
        "debris",
        known
          ? {
              name: entry.name,
              tag: entry.hazard ? HAZARD_LABELS[entry.hazard] : undefined,
              description: entry.description,
              fact: entry.fact,
            }
          : null,
      ),
    )
  }
  return nodes
}

/** Nodos de una sección del códice, listos para meter en su panel. */
export function codexSectionContent(
  section: CodexSection,
  discoveries: CodexDiscoveries,
): HTMLElement[] {
  switch (section) {
    case "debris":
      return debrisList(discoveries)
    case "fauna":
      return [
        grid(
          FAUNA_ENTRIES.map((entry) =>
            codexCard(
              "fauna",
              discoveries.discoveredCreatures.includes(entry.id)
                ? {
                    name: entry.name,
                    tag: FAUNA_ROLE_LABELS[entry.role],
                    fact: entry.fact,
                  }
                : null,
            ),
          ),
        ),
      ]
    case "relics":
      return [
        grid(
          RELIC_ENTRIES.map((entry) =>
            codexCard(
              "relics",
              discoveries.discoveredRelics.includes(entry.id)
                ? {
                    name: entry.name,
                    description: entry.description,
                    fact: entry.fact,
                  }
                : null,
            ),
          ),
        ),
      ]
    case "biomes":
      return [
        grid(
          BIOME_ENTRIES.map((entry) =>
            codexCard(
              "biomes",
              discoveries.discoveredBiomes.includes(entry.id)
                ? {
                    name: entry.name,
                    tag: `${entry.depth.toLocaleString(LOCALE)} m`,
                    description: entry.zone,
                    fact: entry.fact,
                  }
                : null,
            ),
          ),
        ),
      ]
  }
}
