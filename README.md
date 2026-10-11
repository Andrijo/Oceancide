# Oceancide

Juego 3D donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y desciende por las capas del océano recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación, menor visibilidad y más densidad de desechos. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

Además de recolectar desechos directamente, puedes gastar **Conciencia Ecológica** para construir **esferas filtradoras** que atraen y absorben desechos por su cuenta. Y con el **dash de giro** (Q/E) puedes encadenar giros de 360° con un impulso temporal de velocidad.

## Zonas

El juego recorre 10 biomas, desde la superficie hasta las fosas más profundas:

| Zona                  | Desechos | Tasa de toxicidad | Profundidad |
| --------------------- | -------- | ----------------- | ----------- |
| Epipelágico Superior  | 0.1      | 0.00              | 20 m        |
| Pelágico Medio        | 0.2      | 0.00              | 100 m       |
| Subfótico             | 0.3      | 0.05              | 200 m       |
| Mesopelágico Superior | 0.45     | 0.10              | 500 m       |
| Mesopelágico Profundo | 0.6      | 0.20              | 1000 m      |
| Batipelágico Superior | 0.7      | 0.35              | 2000 m      |
| Batipelágico Profundo | 0.8      | 0.50              | 4000 m      |
| Abisopelágico         | 0.9      | 0.70              | 6000 m      |
| Hadopelágico          | 0.95     | 0.85              | 8000 m      |
| Mar Profundo          | 1.0      | 1.00              | 11000 m     |

Cada bioma tiene su propio catálogo de desechos (botellas, redes fantasma, microplásticos, vertidos de petróleo...) con aspecto y toxicidad propios.

## Controles

### Teclado

| Tecla           | Acción                      |
| --------------- | --------------------------- |
| `W` / `↑`       | Avanzar                     |
| `S` / `↓`       | Retroceder                  |
| `A` / `←`       | Girar a la izquierda        |
| `D` / `→`       | Girar a la derecha          |
| `U`             | Subir                       |
| `J`             | Bajar                       |
| `I`             | Impulso                     |
| `Q` / `E`       | Giro de 360° (dash)         |
| `B`             | Construir esfera filtradora |
| `C` (mantener)  | Ver hacia atrás             |
| `Esc` / `Enter` | Pausar / reanudar           |
| `R`             | Abandonar la inmersión      |

### Táctil (móvil)

- **Joystick izquierdo** (mitad izquierda de la pantalla): movimiento y giro.
- **Stick vertical derecho** (mitad derecha): subir / bajar.
- **Botón de impulso**: aumenta la velocidad.
- **Botón de filtro**: construye una esfera filtradora.
- **Botón de vista trasera** (mantener): cámara mirando hacia atrás.

## Conciencia Ecológica y Refugio

Cada desecho recolectado (o absorbido por un filtro) otorga **Conciencia Ecológica**, que sirve para:

- Construir esferas filtradoras durante la inmersión.
- Acumularse como progreso persistente en el **Refugio** (menú inicial), guardado en `localStorage` bajo la clave `oceancide.meta`.

Al terminar cada run se muestra un resumen (zona alcanzada, desechos, duración y conciencia obtenida) y se actualiza el progreso global: mejor zona, runs jugadas/completadas y total de desechos.

## Instalación y ejecución

Requisitos: [Bun](https://bun.sh) instalado.

```bash
# Instalar dependencias
bun install

# Servidor de desarrollo
bun run dev

# Build de producción
bun run build

# Vista previa del build
bun run preview
```

## Estructura del proyecto

```
oceancidio/
├── index.html            # Entry point, HUD, estilos base y controles táctiles
├── package.json
├── tsconfig.json
├── vite.config.ts        # Config de Vite (alias de importación)
├── public/
│   ├── fonts/            # Fuentes (Pogonia, Montserrat, Geist)
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.ts           # Bootstrap del juego
    ├── styles.css        # @font-face
    ├── core/             # Núcleo y estado global
    │   ├── Game.ts             # Lógica principal, loop y cámara
    │   ├── MetaState.ts        # Progreso persistente (Refugio) y guardado
    │   ├── rng.ts              # Generador pseudoaleatorio con semilla
    │   └── types.ts            # Tipos y configuración de biomas
    ├── world/            # Generación y elementos del mundo
    │   ├── BiomeGenerator.ts   # Generación de biomas, terreno, partículas y desechos
    │   ├── BiomeProps.ts       # Props decorativos por bioma
    │   ├── BiomeTransition.ts  # Transición animada entre biomas
    │   ├── Structure.ts        # Esfera filtradora colocada en el agua
    │   ├── StructureConfig.ts  # Configuración de estructuras
    │   └── StructureManager.ts # Ciclo de vida de las estructuras
    ├── entities/         # Entidades del juego
    │   ├── Turtle.ts           # Modelo y movimiento de la tortuga
    │   ├── Debris.ts           # Desechos recolectables
    │   ├── DebrisVisuals.ts    # Aspecto visual de cada tipo de desecho
    │   ├── debrisCatalog.ts    # Catálogo de desechos por bioma
    │   └── BubbleTrail.ts      # Estela de burbujas (instancing)
    └── ui/               # Interfaz y controles
        ├── UIManager.ts        # HUD y mensajes
        ├── ScreenManager.ts    # Menús (hub, resumen y pausa)
        ├── TouchControls.ts    # Controles táctiles (joysticks)
        └── DevMenu.ts          # Menú de desarrollo
```

## Alias de importación

Los imports entre carpetas usan alias configurados en `tsconfig.json` y `vite.config.ts`:

| Alias         | Ruta             |
| ------------- | ---------------- |
| `@core/*`     | `src/core/*`     |
| `@world/*`    | `src/world/*`    |
| `@entities/*` | `src/entities/*` |
| `@ui/*`       | `src/ui/*`       |
| `@/*`         | `src/*`          |

> Reservados para sistemas futuros (aún sin carpeta): `@cards`, `@tycoon`, `@events`, `@relics`, `@drones`, `@bosses`.

## Tecnologías utilizadas

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [TypeScript](https://www.typescriptlang.org/) — tipado estático
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo
- [Bun](https://bun.sh) — runtime y gestor de paquetes
