# Oceancide

Juego 3D donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y desciende por las capas del océano recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación, menor visibilidad y más densidad de desechos. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

Además de recolectar desechos directamente, puedes gastar **Conciencia Ecológica** para construir **esferas filtradoras** que atraen y absorben desechos por su cuenta. Y con el **dash de giro** (Q/E) puedes encadenar giros de 360° con un impulso temporal de velocidad.

Al limpiar cada zona eliges una **carta de mejora** (o maldición) que potencia tu tortuga durante el resto de la inmersión, con un toque roguelike: cada run es distinta. Si lo prefieres, puedes lanzar una **Inmersión sin fin** y ver cuánto aguantas con la dificultad subiendo en cada vuelta.

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

Los desechos no son todos iguales. Cada tipo define, en el catálogo, **dos comportamientos independientes**:

**Movimiento** (antes de tocarlo):

| Comportamiento | Efecto |
| --- | --- |
| *(sin definir)* | Inerte: flota con un balanceo suave. |
| `deriva` | Se desplaza en horizontal con la corriente; más difícil de interceptar. |
| `hunde` | Desciende lento hasta el borde inferior de la banda. |
| `flota` | Sube lento hasta el borde superior. |
| `reposa` | Quieto en el borde inferior: hay que bajar a por él. |

**Peligro** (al tocarlo):

| Peligro | Efecto |
| --- | --- |
| *(sin definir)* | Ninguno. |
| `fragil` | Si llegas en **boost**, se rompe: suelta 3 microfragmentos y no da eco. Con calma se recoge entero. |
| `trampa` | Al recogerlo suelta 2 microfragmentos que también hay que limpiar. |
| `lixivia` | Mientras siga ahí, **mantiene el agua contaminada**: la niebla no se aclara del todo y la toxicidad pasiva no para. Su emisivo **late** para que se distinga. |

Además, cada tipo tiene un **peso** de aparición: los comunes llenan el bioma y los raros (trampas, fugas) aparecen de verdad como excepción. La selección es ponderada (`Rng.pickWeighted`), no uniforme.

## Sistemas de juego

### Toxicidad

La toxicidad es la barra de peligro de la run (0 a 100) y se muestra como una **calavera que se va llenando** en la parte superior de la pantalla:

- **Sube sola** mientras haya desechos en el bioma, a un ritmo proporcional a la contaminación restante y a la tasa de toxicidad de la zona.
- Las **fugas** (desechos `lixivia`, con el emisivo latiendo) mantienen la contaminación por encima de un suelo mientras no se retiren, así que el agua no acaba de aclararse hasta limpiarlas todas.
- **Baja** cada vez que recoges un desecho (más cuanto más contaminante sea) o cuando una esfera filtradora absorbe uno.
- Al **cambiar de bioma** se arrastra la mitad, pero nunca baja del **suelo de contaminación** del bioma (a más profundidad, más alto).
- Si llega al **100%**, la run termina ("¡Se acabó! La toxicidad ganó.").

La calavera se va llenando de **lodo tóxico** y cambia de color y de ritmo de pulso según el nivel: verde pantano (bajo), oliva, óxido y sangre (crítico). Un pequeño **chevron** indica la tendencia: ▲ cuando sube, ▼ cuando estás limpiando. Cuando la toxicidad baja hay un **destello verde** de "limpieza", y la primera vez que aparece en cada run se muestra un aviso explicativo.

### Tiempo por bioma

Cada bioma tiene además un **límite de tiempo**: al agotarse, el bioma entra en **presión** y la subida pasiva de toxicidad se multiplica (×5). No mata por sí solo, pero te envenena rápido si no limpias. El límite parte de **120 s** y baja **2 s por bioma**, con un mínimo de **80 s**.

El HUD muestra un **temporizador** en el cluster de peligro que cambia de blanco a naranja (cuando queda menos del 30%) y a rojo en los últimos 10 segundos; al agotarse pasa a mostrar **PRESIÓN**. Al revivir se garantizan al menos **20 s** en el bioma actual.

### Conciencia Ecológica y esferas filtradoras

Cada desecho tiene un **valor ecológico** (derivado de su toxicidad) que se suma a tu Conciencia Ecológica al recogerlo. Con ella puedes pagar **esferas filtradoras** (tecla `B` o botón táctil):

- Se colocan justo delante de la tortuga.
- Atraen al desecho **más contaminante** dentro de su radio de alcance cada cierto tiempo (a igual contaminación, el más cercano).
- Cada esfera absorbe un número limitado de desechos y luego desaparece.
- Solo puedes tener unas pocas activas a la vez.

La Conciencia Ecológica sobrante se guarda como progreso persistente en el **Refugio**.

### Dash de giro

Con `Q` / `E` la tortuga realiza un giro completo de 360° en menos de un segundo. Al iniciarlo recibe un **impulso temporal de velocidad** (hasta ×1.6) que decae de forma exponencial, y el giro fuerza un avance mínimo aunque sueltes las teclas: úsalo para encadenar giros y desplazarte rápido. El HUD muestra el multiplicador activo como `DASH ×N`.

### Cartas

Cuando completas el **70%** de la limpieza de una zona (y no es la última), antes de descender a la siguiente el juego se detiene y te ofrece **3 cartas** entre las que elegir una. Cada carta aplica una mejora (o maldición) **permanente durante esa run**, y las que vas eligiendo quedan registradas y se muestran en el resumen final.

El mazo tiene **50 cartas** repartidas en 6 rarezas: **común, rara, épica, legendaria, maldición y ultra legendaria**. El reparto es por rareza con pesos (`RARITY_WEIGHTS` en `src/cards/CardPool.ts`): **común 40 · rara 30 · épica 20 · legendaria 7 · maldición 2 · ultra legendaria 1**. El mazo está en `src/cards/CardPool.ts` y la lógica de reparto en `src/cards/CardManager.ts`. Las cartas se eligen con clic/toque o con las teclas `1` / `2` / `3`, y se colorean según su rareza (la ultra legendaria destaca con un brillo especial).

La **resistencia a la toxicidad** de las cartas se acumula con **rendimientos decrecientes**: cada punto adicional vale menos que el anterior, así que apilar caparazones nunca te vuelve inmune.

| Carta                     | Rareza           | Efecto                            | Descripción                                                |
| ------------------------- | ---------------- | --------------------------------- | ---------------------------------------------------------- |
| Aletas Ágiles             | Común            | +10% VEL                          | La tortuga nada más rápido en línea recta                  |
| Caparazón Denso           | Común            | +5% RES                           | El caparazón filtra mejor la toxicidad del agua            |
| Imán Débil                | Común            | +0.5 RADIO                        | Atrae desechos desde un poco más lejos                     |
| Pulmón Extra              | Común            | +1 FILTRO                         | Puedes mantener un filtro más activo a la vez              |
| Aletas Cortas             | Común            | +6% VEL                           | Pequeñas mejoras en las aletas traseras                    |
| Piel Gruesa               | Común            | +4% RES                           | La piel se endurece, resistiendo mejor el agua             |
| Instinto                  | Común            | +0.4 RADIO                        | Un sexto sentido para encontrar desechos                   |
| Válvula Extra             | Común            | +1 FILTRO                         | Un filtro adicional en el caparazón                        |
| Eco Menor                 | Común            | +8% ECO                           | Cada desecho resuena un poco más                           |
| Reflejos                  | Común            | +5% VEL / +0.3 RADIO              | Reacciona más rápido y detecta mejor                       |
| Caparazón Rizado          | Común            | +3% RES / +0.3 RADIO              | La forma curva repele un poco la toxicidad                 |
| Turbo Débil               | Común            | +0.2 DASH                         | Un pequeño impulso adicional en el giro                    |
| Colector                  | Común            | +1 FILTRO / +0.3 RADIO            | Un filtro más y algo de radio extra                        |
| Adaptación                | Común            | +3% VEL / +3% RES                 | La tortuga se adapta al medio hostil                       |
| Ojo de Pez                | Común            | +0.6 RADIO                        | Visión panorámica del entorno                              |
| Respiración               | Común            | +2% RES / +5% ECO                 | Respira mejor y vive en armonía con el océano              |
| Eco Amplificado           | Rara             | +25% ECO                          | Cada desecho recogido vale más                             |
| Dash Potenciado           | Rara             | +0.4 DASH                         | El giro de 360° da un impulso más fuerte                   |
| Simbiosis                 | Rara             | +1 ECO/S                          | Cada filtro activo genera eco por segundo                  |
| Imán Grande               | Rara             | +1.5 RADIO                        | Atrae desechos desde muy lejos                             |
| Caparazón Filtro          | Rara             | +15% RES                          | El caparazón absorbe mejor los tóxicos                     |
| Turbo                     | Rara             | +0.6 DASH                         | Impulso de giro notablemente más fuerte                    |
| Colonia de Filtros        | Rara             | +1.5 ECO/S                        | Los filtros generan más eco por segundo                    |
| Eco Mayor                 | Rara             | +35% ECO                          | El eco resuena con fuerza                                  |
| Aleta Doble               | Rara             | +20% VEL                          | Aletas extendidas, mucha más velocidad                     |
| Super Imán                | Rara             | +2 RADIO                          | Atrae desechos desde puntos lejanos                        |
| Pulmón de Hierro          | Rara             | +2 FILTROS                        | Dos filtros más activos a la vez                           |
| Resistencia Marina        | Rara             | +15% RES / +5% VEL                | Resistente y rápida a la vez                               |
| Filtro Mejorado           | Épica            | +2 FILTROS                        | Puedes mantener dos filtros más a la vez                   |
| Corazón de Medusa         | Épica            | +1 REVIVIR                        | Revives una vez al morir, con 20s de gracia                |
| Bioluminiscencia          | Épica            | +30% ECO                          | Brillas en la oscuridad y ganas más eco                    |
| Caparazón Reforzado       | Épica            | +2 FILTROS / +8% RES              | Más filtros y mejor resistencia                            |
| Mente Colmena             | Épica            | +2 ECO/S                          | Los filtros trabajan en perfecta sincronía                 |
| Nado Elegante             | Épica            | +15% VEL / +0.5 RADIO             | Desplazamiento fluido y mayor alcance                      |
| Reflejo Tóxico            | Épica            | +25% RES                          | El caparazón refleja gran parte de la toxicidad            |
| Simbiosis Mayor           | Épica            | +2 ECO/S / +1 FILTRO              | Los filtros generan más eco y tienes uno extra             |
| Escudo de Coral           | Épica            | +1 REVIVIR / +5% RES              | Un revivir adicional y algo de resistencia                 |
| Carga Ecológica           | Épica            | +50% ECO                          | El eco se acumula rápidamente                              |
| Caparazón Espejo          | Legendaria       | +40% RES                          | El caparazón repele la mayor parte de la contaminación     |
| Nado Supersónico          | Legendaria       | +50% VEL                          | La tortuga es la reencarnación de Flash                    |
| Caparazón del Titán       | Legendaria       | +15% RES / +2 FILTROS             | Un caparazón colosal con filtros y resistencia             |
| Torbellino                | Legendaria       | +1.0 DASH                         | El giro genera un vórtice devastador                       |
| Amplificador              | Legendaria       | +75% ECO                          | Todo el eco que generas se multiplica                      |
| Avaricia                  | Maldición        | +50% ECO / -20% VEL               | Más eco, pero la tortuga se vuelve lenta                   |
| Fragilidad                | Maldición        | +30% VEL / -50% RES               | Más rápida, pero mucho más vulnerable a la toxicidad       |
| Codicia Extrema           | Maldición        | +100% ECO / -30% VEL              | Mucho más eco, pero nadar cansa                            |
| Ruptura                   | Maldición        | +50% VEL / -30% RES               | Velocidad extrema con un caparazón frágil                  |
| Marea Primigenia          | Ultra Legendaria | +80% VEL / +5 FILTROS             | Sobrecarga de energía ancestral: velocidad y filtros       |
| Corazón del Océano        | Ultra Legendaria | +100% ECO / +3 ECO/S              | Sientes el pulso del mar; el eco fluye hacia ti            |
| Furia Abisal              | Ultra Legendaria | +1.2 DASH / +30% VEL / +1 REVIVIR | Una criatura ancestral se manifiesta a través del caparazón |

### Modo sin fin

Desde el Refugio puedes lanzar una **Inmersión sin fin** en lugar de la run normal. No termina al limpiar los 10 biomas: al llegar al fondo vuelve a empezar desde el primero en un nuevo **loop**, y la dificultad escala en cada vuelta (`BiomeGenerator.generateBiome(biomeKey, rng, loop)`):

- La **tasa de toxicidad** se multiplica por `1 + loop`.
- La **densidad de niebla** se multiplica por `1 + 0.2 · loop`.
- La **densidad de desechos** se multiplica por `1 + 0.3 · loop`.

El resumen de una inmersión sin fin es propio: muestra los **biomas sobrevividos** y el loop alcanzado, y el botón principal pasa a ser "Otra inmersión sin fin".

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
| `Espacio`       | Backflip                    |
| `B`             | Construir esfera filtradora |
| `C` (mantener)  | Ver hacia atrás             |
| `Esc` / `Enter` | Pausar / reanudar           |
| `R`             | Abandonar la inmersión      |

### Táctil (móvil)

- **Joystick izquierdo** (mitad izquierda de la pantalla): movimiento y giro **analógicos** (la inclinación regula velocidad y giro, con curva fina cerca del centro).
- **Stick vertical derecho** (mitad derecha): subir / bajar (también analógico).
- **Botón de impulso**: aumenta la velocidad.
- **Botón de filtro**: construye una esfera filtradora.
- **Botón de vista trasera** (mantener): cámara mirando hacia atrás.
- **Dash de giro (360°)**: botón dedicado (alterna el sentido en cada pulsación) o **deslizando rápido el joystick en horizontal** (flick).

Los controles táctiles aparecen al detectar el primer toque y se colocan donde apoyes el dedo.

## HUD

- **Desechos recolectados**, **Conciencia Ecológica** y **Progreso de zona** (porcentaje necesario para avanzar).
- **Calavera de toxicidad**: se llena de **lodo tóxico** y cambia de color según el nivel (verde pantano → oliva → óxido → sangre); un chevron marca la tendencia (▲ sube, ▼ limpiando).
- **Números flotantes**: al recoger un desecho aparece un `+N` sobre su posición en pantalla. El tamaño y el color crecen con el valor (cian → verde → dorado).
- **HUD de construcción**: indica el coste de la esfera filtradora y cuántas tienes activas (se tiñe de rojo si no puedes construir).
- **HUD de dash**: muestra el multiplicador del boost de giro mientras está activo.
- **Cluster de peligro** (arriba al centro): agrupa la **calavera de toxicidad** y el **temporizador de bioma** para que las señales de supervivencia no compitan con los recursos. El temporizador pasa de blanco a naranja y a rojo, y muestra **PRESIÓN** al agotarse.
- **Barra de energía del impulso** (abajo, centrada): energía disponible para el impulso; se oculta cuando está llena y se tiñe de naranja o rojo al agotarse.
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
- **Brillo de la tortuga**: la carta *Bioluminiscencia* enciende un glow propio en la tortuga que sube en 5 fases (color propio → saturación → blanqueo → blanco puro), con un pulso biológico y una luz puntual que pasa de cian a blanco puro; cada carta adicional intensifica el brillo.
- **Props por bioma**: rocas, corales, conchas, algas, esponjas y montículos de arrecife, con más relieve y detalle cuanto más profundo.

A medida que limpias un bioma, **el agua se aclara**: sube el brillo, baja la densidad de la niebla y se refuerzan los rayos. Al pasar de zona se reproduce una **transición** en la que una masa negra de borde irregular barre la pantalla y muestra el nombre del nuevo bioma y su **profundidad**.

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

# Typecheck
bun run typecheck

# Tests (una vez) / en watch / con cobertura
bun run test:run
bun run test
bun run test:coverage

# Lint y formato
bun run lint
bun run format:check
```

## Estructura del proyecto

```
oceancidio/
├── index.html            # Entry point, HUD, estilos base y calavera de toxicidad (SVG)
├── package.json
├── tsconfig.json
├── vite.config.ts        # Config de Vite (alias de importación)
├── vitest.config.ts      # Config de tests y cobertura
├── eslint.config.js      # Reglas de lint (flat config)
├── .github/workflows/    # CI: typecheck, lint, formato, tests y build
├── public/
│   ├── fonts/            # Fuentes (Pogonia para títulos, DM Sans para párrafos)
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
    ├── events/           # Eventos narrativos con opciones
    │   ├── EventPool.ts        # Catálogo de eventos
    │   └── EventEffects.ts     # Efectos declarativos, preview y aplicación
    ├── tycoon/           # Mejoras permanentes del Refugio
    │   ├── Upgrades.ts         # Catálogo de mejoras
    │   └── UpgradeManager.ts   # Compra y aplicación de mejoras
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
| `@tycoon/*`   | `src/tycoon/*`   |
| `@events/*`   | `src/events/*`   |
| `@/*`         | `src/*`          |

> Los alias solo se declaran para carpetas que existen. `@relics`, `@drones` y `@bosses` se eliminaron al no tener todavía código.

## Tecnologías utilizadas

- [Three.js](https://threejs.org/) — renderizado 3D WebGL
- [GSAP](https://gsap.com/) — animaciones UI (revelado de cartas; se congela junto con la pausa)
- [TypeScript](https://www.typescriptlang.org/) — tipado estático
- [Vite](https://vite.dev/) — bundler y servidor de desarrollo
- [Bun](https://bun.sh) — runtime y gestor de paquetes
