# Oceancide

Juego 3D donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y desciende por las capas del océano recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación, menor visibilidad y más densidad de desechos. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

Además de recolectar desechos directamente, puedes gastar **Conciencia Ecológica** para construir **esferas filtradoras** que atraen y absorben desechos por su cuenta. Y con el **dash de giro** (Q/E) puedes encadenar giros de 360° con un impulso temporal de velocidad.

Al limpiar cada zona eliges una **carta de mejora** (o maldición) que potencia tu tortuga durante el resto de la inmersión, con un toque roguelike: cada run es distinta.

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

La columna **Desechos** es la densidad relativa con la que se generan (sobre una base de 200 por zona) y **Tasa de toxicidad** multiplica la subida pasiva de toxicidad del bioma.

Cada bioma tiene su propio catálogo de desechos (botellas, redes fantasma, microplásticos, barriles, vertidos de petróleo...) con aspecto, valor ecológico y toxicidad propios. El catálogo completo está en `src/entities/debrisCatalog.ts`.

## Sistemas de juego

### Toxicidad

La toxicidad es la barra de peligro de la run (0 a 100) y se muestra como una **calavera que se va llenando** en la parte superior de la pantalla:

- **Sube sola** mientras haya desechos en el bioma, a un ritmo proporcional a la contaminación restante y a la tasa de toxicidad de la zona.
- **Baja** cada vez que recoges un desecho (más cuanto más contaminante sea) o cuando una esfera filtradora absorbe uno.
- Al **cambiar de bioma** se reduce a la mitad (no se reinicia).
- Si llega al **100%**, la run termina ("¡Se acabó! La toxicidad ganó.").

La calavera cambia de color y acelera su pulso según el nivel: verde (bajo), amarillo, naranja y rojo (crítico). Cuando la toxicidad baja hay un **destello verde** de "limpieza", y la primera vez que aparece en cada run se muestra un aviso explicativo.

### Conciencia Ecológica y esferas filtradoras

Cada desecho tiene un **valor ecológico** (derivado de su toxicidad) que se suma a tu Conciencia Ecológica al recogerlo. Con ella puedes pagar **esferas filtradoras** (tecla `B` o botón táctil):

- Se colocan justo delante de la tortuga.
- Atraen al desecho más cercano dentro de su radio de alcance cada cierto tiempo.
- Cada esfera absorbe un número limitado de desechos y luego desaparece.
- Solo puedes tener unas pocas activas a la vez.

La Conciencia Ecológica sobrante se guarda como progreso persistente en el **Refugio**.

### Dash de giro

Con `Q` / `E` la tortuga realiza un giro completo de 360° en menos de un segundo. Al iniciarlo recibe un **impulso temporal de velocidad** (hasta ×1.6) que decae de forma exponencial, y el giro fuerza un avance mínimo aunque sueltes las teclas: úsalo para encadenar giros y desplazarte rápido. El HUD muestra el multiplicador activo como `DASH ×N`.

### Cartas

Cuando completas el **70%** de la limpieza de una zona (y no es la última), antes de descender a la siguiente el juego se detiene y te ofrece **3 cartas** entre las que elegir una. Cada carta aplica una mejora (o maldición) **permanente durante esa run**, y las que vas eligiendo quedan registradas y se muestran en el resumen final.

El reparto es por rareza con pesos (`RARITY_WEIGHTS` en `src/cards/CardPool.ts`): **común 40 · rara 30 · épica 20 · legendaria 8 · maldición 2**. El mazo está en `src/cards/CardPool.ts` y la lógica de reparto en `src/cards/CardManager.ts`. Las cartas se eligen con el clic/toque y se colorean según su rareza.

| Carta                 | Rareza      | Efecto              | Descripción                                          |
| --------------------- | ----------- | ------------------- | ---------------------------------------------------- |
| Aletas Ágiles         | Común       | +10% VEL            | Nada más rápido en línea recta                       |
| Caparazón Denso       | Común       | +5% RES             | Filtra mejor la toxicidad del agua                   |
| Imán Débil            | Común       | +0.5 RADIO          | Atrae desechos desde un poco más lejos               |
| Pulmón Extra          | Común       | +1 FILTRO           | Mantiene un filtro más activo a la vez               |
| Eco Amplificado       | Rara        | +25% ECO            | Cada desecho recogido vale más                       |
| Dash Potenciado       | Rara        | +0.4 DASH           | El giro de 360° da un impulso más fuerte             |
| Simbiosis             | Rara        | +1 ECO/S            | Cada filtro activo genera eco por segundo            |
| Imán Grande           | Rara        | +1.5 RADIO          | Atrae desechos desde muy lejos                       |
| Filtro Mejorado       | Épica       | +2 FILTROS          | Mantiene dos filtros más a la vez                    |
| Corazón de Medusa     | Épica       | +1 REVIVIR          | Revives una vez al morir con 50% de toxicidad        |
| Bioluminiscencia      | Épica       | +30% ECO / +5% VEL  | Brilla en la oscuridad y gana más eco                |
| Caparazón Espejo      | Legendaria  | -40% TOX            | Repele la mayor parte de la contaminación            |
| Nado Supersónico      | Legendaria  | +50% VEL            | La tortuga nada como un torpedo                      |
| Avaricia              | Maldición   | +50% ECO / -20% VEL | Más eco, pero la tortuga se vuelve lenta             |
| Fragilidad            | Maldición   | +30% VEL / -50% RES | Más rápida, pero mucho más vulnerable a la toxicidad |

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

Los controles táctiles aparecen al detectar el primer toque y se colocan donde apoyes el dedo.

## HUD

- **Desechos recolectados**, **Conciencia Ecológica** y **Progreso de zona** (porcentaje necesario para avanzar).
- **Calavera de toxicidad**: se llena y colorea según el nivel de toxicidad (ver más arriba).
- **Números flotantes**: al recoger un desecho aparece un `+N` sobre su posición en pantalla. El tamaño y el color crecen con el valor (cian → verde → dorado).
- **HUD de construcción**: indica el coste de la esfera filtradora y cuántas tienes activas (se tiñe de rojo si no puedes construir).
- **HUD de dash**: muestra el multiplicador del boost de giro mientras está activo.
- **Botón de pausa** en la esquina superior derecha.

## Visuales y ambientación

El agua no es un simple fondo: hay una capa de efectos (`src/world/WaterEffects.ts`) que simula el medio marino y que se adapta a cada bioma.

- **Cúpula con gradiente** (horizonte, cenit y nadir) con el brillo del sol, que sigue a la cámara.
- **Niebla con absorción por canal**: el rojo se pierde antes que el azul, como en el agua real.
- **Rayos de luz** (god rays) que cuelgan desde la superficie mientras llega el sol.
- **Nieve marina**: partículas cercanas a la cámara que dan sensación de volumen y parallax.
- **Viñeta** tintada con el color del agua.
- **Cáusticas animadas** sobre el fondo en las zonas donde llega la luz.
- **Bioluminiscencia**: en las zonas profundas (sin sol) las luces puntuales de color de acento pasan a ser la iluminación principal.
- **Props por bioma**: rocas, corales, conchas, algas, esponjas y montículos de arrecife, con más relieve y detalle cuanto más profundo.

A medida que limpias un bioma, **el agua se aclara**: sube el brillo, baja la densidad de la niebla y se refuerzan los rayos. Al pasar de zona se reproduce una **transición** en la que una masa negra de borde irregular barre la pantalla y muestra el nombre del nuevo bioma.

El renderizado pasa por un **pipeline de post-proceso** (`src/core/RenderPipeline.ts`): tonemapping neutro y un **bloom dinámico** que solo se activa en las profundidades (cuando el sol se apaga). Cuando el bloom es inapreciable, el pipeline se salta el composer y renderiza directo para ahorrar recursos.

## Progreso y Refugio

Al terminar cada run se muestra un resumen (zona alcanzada, desechos, duración, semilla, cartas elegidas y conciencia obtenida) y se actualiza el progreso persistente guardado en `localStorage` bajo la clave `oceancide.meta`:

- **Conciencia ecológica** total acumulada.
- **Mejor zona** alcanzada.
- **Runs jugadas / completadas**.
- **Total de desechos** recolectados.

Completar los 10 biomas otorga un **bono del 25%** sobre la conciencia obtenida en la run. Desde el Refugio puedes empezar una nueva inmersión o eliminar el progreso guardado.

### Reproducir una run

Cada run usa una semilla aleatoria (que se muestra en el resumen). Puedes fijarla desde la URL para reproducir exactamente la misma disposición de biomas (y las mismas cartas ofrecidas):

```
http://localhost:5173/?seed=123
```

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
├── index.html            # Entry point, HUD, estilos base y calavera de toxicidad (SVG)
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
    │   ├── Game.ts             # Lógica principal, loop, cámara y pantallas
    │   ├── RenderPipeline.ts   # Tonemapping + bloom dinámico
    │   ├── MetaState.ts        # Progreso persistente (Refugio) y guardado
    │   ├── rng.ts              # Generador pseudoaleatorio con semilla
    │   └── types.ts            # Tipos y configuración de biomas
    ├── world/            # Generación y elementos del mundo
    │   ├── BiomeGenerator.ts   # Generación de biomas, terreno, partículas y desechos
    │   ├── BiomeProps.ts       # Props decorativos por bioma
    │   ├── BiomeTransition.ts  # Transición animada entre biomas
    │   ├── WaterEffects.ts     # Cúpula, niebla con absorción, rayos y nieve marina
    │   ├── Structure.ts        # Esfera filtradora colocada en el agua
    │   ├── StructureConfig.ts  # Configuración de estructuras
    │   └── StructureManager.ts # Ciclo de vida de las estructuras
    ├── entities/         # Entidades del juego
    │   ├── Turtle.ts           # Modelo y movimiento de la tortuga
    │   ├── Debris.ts           # Desechos recolectables
    │   ├── DebrisVisuals.ts    # Aspecto visual de cada tipo de desecho
    │   ├── debrisCatalog.ts    # Catálogo de desechos por bioma
    │   └── BubbleTrail.ts      # Estela de burbujas (instancing)
    ├── cards/            # Sistema de cartas roguelike
    │   ├── Card.ts             # Tipos de carta y estado de la run
    │   ├── CardManager.ts      # Reparto y aplicación de cartas
    │   └── CardPool.ts         # Mazo de cartas y pesos por rareza
    └── ui/               # Interfaz y controles
        ├── UIManager.ts        # HUD, números flotantes, calavera y mensajes
        ├── ScreenManager.ts    # Menús (hub, resumen, pausa y elección de cartas)
        ├── TouchControls.ts    # Controles táctiles (joysticks)
        └── DevMenu.ts          # Menú de desarrollo (componente, no conectado por defecto)
```

## Alias de importación

Los imports entre carpetas usan alias configurados en `tsconfig.json` y `vite.config.ts`:

| Alias         | Ruta             |
| ------------- | ---------------- |
| `@core/*`     | `src/core/*`     |
| `@world/*`    | `src/world/*`    |
| `@entities/*` | `src/entities/*` |
| `@ui/*`       | `src/ui/*`       |
| `@cards/*`    | `src/cards/*`    |
| `@/*`         | `src/*`          |

> Reservados para sistemas futuros (aún sin carpeta): `@tycoon`, `@events`, `@relics`, `@drones`, `@bosses`.

## Tecnologías utilizadas

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [TypeScript](https://www.typescriptlang.org/) — tipado estático
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo
- [Bun](https://bun.sh) — runtime y gestor de paquetes
