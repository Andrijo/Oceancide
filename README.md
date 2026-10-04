# Oceancide

Juego 3D donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y desciende por las capas del océano recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación, menor visibilidad y más densidad de desechos. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

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

| Tecla | Acción            |
| ----- | ----------------- |
| `W`   | Avanzar           |
| `S`   | Retroceder        |
| `A`   | Girar izquierda   |
| `D`   | Girar derecha     |
| `U`   | Subir             |
| `J`   | Bajar             |
| `I`   | Impulso           |
| `R`   | Reiniciar partida |

### Táctil (móvil)

- **Joystick izquierdo** (mitad izquierda de la pantalla): movimiento y giro.
- **Stick vertical derecho** (mitad derecha): subir / bajar.
- **Botón de impulso**: aumenta la velocidad.

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
├── index.html           # Entry point, estilos y UI
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts           # Bootstrap del juego
    ├── Game.ts           # Lógica principal, loop y cámara
    ├── Turtle.ts         # Modelo y movimiento de la tortuga
    ├── BiomeGenerator.ts # Generación de biomas y desechos
    ├── Debris.ts         # Desechos recolectables
    ├── DebrisVisuals.ts  # Aspecto visual de cada tipo de desecho
    ├── debrisCatalog.ts  # Catálogo de desechos por bioma
    ├── BubbleTrail.ts    # Estela de burbujas (instancing)
    ├── DevMenu.ts        # Menú de desarrollo
    ├── TouchControls.ts  # Controles táctiles (joysticks)
    ├── UIManager.ts      # HUD y mensajes
    └── types.ts          # Tipos y configuración de biomas
```

## Tecnologías utilizadas

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [TypeScript](https://www.typescriptlang.org/) — tipado estático
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo
- [Bun](https://bun.sh) — runtime y gestor de paquetes
