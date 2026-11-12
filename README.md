# Oceancide

Juego 3D donde controlas una tortuga marina que limpia los océanos de desechos. Desarrollado con **Three.js**, **TypeScript** y **Vite**.

## Descripción

Toma el control de una tortuga y desciende por las capas del océano recolectando basura y desechos tóxicos. Cada zona tiene mayor contaminación, menor visibilidad y más densidad de desechos. Tienes que recoger un porcentaje de los desechos de cada bioma para avanzar, mientras controlas el nivel de toxicidad: si llega al 100%, se acaba la partida.

Además de recolectar desechos directamente, puedes gastar **Conciencia Ecológica** para construir **esferas filtradoras** que atraen y absorben desechos por su cuenta. Y con el **dash de giro** (Q/E) puedes encadenar giros de 360° con un impulso temporal de velocidad.

Al limpiar cada zona eliges una **carta de mejora** (o maldición) que potencia tu tortuga durante el resto de la inmersión, con un toque roguelike: cada run es distinta. Si lo prefieres, puedes lanzar una **Inmersión sin fin** y ver cuánto aguantas con la dificultad subiendo en cada vuelta.

## Zonas

El catálogo define 10 zonas, desde la superficie hasta las fosas más profundas. Cada run recorre **6** en este orden: **Epipelágico Superior → Subfótico → Mesopelágico Profundo → Batipelágico Profundo → Abisopelágico → Mar Profundo**.

| Zona                  | Run | Desechos | Tasa de toxicidad | Profundidad |
| --------------------- | --- | -------- | ----------------- | ----------- |
| Epipelágico Superior  | Sí  | 0.1      | 0.00              | 20 m        |
| Pelágico Medio        | —   | 0.2      | 0.00              | 100 m       |
| Subfótico             | Sí  | 0.3      | 0.05              | 200 m       |
| Mesopelágico Superior | —   | 0.45     | 0.10              | 500 m       |
| Mesopelágico Profundo | Sí  | 0.6      | 0.20              | 1000 m      |
| Batipelágico Superior | —   | 0.7      | 0.35              | 2000 m      |
| Batipelágico Profundo | Sí  | 0.8      | 0.50              | 4000 m      |
| Abisopelágico         | Sí  | 0.9      | 0.70              | 6000 m      |
| Hadopelágico          | —   | 0.95     | 0.85              | 8000 m      |
| Mar Profundo          | Sí  | 1.0      | 1.00              | 11000 m     |

La columna **Run** marca las zonas que aparecen en el recorrido actual; el resto de configuraciones existe en `src/core/types.ts`, pero no se usa en la run. **Desechos** es la densidad relativa con la que se generan (sobre una base de 200 por zona) y **Tasa de toxicidad** multiplica la subida pasiva de toxicidad del bioma.

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

La Conciencia Ecológica sobrante se guarda como progreso persistente entre runs.

### Avisos y ayuda

La primera vez que pasa cada cosa importante aparece un **aviso contextual** bajo el mensaje central (en la misma burbuja translúcida teñida con el bioma que usan las reliquias), y no vuelve a salir (se guarda en `MetaState.seenTips`):

| Aviso | Cuándo salta |
| --- | --- |
| Recoger desechos | Primer desecho cerca y en pantalla. |
| Fugas | Primera fuga (`lixivia`) a la vista. |
| Frágiles | Primer desecho frágil roto por llegar con impulso. |
| Medusas | Primer golpe de medusa. |
| Tiempo | Cuando queda el 30% del tiempo del bioma. |
| Esfera filtradora | Primera vez que puedes pagar una (nombra la tecla `B` o el botón táctil). |

Los avisos salen de uno en uno, con un respiro entre ellos, y se congelan con la pausa. Los textos y la cola están en `src/core/tips.ts`.

La pantalla **Cómo jugar** (desde la pantalla de inicio) reúne el objetivo, los controles de teclado y táctiles, una ficha por cada tipo de desecho, peligro y herramienta, y un glosario de los atributos de las cartas. Ahí mismo se pueden **desactivar los avisos** o **volver a mostrarlos**.

### Dash de giro

Con `Q` / `E` la tortuga realiza un giro completo de 360° en menos de un segundo. Al iniciarlo recibe un **impulso temporal de velocidad** (hasta ×1.6) que decae de forma exponencial, y el giro fuerza un avance mínimo aunque sueltes las teclas: úsalo para encadenar giros y desplazarte rápido. El HUD muestra el multiplicador activo como `DASH ×N`.

### Medusas

Desde el primer bioma aparecen **medusas** que nadan por el bioma. La cantidad escala con la profundidad: **2 medusas en el Epipelágico Superior** y una más por cada zona, hasta **7 en el Mar Profundo**. En la Inmersión sin fin el contador se mantiene entre 2 y 7 en cada vuelta.

- **Nadan a pulsos**: contraen la campana para impulsarse hacia su rumbo y planean mientras se relajan, con los tentáculos recogiéndose y estirándose detrás. El rumbo vaga solo, se inclinan hacia donde avanzan y dan la vuelta al acercarse a los bordes. Ritmo, fuerza y rumbo inicial salen de la semilla de la run.
- Respetan los límites del bioma y nunca aparecen en el centro, donde se coloca la tortuga al entrar.
- Si tocan a la tortuga, aplican **+15 de toxicidad**, la **ralentizan un 50% durante 2 s** y muestran el aviso **"¡MEDUSA!"**.
- El golpe dispara una **animación de dolor** de 0,42 s: la tortuga retrocede, se comprime y emite un flash magenta con una luz de impacto.
- Tras golpear entran en un **cooldown de 3 s**: se vuelven casi transparentes y su luz rosa se apaga, así que no pueden encadenar golpes.
- En **modo dios** el impacto no aplica daño ni ralentización.

### Cartas

Cuando completas el **60%** de los desechos iniciales de una zona (el HUD lo muestra como 100% de progreso) y no es la última, antes de descender a la siguiente el juego se detiene y te ofrece **3 cartas** entre las que elegir una. En los biomas 2 y 4, antes de las cartas se resuelve un **evento** (ver la sección siguiente). Cada carta aplica una mejora (o maldición) **permanente durante esa run**, y las que vas eligiendo quedan registradas y se muestran en el resumen final.

El mazo tiene **55 cartas** repartidas en 7 rarezas: **común, rara, épica, legendaria, maldición, ultra legendaria y caos**. El reparto es por rareza con pesos (`RARITY_WEIGHTS` en `src/cards/CardPool.ts`): **común 40 · rara 30 · épica 20 · legendaria 7 · maldición 2 · ultra legendaria 1 · caos 14** (≈ 35% · 26% · 17.5% · 6% · 1.8% · 0.9% · 12%). Primero se sortea la rareza según esos pesos y luego una carta al azar dentro de ella, así que la probabilidad no depende de cuántas cartas tenga cada rareza. Un sistema de *pity* garantiza rara+ tras 3 elecciones sin verla y épica+ tras 4. El mazo está en `src/cards/CardPool.ts` y la lógica de reparto en `src/cards/CardManager.ts`. Las cartas se eligen con clic/toque o con las teclas `1` / `2` / `3`, y se colorean según su rareza: la ultra legendaria brilla y las de **caos** parpadean con un glitch naranja.

Las cartas de **caos** no son mejoras seguras: pueden duplicar o partir tu eco, mutar dos stats al azar, añadir medusas a los siguientes biomas o subir la toxicidad pasiva. Algunas devuelven un texto con el resultado aleatorio para que sepas qué te ha tocado.

La **resistencia a la toxicidad** se acumula con **rendimientos decrecientes**, venga de cartas o de mejoras permanentes: cada punto adicional vale menos que el anterior, así que apilar caparazones nunca te vuelve inmune (tope del 90%).

Cada carta declara sus efectos (`effects` en `src/cards/CardPool.ts`) y de ahí salen tanto el valor que se muestra como lo que se aplica, así que ninguna carta hace algo que no enseñe. En la elección, cada tramo del valor se pinta según su signo: verde lo que mejora y rojo lo que penaliza.

Debajo de la descripción, cada carta muestra una **vista previa "antes → después"** con los valores actuales de la tortuga (por ejemplo, `Velocidad 9.0 → 9.9`), así que se ve el efecto real de la resistencia con rendimientos decrecientes o de un atributo que ya está en su tope. Las cartas de azar avisan de que su resultado se decide al elegirlas. La vista previa se calcula en `src/cards/BuildStats.ts`, y un test comprueba con todo el mazo que coincide con lo que la carta aplica de verdad.

Las abreviaturas de las cartas corresponden a estos atributos:

| Abreviatura | Atributo | Qué hace |
| --- | --- | --- |
| VEL | Velocidad | Lo rápido que nadas. |
| RES | Resistencia | Frena la toxicidad pasiva (rendimientos decrecientes, tope 90%). |
| RADIO | Radio de recogida | Distancia a la que recoges un desecho. |
| FILTRO | Filtros | Esferas filtradoras activas a la vez. |
| ECO | Eco por desecho | Multiplica el eco de cada desecho. |
| DASH | Fuerza del dash | Empujón de velocidad del giro de 360°. |
| ECO/S | Eco por filtro | Eco por segundo de cada esfera activa. |
| REVIVIR | Revivir | Veces que vuelves si la toxicidad se llena. |
| BRILLO | Brillo | Luz propia de la tortuga. |
| MEDUSAS | Medusas extra | Medusas añadidas a cada zona. |
| TOX PASIVA | Toxicidad pasiva | Multiplica la subida pasiva de toxicidad. |
| TOX | Toxicidad | Cambio inmediato en la calavera. |

En la **pausa**, el panel **Tu tortuga** enseña el valor actual de cada atributo con su explicación, las cartas elegidas (con el color de su rareza) y las reliquias encontradas.

| Carta                     | Rareza           | Efecto                            | Descripción                                                |
| ------------------------- | ---------------- | --------------------------------- | ---------------------------------------------------------- |
| Aletas Ágiles             | Común            | +10% VEL                          | La tortuga nada más rápido en línea recta                  |
| Caparazón Denso           | Común            | +5% RES                           | El caparazón filtra mejor la toxicidad del agua            |
| Imán Débil                | Común            | +0.5 RADIO                        | Atrae desechos desde un poco más lejos                     |
| Pulmón Extra              | Común            | +1 FILTRO                         | Puedes mantener un filtro más activo a la vez              |
| Aletas Cortas             | Común            | +6% VEL                           | Pequeñas mejoras en las aletas traseras                    |
| Piel Gruesa               | Común            | +4% RES                           | La piel se endurece y resiste mejor la toxicidad           |
| Instinto                  | Común            | +0.4 RADIO                        | Un sexto sentido para encontrar desechos                   |
| Válvula Extra             | Común            | +1 FILTRO                         | Un filtro adicional en el caparazón                        |
| Eco Menor                 | Común            | +8% ECO                           | Cada desecho resuena un poco más                           |
| Reflejos                  | Común            | +5% VEL / +0.3 RADIO              | Reacciona más rápido y detecta mejor                       |
| Caparazón Rizado          | Común            | +3% RES / +0.3 RADIO              | La forma curva repele un poco la toxicidad                 |
| Turbo Débil               | Común            | +0.2 DASH                         | Un pequeño impulso adicional en el dash                    |
| Colector                  | Común            | +1 FILTRO / +0.3 RADIO            | Un filtro más y algo de radio extra                        |
| Adaptación                | Común            | +3% VEL / +3% RES                 | La tortuga se adapta al medio hostil                       |
| Ojo de Pez                | Común            | +0.6 RADIO                        | Visión panorámica del entorno                              |
| Respiración               | Común            | +2% RES / +5% ECO                 | Respira mejor y vive en armonía con el océano              |
| Eco Amplificado           | Rara             | +25% ECO                          | Cada desecho recogido vale más                             |
| Dash Potenciado           | Rara             | +0.4 DASH                         | El giro de 360° da un impulso más fuerte                   |
| Simbiosis                 | Rara             | +1 ECO/S                          | Cada filtro activo genera eco por segundo                  |
| Imán Grande               | Rara             | +1.5 RADIO                        | Atrae desechos desde muy lejos                             |
| Caparazón Filtro          | Rara             | +15% RES                          | El caparazón absorbe mejor los tóxicos                     |
| Turbo                     | Rara             | +0.6 DASH                         | El dash impulsa notablemente más fuerte                    |
| Colonia de Filtros        | Rara             | +1.5 ECO/S                        | Los filtros generan más eco por segundo                    |
| Eco Mayor                 | Rara             | +35% ECO                          | El eco resuena con fuerza                                  |
| Aleta Doble               | Rara             | +20% VEL                          | Aletas extendidas, mucha más velocidad                     |
| Super Imán                | Rara             | +2 RADIO                          | Atrae desechos desde puntos lejanos                        |
| Pulmón de Hierro          | Rara             | +2 FILTROS                        | Dos filtros más activos a la vez                           |
| Resistencia Marina        | Rara             | +15% RES / +5% VEL                | Resistente y rápida a la vez                               |
| Filtro Mejorado           | Épica            | +2 FILTROS                        | Puedes mantener dos filtros más a la vez                   |
| Corazón de Medusa         | Épica            | +1 REVIVIR                        | Revives una vez al morir, con 20s de gracia                |
| Bioluminiscencia          | Épica            | +30% ECO / +5% VEL / +50% BRILLO  | Brillas en la oscuridad, nadas algo más rápido y ganas más eco |
| Caparazón Reforzado       | Épica            | +2 FILTROS / +8% RES              | Más filtros y mejor resistencia                            |
| Mente Colmena             | Épica            | +2 ECO/S                          | Los filtros trabajan en perfecta sincronía                 |
| Nado Elegante             | Épica            | +15% VEL / +0.5 RADIO             | Desplazamiento fluido y mayor alcance                      |
| Reflejo Tóxico            | Épica            | +25% RES                          | El caparazón refleja gran parte de la toxicidad            |
| Simbiosis Mayor           | Épica            | +2 ECO/S / +1 FILTRO              | Los filtros generan más eco y tienes uno extra             |
| Escudo de Coral           | Épica            | +1 REVIVIR / +5% RES              | Un revivir adicional y algo de resistencia                 |
| Carga Ecológica           | Épica            | +50% ECO                          | El eco se acumula rápidamente                              |
| Caparazón Espejo          | Legendaria       | +40% RES                          | El caparazón repele la mayor parte de la toxicidad         |
| Nado Supersónico          | Legendaria       | +50% VEL                          | Nadas tan rápido que dejas atrás tu propia estela          |
| Caparazón del Titán       | Legendaria       | +15% RES / +2 FILTROS             | Un caparazón colosal con filtros y resistencia             |
| Torbellino                | Legendaria       | +1 DASH                           | El dash desata un vórtice devastador                       |
| Amplificador              | Legendaria       | +75% ECO                          | Todo el eco que generas se multiplica                      |
| Avaricia                  | Maldición        | +50% ECO / -20% VEL               | Más eco, pero la tortuga se vuelve lenta                   |
| Fragilidad                | Maldición        | +30% VEL / -50% RES               | Más rápida, pero mucho más vulnerable a la toxicidad       |
| Codicia Extrema           | Maldición        | +100% ECO / -30% VEL              | Mucho más eco, pero nadar cansa                            |
| Ruptura                   | Maldición        | +50% VEL / -30% RES               | Velocidad extrema con un caparazón frágil                  |
| Marea Primigenia          | Ultra Legendaria | +80% VEL / +5 FILTROS             | Sobrecarga de energía ancestral: velocidad y filtros       |
| Corazón del Océano        | Ultra Legendaria | +100% ECO / +3 ECO/S              | Sientes el pulso del mar; el eco fluye hacia ti            |
| Furia Abisal              | Ultra Legendaria | +1.2 DASH / +30% VEL / +1 REVIVIR | Una criatura ancestral se manifiesta a través del caparazón |
| Mutación                  | Caos             | ↑ AL AZAR / ↓ AL AZAR             | El agua reescribe tu cuerpo: un atributo al azar florece y otro se atrofia |
| Doble o Nada              | Caos             | ECO ×2 O ×0.5                     | La marea decide: el eco se duplica o se parte en dos       |
| Pacto de la Medusa        | Caos             | +1 REVIVIR / +2 MEDUSAS           | La colonia te presta una vida, pero cada bioma trae más tentáculos |
| Eco Inestable             | Caos             | +100% ECO / +50% TOX PASIVA       | El eco grita tan fuerte que el agua se vuelve más tóxica   |
| Marea Negra               | Caos             | +25% VEL / +1 FILTRO / +20 TOX    | Ganas impulso y un filtro extra, pero el agua te envenena al instante |

### Reliquias

A partir de la **primera carta elegida**, cada bioma esconde una **reliquia** dentro de uno de sus desechos. Un pequeño **destello dorado** que gira sobre él lo delata: hay que buscarlo entre la niebla.

- Al recoger ese desecho —a mano o con una esfera filtradora— la reliquia entrega su **recompensa** y aparece un aviso con su nombre, un texto de ambientación y lo que has ganado. El aviso es una **burbuja translúcida** teñida con el color del agua y el acento del bioma en el que estás.
- Las recompensas son siempre positivas y usan los mismos efectos declarativos que los eventos: Eco, menos toxicidad, radio, velocidad, un filtro extra, brillo o tiempo para el siguiente bioma.
- Si avanzas de zona sin encontrarla, se pierde. No se repiten dentro de una run hasta haberlas encontrado todas.
- Qué reliquia toca y en qué desecho se esconde sale de la semilla de la run.

| Reliquia               | Recompensa                   |
| ---------------------- | ---------------------------- |
| Brújula del Náufrago   | +0.5 radio                   |
| Mensaje en una Botella | +200 Eco                     |
| Patito de Goma         | +5% velocidad                |
| Moneda de Galeón       | +350 Eco                     |
| Perla Antigua          | -30 toxicidad                |
| Ampolleta de Arena     | +20s en el siguiente bioma   |
| Farol de Buzo          | +30% brillo y +100 Eco       |
| Diente de Megalodón    | +1 filtro                    |
| Caracola Susurrante    | -15 toxicidad y +100 Eco     |
| Caparazón Vacío        | +3% velocidad y +0.3 radio   |

### Eventos

En las runs normales, al completar el **Subfótico** (bioma 2) y el **Batipelágico Profundo** (bioma 4) aparece un **evento narrativo** antes de la elección de carta. El pool actual tiene **5 eventos** y cada uno ofrece **2 opciones**; la interfaz muestra una **previsualización** de los efectos de cada opción (eco, toxicidad, filtros, radio, velocidad, brillo o tiempo del siguiente bioma) antes de decidir.

Los efectos son declarativos (`src/events/EventEffects.ts`): una opción puede modificar la eco, subir o bajar la toxicidad, fijarla a un valor, alterar la capacidad de filtros, el radio de recogida, la velocidad, el brillo, o recortar/ajustar el tiempo y el suelo de toxicidad del siguiente bioma. Si una opción lleva la toxicidad al 100%, la muerte o el revive se resuelven antes de abrir las cartas.

Los eventos no aparecen en la **Inmersión sin fin**. Su elección se deriva de la semilla de la run (índice de bioma incluido), así que al reproducir una run con `?seed=` también se repiten los eventos.

### Modo sin fin

Desde la pantalla de inicio puedes lanzar una **Inmersión sin fin** en lugar de la run normal. No termina al limpiar los **6 biomas de la vuelta**: al llegar al fondo vuelve a empezar desde el primero en un nuevo **loop**, y la dificultad escala en cada vuelta (`BiomeGenerator.generateBiome(biomeKey, rng, loop)`):

- La **tasa de toxicidad** se multiplica por `1 + loop`.
- La **densidad de niebla** se multiplica por `1 + 0.2 · loop`.
- La **densidad de desechos** se multiplica por `1 + 0.3 · loop`.

El Eco se **asegura al cerrar cada vuelta**: al pasar del último bioma al primero, todo lo acumulado queda guardado (la transición lo anuncia). Si mueres o abandonas a mitad de vuelta, de lo conseguido en esa vuelta solo conservas el **50%** (`ENDLESS_UNBANKED_KEEP` en `MetaState.ts`); lo asegurado no se pierde nunca. La pausa muestra cuánto llevas asegurado, la confirmación de abandono avisa de lo que perderías y el resumen indica lo perdido. No hay bono de completar, porque la inmersión sin fin no se completa.

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
- **Revivir disponibles**: un corazón con el número de revivir que quedan, bajo la calavera; solo aparece cuando tienes alguno.
- **Avisos contextuales**: consejos de una sola vez bajo el mensaje central (ver *Avisos y ayuda*).

## Visuales y ambientación

La interfaz usa una paleta de tres colores definida en `src/ui/palette.ts`: **crema** `#F5EEDD` (texto y superficies claras), **azul niebla** `#84B3C3` (acentos, bordes y foco) y **azul profundo** `#16587B` (botones, paneles y avisos). Los colores con significado propio —rarezas de las cartas, peligro, toxicidad y positivo/negativo— se mantienen aparte para que se distingan.

El agua no es un simple fondo: hay una capa de efectos (`src/world/WaterEffects.ts`) que simula el medio marino y que se adapta a cada bioma.

- **Cúpula con gradiente** (horizonte, cenit y nadir) con el brillo del sol, que sigue a la cámara.
- **Niebla con absorción por canal**: el rojo se pierde antes que el azul, como en el agua real.
- **Rayos de luz** (god rays) que cuelgan desde la superficie mientras llega el sol.
- **Nieve marina**: partículas cercanas a la cámara que dan sensación de volumen y parallax.
- **Viñeta** tintada con el color del agua.
- **Cáusticas animadas** sobre el fondo en las zonas donde llega la luz.
- **Bioluminiscencia**: en las zonas profundas (sin sol) las luces puntuales nacen de props luminosos (fuentes hidrotermales, esponjas de vidrio, plumas de mar) y pasan a ser la iluminación principal.
- **Estela de burbujas del color del bioma**: las burbujas que deja la tortuga al nadar se tiñen con el agua y el acento bioluminiscente de cada zona (aclarados para que destaquen), así que cambian de cian en la superficie a violetas, rosas o naranjas en las profundidades.
- **Brillo de la tortuga**: la carta *Bioluminiscencia* enciende un brillo propio en la tortuga que sube en 5 fases (color propio → saturación → blanqueo → blanco puro), con un pulso biológico y una luz puntual que pasa de cian a blanco puro; cada carta adicional intensifica el brillo.
- **Props por bioma**: cada zona tiene su propia mezcla y paleta. Las aguas someras usan kelp, abanicos de mar, corales y arrecifes; el mesopelágico, plumas y esponjas de vidrio; el batipelágico, gusanos de tubo y huesos de ballena; y el abisal, nódulos, chimeneas hidrotermales y agujas de roca.
- **Vida sésil animada**: corales, algas, kelp, abanicos, plumas y gusanos se balancean con una fase y velocidad propias, sin abandonar su posición en el fondo.
- **Fauna libre**: las medusas rosas combinan un domo semitransparente con transmisión, seis tentáculos y una luz puntual propia. Se mecen y derivan de forma errática; durante su cooldown de 3 s se vuelven casi invisibles.

A medida que limpias un bioma, **el agua se aclara**: sube el brillo, baja la densidad de la niebla y se refuerzan los rayos. Al pasar de zona se reproduce una **transición** en la que una masa negra de borde irregular barre la pantalla y muestra el nombre del nuevo bioma y su **profundidad**.

El renderizado pasa por un **pipeline de post-proceso** (`src/core/RenderPipeline.ts`): tonemapping neutro y un **bloom dinámico** que solo se activa en las profundidades (cuando el sol se apaga). Cuando el bloom es inapreciable, el pipeline se salta el composer y renderiza directo para ahorrar recursos.

## Progreso

Al terminar cada run se muestra un resumen (zona alcanzada, desechos, duración, semilla, cartas elegidas y conciencia obtenida) y se actualiza el progreso persistente guardado en `localStorage` bajo la clave `oceancide.meta`:

- **Conciencia ecológica** total acumulada.
- **Mejor zona** alcanzada.
- **Runs jugadas / completadas**.
- **Total de desechos** recolectados.

Completar todos los biomas de la run otorga un **bono del 25%** sobre la conciencia obtenida en la run. Desde la pantalla de inicio puedes empezar una nueva inmersión, abrir **Cómo jugar** o **Ajustes**, o eliminar el progreso guardado. El guardado también recuerda qué avisos has visto.

### Ajustes

La pantalla **Ajustes** (en el inicio y en la pausa) permite cambiar la calidad gráfica, el campo de visión, reducir el movimiento (seguir al sistema o forzarlo), el **modo para daltonismo** (protanopía, deuteranopía o tritanopía: cambia la paleta de mejora/empeora/aviso/fuga y añade símbolos ▲ ▼ y formas para no depender solo del color), la vibración, el tamaño y la opacidad de los controles táctiles, la pista de teclas y los consejos. Los cambios se aplican al momento y se guardan en `localStorage` bajo su propia clave, `oceancide.settings`, así que **eliminar el progreso no los borra**. `?quality=low|medium|high|auto` en la URL sobreescribe la calidad durante esa sesión.

### Reproducir una run

Cada run usa una semilla aleatoria (que se muestra en el resumen). Puedes fijarla desde la URL para reproducir exactamente la misma disposición de biomas, las mismas cartas ofrecidas y los mismos eventos:

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
bun run lint:fix
bun run format
bun run format:check
```

## Calidad y tests

La lógica pura y los controladores se prueban con **Vitest** en entorno `node` (sin WebGL ni DOM). La cobertura se centra en los módulos extraíbles y testables:

- `src/core/systems/*`: toxicidad, tiempo de bioma, progreso y revives.
- `src/core/InputController.ts` y `src/core/CameraRig.ts`.
- `src/core/MetaState.ts`, `src/core/rng.ts` y `src/core/tips.ts`.
- `src/events/EventEffects.ts` y `src/events/EventPool.ts`.
- `src/cards/CardManager.ts` y `src/cards/BuildStats.ts`.
- `src/tycoon/UpgradeManager.ts` y `src/tycoon/Upgrades.ts`.

También hay tests de comportamiento para `BiomeProps`, el catálogo de desechos, `EnemyManager` y la ralentización de `Turtle`. Esos archivos no forman parte del porcentaje de cobertura, que se reserva para lógica pura y controladores.

Los umbrales configurados en `vitest.config.ts` son **90% statements, 80% branches, 90% functions y 90% lines**. `Game.ts` y la UI quedan fuera de la cobertura hasta que se extraigan más sistemas.

El CI (`.github/workflows/ci.yml`) se ejecuta en cada push a `main` y en cada pull request: instala dependencias con el lockfile y pasa `typecheck`, `lint`, `format:check`, `test:run` y `build`.

## Estructura del proyecto

```
oceancide/
├── index.html            # Entry point, HUD, estilos base y calavera de toxicidad (SVG)
├── package.json
├── tsconfig.json
├── vite.config.ts        # Config de Vite (alias de importación)
├── vitest.config.ts      # Config de tests y cobertura
├── eslint.config.js      # Reglas de lint (flat config)
├── .prettierrc.json      # Config de Prettier
├── .prettierignore
├── .github/workflows/    # CI: typecheck, lint, formato, tests y build
├── public/
│   ├── fonts/            # Fuentes woff2 con subconjunto latino (Pogonia, Tanbuster, DM Sans regular y bold)
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.ts           # Bootstrap del juego
    ├── styles.css        # @font-face, tokens de diseño (--color-*, --radius-*, --rarity-*) y estilos de la UI
    ├── core/             # Núcleo y estado global
    │   ├── Game.ts             # Lógica principal, loop y orquestación
    │   ├── InputController.ts  # Teclado → InputState y acciones
    │   ├── CameraRig.ts        # Seguimiento, look-back y órbita
    │   ├── RenderPipeline.ts   # Tonemapping + bloom dinámico
    │   ├── MetaState.ts        # Progreso persistente y guardado
    │   ├── rng.ts              # Generador pseudoaleatorio con semilla
    │   ├── tips.ts             # Avisos contextuales: textos y cola
    │   ├── systems/            # Fórmulas puras y testeables
    │   │   ├── toxicity.ts     # Toxicidad pasiva, entrada y limpieza
    │   │   └── progression.ts  # Tiempo de bioma, progreso y revives
    │   └── types.ts            # Tipos y configuración de biomas
    ├── world/            # Generación y elementos del mundo
    │   ├── BiomeGenerator.ts   # Generación de biomas, terreno, partículas y desechos
    │   ├── BiomeProps.ts       # Props decorativos por bioma
    │   ├── BiomeTransition.ts  # Transición animada entre biomas
    │   ├── EnemyManager.ts     # Spawn, límites, colisión y cooldown de la fauna hostil
    │   ├── WaterEffects.ts     # Cúpula, niebla con absorción, rayos y nieve marina
    │   ├── Structure.ts        # Esfera filtradora colocada en el agua
    │   ├── StructureConfig.ts  # Configuración de estructuras
    │   └── StructureManager.ts # Ciclo de vida de las estructuras
    ├── entities/         # Entidades del juego
    │   ├── Turtle.ts           # Modelo y movimiento de la tortuga
    │   ├── Enemy.ts            # Medusa: domo, tentáculos, luz, deriva y cooldown
    │   ├── Debris.ts           # Desechos recolectables
    │   ├── DebrisVisuals.ts    # Aspecto visual de cada tipo de desecho
    │   ├── debrisCatalog.ts    # Catálogo de desechos por bioma
    │   └── BubbleTrail.ts      # Estela de burbujas (instancing)
    ├── cards/            # Sistema de cartas roguelike
    │   ├── Card.ts             # Tipos de carta y estado de la run
    │   ├── CardManager.ts      # Reparto y aplicación de cartas
    │   ├── CardEffects.ts      # Efectos declarativos: texto, color y aplicación
    │   ├── BuildStats.ts       # Atributos de la build, vista previa y panel de pausa
    │   └── CardPool.ts         # Mazo de cartas y pesos por rareza
    ├── events/           # Eventos narrativos con opciones
    │   ├── EventPool.ts        # Catálogo de eventos
    │   └── EventEffects.ts     # Efectos declarativos, preview y aplicación
    ├── tycoon/           # Mejoras permanentes
    │   ├── Upgrades.ts         # Catálogo de mejoras
    │   └── UpgradeManager.ts   # Compra y aplicación de mejoras
    └── ui/               # Interfaz y controles
        ├── UIManager.ts        # HUD, números flotantes, calavera y mensajes
        ├── ScreenManager.ts    # Menús (hub, resumen, pausa, ayuda, eventos y elección de cartas)
        ├── ConfirmDialog.ts    # Diálogo de confirmación propio (sin window.confirm)
        ├── dom.ts              # Nodos y botones base de las pantallas (estilos en styles.css)
        ├── rarity.ts           # Nombre e icono con forma propia de cada rareza
        ├── HowToPlay.ts        # Contenido de la pantalla "Cómo jugar"
        ├── TouchControls.ts    # Controles táctiles (joysticks)
        └── DevMenu.ts          # Menú de desarrollo (solo en DEV o con ?dev)
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
- [Vitest](https://vitest.dev/) — tests unitarios y cobertura
- [ESLint](https://eslint.org/) — lint
- [Prettier](https://prettier.io/) — formato
- [Bun](https://bun.sh) — runtime y gestor de paquetes
