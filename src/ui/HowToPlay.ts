// src/ui/HowToPlay.ts
// Contenido de la pantalla "Cómo jugar": objetivo, controles y una ficha por
// cada tipo de desecho y de peligro. Los estilos están en styles.css (.help-*).

import { BIOME_ORDER } from "@core/types"
import { BIOME_DEBRIS, type OceanDebrisType } from "@entities/debrisCatalog"
import { STRUCTURES } from "@world/StructureConfig"
import { STAT_INFO, STAT_KEYS } from "@cards/BuildStats"
import {
  gamepadControlRows,
  keyboardControlRows,
  type ControlBindings,
  type ControlDevice,
  type ControlRow,
} from "@ui/controlLabels"

interface HelpCard {
  /** Etiqueta pequeña sobre el nombre ("Movimiento", "Peligro"...). */
  tag: string
  tone: "calm" | "warn" | "danger" | "good"
  name: string
  text: string
  example?: string
}

const TOUCH_CONTROLS: ControlRow[] = [
  { keys: ["Mitad izquierda"], action: "Joystick: avanzar y girar" },
  { keys: ["Mitad derecha"], action: "Stick vertical: subir y bajar" },
  {
    keys: ["Joystick al borde"],
    action: "Impulso: empuja más allá del borde (mientras subes o bajas)",
  },
  { keys: ["Deslizar rápido"], action: "Dash, moviendo el joystick de lado" },
  { keys: ["Botón Dash"], action: "Giro de 360° con dash" },
  { keys: ["Botón Filtro"], action: "Colocar esfera filtradora" },
  { keys: ["Botón Mirar atrás"], action: "Mirar atrás (mantener)" },
]

/** Primer desecho de la inmersión que cumple la condición, como ejemplo de la ficha. */
function exampleOf(
  match: (item: OceanDebrisType) => boolean,
): string | undefined {
  for (const biome of BIOME_ORDER) {
    const found = BIOME_DEBRIS[biome].find(match)
    if (found) return found.name
  }
  return undefined
}

function debrisCards(): HelpCard[] {
  return [
    {
      tag: "Movimiento",
      tone: "calm",
      name: "Flotante",
      text: "Se mece en el sitio. El más fácil de recoger: basta con pasar cerca.",
      example: exampleOf((d) => !d.motion && !d.hazard),
    },
    {
      tag: "Movimiento",
      tone: "calm",
      name: "A la deriva",
      text: "La corriente lo arrastra de lado a lado. Anticipa hacia dónde va.",
      example: exampleOf((d) => d.motion === "deriva"),
    },
    {
      tag: "Movimiento",
      tone: "calm",
      name: "Se hunde",
      text: "Baja despacio hasta el fondo de la zona. Atrápalo antes o baja a por él.",
      example: exampleOf((d) => d.motion === "hunde"),
    },
    {
      tag: "Movimiento",
      tone: "calm",
      name: "En el fondo",
      text: "Quieto en lo más bajo de la zona: no llegas a él sin descender.",
      example: exampleOf((d) => d.motion === "reposa"),
    },
    {
      tag: "Peligro",
      tone: "warn",
      name: "Frágil",
      text: "Si lo tocas con el impulso activo se rompe en 3 pedacitos y no da Eco. Suelta el impulso antes de llegar.",
      example: exampleOf((d) => d.hazard === "fragil"),
    },
    {
      tag: "Peligro",
      tone: "warn",
      name: "Trampa",
      text: "Al recogerla suelta 2 pedacitos que también tendrás que limpiar.",
      example: exampleOf((d) => d.hazard === "trampa"),
    },
    {
      tag: "Peligro",
      tone: "danger",
      name: "Fuga",
      text: "Late con luz propia. Mientras siga ahí, el agua no se aclara y la toxicidad no deja de subir: recógela cuanto antes.",
      example: exampleOf((d) => d.hazard === "lixivia"),
    },
    {
      tag: "Premio",
      tone: "good",
      name: "Reliquia",
      text: "Tras tu primera carta, cada zona esconde una dentro de un desecho. La delata un destello dorado que gira sobre él.",
    },
  ]
}

function dangerCards(): HelpCard[] {
  const filter = STRUCTURES.filter

  return [
    {
      tag: "Peligro",
      tone: "danger",
      name: "Toxicidad",
      text: "La calavera de arriba. Se llena sola mientras quede basura en la zona y baja con cada desecho que recoges. Si se llena del todo, la inmersión termina.",
    },
    {
      tag: "Peligro",
      tone: "danger",
      name: "Tiempo y presión",
      text: "Cada zona tiene un tiempo límite. Al agotarse aparece PRESIÓN y la toxicidad sube cinco veces más rápido.",
    },
    {
      tag: "Peligro",
      tone: "warn",
      name: "Medusas",
      text: "Si te tocan, suman 15 de toxicidad y te frenan 2 segundos. Después se apagan 3 segundos y no pueden picar.",
    },
    {
      tag: "Herramienta",
      tone: "good",
      name: filter.name,
      text: `Cuesta ${filter.cost} de Eco. Se coloca delante de ti, atrae los desechos más contaminantes y absorbe hasta ${filter.capacity} antes de desaparecer.`,
    },
    {
      tag: "Herramienta",
      tone: "good",
      name: "Impulso y dash",
      text: "El impulso gasta la barra de energía de abajo. El giro de 360° da un empujón corto de velocidad y se puede encadenar.",
    },
    {
      tag: "Progreso",
      tone: "good",
      name: "Cartas",
      text: "Al limpiar una zona eliges 1 carta de 3. Su efecto dura el resto de la inmersión.",
    },
  ]
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const wrap = node("section", "help-section")
  wrap.append(node("h2", "help-heading", title), ...children)
  return wrap
}

function controlList(
  title: string,
  rows: ControlRow[],
  active: boolean,
): HTMLElement {
  const panel = node("div", "help-panel")
  if (active) panel.classList.add("help-panel-active")

  const heading = node("h3", "help-subheading", title)
  if (active) heading.append(node("span", "help-badge", "En uso"))

  const list = node("dl", "help-controls")
  for (const row of rows) {
    const keys = node("dt", "help-keys")
    for (const key of row.keys) keys.append(node("kbd", "help-key", key))
    list.append(keys, node("dd", "help-action", row.action))
  }

  panel.append(heading, list)
  return panel
}

/** Glosario de los atributos que muestran las cartas ("VELOCIDAD", "RADIO"...). */
function statGlossary(): HTMLElement {
  const panel = node("div", "help-panel")
  const list = node("dl", "help-controls")

  for (const key of STAT_KEYS) {
    const info = STAT_INFO[key]
    const term = node("dt", "help-keys")
    term.append(node("kbd", "help-key", info.term))
    list.append(
      term,
      node("dd", "help-action", `${info.label}. ${info.description}`),
    )
  }

  panel.append(
    node(
      "p",
      "help-card-text",
      "Al elegir carta, cada una muestra cómo quedarían tus valores. En la pausa, el panel «Tu tortuga» enseña los que llevas.",
    ),
    list,
  )
  return panel
}

function cardGrid(cards: HelpCard[]): HTMLElement {
  const grid = node("div", "help-grid")

  for (const card of cards) {
    const item = node("article", `help-card help-tone-${card.tone}`)
    item.append(
      node("div", "help-tag", card.tag),
      node("h3", "help-card-name", card.name),
      node("p", "help-card-text", card.text),
    )
    if (card.example) {
      item.append(node("p", "help-card-example", `Ejemplo: ${card.example}`))
    }
    grid.append(item)
  }

  return grid
}

/**
 * Cuerpo informativo de "Cómo jugar". Los controles del dispositivo en uso se
 * resaltan y van primero; teclado y mando muestran lo que hay asignado.
 */
export function createHowToPlayBody(
  { device, padStyle }: ControlDevice,
  bindings: ControlBindings,
): HTMLElement {
  const body = node("div", "help-body")

  const goal = node(
    "p",
    "help-lead",
    "Cumple el objetivo de cada zona (recoger el 60 % de sus desechos: el contador llega al 100 %) y desciende a la siguiente. Vigila la calavera: si la toxicidad se llena, la inmersión termina.",
  )

  const currency = node(
    "p",
    "help-lead",
    "Cada desecho te da Eco (conciencia ecológica). Con él colocas esferas filtradoras durante la inmersión y, al volver al inicio, compras mejoras permanentes. Las cartas, en cambio, son gratis y solo duran una inmersión.",
  )

  const controls = node("div", "help-columns")
  const lists = {
    keyboard: controlList(
      "Teclado",
      keyboardControlRows(bindings.keys),
      device === "keyboard",
    ),
    gamepad: controlList(
      "Mando",
      gamepadControlRows(padStyle, bindings.pad),
      device === "gamepad",
    ),
    touch: controlList("Táctil", TOUCH_CONTROLS, device === "touch"),
  }
  // Primero, los controles que el jugador está usando.
  const order: (keyof typeof lists)[] = ["keyboard", "gamepad", "touch"]
  controls.append(
    lists[device],
    ...order.filter((d) => d !== device).map((d) => lists[d]),
  )

  body.append(
    section("Objetivo", goal, currency),
    section("Controles", controls),
    section("Desechos", cardGrid(debrisCards())),
    section("Peligros y herramientas", cardGrid(dangerCards())),
    section("Atributos de las cartas", statGlossary()),
  )

  return body
}
