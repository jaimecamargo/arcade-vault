# SPEC 09 — Juego real: SNAKE

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-09
> **Objetivo:** Agregar SNAKE al catálogo como juego real (`id: "vibora"`), construido desde cero —sin template de referencia, a partir de las respuestas del usuario— con movimiento continuo en cuadrícula y las frutas provistas en `references/templates/source-assets/snake-assets/` como sprites de recompensa, siguiendo el patrón de registro de SPEC 05 y las tablas `games`/`scores` de SPEC 06.

## Por qué existe este spec

A diferencia de SPEC 07 (Tetris) y SPEC 08 (Arkanoid), este juego no parte de un template en `references/templates/started-games/` — no existe ninguno para Snake. El diseño del juego se obtuvo por preguntas directas al usuario (`AskUserQuestion`, modo B del skill `add-game`), y el único insumo externo es un asset visual: `references/templates/source-assets/snake-assets/fruits.png` (spritesheet de 22 frutas, 3790×442px, fondo transparente) junto a `sprites.js`, que documenta las coordenadas de recorte de cada fruta dentro de la hoja.

Además, el `id` natural `"snake"` colisiona con `.cover-snake`, una clase CSS ya existente en `app/globals.css` que pertenece al juego decorativo `serpentina` de SPEC 01 (nunca implementado como fila real de Supabase, pero su cobertura visual sigue viva en el CSS). Por eso el juego se registra con `id: "vibora"` mientras conserva `title: "SNAKE"` como nombre visible — mismo patrón que `asteroids` usando `cover-rocas` sin relación 1:1 entre id y nombre de clase.

## Scope

**In:**

- Nueva fila en `public.games` (Supabase): `id: "vibora"`, `title: "SNAKE"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-vibora"`, `short`/`long` según el copy confirmado en el Modelo de datos.
- `components/games/vibora/engine.ts`: motor propio en TypeScript dentro de `createViboraEngine(canvas): ViboraEngine`, con `start()`, `stop()`, `destroy()`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`. Sin estado de módulo global — todo el estado mutable (serpiente, dirección, fruta activa, puntaje, frutas comidas, nivel, intervalo de movimiento, temporizador acumulado) vive en el closure de la factory.
- `components/games/vibora/sprites.ts`: port literal de `references/templates/source-assets/snake-assets/sprites.js` (mapa `x, y, w, h` de las 22 frutas dentro de la hoja) a un objeto TypeScript tipado, más la tabla `FRUIT_POINTS` (ver Modelo de datos). Es _data_ de la carpeta del componente, no un asset binario.
- `public/games/vibora/fruits.png`: copia binaria de `references/templates/source-assets/snake-assets/fruits.png`, servida en `/games/vibora/fruits.png` y cargada con `new Image()` dentro de la factory del motor (no `next/image`).
- `components/games/vibora/ViboraCanvas.tsx`: Client Component que implementa `GamePlayerProps`, mismo patrón de ~52 líneas que `AsteroidsCanvas.tsx`/`TetrisCanvas.tsx` (efecto de montaje con cleanup vía `destroy()`, efecto separado sobre `[paused]` que llama `stop()`/`start()`).
- Registro: una línea de import y una entrada `vibora: ViboraCanvas` en `components/games/registry.ts`, manteniendo orden alfabético (`arkanoid`, `asteroids`, `tetris`, `vibora`).
- Bloque CSS `.cover-vibora` en `app/globals.css`, al final de la sección de portadas, antes del comentario `/* ===== detail screen ===== */`, con motivo visual propio (serpiente sobre cuadrícula/pasto, tono `--green`), visualmente distinto de `.cover-snake` ya existente (que pertenece a `serpentina` y no se toca). Se invoca `/frontend-design` para esta pieza.
- Canvas lógico fijo 800×600, cuadrícula de juego `CELL=25`, `COLS=32`, `ROWS=24` (32×25=800, 24×25=600 — sin resto, sin letterboxing).
- Controles de teclado (`e.code`): `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` cambian de dirección; se ignora un cambio que revierta directamente sobre la dirección actual (evita que la cabeza choque contra el primer segmento del cuello en el mismo tick). `preventDefault()` en las cuatro para que no scrolleen la página.
- Movimiento continuo por pasos de cuadrícula (no por píxel): la serpiente avanza una celda cada `moveInterval` ms; solo se aplica **una** dirección en cola por paso, aunque el jugador presione varias teclas entre pasos.
- Fruta: una sola en pantalla a la vez. Al comerla, la serpiente crece un segmento, se otorgan los puntos de `FRUIT_POINTS[key]`, y aparece una fruta nueva de tipo aleatorio en una celda libre (no ocupada por la serpiente).
- Progresión: `level = floor(fruitsEaten / 5) + 1`, reportado vía `onLevel` en cada cambio. `moveInterval = max(60, 150 - (level - 1) * 15)` ms — cada 5 frutas el juego se vuelve más rápido, con piso de 60ms/paso.
- Vidas: **una sola vida real**, igual que Tetris (SPEC 07). `onLives(1)` al iniciar; al chocar contra un borde del tablero o contra su propio cuerpo se emiten `onLives(0)` y `onGameOver()` en el mismo instante, y el motor se detiene sin reiniciar.
- HUD propio dibujado en el canvas: puntaje, nivel y longitud actual de la serpiente, además de la lista de controles — mismo criterio que Asteroids/Tetris/Arkanoid (el CRT se ve como un gabinete real).
- Presentación: serpiente dibujada vectorialmente como bloques sólidos redondeados en `var(--green)` (cabeza con un tono distinguible del cuerpo), fruta dibujada con el sprite real correspondiente del atlas, escalado para caber dentro de una celda (`object-fit: contain` manual — mantiene el aspect ratio original de cada fruta, centrado en la celda).

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a `components/game-player-screen.tsx`, `components/games/types.ts`, `lib/supabase/types.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- Cualquier otro juego del catálogo (`arkanoid`, `asteroids`, `tetris`, ni las filas decorativas existentes, incluida `serpentina`/`.cover-snake`, que no se toca ni se fusiona con `vibora`).
- RLS en Supabase — sigue deshabilitado; riesgo ya aceptado en SPEC 06.
- Audio / efectos de sonido.
- Obstáculos internos fijos en el tablero (solo mata el borde o el propio cuerpo).
- Power-ups o frutas con efectos especiales (velocidad, invencibilidad, etc.) — todas las frutas solo otorgan puntos y crecimiento.
- Wrap-around en los bordes — cruzar el borde termina la partida, no teletransporta.
- Controles táctiles / móviles.
- Rutas nuevas — `/juegos/[id]/jugar` sigue siendo genérica.

## Modelo de datos

No se introducen tablas ni columnas nuevas. Se reutilizan `GameRow` y `ScoreRow` de `lib/supabase/types.ts` sin cambios (SPEC 06). Solo crece la tabla `games` con una fila más:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'vibora', 'SNAKE',
  'Guía a la víbora por el tablero, devora fruta y crece sin chocar contra tu propia cola.',
  'Controla la víbora con las flechas ↑ ↓ ← → y recórrela por el tablero. Cada fruta que comas te alarga y suma puntos según su tipo; la velocidad sube cada 5 frutas comidas. Chocar contra un borde o contra tu propio cuerpo termina la partida.',
  'ARCADE', 'cover-vibora', 'green'
);
```

`components/games/vibora/sprites.ts` — port literal de `snake-assets/sprites.js`, más la tabla de puntos (nueva, no existía en el original):

```ts
export const FRUIT_ATLAS: Record<
    string,
    { x: number; y: number; w: number; h: number }
> = {
    banana: { x: 34, y: 136, w: 110, h: 160 },
    orange: { x: 186, y: 136, w: 150, h: 160 },
    grape: { x: 378, y: 136, w: 110, h: 160 },
    garlic: { x: 540, y: 136, w: 130, h: 160 },
    eggplant: { x: 712, y: 136, w: 130, h: 160 },
    strawberry: { x: 894, y: 136, w: 110, h: 160 },
    cherry: { x: 1066, y: 136, w: 110, h: 160 },
    carrot: { x: 1228, y: 136, w: 130, h: 160 },
    mushroom: { x: 1400, y: 136, w: 130, h: 160 },
    broccoli: { x: 1582, y: 136, w: 110, h: 160 },
    watermelon: { x: 1734, y: 136, w: 150, h: 160 },
    pepper: { x: 1906, y: 136, w: 150, h: 160 },
    kiwi: { x: 2068, y: 136, w: 170, h: 160 },
    lemon: { x: 2250, y: 136, w: 140, h: 160 },
    peach: { x: 2432, y: 136, w: 130, h: 160 },
    peanut: { x: 2604, y: 136, w: 130, h: 160 },
    apple: { x: 2786, y: 136, w: 110, h: 160 },
    tomato: { x: 2948, y: 136, w: 130, h: 160 },
    berries: { x: 3110, y: 136, w: 150, h: 160 },
    grapes2: { x: 3302, y: 136, w: 110, h: 160 },
    pineapple: { x: 3454, y: 136, w: 150, h: 160 },
    melon: { x: 3637, y: 136, w: 130, h: 160 },
};

// Fuente: fila mediana (y=136–295) de fruits.png (3790×442px), tal como
// documenta snake-assets/sprites.js. Servida en /games/vibora/fruits.png.
export const FRUIT_SHEET_SRC = "/games/vibora/fruits.png";

export const FRUIT_POINTS: Record<keyof typeof FRUIT_ATLAS, number> = {
    banana: 10,
    grape: 10,
    cherry: 10,
    apple: 10,
    garlic: 10,
    orange: 20,
    strawberry: 20,
    tomato: 20,
    carrot: 20,
    lemon: 20,
    peanut: 20,
    peach: 35,
    mushroom: 35,
    eggplant: 35,
    broccoli: 35,
    pepper: 35,
    grapes2: 35,
    kiwi: 60,
    berries: 60,
    watermelon: 60,
    pineapple: 60,
    melon: 60,
};
```

Estado interno del motor (dentro del closure de `createViboraEngine`, sin estado de módulo):

```ts
type Point = { x: number; y: number }; // coordenadas de cuadrícula, no de píxel

let snake: Point[]; // [0] = cabeza
let dir: Point; // dirección actual aplicada, ej. {x:1,y:0}
let queuedDir: Point | null; // próximo cambio de dirección pendiente, 1 por paso
let fruit: { pos: Point; key: keyof typeof FRUIT_ATLAS } | null;
let score: number;
let fruitsEaten: number;
let level: number;
let moveInterval: number; // ms entre pasos de cuadrícula
let accumMs: number; // acumulador de tiempo desde el último paso
let lastTime: number | null;
let gameOver: boolean;
let rafId: number;
let spritesReady: boolean; // true tras onload de la imagen del atlas
```

Constantes de módulo (puras, sin estado): `CELL = 25`, `COLS = 32`, `ROWS = 24`, `W = 800`, `H = 600`, `FRUIT_ATLAS`, `FRUIT_POINTS`, `FRUIT_SHEET_SRC`.

## Plan de implementación

1. Insertar la fila `vibora` en `public.games` (Supabase) y verificar con un `SELECT` de vuelta que los siete campos quedaron correctos.
2. Copiar `references/templates/source-assets/snake-assets/fruits.png` a `public/games/vibora/fruits.png`. Crear `components/games/vibora/sprites.ts` con `FRUIT_ATLAS`, `FRUIT_SHEET_SRC` y `FRUIT_POINTS` (ver Modelo de datos).
3. Crear `components/games/vibora/engine.ts`: implementar `createViboraEngine(canvas)` con la cuadrícula, el paso de movimiento por `moveInterval`, el spawn de fruta en celda libre, el crecimiento al comer, la detección de colisión contra bordes y contra el propio cuerpo, el cálculo de `level`/`moveInterval` por frutas comidas, la carga diferida de `fruits.png` (con fallback a un rectángulo de color mientras `spritesReady` es `false`), el dibujo de la serpiente (bloques redondeados) y de la fruta activa (sprite recortado del atlas, escalado a la celda preservando aspect ratio), y el HUD propio (puntaje, nivel, longitud, controles). Listeners de teclado en `window`, agregados en el cuerpo de la factory y removidos en `destroy()`.
4. Crear `components/games/vibora/ViboraCanvas.tsx` replicando la estructura de `AsteroidsCanvas.tsx`/`TetrisCanvas.tsx`: efecto de montaje (crea el motor, conecta los 4 callbacks, `start()`, cleanup con `destroy()`) y efecto `[paused]` (`stop()`/`start()`).
5. Registrar en `components/games/registry.ts`: import de `ViboraCanvas` + entrada `vibora: ViboraCanvas`, orden alfabético (`arkanoid`, `asteroids`, `tetris`, `vibora`).
6. Agregar el bloque `.cover-vibora` en `app/globals.css` (vía `/frontend-design` para el motivo visual), antes del comentario `/* ===== detail screen ===== */`.
7. Correr `npx eslint .` y `npm run build`, corrigiendo lo que reporten.
8. Verificación manual end-to-end en `/juegos/vibora/jugar` siguiendo el checklist de la Fase 13 del skill `add-game` (catálogo, detalle, jugabilidad, persistencia del score, regresión de `rocas`/`asteroids`/`tetris`/`arkanoid`/`serpentina` y demás juegos decorativos).

## Criterios de aceptación

- [ ] `vibora` aparece como tarjeta jugable en `/biblioteca` con título "SNAKE", su propia portada (`.cover-vibora`) y en las tabs de `/salon`.
- [ ] `/juegos/vibora` muestra la ficha de detalle con la descripción larga y el mensaje de leaderboard vacío "Sé el primero en entrar al salón de la fama" (sin scores todavía).
- [ ] `/juegos/vibora/jugar` renderiza el Snake real dentro del CRT (cuadrícula 32×24, serpiente y fruta visibles), no el stub decorativo `game-arena`.
- [ ] El tablero llena el CRT de borde a borde sin letterboxing ni scrollbars.
- [ ] Las cuatro flechas cambian de dirección sin scrollear la página; presionar la dirección opuesta a la actual en el mismo paso no causa una colisión inmediata contra el propio cuello.
- [ ] El sprite de la fruta activa carga desde `/games/vibora/fruits.png` sin un 404 en la pestaña de red, recortado correctamente del atlas.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) se actualiza en tiempo real: Vidas pasa de 1 a 0 exactamente al perder, Nivel sube cada 5 frutas comidas.
- [ ] El HUD propio del juego (puntaje, nivel, longitud, controles) sigue dibujado en el canvas.
- [ ] Comer una fruta incrementa el puntaje exactamente en `FRUIT_POINTS[esa fruta]` y alarga la serpiente en un segmento.
- [ ] PAUSA congela el movimiento y las entradas de teclado; REANUDAR continúa sin salto de posición ni fruta reubicada.
- [ ] Chocar contra un borde del tablero o contra el propio cuerpo dispara automáticamente el modal de fin de juego con el puntaje final.
- [ ] El botón FIN fuerza el modal en cualquier momento.
- [ ] Guardar el puntaje en el modal inserta el score en Supabase (`game_id: 'vibora'`) y aparece en `/juegos/vibora` y en `/salon` al recargar.
- [ ] JUGAR DE NUEVO reinicia desde cero (serpiente de longitud inicial, score 0, nivel 1, vida 1, fruta nueva) — sin fuga de estado de módulo.
- [ ] Los juegos existentes (`arkanoid`, `asteroids`, `tetris`) y los decorativos (incluido `/juegos/rocas/jugar` y el que usa `.cover-snake`) siguen funcionando sin cambios.
- [ ] Agregar `vibora` no requirió condicionales hardcodeadas por juego en `components/game-player-screen.tsx`, ni ningún cambio a ese archivo.
- [ ] `npx eslint .` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** `id: "vibora"` en vez de `"snake"`. `"snake"` produciría la clase `cover-snake`, que ya existe en `app/globals.css` y pertenece al juego decorativo `serpentina` de SPEC 01 — reutilizarla habría hecho que la portada nueva se confundiera visualmente con una entrada ya existente del catálogo estático. Confirmado por el usuario tras presentarle la colisión y tres alternativas. `title` se mantiene como `"SNAKE"` — mismo patrón que `asteroids` (`id` real distinto del nombre de su clase `cover-rocas`).
- **Sí:** `cat: "ARCADE"`, `color: "green"` — `green` es el único de los cuatro colores permitidos aún sin usar en el catálogo (`arkanoid`=magenta, `asteroids`=yellow, `tetris`=cyan), y encaja temáticamente con la fruta/pasto.
- **Sí:** mecánica clásica de Snake con bordes sólidos (sin wrap-around, sin obstáculos internos) y una sola fruta en pantalla a la vez. Confirmado por el usuario (bloques de preguntas 1 y 2 del modo B).
- **Sí:** controles solo de flechas (`ArrowUp/Down/Left/Right`), sin WASD. Confirmado por el usuario.
- **Sí:** una sola vida real (no un mapeo artificial) — mismo criterio que Tetris (SPEC 07): `onLives(1)` al iniciar, `onLives(0)` + `onGameOver()` simultáneos al chocar. Confirmado por el usuario.
- **Sí:** puntos variados por tipo de fruta según la tabla `FRUIT_POINTS` (4 niveles: 10/20/35/60), en vez de un valor fijo — aprovecha las 22 variantes del atlas provisto. Confirmado por el usuario; la tabla concreta de valores es una decisión de diseño de este spec, no algo que el usuario haya fijado número por número.
- **Sí:** dificultad por niveles discretos — `level = floor(fruitsEaten/5)+1`, `moveInterval` baja un escalón fijo por nivel con piso de 60ms. Confirmado por el usuario, mismo criterio que Tetris (líneas → nivel).
- **Sí:** una fruta a la vez, reponiéndose al ser comida en una celda libre aleatoria. Confirmado por el usuario.
- **Sí:** serpiente dibujada vectorialmente (bloques redondeados en `var(--green)`), fruta dibujada con el sprite real del atlas provisto. Confirmado por el usuario — aprovecha el asset entregado sin descartarlo, y mantiene el contraste visual entre jugador y objetivo.
- **Sí:** HUD propio dibujado en el canvas, además del HUD de React — mismo patrón que los tres juegos reales existentes. Confirmado por el usuario.
- **Sí:** `FRUIT_ATLAS` se porta literal desde `snake-assets/sprites.js` (coordenadas ya analizadas por el autor original), sin recalcular recortes. La imagen binaria (`fruits.png`) va a `public/games/vibora/`; la data de coordenadas (`sprites.ts`) vive junto al motor en `components/games/vibora/`, siguiendo la regla de Fase 8 del skill `add-game`.
- **No:** sin audio, sin obstáculos internos, sin power-ups, sin wrap-around en los bordes. Confirmado por el usuario (bloque de preguntas 3) y por la elección de la mecánica clásica en el bloque 1.
- **No:** no se modifica `.cover-snake` ni la fila decorativa `serpentina` — son un juego distinto del catálogo que sigue con el simulador decorativo de SPEC 01.

## Riesgos

| Riesgo                                                                                                                                                                                                                                     | Mitigación                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta/desmonta el efecto de montaje dos veces en desarrollo, duplicando el `requestAnimationFrame` o los listeners de teclado.                                                                                           | `destroy()` cancela el `rafId` pendiente y remueve los listeners `keydown` de esa instancia, igual que `AsteroidsEngine`/`TetrisEngine`.                                                                            |
| Aceptar más de un cambio de dirección entre dos pasos de cuadrícula podría permitir un giro de 180° "instantáneo" (ej. Derecha→Arriba→Izquierda en el mismo frame) que choca contra el cuello sin que el jugador lo perciba como su culpa. | Solo se conserva **una** dirección en cola (`queuedDir`) por paso de cuadrícula, y se descarta cualquier cambio que revierta directamente la dirección actualmente aplicada (`dir`), no la última tecla presionada. |
| El spritesheet (3790×442px) tarda en cargar o falla la carga antes del primer frame.                                                                                                                                                       | La factory dibuja un rectángulo de color como fallback mientras `spritesReady` es `false`, igual que el patrón de Fase 8 del skill `add-game`.                                                                      |
| Un `id` de Supabase (`vibora`) desalineado con la clave de `GAME_REGISTRY` haría que la página caiga silenciosamente al stub decorativo `game-arena` sin error visible.                                                                    | Verificar carácter por carácter en la Fase 9 del skill `add-game` antes de dar la tarea por terminada; incluido como criterio de aceptación explícito.                                                              |
| `dt`/`accumMs` sin clamp tras una pausa larga podría acumular varios pasos de cuadrícula de golpe al reanudar, moviendo la serpiente varias celdas en un solo frame visible.                                                               | `loop(ts)` clampa el delta igual que `engine.ts` de Asteroids/Tetris (`Math.min((ts-lastTime)/1000, 0.05)`), y `lastTime`/`accumMs` se resetean en `start()`.                                                       |

## Qué **no** está en este spec

- Cualquier otro juego del catálogo, incluido `serpentina`/`.cover-snake`.
- Wrap-around, obstáculos internos y power-ups.
- Controles táctiles / móviles.
- Audio / efectos de sonido.
- RLS en Supabase.
- Cambios a `game-player-screen.tsx`, `types.ts` o `lib/supabase/*`.

Cada uno de estos, si se implementa, va en su propio spec.
