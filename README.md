# Oceancide

Juego 3D en el navegador donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y recorre biomas oceánicos recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación y menor visibilidad. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

## Zonas

| Zona              | Densidad de desechos | Tasa de toxicidad | Profundidad |
| ----------------- | -------------------- | ----------------- | ----------- |
| Arrecife de Coral | 0.5                  | 0.1               | 20          |
| Zona de Plástico  | 1.2                  | 0.3               | 40          |
| Fosa Abisal       | 0.8                  | 0.5               | 100         |

## Controles

### Teclado

| Tecla     | Acción            |
| --------- | ----------------- |
| `W` / `↑` | Avanzar           |
| `S` / `↓` | Retroceder        |
| `A` / `←` | Girar izquierda   |
| `D` / `→` | Girar derecha     |
| `U`       | Subir             |
| `J`       | Bajar             |
| `I`       | Impulso           |
| `R`       | Reiniciar partida |

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
├── index.html          # Entry point, estilos y UI
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts          # Bootstrap del juego
    ├── Game.ts          # Lógica principal, loop y cámara
    ├── Turtle.ts        # Modelo y movimiento de la tortuga
    ├── BiomeGenerator.ts# Generación de biomas y desechos
    ├── Debris.ts        # Desechos recolectables
    ├── TouchControls.ts # Controles táctiles (joysticks)
    ├── UIManager.ts     # HUD y mensajes
    └── types.ts         # Tipos y configuración de biomas
```

## Tecnologías utilizadas

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [TypeScript](https://www.typescriptlang.org/) — tipado estático
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo
- [Bun](https://bun.sh) — runtime y gestor de paquetes
