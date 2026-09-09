# SPEC 07 — Juego real: TETRIS

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-09-09
> **Objetivo:** Agregar TETRIS al catálogo como juego real (`id: "tetris"`), portando `references/templates/started-games/03-tetris/game.js` al patrón de registro genérico de SPEC 05 y a las tablas `games`/`scores` de Supabase de SPEC 06.

## Scope

**In:**

- Nueva fila en `public.games` (Supabase): `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetris"`, `short`/`long` según el copy confirmado en el Modelo de datos.
- `components/games/tetris/engine.ts`: port de `game.js` a TypeScript dentro de `createTetrisEngine(canvas): TetrisEngine`, con `start()`, `stop()`, `destroy()`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`. Sin estado de módulo global — todo el `let` a nivel de módulo del original (`board`, `current`, `next`, `score`, `lines`, `level`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) vive en el closure de la factory.
- `components/games/tetris/TetrisCanvas.tsx`: Client Component que implementa `GamePlayerProps`, mismo patrón de 52 líneas que `AsteroidsCanvas.tsx` (efecto de montaje con cleanup vía `destroy()`, efecto separado sobre `[paused]` que llama `stop()`/`start()`).
- Registro: una línea de import y una entrada `tetris: TetrisCanvas` en `components/games/registry.ts`, manteniendo orden alfabético (`asteroids`, `tetris`).
- Bloque CSS `.cover-tetris` en `app/globals.css`, al final de la sección de portadas, antes del comentario `/* ===== detail screen ===== */`, con motivo visual propio (tetrominós/bloques), visualmente distinto de `.cover-tetro` ya existente. Se invoca `/frontend-design` para esta pieza.
- Canvas lógico fijo 800×600:
    - Tablero (canvas primario, `300×600`, `BLOCK=30`) **centrado horizontalmente** (`x=250`), llenando el alto completo (`20×30=600=H`).
    - Preview de la siguiente pieza (`120×120`, `NB=30`) a la derecha del tablero, **desalineado**: no comparte el mismo centro vertical (`x≈610, y≈40`).
    - HUD propio dibujado en canvas (`SCORE`, `LINEAS`, `NIVEL`, lista de controles) replicando el contenido del sidebar del `index.html` original — se conserva completo, solo reposicionado.
- Controles de teclado (`e.code`): `ArrowLeft`/`ArrowRight` mover, `ArrowUp` o `KeyX` rotar CW con wall kicks `[0,-1,1,-2,2]`, `ArrowDown` soft drop (+1 pt/fila), `Space` con `preventDefault()` hard drop (+2 pt/celda).
- Scoring idéntico al original: `LINE_SCORES=[0,100,300,500,800] × level` al limpiar líneas.
- Nivel real vía `onLevel`: `level = floor(lines/10) + 1`, reportado en cada cambio.
- Vidas: Tetris tiene **1 vida real** en esta plataforma. `onLives(1)` al iniciar la partida; al perder esa única vida (pieza nueva colisiona al aparecer) se emiten `onLives(0)` y `onGameOver()` en el mismo instante. Sin reaparición ni temporizador de muerte (a diferencia de Asteroids).
- Se conserva la pieza extra "N" (tuerca, índice 8, gris `#9e9e9e`) presente en el array `PIECES` del template aunque no está documentada en su `README.md` — se porta el comportamiento real del código, no la documentación desactualizada.
- Se conserva la pieza fantasma (`ghostY`, dibujada a `alpha=0.2`) — es mecánica de juego, no chrome.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio a `components/game-player-screen.tsx`, `components/games/types.ts`, `lib/supabase/types.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- Cualquier otro juego del catálogo (`asteroids` ni las filas decorativas existentes).
- RLS en Supabase — sigue deshabilitado; riesgo ya aceptado en SPEC 06.
- Controles táctiles / móviles.
- Audio / efectos de sonido — el template no trae ninguno.
- Theme toggle (claro/oscuro) propio del template — se descarta, es chrome de la app standalone.
- Tecla `P` de pausa propia del template — se elimina; la pausa la controla exclusivamente `game-player-screen.tsx` vía la prop `paused`.
- Botón de reinicio propio del template (`restartBtn`) y overlay propio de PAUSA/GAME OVER (`#overlay`) — se eliminan; React reinicia por `key={playCount}` y muestra su propio modal.
- Rutas nuevas — `/juegos/[id]/jugar` sigue siendo genérica.

## Modelo de datos

No se introducen tablas ni columnas nuevas. Se reutilizan `GameRow` y `ScoreRow` de `lib/supabase/types.ts` sin cambios (SPEC 06). Solo crece la tabla `games` con una fila más:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'tetris', 'TETRIS',
  'Encaja piezas y despeja líneas antes de que te desborden.',
  'Bloques de siete formas —más una pieza especial— caen desde arriba. Muévelos con ← →, rótalos con ↑ o X, acelera la caída con ↓ o remátala al instante con Espacio. Completa filas para despejarlas: subes de nivel cada 10 líneas y la caída se acelera.',
  'PUZZLE', 'cover-tetris', 'cyan'
);
```

Estado interno del motor (dentro del closure de `createTetrisEngine`, sin estado de módulo):

```ts
let board: number[][]; // ROWS×COLS, 0=vacío, 1-8=índice de color
let current: { type: number; shape: number[][]; x: number; y: number };
let next: typeof current;
let score: number;
let lines: number;
let level: number;
let gameOver: boolean;
let lastTime: number | null;
let dropAccum: number;
let dropInterval: number;
let rafId: number;
```

## Plan de implementación

1. Insertar la fila `tetris` en `public.games` (Supabase) y verificar con un `SELECT` de vuelta que los siete campos quedaron correctos.
2. Crear `components/games/tetris/engine.ts`: portar `game.js` completo (`createBoard`, `randomPiece` con las 8 piezas, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `drawBlock`, `drawGrid`, dibujo del tablero, dibujo del preview, `drawHUD` propio) dentro de `createTetrisEngine(canvas)`, con el estado del Modelo de datos movido al closure. Se elimina `endGame`/`togglePause`/el listener de `KeyP`/`restartBtn`/el theme toggle del original; al llegar a game over el motor se detiene, llama `onLives(0)` y `onGameOver()` sin reiniciar. Listeners de teclado en `window`, agregados en el cuerpo de la factory y removidos en `destroy()`.
3. Crear `components/games/tetris/TetrisCanvas.tsx` replicando la estructura de `AsteroidsCanvas.tsx`: efecto de montaje (crea el motor, conecta los 4 callbacks, `start()`, cleanup con `destroy()`) y efecto `[paused]` (`stop()`/`start()`).
4. Registrar en `components/games/registry.ts`: import de `TetrisCanvas` + entrada `tetris: TetrisCanvas`, orden alfabético.
5. Agregar el bloque `.cover-tetris` en `app/globals.css` (vía `/frontend-design` para el motivo visual), antes del comentario `/* ===== detail screen ===== */`.
6. Correr `npx eslint .` y `npm run build`, corrigiendo lo que reporten.
7. Verificación manual end-to-end en `/juegos/tetris/jugar` siguiendo el checklist de la Fase 13 del skill `add-game` (catálogo, detalle, jugabilidad, persistencia del score, regresión de `rocas`/`asteroids`/otros juegos decorativos).

## Criterios de aceptación

- [ ] `tetris` aparece como tarjeta jugable en `/biblioteca` con su propia portada (`.cover-tetris`) y en las tabs de `/salon`.
- [ ] `/juegos/tetris` muestra la ficha de detalle con la descripción larga y el mensaje de leaderboard vacío "Sé el primero en entrar al salón de la fama" (sin scores todavía).
- [ ] `/juegos/tetris/jugar` renderiza el Tetris real dentro del CRT (tablero centrado, preview de siguiente pieza a la derecha), no el stub decorativo `game-arena`.
- [ ] El tablero llena el CRT de borde a borde sin letterboxing ni scrollbars, y queda centrado horizontalmente dentro del canvas de 800×600.
- [ ] `ArrowLeft`/`ArrowRight` mueven la pieza, `ArrowUp`/`KeyX` rotan con wall kicks, `ArrowDown` hace soft drop, `Space` hace hard drop, sin scrollear la página.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) se actualiza en tiempo real: Vidas pasa de 1 a 0 exactamente al perder, Nivel sube cada 10 líneas.
- [ ] El HUD propio del juego (SCORE, LINEAS, NIVEL, preview de siguiente pieza, lista de controles) sigue dibujado en el canvas, replicando el sidebar del template original.
- [ ] PAUSA congela la caída y las entradas de teclado; REANUDAR continúa sin salto de `dt` ni pieza teletransportada.
- [ ] Al perder la única vida (pieza nueva colisiona al aparecer) se dispara automáticamente el modal de fin de juego con el puntaje final.
- [ ] El botón FIN fuerza el modal en cualquier momento.
- [ ] Guardar el puntaje en el modal inserta el score en Supabase (`game_id: 'tetris'`) y aparece en `/juegos/tetris` y en `/salon` al recargar.
- [ ] JUGAR DE NUEVO reinicia desde cero (tablero vacío, score 0, líneas 0, nivel 1, vida 1) — sin fuga de estado de módulo.
- [ ] Los juegos decorativos (ej. `/juegos/rocas/jugar`) y `asteroids` siguen funcionando sin cambios.
- [ ] Agregar `tetris` no requirió condicionales hardcodeadas por juego en `components/game-player-screen.tsx`, ni ningún cambio a ese archivo.
- [ ] `npx eslint .` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** `id: "tetris"`, `cat: "PUZZLE"`, `color: "cyan"` (sin usar aún, no colisiona con `yellow` de `asteroids`), `cover: "cover-tetris"` — confirmados contra `GAME_REGISTRY`, la tabla `games` en vivo y `app/globals.css`, sin colisiones.
- **Sí:** Tetris se modela con **1 vida real**, no un mapeo artificial por carecer del concepto. Confirmado por el usuario: "Todos los juegos tienen vidas y en este caso Tetris solo tiene una vida, cuando pierdes esa vida hasta allí llega el juego." `onLives(1)` al iniciar, `onLives(0)` + `onGameOver()` simultáneos al perderla.
- **Sí:** se conserva la pieza extra "N" (índice 8, tuerca gris) presente en el código del template aunque el `README.md` solo documenta 7 piezas — se porta el comportamiento real, no la documentación desactualizada.
- **Sí:** layout del canvas — el tablero (canvas primario) queda centrado horizontalmente en los 800×600; el preview de siguiente pieza (canvas secundario) queda desalineado, corrido a la derecha, sin compartir el mismo centro vertical. Confirmado explícitamente por el usuario tras una propuesta inicial que centraba ambos.
- **Sí:** el HUD interno del juego se conserva completo (SCORE/LINEAS/NIVEL/preview/controles), replicando el sidebar del template "tal cual", solo reposicionado — confirmado por el usuario, no se resume ni se recorta. El HUD externo de React (Puntuación/Vidas/Nivel) se mantiene por separado, alimentado por los mismos callbacks — ambos conviven, ninguno reemplaza al otro.
- **No:** no se porta la tecla `P` de pausa propia ni el botón de reinicio del template — la pausa y el reinicio ya los controla `game-player-screen.tsx` (SPEC 05).
- **No:** sin audio — el template no trae ninguno.
- **No:** sin theme toggle propio (claro/oscuro) — es chrome de la app standalone del template, no del juego.

## Riesgos

| Riesgo                                                                                                                                                                  | Mitigación                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React Strict Mode monta/desmonta el efecto de montaje dos veces en desarrollo, duplicando el `requestAnimationFrame` o los listeners de teclado.                        | `destroy()` cancela el `rafId` pendiente y remueve los listeners `keydown`/`keyup` de esa instancia, igual que `AsteroidsEngine` (SPEC 05).            |
| Un `id` de Supabase (`tetris`) desalineado con la clave de `GAME_REGISTRY` haría que la página caiga silenciosamente al stub decorativo `game-arena` sin error visible. | Verificar carácter por carácter en la Fase 9 del skill `add-game` antes de dar la tarea por terminada; incluido como criterio de aceptación explícito. |
| `dt` sin clamp tras una pausa larga podría hacer que `dropAccum` se dispare y la pieza caiga varias filas de golpe al reanudar.                                         | `loop(ts)` clampa `dt` igual que en `engine.ts` de Asteroids (`Math.min((ts-lastTime)/1000, 0.05)`) y `lastTime` se resetea a `null` en `start()`.     |

## Qué **no** está en este spec

- Cualquier otro juego del catálogo.
- Controles táctiles / móviles.
- Audio / efectos de sonido.
- RLS en Supabase.
- Cambios a `game-player-screen.tsx`, `types.ts` o `lib/supabase/*`.

Cada uno de estos, si se implementa, va en su propio spec.
